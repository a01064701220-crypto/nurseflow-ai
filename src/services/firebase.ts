import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User,
} from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db: Firestore = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);

/** Authentication is explicit. A session QR never signs a user in. */
export function waitForAuthState(): Promise<User | null> {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        resolve(user);
      },
      (error) => {
        unsubscribe();
        reject(error);
      }
    );
  });
}

export async function ensureAuthenticated(): Promise<User> {
  const user = auth.currentUser || (await waitForAuthState());
  if (!user || user.isAnonymous) {
    throw new Error('승인된 간호사 로그인이 필요합니다.');
  }
  return user;
}

export async function signInNurse(): Promise<void> {
  // Embedded messaging-app browsers often block the storage used by Google's
  // OAuth helper. Do not send the user into a redirect page that cannot recover.
  const browserAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/(KAKAOTALK|FBAN|FBAV|Instagram|Line\/|NAVER\(|; wv\))/i.test(browserAgent)) {
    throw new Error('앱 안의 브라우저에서는 Google 로그인이 제한될 수 있습니다. NurseFlow AI 주소를 복사해 Safari 또는 Chrome에서 직접 열어 주세요.');
  }
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (error: any) {
    if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }
    if (error?.code === 'auth/web-storage-unsupported') {
      throw new Error('브라우저 저장소를 사용할 수 없어 로그인하지 못했습니다. Safari 또는 Chrome에서 앱 주소를 직접 열어 주세요.');
    }
    throw error;
  }
}

export function signOutNurse(): Promise<void> {
  return signOut(auth);
}
