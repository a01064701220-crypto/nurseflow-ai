import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import {
  getFirestore,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Cloud Firestore using the configured database ID
export const db: Firestore = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);

export const DEFAULT_NURSE_EMAIL = 'yang.rn@hospital.mock';
export const DEFAULT_NURSE_PASSWORD = 'NurseFlow2026!';

let inFlightAuthPromise: Promise<User> | null = null;

/**
 * Ensures the user is authenticated with Firebase (signs in with nurse credentials or anonymously)
 */
export async function ensureAuthenticated(): Promise<User> {
  if (auth.currentUser) {
    return auth.currentUser;
  }
  if (inFlightAuthPromise) {
    return inFlightAuthPromise;
  }

  inFlightAuthPromise = new Promise<User>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        unsubscribe();
        resolve(user);
      } else {
        // Try sign in with default nurse email, or fallback to anonymous auth
        try {
          const userCredential = await signInWithEmailAndPassword(
            auth,
            DEFAULT_NURSE_EMAIL,
            DEFAULT_NURSE_PASSWORD
          );
          unsubscribe();
          resolve(userCredential.user);
        } catch (emailErr: any) {
          try {
            // If user doesn't exist, create it
            if (emailErr.code === 'auth/user-not-found' || emailErr.code === 'auth/invalid-credential') {
              try {
                const newCred = await createUserWithEmailAndPassword(
                  auth,
                  DEFAULT_NURSE_EMAIL,
                  DEFAULT_NURSE_PASSWORD
                );
                unsubscribe();
                resolve(newCred.user);
                return;
              } catch {
                // fall through to anonymous
              }
            }
            // Fallback to anonymous auth
            const anonCred = await signInAnonymously(auth);
            unsubscribe();
            resolve(anonCred.user);
          } catch (anonErr) {
            console.warn('Firebase Auth fallback warning:', anonErr);
            // Even if auth fails, resolve with any state so UI doesn't freeze
            unsubscribe();
            resolve(auth.currentUser as User);
          }
        }
      }
    });
  }).finally(() => {
    inFlightAuthPromise = null;
  });

  return inFlightAuthPromise;
}
