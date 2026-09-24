import React, { useState, useEffect, useRef } from 'react';
import {
  AppMode,
  EventType,
  EventSource,
  IvSiteAssessment,
  NursingRecord,
  EMRTransfer,
  DemoSession,
  Nurse,
  Patient,
  MedicationOrder,
  NursingEvent,
  isStep4,
  isStep5,
} from './types';
import {
  StorageService,
  DEFAULT_NURSE,
  DEFAULT_PATIENT,
  DEFAULT_PRESCRIPTION,
} from './services/storageService';
import { EmrService } from './services/emrService';
import { PortalView } from './components/PortalView';
import { StationView } from './components/StationView';
import { CaptureView } from './components/CaptureView';
import { FirebaseGuideModal } from './components/FirebaseGuideModal';
import { DiagnosticsModal } from './components/DiagnosticsModal';
import { HandoffPanel } from './components/HandoffPanel';
import { db } from './services/firebase';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, signInNurse, signOutNurse } from './services/firebase';
import { loadApprovedNurse } from './services/accessService';
import { onAuthStateChanged, User } from 'firebase/auth';
import { AlertTriangle, RefreshCw, Smartphone, QrCode } from 'lucide-react';

export default function App() {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem('nurseflow_theme') === 'dark' ||
        window.matchMedia('(prefers-color-scheme: dark)').matches
      );
    }
    return false;
  });

  // Mode state: 'PORTAL' | 'STATION' | 'CAPTURE'
  const [currentMode, setCurrentMode] = useState<AppMode>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const modeParam = urlParams.get('mode')?.toUpperCase();
      if (modeParam === 'STATION' || modeParam === 'CAPTURE' || modeParam === 'PORTAL') {
        return modeParam as AppMode;
      }

      const hash = window.location.hash.replace('#', '').toUpperCase();
      if (hash === 'STATION' || hash === 'CAPTURE' || hash === 'PORTAL') {
        return hash as AppMode;
      }

      const preferred = StorageService.getPreferredMode();
      if (preferred === 'STATION' || preferred === 'CAPTURE') {
        return preferred as AppMode;
      }
    }
    return 'PORTAL';
  });

  // Core Data Entities (Strictly initialized from URL session if present to eliminate race condition)
  const [nurse, setNurse] = useState<Nurse>(() => StorageService.loadNurse());
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [accessReady, setAccessReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authorizedSessionId, setAuthorizedSessionId] = useState<string | null>(null);
  const [sessionCheckComplete, setSessionCheckComplete] = useState(false);
  const [patient] = useState<Patient>(() => StorageService.loadPatient());
  const [prescription, setPrescription] = useState<MedicationOrder>(() =>
    StorageService.loadPrescription()
  );
  const [currentSession, setCurrentSession] = useState<DemoSession>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionParam = urlParams.get('session');
      if (sessionParam) {
        const stored = StorageService.getCurrentSession();
        if (stored && stored.sessionId === sessionParam) {
          return stored;
        }
        return {
          sessionId: sessionParam,
          sessionNumber: 1,
          nurseId: DEFAULT_NURSE.nurseId,
          patientId: DEFAULT_PATIENT.id,
          status: 'ACTIVE',
          startedAt: '--:--',
          eventsCount: 0,
          emrTransmitted: false,
          lastSyncAt: new Date().toISOString(),
        };
      }
    }
    return StorageService.getCurrentSession();
  });
  const [events, setEvents] = useState<NursingEvent[]>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionParam = urlParams.get('session');
      if (sessionParam) {
        return StorageService.loadEvents(sessionParam);
      }
    }
    return StorageService.loadEvents();
  });
  const [ivSiteAssessment, setIvSiteAssessment] = useState<IvSiteAssessment | null>(() => {
    const saved = StorageService.loadEvents();
    const iv = saved.find((e) => e.eventType === 'IV_SITE_ASSESS');
    return iv?.metadata?.ivAssessment || null;
  });
  const [draftNote, setDraftNote] = useState<NursingRecord | null>(() =>
    StorageService.loadDraft()
  );
  const [emrRecords, setEmrRecords] = useState<EMRTransfer[]>(() =>
    StorageService.loadEmrRecords()
  );

  const showSessionRecords = (sessionId: string) => {
    const cachedDraft = StorageService.loadDraft();
    setDraftNote(cachedDraft?.sessionId === sessionId ? cachedDraft : null);
    setEmrRecords(StorageService.loadEmrRecords().filter((entry) => entry.sessionId === sessionId));
  };

  // Session Connection Verification State (Specifically for Mobile Capture via QR)
  const [isVerifyingSession, setIsVerifyingSession] = useState<boolean>(false);
  const [sessionVerificationError, setSessionVerificationError] = useState<string | null>(null);

  // Diagnostics & Listener Health Monitoring State
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isHandoffOpen, setIsHandoffOpen] = useState(false);
  const [firestoreEventsCount, setFirestoreEventsCount] = useState<number>(0);
  const [listenerStatus, setListenerStatus] = useState<{
    state: 'LISTENING_SERVER' | 'LISTENING_CACHE' | 'ERROR' | 'INITIALIZING';
    lastSyncTime: string | null;
    errorMessage: string | null;
  }>({
    state: 'INITIALIZING',
    lastSyncTime: null,
    errorMessage: null,
  });

  // Modals & Feedback
  const [isEmrModalOpen, setIsEmrModalOpen] = useState(false);
  const [isFirebaseGuideOpen, setIsFirebaseGuideOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isTriggeringEvent, setIsTriggeringEvent] = useState<boolean>(false);

  // Theme Sync
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('nurseflow_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('nurseflow_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 4000);
  };

  useEffect(() => onAuthStateChanged(auth, async (user) => {
    setAuthReady(false);
    setAuthUser(user);
    setAccessReady(false);
    setAuthorizedSessionId(null);
    if (!user) {
      setAuthError(null);
      setAuthReady(true);
      return;
    }
    try {
      const profile = await loadApprovedNurse();
      if (auth.currentUser?.uid !== user.uid) return;
      setNurse(profile);
      setAuthError(null);
      setAccessReady(true);
    } catch (error: any) {
      if (auth.currentUser?.uid === user.uid) setAuthError(error?.message || '간호사 권한 확인에 실패했습니다.');
    } finally {
      if (auth.currentUser?.uid === user.uid) setAuthReady(true);
    }
  }), []);

  // 1. Verify the selected session after identity and profile are established.
  useEffect(() => {
    if (!authReady || !accessReady || !authUser) return;
    const initApp = async () => {
      setSessionCheckComplete(false);
      if (typeof window === 'undefined') return;

      const urlParams = new URLSearchParams(window.location.search);
      const sessionParam = urlParams.get('session');

      if (sessionParam) {
        // Mobile Capture joined via Station QR code with specific session ID
        setIsVerifyingSession(true);
        setSessionVerificationError(null);

        const result = await StorageService.verifyAndJoinSession(sessionParam);
        setIsVerifyingSession(false);

        if (result.success && result.session) {
          setAuthorizedSessionId(result.session.sessionId);
          setCurrentSession(result.session);
          showSessionRecords(result.session.sessionId);
          if (result.events) {
            setEvents(result.events);
            setFirestoreEventsCount(result.events.length);
            const iv = result.events.find((e) => e.eventType === 'IV_SITE_ASSESS');
            if (iv?.metadata?.ivAssessment) {
              setIvSiteAssessment(iv.metadata.ivAssessment);
            }
          }
          showToast(`Station 클라우드 세션 [${result.session.sessionId}]에 성공적으로 연결되었습니다.`);
        } else {
          setAuthorizedSessionId(null);
          // Explicit error: do NOT silently replace with a random new session!
          setSessionVerificationError(
            result.error || `클라우드 세션 [${sessionParam}]을 찾을 수 없습니다.`
          );
        }
      } else {
        // Never create a guessed local session during page load.
        try {
          const result = await StorageService.verifyAndJoinSession(currentSession.sessionId);
          if (result.success && result.session) {
            setCurrentSession(result.session);
            setEvents(result.events || []);
            setAuthorizedSessionId(result.session.sessionId);
            showSessionRecords(result.session.sessionId);
          }
        } catch (e) {
          console.warn('No authorized session selected:', e);
        }
      }
      setSessionCheckComplete(true);
    };

    initApp();
  }, [authReady, accessReady, authUser?.uid]);

  // 2. Real-time Firestore onSnapshot listener for the exact currentSession.sessionId
  useEffect(() => {
    if (!currentSession.sessionId || authorizedSessionId !== currentSession.sessionId || sessionVerificationError) return;

    const unsubFirestore = StorageService.listenToSessionEvents(
      currentSession.sessionId,
      (remoteEvents, source) => {
        setFirestoreEventsCount(remoteEvents.length);
        setEvents(remoteEvents);
        setListenerStatus({
          state: source === 'cache' ? 'LISTENING_CACHE' : 'LISTENING_SERVER',
          lastSyncTime: new Date().toLocaleTimeString('ko-KR', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          errorMessage: null,
        });

        const iv = remoteEvents.find((e) => e.eventType === 'IV_SITE_ASSESS');
        if (iv?.metadata?.ivAssessment) {
          setIvSiteAssessment(iv.metadata.ivAssessment);
        } else {
          setIvSiteAssessment(null);
        }

        // Update prescription status based on remote events
        const isMedVerified = remoteEvents.some((e) => e.eventType === 'MEDICATION_VERIFY');
        const isInfusionEnded = remoteEvents.some((e) => e.eventType === 'INFUSION_END');
        if (isInfusionEnded) {
          setPrescription((prev) => ({ ...prev, status: 'ADMINISTERED' }));
        } else if (isMedVerified) {
          setPrescription((prev) => ({ ...prev, status: 'VERIFIED' }));
        } else {
          setPrescription(DEFAULT_PRESCRIPTION);
        }
      },
      (error) => {
        console.error('onSnapshot listener failure:', error);
        setListenerStatus((prev) => ({
          ...prev,
          state: 'ERROR',
          errorMessage: error?.message || 'Firestore 실시간 연결 실패',
        }));
      }
    );

    return () => {
      unsubFirestore();
    };
  }, [currentSession.sessionId, authorizedSessionId, sessionVerificationError]);

  // Station and Capture both observe changes to the active nurse and participants.
  useEffect(() => {
    if (!authorizedSessionId || !authUser) return;
    return onSnapshot(doc(db, 'demoSessions', authorizedSessionId), (snapshot) => {
      if (!snapshot.exists()) return;
      const session = snapshot.data() as DemoSession;
      if (!(session.participantUids || []).includes(authUser.uid)) {
        setAuthorizedSessionId(null);
        setSessionVerificationError('세션 참여 권한이 종료되었습니다.');
        return;
      }
      setCurrentSession(session);
    }, (error) => {
      setSessionVerificationError(error.message);
      setAuthorizedSessionId(null);
    });
  }, [authorizedSessionId, authUser?.uid]);

  // Shared Mock EMR state. Existing local-only legacy records remain visible until mapped.
  useEffect(() => {
    if (!authorizedSessionId) return;
    const draftQuery = query(collection(db, 'nursingRecords'), where('sessionId', '==', authorizedSessionId));
    const transferQuery = query(collection(db, 'emrTransfers'), where('sessionId', '==', authorizedSessionId));
    const stopDrafts = onSnapshot(draftQuery, (snapshot) => {
      const drafts = snapshot.docs.map((entry) => entry.data() as NursingRecord)
        .sort((a, b) => b.id.localeCompare(a.id));
      setDraftNote(drafts[0] || null);
    }, (error) => showToast(`간호기록 동기화 실패: ${error.message}`));
    const stopTransfers = onSnapshot(transferQuery, (snapshot) => {
      const remote = snapshot.docs.map((entry) => entry.data() as EMRTransfer);
      setEmrRecords(remote);
    }, (error) => showToast(`Mock EMR 동기화 실패: ${error.message}`));
    return () => { stopDrafts(); stopTransfers(); };
  }, [authorizedSessionId]);

  // 3. In-browser BroadcastChannel synchronization (for same-browser multiple tabs)
  useEffect(() => {
    const unsubscribe = StorageService.subscribe(({ type, payload }) => {
      switch (type) {
        case 'EVENTS_UPDATED':
          if (payload && payload.sessionId === currentSession.sessionId) {
            setEvents(payload.events);
            setFirestoreEventsCount(payload.events.length);
            const iv = (payload.events as NursingEvent[]).find((e) => e.eventType === 'IV_SITE_ASSESS');
            if (iv?.metadata?.ivAssessment) {
              setIvSiteAssessment(iv.metadata.ivAssessment);
            }
          }
          break;
        case 'PRESCRIPTION_UPDATED':
          setPrescription(payload);
          break;
        case 'DRAFT_UPDATED':
          if (!payload || payload.sessionId === currentSession.sessionId) setDraftNote(payload);
          break;
        case 'EMR_RECORDS_UPDATED':
          setEmrRecords((payload as EMRTransfer[]).filter((entry) => entry.sessionId === currentSession.sessionId));
          break;
        case 'NEW_SESSION_STARTED':
          if (payload && payload.sessionId !== currentSession.sessionId) {
            void StorageService.verifyAndJoinSession(payload.sessionId).then((result) => {
              if (!result.success || !result.session) return;
              setAuthorizedSessionId(result.session.sessionId);
              setCurrentSession(result.session);
              setEvents(result.events || []);
              showSessionRecords(result.session.sessionId);
              setFirestoreEventsCount(result.events?.length || 0);
              setIvSiteAssessment(null);
              setDraftNote(null);
              setPrescription(DEFAULT_PRESCRIPTION);
            });
          }
          break;
        case 'SESSION_SWITCHED':
          if (payload && payload.session) {
            void StorageService.verifyAndJoinSession(payload.session.sessionId).then((result) => {
              if (!result.success || !result.session) return;
              setAuthorizedSessionId(result.session.sessionId);
              setCurrentSession(result.session);
              setEvents(result.events || []);
              showSessionRecords(result.session.sessionId);
              setFirestoreEventsCount(result.events?.length || 0);
            });
          }
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentSession.sessionId]);

  // Update URL & mode handler
  const handleSelectMode = (mode: AppMode, rememberPreference: boolean = true) => {
    setCurrentMode(mode);
    if (rememberPreference && mode !== 'PORTAL') {
      StorageService.setPreferredMode(mode);
    }

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (mode === 'PORTAL') {
        url.searchParams.delete('mode');
      } else {
        url.searchParams.set('mode', mode.toLowerCase());
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Start Fresh Session (Explicitly generates a fresh session and guarantees Firestore write)
  const handleStartNewSession = async () => {
    try {
      const newSession = await StorageService.startNewSession();
      setAuthorizedSessionId(newSession.sessionId);
      setCurrentSession(newSession);
      setEvents([]);
      setFirestoreEventsCount(0);
      setIvSiteAssessment(null);
      setDraftNote(null);
      setEmrRecords([]);
      setPrescription(DEFAULT_PRESCRIPTION);
      setSessionVerificationError(null);
      showToast(`새로운 클라우드 시연 세션 [${newSession.sessionId}]이 시작되었습니다.`);
    } catch (e: any) {
      showToast(`세션 시작 오류: ${e.message || e}`);
    }
  };

  // Switch to another existing session (for demo history replay / testing)
  const handleSwitchSession = async (sessionId: string) => {
    setIsVerifyingSession(true);
    setSessionVerificationError(null);
    try {
      const result = await StorageService.verifyAndJoinSession(sessionId);
      if (result.success && result.session) {
        setAuthorizedSessionId(result.session.sessionId);
        setCurrentSession(result.session);
        showSessionRecords(result.session.sessionId);
        const evts = result.events || StorageService.loadEvents(sessionId);
        setEvents(evts);
        setFirestoreEventsCount(evts.length);
        const iv = evts.find((e) => e.eventType === 'IV_SITE_ASSESS');
        setIvSiteAssessment(iv?.metadata?.ivAssessment || null);

        // Update prescription status
        const isMed = evts.some((e) => e.eventType === 'MEDICATION_VERIFY');
        const isEnded = evts.some((e) => e.eventType === 'INFUSION_END');
        if (isEnded) {
          setPrescription((prev) => ({ ...prev, status: 'ADMINISTERED' }));
        } else if (isMed) {
          setPrescription((prev) => ({ ...prev, status: 'VERIFIED' }));
        } else {
          setPrescription(DEFAULT_PRESCRIPTION);
        }

        showToast(`시연 세션 [${result.session.sessionId}]으로 전환되었습니다.`);
      } else {
        showToast(result.error || '세션 전환에 실패했습니다.');
      }
    } catch (err: any) {
      showToast(`세션 전환 오류: ${err.message || err}`);
    } finally {
      setIsVerifyingSession(false);
    }
  };

  // Force re-fetch from Firestore
  const handleForceRefresh = async () => {
    if (!currentSession.sessionId) return;
    try {
      const remoteEvents = await StorageService.fetchSessionEventsFromFirestore(currentSession.sessionId);
      setEvents(remoteEvents);
      setFirestoreEventsCount(remoteEvents.length);
      showToast(`Firestore에서 ${remoteEvents.length}건의 이벤트를 재조회했습니다.`);
    } catch (err: any) {
      showToast(`재조회 오류: ${err.message || err}`);
    }
  };

  // Core Event Trigger Pipeline with actual Firestore write confirmation
  const handleTriggerEvent = async (
    eventType: EventType,
    source: EventSource = 'Manual Confirmation',
    metadata?: any
  ): Promise<{ success: boolean; message?: string }> => {
    if (!authUser || currentSession.activeNurseUid !== authUser.uid || currentSession.status !== 'ACTIVE') {
      return { success: false, message: '현재 담당 간호사만 활성 세션에 기록할 수 있습니다.' };
    }
    if (isTriggeringEvent) {
      return { success: false, message: '이전 기록 저장 작업이 처리 중입니다.' };
    }

    setIsTriggeringEvent(true);

    let description = '';
    let verificationResult: 'MATCHED' | 'MISMATCHED' | 'CONFIRMED' | 'WARNING' = 'CONFIRMED';

    switch (eventType) {
      case 'PATIENT_VERIFY':
        description = `${patient.name} 환자 본인확인 완료 (등록번호: ${patient.id}, ${patient.room})`;
        verificationResult = 'MATCHED';
        break;
      case 'MEDICATION_VERIFY':
        description = metadata?.fiveRightsVerified
          ? `처방 약물 [${prescription.medicationName}] 바코드 일치 및 간호사 5-Rights 수동 확인 완료`
          : `처방 약물 [${prescription.medicationName}] 바코드 일치 확인. 용량·경로·시간 등은 간호사 별도 확인 필요`;
        verificationResult = 'MATCHED';
        break;
      case 'IV_SITE_ASSESS':
        description = metadata?.transcript
          ? `정맥 주입 부위(IV site) 음성 사정: ${metadata.transcript}`
          : `정맥 주입 부위(IV site) 사정: 이상 소견 없음, 카테터 개통성 양호함`;
        break;
      case 'INFUSION_START':
      case 'MEDICATION_START':
        description = metadata?.transcript
          ? `처방 약물 ${prescription.medicationName} 점적 투여 시작 (음성 확인: "${metadata.transcript}")`
          : `처방된 ${prescription.medicationName} 정맥 점적 주입(IV infusion) 시작함`;
        break;
      case 'INFUSION_END':
      case 'MEDICATION_END':
        description = metadata?.transcript
          ? `처방 약물 ${prescription.medicationName} 전량 주입 투여 종료 (음성 확인: "${metadata.transcript}")`
          : `처방된 ${prescription.medicationName} 전량 주입 완료 및 투여 종료함`;
        break;
    }

    // Explicit source mapping according to clinical provenance
    let explicitSource = metadata?.source;
    if (!explicitSource) {
      if (source === 'Voice Confirmation' || source === 'Voice Command') {
        explicitSource = 'VOICE_AI_CONFIRMED';
      } else if (source === 'QR Scan' || source === 'QR Wristband Scan') {
        explicitSource = 'QR_SCAN';
      } else if (source === 'Barcode Scan') {
        explicitSource = 'BARCODE_SCAN';
      } else {
        explicitSource = 'MANUAL_CONFIRMATION';
      }
    }

    try {
      const res = await StorageService.appendEvent({
        eventType,
        eventDescription: description,
        eventSource: source,
        source: explicitSource,
        patientId: patient.id,
        sessionId: currentSession.sessionId,
        nurseId: nurse.nurseId,
        nurseUid: authUser?.uid,
        nurseName: nurse.nurseName,
        verificationResult,
        metadata: metadata || {},
      });

      if (res.success && res.event) {
        if (eventType === 'MEDICATION_VERIFY') {
          const updatedRx: MedicationOrder = { ...prescription, status: 'VERIFIED' };
          setPrescription(updatedRx);
          await StorageService.savePrescription(updatedRx);
        } else if (isStep4(eventType)) {
          // Strictly update prescription state and 4/5 progress AFTER Firestore setDoc succeeds
          const inProgressRx: MedicationOrder = { ...prescription, status: 'IN_PROGRESS' };
          setPrescription(inProgressRx);
          await StorageService.savePrescription(inProgressRx);
        } else if (isStep5(eventType)) {
          // Strictly update prescription state and 5/5 progress AFTER Firestore setDoc succeeds
          const administeredRx: MedicationOrder = { ...prescription, status: 'ADMINISTERED' };
          setPrescription(administeredRx);
          await StorageService.savePrescription(administeredRx);
        }

        showToast(`[${eventType}] 이벤트가 Cloud Firestore에 실시간 기록되었습니다.`);
        return { success: true };
      } else {
        const errMsg = res.error || '이벤트 저장에 실패했습니다.';
        showToast(`⚠️ ${errMsg}`);
        return { success: false, message: errMsg };
      }
    } catch (err: any) {
      const errMsg = `클라우드 쓰기 오류: ${err.message || err}`;
      showToast(`⚠️ ${errMsg}`);
      return { success: false, message: errMsg };
    } finally {
      setIsTriggeringEvent(false);
    }
  };

  // Optical Scanners Callback
  const handleConfirmVerification = async (
    source: 'QR Scan' | 'Barcode Scan',
    fiveRightsVerified: boolean = false
  ) => {
    if (source === 'QR Scan') {
      await handleTriggerEvent('PATIENT_VERIFY', 'QR Scan', {
        source: 'QR_SCAN',
        deviceType: 'MOBILE_CAPTURE',
        fiveRightsVerified: false,
      });
    } else if (source === 'Barcode Scan') {
      await handleTriggerEvent('MEDICATION_VERIFY', 'Barcode Scan', {
        source: 'BARCODE_SCAN',
        deviceType: 'MOBILE_CAPTURE',
        scannedCode: prescription.id,
        fiveRightsVerified,
        automatedChecks: ['prescriptionId'],
        nurseConfirmedFiveRights: fiveRightsVerified,
      });
    }
  };

  // IV Assessment save
  const handleSaveIvAssessment = async (assessment: IvSiteAssessment) => {
    setIvSiteAssessment(assessment);
    const hasSymptom = assessment.hasPain || assessment.hasRedness || assessment.hasSwelling || assessment.hasLeakage;
    const desc = hasSymptom
      ? `정맥 주입 부위(${assessment.site}) 사정: 특이 소견 관찰됨 [통증:${assessment.hasPain ? '유' : '무'}, 발적:${assessment.hasRedness ? '유' : '무'}, 부종:${assessment.hasSwelling ? '유' : '무'}]`
      : `정맥 주입 부위(${assessment.site}) 사정: 발적, 부종, 통증, 누출 등 이상 소견 없음 (22G 개통성 확인)`;

    const res = await StorageService.appendEvent({
      eventType: 'IV_SITE_ASSESS',
      eventDescription: desc,
      eventSource: 'NurseFlow Capture',
      source: 'MANUAL_CONFIRMATION',
      patientId: patient.id,
      sessionId: currentSession.sessionId,
      nurseId: nurse.nurseId,
      nurseUid: authUser?.uid,
      nurseName: nurse.nurseName,
      verificationResult: hasSymptom ? 'WARNING' : 'CONFIRMED',
      metadata: { ivAssessment: assessment },
    });

    if (res.success) {
      showToast('IV site 사정 결과가 Firestore에 저장되었습니다.');
    } else {
      showToast(`⚠️ ${res.error || 'IV 사정 저장 실패'}`);
    }
  };

  // Voice note save: Independent VOICE_NOTE event with multi-entry support and debug logging
  const handleSaveVoiceNote = async (
    transcript: string,
    linkedStep?: string,
    clinicalFindings?: any
  ) => {
    if (!transcript.trim()) return;

    const currentSessionEvents = events.filter((e) => e.sessionId === currentSession.sessionId);
    const completedSteps = currentSessionEvents.map((e) => e.eventType);

    console.log('[confirmVoiceInput] Invoking voice note handler:', {
      eventType: 'VOICE_NOTE',
      linkedStep: linkedStep || 'NONE',
      completedSteps,
      duplicateEvaluation: 'BYPASSED (VOICE_NOTE is multi-recordable independent event)',
    });

    const res = await StorageService.saveVoiceNote({
      transcript: transcript.trim(),
      sessionId: currentSession.sessionId,
      patientId: patient.id,
      nurseId: nurse.nurseId,
      nurseUid: authUser?.uid,
      nurseName: nurse.nurseName,
      linkedStep: linkedStep || undefined,
      clinicalFindings,
    });

    if (res.success) {
      console.log('[confirmVoiceInput] Firestore write SUCCESS:', res.event?.eventId);
      showToast('음성 간호 기록(VOICE_NOTE)이 Firestore에 실시간 등록되었습니다.');
    } else {
      console.error('[confirmVoiceInput] Firestore write FAILED:', res.error);
      showToast(`⚠️ ${res.error || '음성 기록 저장 실패'}`);
    }
  };

  // Draft Note Save
  const handleUpdateDraft = async (draft: NursingRecord): Promise<void> => {
    if (!authUser || currentSession.activeNurseUid !== authUser.uid) {
      throw new Error('현재 담당 간호사만 기록을 저장하거나 승인할 수 있습니다.');
    }
    const saved: NursingRecord = {
      ...draft,
      sessionId: currentSession.sessionId,
      nurseId: draft.id === draftNote?.id ? (draft.nurseId || nurse.nurseId) : nurse.nurseId,
      nurseUid: draft.id === draftNote?.id ? (draft.nurseUid || authUser.uid) : authUser.uid,
      ...(draft.status === 'APPROVED' ? {
        approver: `${nurse.nurseName} 간호사`,
        approverId: nurse.nurseId,
        approverUid: authUser.uid,
      } : {}),
    };
    await StorageService.saveDraft(saved);
    setDraftNote(saved);
  };

  if (!authReady) {
    return <div className="min-h-screen flex items-center justify-center">로그인 상태를 확인하는 중입니다.</div>;
  }

  if (!authUser || !accessReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center space-y-4">
          <h1 className="text-xl font-bold">NurseFlow AI</h1>
          <p className="text-sm text-slate-600">승인된 간호사 계정으로 로그인해야 세션을 열 수 있습니다. QR 코드는 로그인이나 참여 승인을 대신하지 않습니다.</p>
          {authError && <p className="text-sm text-rose-700">{authError}</p>}
          {authUser ? (
            <button className="rounded-lg bg-slate-800 px-5 py-2 text-white" onClick={() => signOutNurse()}>다른 계정으로 로그인</button>
          ) : (
            <button className="rounded-lg bg-teal-700 px-5 py-2 text-white" onClick={() => signInNurse().catch((e) => setAuthError(e.message))}>Google 계정으로 로그인</button>
          )}
        </div>
      </div>
    );
  }

  if (currentMode !== 'PORTAL' && authorizedSessionId !== currentSession.sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center space-y-4">
          <h1 className="text-xl font-bold">세션 접근 확인</h1>
          <p className="text-sm text-slate-600">{sessionCheckComplete ? (sessionVerificationError || '참여가 승인된 세션이 없습니다.') : '세션 권한을 확인하는 중입니다.'}</p>
          {sessionCheckComplete && !new URLSearchParams(window.location.search).has('session') && (
            <button className="rounded-lg bg-teal-700 px-5 py-2 text-white" onClick={handleStartNewSession}>새 시연 세션 시작</button>
          )}
          <button className="rounded-lg border px-5 py-2" onClick={() => handleSelectMode('PORTAL')}>시작 화면</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-2xl border border-teal-500/40 animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-md">
          {toastMessage}
        </div>
      )}

      {/* Session Join Error Banner (Specifically for Mobile Capture if QR session invalid) */}
      {sessionVerificationError && currentMode === 'CAPTURE' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-900/80 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                세션 연결 실패
              </h3>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                {sessionVerificationError}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
                노트북 Station 화면에 표시된 최신 연결 QR 코드를 다시 스캔해 주시거나, 
                Station에서 [새 시연 세션 시작]을 클릭한 후 재시도해 주세요.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.reload();
                  }
                }}
                className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                다시 시도 (새로고침)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSessionVerificationError(null);
                  handleSelectMode('PORTAL');
                }}
                className="w-full py-2 px-4 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-100 transition"
              >
                포털 시작 화면으로 이동
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Verification Loading Screen */}
      {isVerifyingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-3 border border-slate-200 dark:border-slate-800">
            <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
            <div className="text-center">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                클라우드 세션 확인 중...
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                Firestore 세션 문서 조회 중
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Render Current View Mode */}
      {currentMode === 'PORTAL' && (
        <PortalView
          onSelectMode={handleSelectMode}
          onOpenFirebaseGuide={() => setIsFirebaseGuideOpen(true)}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
        />
      )}

      {currentMode === 'STATION' && (
        <StationView
          nurse={nurse}
          canWrite={currentSession.activeNurseUid === authUser.uid && currentSession.status === 'ACTIVE'}
          patient={patient}
          prescription={prescription}
          currentSession={currentSession}
          events={events}
          ivSiteAssessment={ivSiteAssessment}
          draftNote={draftNote}
          emrRecords={emrRecords}
          onStartNewSession={handleStartNewSession}
          onUpdateDraft={handleUpdateDraft}
          onOpenEmrModal={() => setIsEmrModalOpen(true)}
          isEmrModalOpen={isEmrModalOpen}
          onCloseEmrModal={() => setIsEmrModalOpen(false)}
          onTransmissionSuccess={(newRecord) => {
            setEmrRecords((previous) => [newRecord, ...previous.filter((entry) => entry.transferId !== newRecord.transferId)]);
            showSessionRecords(currentSession.sessionId);
            showToast('공유 Mock EMR의 Firestore 저장이 확인되었습니다.');
          }}
          onSwitchMode={handleSelectMode}
          onOpenFirebaseGuide={() => setIsFirebaseGuideOpen(true)}
          onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          onSimulateEvent={handleTriggerEvent}
        />
      )}
      {currentMode === 'STATION' && authorizedSessionId === currentSession.sessionId && (
        <button className="fixed bottom-5 left-5 z-40 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white shadow-lg" onClick={() => setIsHandoffOpen(true)}>간호사 교대 관리</button>
      )}
      {isHandoffOpen && authUser && (
        <HandoffPanel session={currentSession} currentUid={authUser.uid} onUpdated={setCurrentSession} onClose={() => setIsHandoffOpen(false)} />
      )}

      {currentMode === 'CAPTURE' && currentSession.activeNurseUid !== authUser.uid && (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 text-white text-center">
          <div><h2 className="text-xl font-bold">교대된 세션</h2><p className="mt-2 text-sm">현재 담당 간호사가 아니므로 새 기록을 작성할 수 없습니다. Station에서 기록은 계속 볼 수 있습니다.</p></div>
        </div>
      )}
      {currentMode === 'CAPTURE' && currentSession.activeNurseUid === authUser.uid && (
        <CaptureView
          nurse={nurse}
          patient={patient}
          prescription={prescription}
          currentSession={currentSession}
          events={events}
          ivSiteAssessment={ivSiteAssessment}
          onTriggerEvent={handleTriggerEvent}
          onConfirmVerification={handleConfirmVerification}
          onSaveIvAssessment={handleSaveIvAssessment}
          onSaveVoiceNote={handleSaveVoiceNote}
          onStartNewSession={handleStartNewSession}
          onSwitchMode={handleSelectMode}
          onOpenFirebaseGuide={() => setIsFirebaseGuideOpen(true)}
          onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
        />
      )}

      {/* Firebase Cloud Connection Guide Modal */}
      <FirebaseGuideModal
        isOpen={isFirebaseGuideOpen}
        onClose={() => setIsFirebaseGuideOpen(false)}
      />

      {/* Dev Diagnostics Modal (Hidden by default, opened via [진단] button) */}
      <DiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        currentSession={currentSession}
        events={events.filter((e) => e.sessionId === currentSession.sessionId)}
        firestoreEventsCount={firestoreEventsCount}
        listenerStatus={listenerStatus}
        onSwitchSession={handleSwitchSession}
        onForceRefresh={handleForceRefresh}
      />
    </div>
  );
}
