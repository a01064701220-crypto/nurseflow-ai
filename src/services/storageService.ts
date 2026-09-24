import {
  Nurse,
  Patient,
  MedicationOrder,
  DemoSession,
  NursingEvent,
  NursingRecord,
  EMRTransfer,
  EventType,
  EventSource,
  isStep4,
  isStep5,
} from '../types';
import { db, ensureAuthenticated } from './firebase';
import { assertSessionAccess, loadApprovedNurse } from './accessService';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  arrayUnion,
  runTransaction,
  writeBatch,
  query,
  where,
  Unsubscribe,
} from 'firebase/firestore';

/**
 * Strips any property whose value is undefined.
 * Firestore setDoc strictly throws on undefined values!
 */
export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeForFirestore(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export const DEFAULT_NURSE: Nurse = {
  nurseId: 'NURSE-2026-001',
  nurseName: '양두영',
  licenseNumber: 'RN-89412',
  department: '내과 병동 5W',
  shift: 'DAY',
  role: 'PRIMARY_RN',
  email: 'yang.rn@hospital.mock',
};

export const DEFAULT_PATIENT: Patient = {
  id: 'TEST-P001',
  name: '홍길동',
  gender: 'M',
  age: 65,
  room: '305호-B',
  department: '내과 병동 5W',
  diagnosis: '폐렴 의증 (R/O Pneumonia) [가상 시나리오]',
  admissionDate: '2026-09-21',
  attendingPhysician: '김교수 (내과)',
  bloodType: 'A+',
  allergies: ['특이 알레르기 없음 (NKDA)'],
  bedNumber: 'Bed 2',
};

export const DEFAULT_PRESCRIPTION: MedicationOrder = {
  id: 'RX-2026-0923-004',
  prescriptionId: 'RX-2026-0923-004',
  patientId: 'TEST-P001',
  medicationName: '모의 IV 항생제 A',
  route: 'IV (정맥주사)',
  status: 'PENDING_VERIFY',
  dosage: '1 vial / 모의 처방',
  instructions: '정맥 내 점적 주입 (교육용 가상 데이터)',
  prescribedDoctor: '김교수 (내과)',
  orderTime: '08:30',
  isEducationalMock: true,
  barcodeValue: 'RX-2026-0923-004',
};

const STORAGE_KEYS = {
  NURSE: 'nurseflow_nurse_v1',
  PATIENT: 'nurseflow_patient_v1',
  PRESCRIPTION: 'nurseflow_prescription_v1',
  CURRENT_SESSION: 'nurseflow_current_session_v1',
  SESSIONS: 'nurseflow_sessions_v1',
  EVENTS: 'nurseflow_events_v1',
  SESSION_EVENTS_PREFIX: 'nurseflow_events_session_',
  LOCAL_BACKUP_EVENTS: 'nurseflow_local_backup_events_v1',
  DRAFT: 'nurseflow_draft_v1',
  EMR_RECORDS: 'nurseflow_emr_records_v1',
  PREFERRED_MODE: 'nurseflow_preferred_mode',
};

// BroadCastChannel for same-origin tabs/windows sync
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('nurseflow_realtime_sync');
  }
} catch (e) {
  console.warn('BroadcastChannel fallback:', e);
}

type SyncCallback = (data: { type: string; payload: any }) => void;
const syncListeners = new Set<SyncCallback>();

if (broadcastChannel) {
  broadcastChannel.onmessage = (event) => {
    if (event && event.data) {
      syncListeners.forEach((callback) => {
        try {
          callback(event.data);
        } catch (err) {
          console.error('Error in sync listener callback:', err);
        }
      });
    }
  };
}

let activeFirestoreUnsub: Unsubscribe | null = null;
let currentListeningSessionId: string | null = null;

export class StorageService {
  static subscribe(callback: SyncCallback): () => void {
    syncListeners.add(callback);
    return () => {
      syncListeners.delete(callback);
    };
  }

  static broadcast(type: string, payload: any) {
    syncListeners.forEach((cb) => {
      try {
        cb({ type, payload });
      } catch (err) {
        console.error(err);
      }
    });

    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({ type, payload, timestamp: Date.now() });
      } catch (e) {
        console.warn('Broadcast failed:', e);
      }
    }
  }

  static isFirebaseConfigured(): boolean {
    return true;
  }

  // Nurse
  static loadNurse(): Nurse {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.NURSE);
      return data ? JSON.parse(data) : DEFAULT_NURSE;
    } catch {
      return DEFAULT_NURSE;
    }
  }

  // Patient
  static loadPatient(): Patient {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PATIENT);
      return data ? JSON.parse(data) : DEFAULT_PATIENT;
    } catch {
      return DEFAULT_PATIENT;
    }
  }

  // Prescription
  static loadPrescription(): MedicationOrder {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRESCRIPTION);
      return data ? JSON.parse(data) : DEFAULT_PRESCRIPTION;
    } catch {
      return DEFAULT_PRESCRIPTION;
    }
  }

  static async savePrescription(prescription: MedicationOrder): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.PRESCRIPTION, JSON.stringify(prescription));
      this.broadcast('PRESCRIPTION_UPDATED', prescription);

      // Master order data stays read-only; session events carry status changes.
    } catch (e) {
      console.error('Failed to save prescription:', e);
    }
  }

  // Session Management
  static getCurrentSession(): DemoSession {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION);
      if (data) return JSON.parse(data);
    } catch {}

    const initialSession: DemoSession = {
      sessionId: `SES-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-001`,
      sessionNumber: 1,
      nurseId: DEFAULT_NURSE.nurseId,
      patientId: DEFAULT_PATIENT.id,
      status: 'ACTIVE',
      startedAt: new Date().toLocaleTimeString('ko-KR', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      }),
      eventsCount: 0,
      emrTransmitted: false,
      lastSyncAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(initialSession));
    } catch {}

    return initialSession;
  }

  /**
   * Guarantees that the session document exists in Firestore (critical for security rules and multi-device lookup)
   */
  static async ensureSessionInFirestore(session: DemoSession, write = false): Promise<void> {
    try {
      const user = await ensureAuthenticated();
      const sessionRef = doc(db, 'demoSessions', session.sessionId);
      const snap = await getDoc(sessionRef);
      if (!snap.exists()) throw new Error('클라우드에 세션이 없습니다.');
      assertSessionAccess(snap.data() as DemoSession, user.uid, write);
    } catch (err) {
      console.error('ensureSessionInFirestore error:', err);
      throw err;
    }
  }

  /**
   * Fetch session directly from Firestore by full sessionId
   */
  static async fetchSessionFromFirestore(sessionId: string): Promise<DemoSession | null> {
    try {
      const user = await ensureAuthenticated();
      const snap = await getDoc(doc(db, 'demoSessions', sessionId));
      if (snap.exists()) {
        const session = snap.data() as DemoSession;
        assertSessionAccess(session, user.uid);
        return session;
      }
      return null;
    } catch (err: any) {
      if (err?.code === 'permission-denied' || err?.message?.includes('insufficient permissions')) {
        throw new Error('Station에서 먼저 참여 승인이 필요합니다. Station 화면의 [간호사 교대 관리]에서 참여자로 등록해 주세요.');
      }
      console.error('fetchSessionFromFirestore error:', err);
      throw err;
    }
  }

  /**
   * Fetch all events directly from Firestore for a specific sessionId
   */
  static async fetchSessionEventsFromFirestore(sessionId: string): Promise<NursingEvent[]> {
    try {
      await this.fetchSessionFromFirestore(sessionId);
      const eventsCol = collection(db, 'nursingEvents');
      const q = query(eventsCol, where('sessionId', '==', sessionId));
      const snap = await getDocs(q);
      const remoteEvents: NursingEvent[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as NursingEvent;
        if (data.sessionId === sessionId) {
          remoteEvents.push(data);
        }
      });
      remoteEvents.sort(
        (a, b) =>
          new Date(a.rawDate || a.occurredAt || a.createdAt || '').getTime() -
          new Date(b.rawDate || b.occurredAt || b.createdAt || '').getTime()
      );
      this.saveSessionEvents(sessionId, remoteEvents);
      return remoteEvents;
    } catch (err) {
      console.error('fetchSessionEventsFromFirestore error:', err);
      throw err;
    }
  }

  /**
   * Fetch all registered demoSessions from Firestore
   */
  static async loadAllSessions(): Promise<DemoSession[]> {
    try {
      const user = await ensureAuthenticated();
      await loadApprovedNurse();
      const snap = await getDocs(query(collection(db, 'demoSessions'), where('participantUids', 'array-contains', user.uid)));
      const list: DemoSession[] = [];
      snap.forEach((d) => {
        list.push(d.data() as DemoSession);
      });
      list.sort((a, b) => {
        if (b.startedAt && a.startedAt) {
          return b.startedAt.localeCompare(a.startedAt);
        }
        return (b.sessionNumber || 0) - (a.sessionNumber || 0);
      });
      return list;
    } catch (err) {
      console.error('loadAllSessions error:', err);
      return [];
    }
  }

  /**
   * Verify and join an existing session on Mobile Capture or Station
   * Fails explicitly if the session does not exist in Cloud Firestore.
   * Loads the existing events belonging to this session so they are not wiped!
   */
  static async verifyAndJoinSession(
    sessionId: string
  ): Promise<{ success: boolean; session?: DemoSession; events?: NursingEvent[]; error?: string }> {
    try {
      const user = await ensureAuthenticated();
      await loadApprovedNurse();
      const remoteSession = await this.fetchSessionFromFirestore(sessionId);

      if (!remoteSession) {
        return {
          success: false,
          error: `클라우드 Firestore에서 세션 [${sessionId}]을(를) 찾을 수 없습니다. Station 화면의 QR 코드를 다시 확인해 주세요.`,
        };
      }
      assertSessionAccess(remoteSession, user.uid);

      // Fetch actual events from Firestore for this specific session
      const events = await this.fetchSessionEventsFromFirestore(sessionId);

      // Save locally under session-scoped key
      localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(remoteSession));
      this.saveSessionEvents(sessionId, events);

      return { success: true, session: remoteSession, events };
    } catch (err: any) {
      console.error('verifyAndJoinSession error:', err);
      const isPermError =
        err?.code === 'permission-denied' ||
        err?.message?.includes('insufficient permissions') ||
        err?.message?.includes('참여 승인') ||
        err?.message?.includes('접근 권한');
      return {
        success: false,
        error: isPermError
          ? 'Station에서 먼저 참여 승인이 필요합니다. Station 화면의 [간호사 교대 관리]에서 참여자로 등록해 주세요.'
          : (err.message || '세션 확인 중 클라우드 오류가 발생했습니다.'),
      };
    }
  }

  static setCurrentSession(session: DemoSession): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(session));
      this.broadcast('NEW_SESSION_STARTED', session);

      // Selecting a session never creates or changes the server document.
    } catch (e) {
      console.error('Failed to set current session:', e);
    }
  }

  static async startNewSession(): Promise<DemoSession> {
    const user = await ensureAuthenticated();
    const nurse = await loadApprovedNurse();
    const current = this.getCurrentSession();
    // Backup existing events before starting new session
    const existingEvents = this.loadEvents(current?.sessionId);
    if (existingEvents.length > 0) {
      try {
        const backup = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOCAL_BACKUP_EVENTS) || '[]');
        localStorage.setItem(
          STORAGE_KEYS.LOCAL_BACKUP_EVENTS,
          JSON.stringify([...backup, ...existingEvents])
        );
      } catch (err) {
        console.warn('Backup error:', err);
      }
    }

    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const newSession: DemoSession = {
      sessionId: `SES-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomSuffix}`,
      sessionNumber: (current?.sessionNumber || 1) + 1,
      nurseId: nurse.nurseId,
      ownerUid: user.uid,
      participantUids: [user.uid],
      activeNurseUid: user.uid,
      patientId: DEFAULT_PATIENT.id,
      status: 'ACTIVE',
      startedAt: new Date().toLocaleTimeString('ko-KR', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      }),
      eventsCount: 0,
      emrTransmitted: false,
      lastSyncAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'demoSessions', newSession.sessionId), newSession);

    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(newSession));
      this.saveSessionEvents(newSession.sessionId, []);
      localStorage.removeItem(STORAGE_KEYS.DRAFT);
      localStorage.setItem(STORAGE_KEYS.PRESCRIPTION, JSON.stringify(DEFAULT_PRESCRIPTION));
    } catch (e) {
      console.error('Failed to start new session locally:', e);
    }

    this.broadcast('NEW_SESSION_STARTED', newSession);

    return newSession;
  }

  static async addSessionParticipant(sessionId: string, participantUid: string): Promise<DemoSession> {
    const user = await ensureAuthenticated();
    const session = await this.fetchSessionFromFirestore(sessionId);
    if (!session || session.ownerUid !== user.uid) throw new Error('세션 소유자만 참여자를 승인할 수 있습니다.');
    const participant = await getDoc(doc(db, 'nurses', participantUid));
    if (!participant.exists() || participant.data().approved !== true) throw new Error('승인된 간호사 계정만 참여할 수 있습니다.');
    await updateDoc(doc(db, 'demoSessions', sessionId), {
      participantUids: arrayUnion(participantUid),
      lastSyncAt: new Date().toISOString(),
    });
    const updated = await this.fetchSessionFromFirestore(sessionId);
    if (!updated) throw new Error('참여자 추가 후 세션을 다시 읽지 못했습니다.');
    return updated;
  }

  static async handoffSession(sessionId: string, nextUid: string): Promise<DemoSession> {
    const user = await ensureAuthenticated();
    const nurse = await loadApprovedNurse();
    const sessionRef = doc(db, 'demoSessions', sessionId);
    const now = new Date().toISOString();
    const eventId = `evt_handoff_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(sessionRef);
      if (!snapshot.exists()) throw new Error('세션을 찾을 수 없습니다.');
      const session = snapshot.data() as DemoSession;
      assertSessionAccess(session, user.uid, true);
      if (!(session.participantUids || []).includes(nextUid)) throw new Error('먼저 새 담당 간호사의 참여를 승인해 주세요.');
      if (nextUid === user.uid) throw new Error('현재 담당 간호사와 같은 계정입니다.');
      const event: NursingEvent = {
        eventId,
        sessionId,
        patientId: session.patientId || DEFAULT_PATIENT.id,
        nurseId: nurse.nurseId,
        nurseUid: user.uid,
        nurseName: nurse.nurseName,
        eventType: 'NURSE_HANDOFF',
        source: 'MANUAL_CONFIRMATION',
        eventSource: 'Manual Confirmation',
        eventDescription: '담당 간호사 교대 승인',
        occurredAt: now,
        createdAt: now,
        metadata: { fromUid: user.uid, toUid: nextUid },
      };
      transaction.set(doc(db, 'nursingEvents', eventId), event);
      transaction.update(sessionRef, { activeNurseUid: nextUid, lastSyncAt: now });
    });
    const updated = await this.fetchSessionFromFirestore(sessionId);
    if (!updated) throw new Error('교대 후 세션을 다시 읽지 못했습니다.');
    return updated;
  }

  // Events Management (Strictly session-scoped)
  static loadEvents(targetSessionId?: string): NursingEvent[] {
    try {
      const sid = targetSessionId || this.getCurrentSession().sessionId;
      // 1. Session-scoped storage key
      const sessionKey = `${STORAGE_KEYS.SESSION_EVENTS_PREFIX}${sid}`;
      const sessionData = localStorage.getItem(sessionKey);
      if (sessionData) {
        const parsed: NursingEvent[] = JSON.parse(sessionData);
        return parsed.filter((e) => e.sessionId === sid);
      }

      // 2. Generic fallback key, but strictly filter by sid
      const data = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (data) {
        const all: NursingEvent[] = JSON.parse(data);
        const filtered = all.filter((e) => e.sessionId === sid);
        if (filtered.length > 0) {
          localStorage.setItem(sessionKey, JSON.stringify(filtered));
        }
        return filtered;
      }
      return [];
    } catch {
      return [];
    }
  }

  static saveSessionEvents(sessionId: string, events: NursingEvent[]): void {
    try {
      const filtered = events.filter((e) => e.sessionId === sessionId);
      const sessionKey = `${STORAGE_KEYS.SESSION_EVENTS_PREFIX}${sessionId}`;
      localStorage.setItem(sessionKey, JSON.stringify(filtered));

      // Also update generic key for compatibility without corrupting other sessions
      let allEvents: NursingEvent[] = [];
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.EVENTS);
        if (raw) {
          allEvents = (JSON.parse(raw) as NursingEvent[]).filter((e) => e.sessionId !== sessionId);
        }
      } catch {}
      allEvents = [...allEvents, ...filtered];
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(allEvents));

      const session = this.getCurrentSession();
      if (session.sessionId === sessionId) {
        session.eventsCount = filtered.length;
        session.lastSyncAt = new Date().toISOString();
        localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(session));
      }

      this.broadcast('EVENTS_UPDATED', { sessionId, events: filtered });
    } catch (e) {
      console.error('Failed to save session events:', e);
    }
  }

  static saveEvents(events: NursingEvent[]): void {
    const session = this.getCurrentSession();
    this.saveSessionEvents(session.sessionId, events);
  }

  /**
   * Start Firestore real-time onSnapshot listener for the exact sessionId.
   * Defensively cancels zombie listeners and ignores stale asynchronous callbacks.
   */
  static listenToSessionEvents(
    sessionId: string,
    onEventsReceived: (events: NursingEvent[], source: 'server' | 'cache') => void,
    onError?: (err: any) => void
  ): () => void {
    let isCancelled = false;
    let localUnsub: Unsubscribe | null = null;

    if (activeFirestoreUnsub) {
      try {
        activeFirestoreUnsub();
      } catch {}
      activeFirestoreUnsub = null;
    }
    currentListeningSessionId = sessionId;

    this.fetchSessionFromFirestore(sessionId)
      .then(() => {
        if (isCancelled) return;
        try {
          const eventsCol = collection(db, 'nursingEvents');
          const q = query(eventsCol, where('sessionId', '==', sessionId));

          localUnsub = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const remoteEvents: NursingEvent[] = [];
              snapshot.forEach((docSnap) => {
                const data = docSnap.data() as NursingEvent;
                // Strict defensive check: verify data.sessionId === sessionId
                if (data.sessionId === sessionId) {
                  remoteEvents.push(data);
                }
              });

              // Sort chronologically by rawDate or occurredAt
              remoteEvents.sort(
                (a, b) =>
                  new Date(a.rawDate || a.occurredAt || a.createdAt || '').getTime() -
                  new Date(b.rawDate || b.occurredAt || b.createdAt || '').getTime()
              );

              // Update session storage and notify caller
              StorageService.saveSessionEvents(sessionId, remoteEvents);
              const source = snapshot.metadata.fromCache ? 'cache' : 'server';
              onEventsReceived(remoteEvents, source);
            },
            (error) => {
              if (isCancelled) return;
              console.error(`Firestore onSnapshot error for session ${sessionId}:`, error);
              if (onError) onError(error);
            }
          );

          if (isCancelled) {
            localUnsub();
            localUnsub = null;
          } else {
            activeFirestoreUnsub = localUnsub;
          }
        } catch (err) {
          if (!isCancelled && onError) onError(err);
        }
      })
      .catch((authErr) => {
        if (!isCancelled && onError) onError(authErr);
      });

    return () => {
      isCancelled = true;
      if (localUnsub) {
        try {
          localUnsub();
        } catch {}
        localUnsub = null;
      }
      if (activeFirestoreUnsub === localUnsub) {
        activeFirestoreUnsub = null;
      }
      if (currentListeningSessionId === sessionId) {
        currentListeningSessionId = null;
      }
    };
  }

  /**
   * Append standardized event:
   * CRITICAL: Writes to Cloud Firestore first with await.
   * If Firestore fails, rejects immediately so the UI does NOT show false success!
   */
  static async appendEvent(params: {
    eventType: EventType;
    eventDescription: string;
    eventSource: EventSource;
    patientId?: string;
    sessionId?: string;
    nurseId?: string;
    nurseUid?: string;
    nurseName?: string;
    verificationResult?: 'MATCHED' | 'MISMATCHED' | 'CONFIRMED' | 'WARNING';
    source?: string;
    transcript?: string;
    linkedStep?: string;
    metadata?: any;
  }): Promise<{ success: boolean; event?: NursingEvent; error?: string }> {
    const currentSession = this.getCurrentSession();
    const effectiveSessionId = params.sessionId || currentSession.sessionId;

    // Load events for THIS specific session only
    const events = this.loadEvents(effectiveSessionId);
    const sessionEvents = events.filter((e) => e.sessionId === effectiveSessionId);
    const completedSteps = sessionEvents.map((e) => e.eventType);

    // 5 main sequential workflow stages that can only occur once per session.
    // Supports both MEDICATION_START / INFUSION_START and MEDICATION_END / INFUSION_END
    // VOICE_NOTE and other auxiliary events are NOT single-action stages and bypass duplicate blocking.
    const SINGLE_ACTION_STAGES: (EventType | string)[] = [
      'PATIENT_VERIFY',
      'MEDICATION_VERIFY',
      'IV_SITE_ASSESS',
      'INFUSION_START',
      'MEDICATION_START',
      'INFUSION_END',
      'MEDICATION_END',
    ];

    const isSingleActionStage = SINGLE_ACTION_STAGES.includes(params.eventType);
    const isDuplicate = isSingleActionStage && sessionEvents.some((e) => {
      if (isStep4(params.eventType)) return isStep4(e.eventType);
      if (isStep5(params.eventType)) return isStep5(e.eventType);
      return e.eventType === params.eventType;
    });

    console.log('[StorageService.appendEvent duplicate check]', {
      eventType: params.eventType,
      linkedStep: params.linkedStep || params.metadata?.linkedStep || null,
      completedSteps,
      isSingleActionStage,
      duplicateEvaluation: isDuplicate
        ? 'DUPLICATE_FOUND_BLOCKED'
        : isSingleActionStage
        ? 'FIRST_TIME_ALLOWED'
        : 'BYPASSED_MULTI_RECORDABLE',
      sessionId: effectiveSessionId,
    });

    if (isDuplicate) {
      console.warn(`[StorageService.appendEvent] Blocked duplicate event for single-action stage: ${params.eventType}`);
      return { success: false, error: '현재 세션에서 이미 완료된 간호 행위 단계입니다.' };
    }

    const user = await ensureAuthenticated();
    const approvedNurse = await loadApprovedNurse();
    const remoteSession = await this.fetchSessionFromFirestore(effectiveSessionId);
    if (!remoteSession) {
      return { success: false, error: `세션 [${effectiveSessionId}]을(를) 찾을 수 없습니다.` };
    }
    assertSessionAccess(remoteSession, user.uid, true);

    const now = new Date();
    const isoNow = now.toISOString();
    const formattedTime = now.toLocaleTimeString('ko-KR', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    // Resolve clinical recording source strictly according to actual origin:
    // - Nurse direct manual confirmation: "MANUAL_CONFIRMATION"
    // - AI voice recognition analysis & confirmed: "VOICE_AI_CONFIRMED"
    // - Pure voice recording / dictation: "speech"
    // - QR wristband / patient scan: "QR_SCAN"
    // - Medication 1D barcode scan: "BARCODE_SCAN"
    let resolvedSource = params.source;
    if (!resolvedSource) {
      if (params.eventType === 'VOICE_NOTE') {
        resolvedSource = 'speech';
      } else if (
        params.eventSource === 'Voice Confirmation' ||
        params.eventSource === 'Voice Command'
      ) {
        resolvedSource = 'VOICE_AI_CONFIRMED';
      } else if (
        params.eventSource === 'QR Scan' ||
        params.eventSource === 'QR Wristband Scan'
      ) {
        resolvedSource = 'QR_SCAN';
      } else if (params.eventSource === 'Barcode Scan') {
        resolvedSource = 'BARCODE_SCAN';
      } else {
        resolvedSource = 'MANUAL_CONFIRMATION';
      }
    }

    const newEvent: NursingEvent = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sessionId: effectiveSessionId,
      patientId: remoteSession.patientId || params.patientId || DEFAULT_PATIENT.id,
      nurseId: approvedNurse.nurseId || params.nurseId || DEFAULT_NURSE.nurseId,
      nurseUid: user.uid,
      eventType: params.eventType,
      source: resolvedSource,
      occurredAt: isoNow,
      createdAt: isoNow,
      nurseName: approvedNurse.nurseName || params.nurseName || DEFAULT_NURSE.nurseName,
      eventTimestamp: formattedTime,
      rawDate: isoNow,
      eventDescription: params.eventDescription,
      eventSource: params.eventSource,
      eventStatus: 'COMPLETED',
      verificationResult: params.verificationResult || 'CONFIRMED',
      metadata: params.metadata || {},
    };

    if (params.transcript || params.metadata?.transcript || params.metadata?.rawSpeechText) {
      newEvent.transcript = params.transcript || params.metadata?.transcript || params.metadata?.rawSpeechText;
    }
    if (params.linkedStep || params.metadata?.linkedStep) {
      newEvent.linkedStep = params.linkedStep || params.metadata?.linkedStep;
    }

    // Strict validation of the 8 required fields before Firestore write
    const requiredFields = [
      { key: 'eventId', val: newEvent.eventId },
      { key: 'sessionId', val: newEvent.sessionId },
      { key: 'patientId', val: newEvent.patientId },
      { key: 'nurseId', val: newEvent.nurseId },
      { key: 'eventType', val: newEvent.eventType },
      { key: 'source', val: newEvent.source },
      { key: 'occurredAt', val: newEvent.occurredAt },
      { key: 'createdAt', val: newEvent.createdAt },
    ];

    const missingFields = requiredFields.filter((f) => !f.val || f.val === '');
    if (missingFields.length > 0) {
      const missingKeys = missingFields.map((f) => f.key).join(', ');
      console.error(`[StorageService.appendEvent] Firestore 전달 전 필수 필드 누락 감지: ${missingKeys}`);
      return {
        success: false,
        error: `이벤트 필수 필드 누락 (${missingKeys}). 저장이 중단되었습니다.`,
      };
    }

    try {
      console.log(`[StorageService.appendEvent] Writing to Firestore /nursingEvents/${newEvent.eventId}...`, {
        eventType: newEvent.eventType,
        source: newEvent.source,
        linkedStep: newEvent.linkedStep,
        sessionId: effectiveSessionId,
      });

      // 1. Session stage duplicate check on server
      // Note: Client queries detect existing stage records, but client checks alone
      // cannot fully guarantee zero duplication in concurrent distributed environments.
      // Firestore rule 'allow update, delete: if false' strictly ensures create-only document immutability.
      if (isSingleActionStage) {
        const q = query(
          collection(db, 'nursingEvents'),
          where('sessionId', '==', effectiveSessionId)
        );
        const querySnap = await getDocs(q);
        const alreadyRecordedOnServer = querySnap.docs.some((d) => {
          const data = d.data();
          if (isStep4(newEvent.eventType)) return isStep4(data.eventType);
          if (isStep5(newEvent.eventType)) return isStep5(data.eventType);
          return data.eventType === newEvent.eventType;
        });

        if (alreadyRecordedOnServer) {
          console.warn(`[StorageService.appendEvent] Stage ${newEvent.eventType} already recorded on Firestore for session ${effectiveSessionId}`);
          return { success: false, error: '현재 세션에서 이미 완료된 간호 행위 단계입니다.' };
        }
      }

      // 2. Create-only event write (No getDoc on non-existent doc to avoid rule evaluation on null resource)
      const eventDocRef = doc(db, 'nursingEvents', newEvent.eventId);
      const cleanDoc = sanitizeForFirestore(newEvent);
      await setDoc(eventDocRef, cleanDoc);

      // 3. Update session metadata in Firestore
      const sessionRef = doc(db, 'demoSessions', effectiveSessionId);
      await updateDoc(sessionRef, {
        eventsCount: events.length + 1,
        lastSyncAt: new Date().toISOString(),
      });

      // 4. Save locally and sync
      const updatedEvents = [...events, newEvent];
      this.saveSessionEvents(effectiveSessionId, updatedEvents);

      console.log(`[StorageService.appendEvent] Firestore write SUCCESS: ${newEvent.eventId} (source: ${newEvent.source})`);
      return { success: true, event: newEvent };
    } catch (err: any) {
      console.error('[StorageService.appendEvent] Firestore write FAILED:', err);
      return {
        success: false,
        error: `클라우드 저장 실패: ${err.message || 'Firestore 권한 또는 네트워크 오류'}`,
      };
    }
  }

  /**
   * Save independent Voice Note event (VOICE_NOTE):
   * - Strictly independent from main 5 workflow stages
   * - Bypasses single-action completedStep duplicate checks
   * - Supports multiple recordings per session
   * - Stores eventId, sessionId, patientId, nurseId, eventType='VOICE_NOTE', source='speech', occurredAt, createdAt
   */
  static async saveVoiceNote(params: {
    transcript: string;
    sessionId?: string;
    patientId?: string;
    nurseId?: string;
    nurseUid?: string;
    nurseName?: string;
    linkedStep?: string;
    clinicalFindings?: any;
  }): Promise<{ success: boolean; event?: NursingEvent; error?: string }> {
    const cleanTranscript = params.transcript.trim();
    if (!cleanTranscript) {
      return { success: false, error: '음성 인식된 내용이 없습니다.' };
    }

    const currentSession = this.getCurrentSession();
    const effectiveSessionId = params.sessionId || currentSession.sessionId;
    const events = this.loadEvents(effectiveSessionId);
    const sessionEvents = events.filter((e) => e.sessionId === effectiveSessionId);
    const completedSteps = sessionEvents.map((e) => e.eventType);

    console.log('[StorageService.saveVoiceNote] Initiating independent voice note save...', {
      eventType: 'VOICE_NOTE',
      source: 'speech',
      linkedStep: params.linkedStep || 'NONE',
      completedSteps,
      duplicateEvaluation: 'BYPASSED (VOICE_NOTE is multi-recordable independent event)',
      sessionId: effectiveSessionId,
    });

    const user = await ensureAuthenticated();
    const approvedNurse = await loadApprovedNurse();
    const remoteSession = await this.fetchSessionFromFirestore(effectiveSessionId);
    if (!remoteSession) {
      return { success: false, error: `세션 [${effectiveSessionId}]을(를) 찾을 수 없습니다.` };
    }
    assertSessionAccess(remoteSession, user.uid, true);

    const now = new Date();
    const isoNow = now.toISOString();
    const formattedTime = now.toLocaleTimeString('ko-KR', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const newEvent: NursingEvent = {
      eventId: `evt_vn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sessionId: effectiveSessionId,
      patientId: remoteSession.patientId || params.patientId || DEFAULT_PATIENT.id,
      nurseId: approvedNurse.nurseId || params.nurseId || DEFAULT_NURSE.nurseId,
      nurseUid: user.uid,
      eventType: 'VOICE_NOTE',
      source: 'speech',
      occurredAt: isoNow,
      createdAt: isoNow,
      nurseName: approvedNurse.nurseName || params.nurseName || DEFAULT_NURSE.nurseName,
      eventTimestamp: formattedTime,
      rawDate: isoNow,
      eventDescription: `음성 간호 기록: "${cleanTranscript}"`,
      eventSource: 'Voice Confirmation',
      transcript: cleanTranscript,
      eventStatus: 'COMPLETED',
      verificationResult: 'CONFIRMED',
      metadata: {
        transcript: cleanTranscript,
        rawSpeechText: cleanTranscript,
        source: 'speech',
      },
    };

    if (params.linkedStep) {
      newEvent.linkedStep = params.linkedStep;
      newEvent.metadata!.linkedStep = params.linkedStep;
    }
    if (params.clinicalFindings) {
      newEvent.metadata!.clinicalFindings = params.clinicalFindings;
    }

    // Strict validation of the 8 required fields before Firestore write
    const requiredFields = [
      { key: 'eventId', val: newEvent.eventId },
      { key: 'sessionId', val: newEvent.sessionId },
      { key: 'patientId', val: newEvent.patientId },
      { key: 'nurseId', val: newEvent.nurseId },
      { key: 'eventType', val: newEvent.eventType },
      { key: 'source', val: newEvent.source },
      { key: 'occurredAt', val: newEvent.occurredAt },
      { key: 'createdAt', val: newEvent.createdAt },
    ];

    const missingFields = requiredFields.filter((f) => !f.val || f.val === '');
    if (missingFields.length > 0) {
      const missingKeys = missingFields.map((f) => f.key).join(', ');
      console.error(`[StorageService.saveVoiceNote] Firestore 전달 전 필수 필드 누락 감지: ${missingKeys}`);
      return {
        success: false,
        error: `음성 메모 필수 필드 누락 (${missingKeys}). 저장이 중단되었습니다.`,
      };
    }

    try {
      console.log(`[StorageService.saveVoiceNote] Writing to Firestore /nursingEvents/${newEvent.eventId}...`, {
        eventId: newEvent.eventId,
        sessionId: effectiveSessionId,
        eventType: newEvent.eventType,
        source: newEvent.source,
        linkedStep: newEvent.linkedStep,
      });

      // Create-only write without getDoc on non-existent document
      const eventDocRef = doc(db, 'nursingEvents', newEvent.eventId);
      const cleanDoc = sanitizeForFirestore(newEvent);
      await setDoc(eventDocRef, cleanDoc);

      const sessionRef = doc(db, 'demoSessions', effectiveSessionId);
      await updateDoc(sessionRef, {
        eventsCount: events.length + 1,
        lastSyncAt: new Date().toISOString(),
      });

      const updatedEvents = [...events, newEvent];
      this.saveSessionEvents(effectiveSessionId, updatedEvents);

      console.log(`[StorageService.saveVoiceNote] Firestore write SUCCESS: ${newEvent.eventId}`);
      return { success: true, event: newEvent };
    } catch (err: any) {
      console.error('[StorageService.saveVoiceNote] Firestore write FAILED:', err);
      return {
        success: false,
        error: `클라우드 저장 실패: ${err.message || 'Firestore 권한 또는 네트워크 오류'}`,
      };
    }
  }

  // Draft Nursing Note
  static loadDraft(): NursingRecord | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DRAFT);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  static async saveDraft(draft: NursingRecord | null): Promise<void> {
    if (draft) {
      if (!draft.sessionId) throw new Error('간호기록에 세션 ID가 없습니다.');
      await this.ensureSessionInFirestore({ sessionId: draft.sessionId } as DemoSession, true);
      const cleanDraft = sanitizeForFirestore(draft);
      await setDoc(doc(db, 'nursingRecords', draft.id), cleanDraft, { merge: true });
      try {
        localStorage.setItem(STORAGE_KEYS.DRAFT, JSON.stringify(draft));
        this.broadcast('DRAFT_UPDATED', draft);
      } catch (error) {
        console.warn('Local draft cache failed after cloud save:', error);
      }
    } else {
      try {
        localStorage.removeItem(STORAGE_KEYS.DRAFT);
        this.broadcast('DRAFT_UPDATED', null);
      } catch (error) {
        console.warn('Local draft cache clear failed:', error);
      }
    }
  }

  // EMR Records
  static loadEmrRecords(): EMRTransfer[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EMR_RECORDS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static async saveEmrRecords(records: EMRTransfer[]): Promise<void> {
    if (records.length > 0) {
      const latest = records[0];
      if (!latest.sessionId) throw new Error('Mock EMR 기록에 세션 ID가 없습니다.');
      await this.ensureSessionInFirestore({ sessionId: latest.sessionId } as DemoSession, true);
      const cleanTransfer = sanitizeForFirestore(latest);
      await setDoc(doc(db, 'emrTransfers', latest.transferId), cleanTransfer);
    }
    try {
      localStorage.setItem(STORAGE_KEYS.EMR_RECORDS, JSON.stringify(records));
      this.broadcast('EMR_RECORDS_UPDATED', records);
    } catch (error) {
      console.warn('Local Mock EMR cache failed after cloud save:', error);
    }
  }

  static async saveEmrTransmission(transfer: EMRTransfer, updatedDraft: NursingRecord): Promise<void> {
    if (!transfer.sessionId || transfer.sessionId !== updatedDraft.sessionId) {
      throw new Error('Mock EMR과 승인 기록의 세션이 일치하지 않습니다.');
    }
    await this.ensureSessionInFirestore({ sessionId: transfer.sessionId } as DemoSession, true);
    const cleanTransfer = sanitizeForFirestore(transfer);
    const batch = writeBatch(db);
    batch.set(doc(db, 'emrTransfers', transfer.transferId), cleanTransfer);
    batch.update(doc(db, 'nursingRecords', updatedDraft.id), {
      emrTransmitted: true,
      emrTransmittedAt: updatedDraft.emrTransmittedAt || new Date().toISOString(),
    });
    batch.update(doc(db, 'demoSessions', transfer.sessionId), {
      emrTransmitted: true,
      lastSyncAt: new Date().toISOString(),
    });
    await batch.commit();
    const records = [transfer, ...this.loadEmrRecords().filter((entry) => entry.transferId !== transfer.transferId)];
    try {
      localStorage.setItem(STORAGE_KEYS.EMR_RECORDS, JSON.stringify(records));
      localStorage.setItem(STORAGE_KEYS.DRAFT, JSON.stringify(updatedDraft));
      this.broadcast('EMR_RECORDS_UPDATED', records);
      this.broadcast('DRAFT_UPDATED', updatedDraft);
    } catch (error) {
      console.warn('Local Mock EMR cache failed after cloud save:', error);
    }
  }

  // Load past local backups
  static loadLocalBackups(): NursingEvent[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LOCAL_BACKUP_EVENTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  // Preferred Mode
  static getPreferredMode(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.PREFERRED_MODE);
    } catch {
      return null;
    }
  }

  static setPreferredMode(mode: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PREFERRED_MODE, mode);
    } catch {}
  }
}
