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
import { ensureAuthenticated } from './services/firebase';
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
  const [nurse] = useState<Nurse>(() => StorageService.loadNurse());
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

  // Session Connection Verification State (Specifically for Mobile Capture via QR)
  const [isVerifyingSession, setIsVerifyingSession] = useState<boolean>(false);
  const [sessionVerificationError, setSessionVerificationError] = useState<string | null>(null);

  // Diagnostics & Listener Health Monitoring State
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
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

  // 1. Initial Session Registration & Verification Pipeline
  useEffect(() => {
    const initApp = async () => {
      try {
        await ensureAuthenticated();
      } catch (err) {
        console.warn('Firebase initial authentication warning:', err);
      }

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
          setCurrentSession(result.session);
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
          // Explicit error: do NOT silently replace with a random new session!
          setSessionVerificationError(
            result.error || `클라우드 세션 [${sessionParam}]을 찾을 수 없습니다.`
          );
        }
      } else {
        // Station mode or direct standalone access: guarantee current session exists in Firestore
        try {
          await StorageService.ensureSessionInFirestore(currentSession);
        } catch (e) {
          console.warn('Failed to ensure current session in Firestore on startup:', e);
        }
      }
    };

    initApp();
  }, []);

  // 2. Real-time Firestore onSnapshot listener for the exact currentSession.sessionId
  useEffect(() => {
    if (!currentSession.sessionId || sessionVerificationError) return;

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
  }, [currentSession.sessionId, sessionVerificationError]);

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
          setDraftNote(payload);
          break;
        case 'EMR_RECORDS_UPDATED':
          setEmrRecords(payload);
          break;
        case 'NEW_SESSION_STARTED':
          if (payload && payload.sessionId !== currentSession.sessionId) {
            setCurrentSession(payload);
            setEvents([]);
            setFirestoreEventsCount(0);
            setIvSiteAssessment(null);
            setDraftNote(null);
            setPrescription(DEFAULT_PRESCRIPTION);
          }
          break;
        case 'SESSION_SWITCHED':
          if (payload && payload.session) {
            setCurrentSession(payload.session);
            if (payload.events) {
              setEvents(payload.events);
              setFirestoreEventsCount(payload.events.length);
            }
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
      setCurrentSession(newSession);
      setEvents([]);
      setFirestoreEventsCount(0);
      setIvSiteAssessment(null);
      setDraftNote(null);
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
        setCurrentSession(result.session);
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
        description = `처방 약물 [${prescription.medicationName}] 5-Right(환자, 약물, 용량, 경로, 시간) 대조 완료`;
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
      transcript: transcript.trim(),
    });

    const res = await StorageService.saveVoiceNote({
      transcript: transcript.trim(),
      sessionId: currentSession.sessionId,
      patientId: patient.id,
      nurseId: nurse.nurseId,
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
  const handleUpdateDraft = (draft: NursingRecord) => {
    setDraftNote(draft);
    StorageService.saveDraft(draft);
  };

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
            setEmrRecords(StorageService.loadEmrRecords());
            setDraftNote(StorageService.loadDraft());
            showToast('가상 병원 EMR 시스템으로 전자서명 간호기록이 안전하게 전송되었습니다.');
          }}
          onSwitchMode={handleSelectMode}
          onOpenFirebaseGuide={() => setIsFirebaseGuideOpen(true)}
          onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          onSimulateEvent={handleTriggerEvent}
        />
      )}

      {currentMode === 'CAPTURE' && (
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
