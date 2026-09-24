import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Camera,
  Mic,
  MicOff,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Play,
  Square,
  ShieldCheck,
  Radio,
  Cpu,
  Eye,
  Check,
  Sliders,
  Terminal,
  Sparkles,
  Volume2,
  ChevronRight,
  Info,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import {
  Patient,
  MedicationOrder,
  DemoSession,
  NursingEvent,
  EventType,
  EventSource,
  isStep4,
  isStep5,
} from '../types';
import {
  decodeBarcodeOrQrFromVideo,
  DetailedDecodeResult,
} from '../utils/zxingBarcodeDecoder';
import {
  verifyPatientQrCode,
  verifyMedicationBarcode,
  PatientVerificationResult,
  MedicationVerificationResult,
} from '../utils/codeVerification';
import { HandsFreeDiagnosticsModal } from './HandsFreeDiagnosticsModal';

interface HandsFreeDemoViewProps {
  isOpen: boolean;
  onClose: () => void;
  nurse: any;
  patient: Patient;
  prescription: MedicationOrder;
  currentSession: DemoSession;
  events: NursingEvent[];
  onTriggerEvent: (
    eventType: EventType,
    source?: EventSource,
    metadata?: any
  ) => Promise<{ success: boolean; message?: string }>;
  onConfirmVerification: (
    source: 'QR Scan' | 'Barcode Scan',
    fiveRightsVerified?: boolean
  ) => Promise<void>;
  onSaveVoiceNote: (transcript: string, linkedStep?: string, clinicalFindings?: any) => void;
  onEndDemo?: () => void;
}

// Voice Command Classifier: Prioritizes demo termination commands while protecting clinical medication commands
export function isDemoExitVoiceCommand(transcript: string): boolean {
  if (!transcript) return false;
  const text = transcript.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!text) return false;

  // 1. Explicit Clinical Action Guard: "투여 종료", "항생제 투여 종료" etc. are Step 5 clinical events, NOT demo exits!
  if (
    text.includes('투여 종료') ||
    text.includes('투여종료') ||
    text.includes('항생제 투여') ||
    text.includes('항생제투여') ||
    text.includes('약물 투여') ||
    text.includes('약물투여') ||
    text.includes('점적 투여') ||
    text.includes('주입 종료') ||
    text.includes('주입종료') ||
    text.includes('투약 종료') ||
    text.includes('투약종료')
  ) {
    return false;
  }

  // 2. Recognize "시연 종료" or "핸즈프리 종료" with Korean spacing flexibility
  const hasShiyeonEnd =
    /시연\s*종료/.test(text) ||
    text.includes('시연끝') ||
    text.includes('시연 끝') ||
    text.includes('시연 그만');

  const hasHandsFreeEnd =
    /핸즈프리\s*종료/.test(text) ||
    text.includes('핸즈프리끝') ||
    text.includes('핸즈프리 끝') ||
    text.includes('핸즈프리 그만');

  return hasShiyeonEnd || hasHandsFreeEnd;
}

// Web Audio API tactile audio chimes
function playScanChime(isSuccess: boolean = true) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (isSuccess) {
      // Ascending major chime (success)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15); // A6
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else {
      // Low dual warning buzzer (mismatch)
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.setValueAtTime(240, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (_) {}
}

export const HandsFreeDemoView: React.FC<HandsFreeDemoViewProps> = ({
  isOpen,
  onClose,
  nurse,
  patient,
  prescription,
  currentSession,
  events,
  onTriggerEvent,
  onConfirmVerification,
  onSaveVoiceNote,
  onEndDemo,
}) => {
  // Operating mode: 'SIMULTANEOUS' (camera + mic) vs 'AUTO_SWITCH' (step-aware alternation)
  const [operatingMode, setOperatingMode] = useState<'SIMULTANEOUS' | 'AUTO_SWITCH'>('SIMULTANEOUS');
  const [isDiagModalOpen, setIsDiagModalOpen] = useState(false);

  // Demo exit and confirmation state
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const [exitFeedbackMessage, setExitFeedbackMessage] = useState<string | null>(null);
  const [isProcessingExit, setIsProcessingExit] = useState(false);
  const isExitingDemoRef = useRef(false);
  const lastExitCommandTimeRef = useRef(0);
  const isExitConfirmOpenRef = useRef(false);
  isExitConfirmOpenRef.current = isExitConfirmOpen;

  // Camera & hardware states
  const [cameraState, setCameraState] = useState<'IDLE' | 'INITIALIZING' | 'STREAMING' | 'PAUSED' | 'ERROR'>('IDLE');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [cameraFps, setCameraFps] = useState<number>(0);

  // Optical Decoder Telemetry States
  const [decoderHz, setDecoderHz] = useState<number>(0);
  const [decodeAttempts, setDecodeAttempts] = useState<number>(0);
  const [decodeSuccessCount, setDecodeSuccessCount] = useState<number>(0);
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [lastDecodedRaw, setLastDecodedRaw] = useState<string>('');
  const [lastScanStatus, setLastScanStatus] = useState<'IDLE' | 'SCANNING' | 'MATCHED' | 'MISMATCH' | 'DECODE_FAILED'>('IDLE');
  const [firestoreSaveStatus, setFirestoreSaveStatus] = useState<'IDLE' | 'SAVING' | 'SUCCESS' | 'FAILED'>('IDLE');
  const [lastEngineUsed, setLastEngineUsed] = useState<string>('none');

  // Speech recognition states
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [recentTranscripts, setRecentTranscripts] = useState<string[]>([]);

  // Detected Code Candidate awaiting nurse confirmation (Prevents duplicate triggering)
  const [detectedMatch, setDetectedMatch] = useState<{
    step: 1 | 2;
    type: 'PATIENT_QR' | 'MEDICATION_BARCODE';
    code: string;
    isMatched: boolean;
    status: 'MATCHED' | 'MISMATCH';
    label: string;
    message: string;
    details: string[];
    patientData?: PatientVerificationResult;
    medicationData?: MedicationVerificationResult;
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // References
  const scanGenerationRef = useRef(0);
  const saveLockRef = useRef(false);
  const lastScannedCodeRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);
  const isScanningActiveRef = useRef<boolean>(false);
  const isEvaluatingRef = useRef<boolean>(false);
  const detectedMatchRef = useRef<any>(null);
  detectedMatchRef.current = detectedMatch;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const restartMicTimerRef = useRef<any>(null);
  const diagRestartTimerRef = useRef<any>(null);

  // Counters for live rates
  const frameCounterRef = useRef<{ frames: number; lastTime: number }>({ frames: 0, lastTime: performance.now() });
  const decoderRateRef = useRef<{ decodes: number; lastTime: number }>({ decodes: 0, lastTime: performance.now() });

  // Calculate current target step for session #4
  const sessionEvents = events.filter((e) => e.sessionId === currentSession.sessionId);
  const isPatientVerified = sessionEvents.some((e) => e.eventType === 'PATIENT_VERIFY');
  const isMedicationVerified = sessionEvents.some((e) => e.eventType === 'MEDICATION_VERIFY');
  const isIvSiteAssessed = sessionEvents.some((e) => e.eventType === 'IV_SITE_ASSESS');
  const hasInfusionStarted = sessionEvents.some((e) => isStep4(e.eventType));
  const hasInfusionEnded = sessionEvents.some((e) => isStep5(e.eventType));

  let currentTargetStep: 1 | 2 | 3 | 4 | 5 | 6 = 1;
  if (!isPatientVerified) currentTargetStep = 1;
  else if (!isMedicationVerified) currentTargetStep = 2;
  else if (!isIvSiteAssessed) currentTargetStep = 3;
  else if (!hasInfusionStarted) currentTargetStep = 4;
  else if (!hasInfusionEnded) currentTargetStep = 5;
  else currentTargetStep = 6;

  const completedStepsCount = [
    isPatientVerified,
    isMedicationVerified,
    isIvSiteAssessed,
    hasInfusionStarted,
    hasInfusionEnded,
  ].filter(Boolean).length;

  const isAllStepsCompleted = completedStepsCount === 5;

  const incompleteSteps: string[] = [];
  if (!isPatientVerified) incompleteSteps.push('1단계: 환자 손목밴드 QR 확인');
  if (!isMedicationVerified) incompleteSteps.push('2단계: 처방 약물 1D 바코드 확인');
  if (!isIvSiteAssessed) incompleteSteps.push('3단계: IV Site 정맥 주입 부위 사정');
  if (!hasInfusionStarted) incompleteSteps.push('4단계: 점적 투여 시작');
  if (!hasInfusionEnded) incompleteSteps.push('5단계: 점적 투여 종료');

  const requestDemoExitRef = useRef<(source?: 'VOICE' | 'BUTTON') => void>(() => {});
  const executeExitFlowRef = useRef<(isAllComplete: boolean) => Promise<void>>(async () => {});

  const currentTargetFormat: 'QR_CODE' | 'CODE_128' | 'NONE' =
    currentTargetStep === 1 ? 'QR_CODE' : currentTargetStep === 2 ? 'CODE_128' : 'NONE';

  const scanContextRef = useRef({ currentTargetFormat, currentTargetStep, sessionId: currentSession.sessionId });
  scanContextRef.current = { currentTargetFormat, currentTargetStep, sessionId: currentSession.sessionId };
  const codeHandlerRef = useRef<(text: string, format: string) => void>(() => {});

  // 1. Camera Lifecycle Management (Preserves DOM mount and handles iOS Safari)
  const attachStreamToVideo = async (stream: MediaStream): Promise<boolean> => {
    const video = videoRef.current;
    if (!video) {
      console.warn('[HandsFree] videoRef.current is null during attachStreamToVideo');
      return false;
    }

    try {
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.playsInline = true;
      video.muted = true;
      video.autoplay = true;

      await new Promise<void>((resolve) => {
        if (video.readyState >= 2 && video.videoWidth > 0) {
          resolve();
          return;
        }
        const onLoaded = () => {
          video.removeEventListener('loadedmetadata', onLoaded);
          video.removeEventListener('canplay', onLoaded);
          resolve();
        };
        video.addEventListener('loadedmetadata', onLoaded);
        video.addEventListener('canplay', onLoaded);
        setTimeout(resolve, 1000);
      });

      const playPromise = video.play();
      if (playPromise !== undefined) {
        await playPromise;
      }

      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setVideoDimensions({ width: video.videoWidth, height: video.videoHeight });
      }

      setCameraState('STREAMING');
      setCameraError(null);
      return true;
    } catch (err: any) {
      console.warn('[HandsFree] video.play error:', err);
      if (err.name === 'NotAllowedError') {
        setCameraError('iOS Safari 미디어 정책: 화면을 탭하여 비디오 재생을 시작해 주세요.');
      } else {
        setCameraError(err.message || '카메라 재생 실패');
      }
      setCameraState('ERROR');
      return false;
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    setCameraState('INITIALIZING');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('이 브라우저는 카메라 스트림(getUserMedia)을 지원하지 않습니다 (HTTPS 환경 확인 필요).');
      }

      stopCamera(false);
      const generation = scanGenerationRef.current;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (rearErr) {
        console.warn('[HandsFree] Rear camera request fallback:', rearErr);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      if (generation !== scanGenerationRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      streamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          console.warn('[HandsFree] Video track ended by OS');
          setCameraState('PAUSED');
          setCameraFps(0);
        };
      }

      const attached = await attachStreamToVideo(stream);
      if (attached && generation === scanGenerationRef.current) {
        isScanningActiveRef.current = true;
        startScanLoop();
      }
    } catch (err: any) {
      console.error('[HandsFree] Camera start error:', err);
      setCameraState('ERROR');
      setCameraError(
        err.name === 'NotAllowedError'
          ? '카메라 접근 권한이 거부되었습니다. Safari 설정에서 카메라를 허용해 주세요.'
          : err.message || '카메라를 시작할 수 없습니다.'
      );
      setCameraFps(0);
    }
  };

  const stopCamera = (setPausedState = true) => {
    scanGenerationRef.current++;
    isEvaluatingRef.current = false;
    isScanningActiveRef.current = false;
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (_) {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (setPausedState) {
      setCameraState('PAUSED');
    }
    setCameraFps(0);
    setDecoderHz(0);
    setVideoDimensions({ width: 0, height: 0 });
  };

  // 2. Continuous Video Frame Scanner & FPS/DecoderHz Measurement Loop
  const startScanLoop = () => {
    frameCounterRef.current = { frames: 0, lastTime: performance.now() };
    decoderRateRef.current = { decodes: 0, lastTime: performance.now() };
    let lastScanEvalTime = 0;
    let lastVideoTime = -1;
    const generation = scanGenerationRef.current;

    const scanFrame = () => {
      if (!isScanningActiveRef.current || generation !== scanGenerationRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (
        video &&
        video.readyState >= 2 &&
        !video.paused &&
        !video.ended &&
        video.videoWidth > 0
      ) {
        const now = performance.now();
        // Count advancing media frames, not display refresh callbacks.
        if (video.currentTime !== lastVideoTime) {
          frameCounterRef.current.frames++;
          lastVideoTime = video.currentTime;
        }

        // A. Camera FPS Measurement (1 second rolling window)
        if (now - frameCounterRef.current.lastTime >= 1000) {
          const elapsed = (now - frameCounterRef.current.lastTime) / 1000;
          const actualFps = Math.round(frameCounterRef.current.frames / elapsed);
          setCameraFps(actualFps);
          frameCounterRef.current.frames = 0;
          frameCounterRef.current.lastTime = now;

          if (video.videoWidth > 0 && videoDimensions.width !== video.videoWidth) {
            setVideoDimensions({ width: video.videoWidth, height: video.videoHeight });
          }
        }

        // B. Decoder Execution Rate Measurement (1 second rolling window)
        if (now - decoderRateRef.current.lastTime >= 1000) {
          const elapsed = (now - decoderRateRef.current.lastTime) / 1000;
          const actualHz = Math.round(decoderRateRef.current.decodes / elapsed);
          setDecoderHz(actualHz);
          decoderRateRef.current.decodes = 0;
          decoderRateRef.current.lastTime = now;
        }

        // C. Optical Recognition Trigger (5 to 6 times per sec: interval 180ms)
        // Runs ONLY when in Step 1 (QR) or Step 2 (Barcode) and NO pending confirmation modal is active
        const targetFormat = scanContextRef.current.currentTargetFormat;
        const sessionId = scanContextRef.current.sessionId;
        const canScan =
          targetFormat !== 'NONE' &&
          !detectedMatchRef.current &&
          !isEvaluatingRef.current &&
          now - lastScanEvalTime >= 180;

        if (canScan) {
          lastScanEvalTime = now;
          isEvaluatingRef.current = true;
          decoderRateRef.current.decodes++;
          setDecodeAttempts((prev) => prev + 1);

          decodeBarcodeOrQrFromVideo(video, targetFormat, canvas)
            .then((result: DetailedDecodeResult) => {
              if (generation !== scanGenerationRef.current || !isScanningActiveRef.current ||
                  targetFormat !== scanContextRef.current.currentTargetFormat || sessionId !== scanContextRef.current.sessionId) return;
              if (result.canvasDimensions) {
                setCanvasDimensions(result.canvasDimensions);
              }

              if (result.success && result.text) {
                setDecodeSuccessCount((prev) => prev + 1);
                setLastDecodedRaw(result.text);
                setLastEngineUsed(result.engine || 'zxing');
                codeHandlerRef.current(result.text, result.format || targetFormat);
              } else {
                // Evaluated successfully, but no code detected in this frame
                if (!detectedMatchRef.current) {
                  setLastScanStatus('DECODE_FAILED');
                }
              }
            })
            .catch((err) => {
              console.warn('[HandsFree] Decoder evaluation error (safe):', err);
            })
            .finally(() => {
              if (generation === scanGenerationRef.current) isEvaluatingRef.current = false;
            });
        }
      } else {
        const now = performance.now();
        if (now - frameCounterRef.current.lastTime >= 1000) {
          setCameraFps(0);
          setDecoderHz(0);
          frameCounterRef.current.frames = 0;
          frameCounterRef.current.lastTime = now;
        }
      }

      animFrameIdRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameIdRef.current = requestAnimationFrame(scanFrame);
  };

  // 3. Speech Recognition Initialization
  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError('이 브라우저는 Web Speech API를 지원하지 않습니다.');
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'ko-KR';
      recognitionRef.current = rec;

      rec.onstart = () => {
        setIsListening(true);
        setVoiceError(null);
      };

      rec.onresult = (evt: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = evt.resultIndex; i < evt.results.length; ++i) {
          const trans = evt.results[i][0].transcript;
          if (evt.results[i].isFinal) {
            finalTranscript += trans;
          } else {
            interimTranscript += trans;
          }
        }

        const text = (finalTranscript || interimTranscript).trim();
        if (text) {
          // A. If Exit Confirmation Dialog is open, listen for confirmation or cancellation
          if (isExitConfirmOpenRef.current) {
            const lower = text.toLowerCase();
            if (
              lower.includes('종료') ||
              lower.includes('확인') ||
              lower.includes('네') ||
              lower.includes('시연 종료') ||
              lower.includes('핸즈프리 종료') ||
              lower.includes('끝내')
            ) {
              console.log('[HandsFree Speech] Exit confirmed by voice:', text);
              executeExitFlowRef.current(false);
              return;
            }
            if (
              lower.includes('취소') ||
              lower.includes('계속') ||
              lower.includes('아니') ||
              lower.includes('유지')
            ) {
              console.log('[HandsFree Speech] Exit confirmation cancelled by voice:', text);
              setIsExitConfirmOpen(false);
              return;
            }
          }

          // B. Classify Exit Command FIRST before any clinical nursing finding
          if (isDemoExitVoiceCommand(text)) {
            console.log('[HandsFree Speech] Demo exit command detected:', text);
            setCurrentTranscript('');
            requestDemoExitRef.current('VOICE');
            return;
          }

          // C. Normal Clinical Speech Handling
          setCurrentTranscript(text);
          if (finalTranscript) {
            setRecentTranscripts((prev) => [finalTranscript, ...prev.slice(0, 4)]);
            handleVoiceIntent(finalTranscript);
          }
        }
      };

      rec.onerror = (e: any) => {
        console.warn('[HandsFree] Speech recognition error:', e.error);
        if (e.error !== 'no-speech') {
          setVoiceError(`음성: ${e.error}`);
        }
      };

      rec.onend = () => {
        setIsListening(false);
        if (isOpen && (operatingMode === 'SIMULTANEOUS' || currentTargetStep >= 3) && !isDiagModalOpen) {
          clearTimeout(restartMicTimerRef.current);
          restartMicTimerRef.current = setTimeout(() => {
            try {
              if (recognitionRef.current) {
                recognitionRef.current.start();
              }
            } catch (_) {}
          }, 400);
        }
      };

      rec.start();
    } catch (err: any) {
      console.warn('[HandsFree] Failed to start speech recognition:', err);
      setVoiceError('음성 인식 시작 대기 중');
    }
  }, [isOpen, operatingMode, currentTargetStep, isDiagModalOpen]);

  const stopSpeechRecognition = () => {
    clearTimeout(restartMicTimerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.abort();
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  // Demo Exit Implementation
  const executeExitFlow = async (isAllComplete: boolean) => {
    if (isExitingDemoRef.current) return;
    isExitingDemoRef.current = true;
    setIsProcessingExit(true);
    setIsExitConfirmOpen(false);

    // 3. 진행 중인 Firestore 저장 작업 확인
    if (saveLockRef.current || isSaving) {
      setExitFeedbackMessage('진행 중인 Firestore 기록 저장 결과를 확인하고 있습니다...');
      let waitIterations = 0;
      while ((saveLockRef.current || isSaving) && waitIterations < 25) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        waitIterations++;
      }
      if (firestoreSaveStatus === 'FAILED') {
        setExitFeedbackMessage('⚠️ 진행 중이던 Firestore 저장에 실패했습니다. 시연 종료를 보류합니다.');
        isExitingDemoRef.current = false;
        setIsProcessingExit(false);
        return;
      }
    }

    const message = isAllComplete
      ? '핸즈프리 시연을 종료합니다'
      : '핸즈프리 시연을 종료하고 간호 Station으로 이동합니다';
    setExitFeedbackMessage(message);

    // 오디오 피드백 및 음성 TTS (지원 브라우저)
    try {
      playScanChime(true);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance('핸즈프리 시연을 종료합니다');
        utterance.lang = 'ko-KR';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    } catch (_) {}

    // 4. 카메라 스트림, 음성 인식 및 QR/바코드 디코딩 루프 정상 정리 (iPhone Safari 리소스 완전 해제)
    stopCamera(true);
    stopSpeechRecognition();

    // 6. 모바일 Station 화면으로 이동하고 '주요 간호 작업 바로가기' 영역으로 이동
    setTimeout(() => {
      setIsProcessingExit(false);
      setExitFeedbackMessage(null);
      isExitingDemoRef.current = false;
      if (onEndDemo) {
        onEndDemo();
      } else {
        onClose();
      }
    }, 750);
  };

  const requestDemoExit = useCallback((source: 'VOICE' | 'BUTTON' = 'BUTTON') => {
    const now = Date.now();
    if (isExitingDemoRef.current || now - lastExitCommandTimeRef.current < 1500) {
      return;
    }
    lastExitCommandTimeRef.current = now;

    console.log(`[HandsFree] Exit requested via ${source}. Completed: ${completedStepsCount}/5, isAllDone: ${isAllStepsCompleted}`);

    if (isAllStepsCompleted) {
      // 5단계 완료 시 피드백 후 바로 자동 종료
      executeExitFlow(true);
    } else {
      // 미완료 단계가 있을 시 사용자 확인 대화창 표시
      setIsExitConfirmOpen(true);
    }
  }, [isAllStepsCompleted, completedStepsCount]);

  requestDemoExitRef.current = requestDemoExit;
  executeExitFlowRef.current = executeExitFlow;

  // 4. Autonomous Code Detection & Verification Dispatcher
  const handleAutonomousCode = (decodedText: string, format: string) => {
    const raw = decodedText.trim();
    if (!raw || detectedMatchRef.current || saveLockRef.current) return;
    if ((currentTargetStep === 1 && format !== 'QR_CODE') || (currentTargetStep === 2 && format !== 'CODE_128')) return;

    const now = Date.now();

    // Prevent duplicate repeated popups for the exact same scanned code within 2.5s
    if (raw === lastScannedCodeRef.current && now - lastScanTimeRef.current < 2500) {
      return;
    }

    lastScannedCodeRef.current = raw;
    lastScanTimeRef.current = now;

    // STEP 1: Patient Wristband QR Verification
    if (currentTargetStep === 1) {
      const pResult = verifyPatientQrCode(raw, patient);
      setLastScanStatus(pResult.status);
      playScanChime(pResult.isMatch);

      setDetectedMatch({
        step: 1,
        type: 'PATIENT_QR',
        code: raw,
        isMatched: pResult.isMatch,
        status: pResult.status,
        label: pResult.isMatch ? '환자 손목밴드 QR 일치 (MATCHED)' : '경고: 환자 불일치 (MISMATCH)',
        message: pResult.message,
        details: [
          ...pResult.details,
          `해독 포맷: ${format}`,
          `엔진: ${lastEngineUsed}`,
        ],
        patientData: pResult,
      });
      return;
    }

    // STEP 2: Medication Code 128 Verification
    if (currentTargetStep === 2) {
      const mResult = verifyMedicationBarcode(raw, prescription, patient);
      setLastScanStatus(mResult.status);
      playScanChime(mResult.isMatch);

      setDetectedMatch({
        step: 2,
        type: 'MEDICATION_BARCODE',
        code: raw,
        isMatched: mResult.isMatch,
        status: mResult.status,
        label: mResult.isMatch ? '처방 약물 바코드 일치 (MATCHED)' : '경고: 처방 외 약물 불일치 (MISMATCH)',
        message: mResult.message,
        details: [
          ...mResult.details,
          `해독 포맷: ${format}`,
          `엔진: ${lastEngineUsed}`,
        ],
        medicationData: mResult,
      });
      return;
    }
  };

  codeHandlerRef.current = handleAutonomousCode;

  // 5. Explicit Nurse Confirmation & Real-time Firestore Event Recording
  const handleConfirmDetectedCode = async () => {
    if (!detectedMatch || !detectedMatch.isMatched || saveLockRef.current ||
        detectedMatch.step !== currentTargetStep || currentSession.status === 'COMPLETED') return;
    saveLockRef.current = true;
    setIsSaving(true);
    setFirestoreSaveStatus('SAVING');
    setSaveMessage(null);

    try {
      if (detectedMatch.step === 1) {
        // Record STEP 1: PATIENT_VERIFY in Firestore
        const res = await onTriggerEvent('PATIENT_VERIFY', 'QR Scan', {
          source: 'QR_SCAN',
          deviceType: 'HANDS_FREE_WEARABLE',
          scannedCode: detectedMatch.code,
          isMatched: detectedMatch.isMatched,
          patientId: detectedMatch.patientData?.scannedId || patient.id,
          patientName: detectedMatch.patientData?.scannedName || patient.name,
        });

        if (res.success) {
          setFirestoreSaveStatus('SUCCESS');
          setSaveMessage(`[1단계 완료] 환자(${patient.name}) 확인 이벤트가 Firestore에 저장되었습니다. 2단계(약물 바코드)로 전환합니다.`);
          setDetectedMatch(null);
        } else {
          setFirestoreSaveStatus('FAILED');
          setSaveMessage(`저장 실패: ${res.message}`);
        }
      } else if (detectedMatch.step === 2) {
        // Record STEP 2: MEDICATION_VERIFY in Firestore
        const res = await onTriggerEvent('MEDICATION_VERIFY', 'Barcode Scan', {
          source: 'BARCODE_SCAN',
          deviceType: 'HANDS_FREE_WEARABLE',
          scannedCode: detectedMatch.code,
          isMatched: detectedMatch.isMatched,
          fiveRightsVerified: false,
          rxId: detectedMatch.medicationData?.rxId || prescription.id,
          medicationName: detectedMatch.medicationData?.medName || prescription.medicationName,
        });

        if (res.success) {
          setFirestoreSaveStatus('SUCCESS');
          setSaveMessage(`[2단계 완료] 약물(${prescription.medicationName}) 바코드 일치 이벤트가 Firestore에 저장되었습니다. 5-Rights는 간호사 별도 확인이 필요합니다.`);
          setDetectedMatch(null);
        } else {
          setFirestoreSaveStatus('FAILED');
          setSaveMessage(`저장 실패: ${res.message}`);
        }
      }
    } catch (err: any) {
      setFirestoreSaveStatus('FAILED');
      setSaveMessage(`저장 오류: ${err.message || err}`);
    } finally {
      saveLockRef.current = false;
      setIsSaving(false);
    }
  };

  // 6. Voice Intent & Note Handling
  const handleVoiceIntent = (phrase: string) => {
    console.log('[HandsFree Voice Intent Heard]:', phrase);

    // Rule 3: Guard exit command again if triggered via finalTranscript
    if (isDemoExitVoiceCommand(phrase)) {
      requestDemoExitRef.current('VOICE');
      return;
    }

    // Rule 4: Clinical medication/infusion completion (Step 5)
    // "투여 종료", "항생제 투여 종료"는 기존 간호 행위로 처리하며 시연 종료로 오인하지 않는다.
    const isInfusionEndCommand =
      (phrase.includes('투여') && phrase.includes('종료')) ||
      phrase.includes('항생제 종료') ||
      phrase.includes('항생제투여종료') ||
      phrase.includes('약물 투여 종료') ||
      phrase.includes('주입 종료') ||
      phrase.includes('투약 종료');

    if (isInfusionEndCommand) {
      console.log('[HandsFree Voice] Clinical medication end command (Step 5):', phrase);
      if (currentTargetStep === 5 || hasInfusionStarted) {
        onTriggerEvent('MEDICATION_END', 'Voice Confirmation', {
          source: 'VOICE_AI_CONFIRMED',
          transcript: phrase,
        }).then((res) => {
          if (res.success) {
            setSaveMessage('항생제 투여 종료 완료 기록 (5/5)');
          } else {
            setSaveMessage(`저장 실패: ${res.message}`);
          }
        });
      } else {
        onSaveVoiceNote(phrase, 'INFUSION_END', {});
        setSaveMessage(`투여 종료 소견 기록: "${phrase.slice(0, 20)}..."`);
      }
      return;
    }

    // Clinical medication/infusion start (Step 4)
    const isInfusionStartCommand =
      (phrase.includes('투여') && phrase.includes('시작')) ||
      phrase.includes('항생제 시작') ||
      phrase.includes('항생제투여시작') ||
      phrase.includes('약물 투여 시작') ||
      phrase.includes('주입 시작');

    if (isInfusionStartCommand && currentTargetStep === 4) {
      console.log('[HandsFree Voice] Clinical medication start command (Step 4):', phrase);
      onTriggerEvent('MEDICATION_START', 'Voice Confirmation', {
        source: 'VOICE_AI_CONFIRMED',
        transcript: phrase,
      }).then((res) => {
        if (res.success) {
          setSaveMessage('항생제 투여 시작 완료 기록 (4/5)');
        } else {
          setSaveMessage(`저장 실패: ${res.message}`);
        }
      });
      return;
    }

    // Clinical IV site assessment (Step 3)
    const isIvRelated =
      phrase.includes('정맥') ||
      phrase.includes('발적') ||
      phrase.includes('부종') ||
      phrase.includes('통증') ||
      phrase.includes('이상 없음') ||
      phrase.includes('정상');

    if (isIvRelated && currentTargetStep === 3) {
      onSaveVoiceNote(phrase, 'IV_SITE_ASSESS', {
        hasPain: phrase.includes('통증 있음'),
        hasRedness: phrase.includes('발적 있음'),
        hasSwelling: phrase.includes('부종 있음'),
      });
      setSaveMessage(`음성 소견 반영됨: "${phrase.slice(0, 25)}..."`);
    }
  };

  const handleSaveCurrentVoiceNote = () => {
    if (!currentTranscript.trim()) return;
    onSaveVoiceNote(
      currentTranscript,
      currentTargetStep === 3
        ? 'IV_SITE_ASSESS'
        : currentTargetStep === 4
        ? 'INFUSION_START'
        : currentTargetStep === 5
        ? 'INFUSION_END'
        : 'GENERAL',
      {}
    );
    setSaveMessage(`음성 간호 메모 저장 완료 ("${currentTranscript.slice(0, 20)}...")`);
    setCurrentTranscript('');
  };

  // 7. Diagnostics Modal Lifecycle Hand-off
  const handleOpenDiagnostics = () => {
    stopCamera(true);
    stopSpeechRecognition();
    setIsDiagModalOpen(true);
  };

  const handleCloseDiagnostics = () => {
    // The operating-mode effect is the sole owner of camera restart.
    setIsDiagModalOpen(false);
  };

  // 8. Operating Mode Management Effect
  useEffect(() => {
    if (!isOpen || isDiagModalOpen) {
      stopCamera(true);
      stopSpeechRecognition();
      return;
    }

    if (operatingMode === 'SIMULTANEOUS') {
      startCamera();
      startSpeechRecognition();
    } else {
      // AUTO_SWITCH Mode
      if (currentTargetStep === 1 || currentTargetStep === 2) {
        startCamera();
        stopSpeechRecognition();
      } else {
        stopCamera(true);
        startSpeechRecognition();
      }
    }

    return () => {
      stopCamera(true);
      stopSpeechRecognition();
      clearTimeout(diagRestartTimerRef.current);
      clearTimeout(restartMicTimerRef.current);
    };
  }, [isOpen, operatingMode, currentTargetStep, isDiagModalOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between text-white overflow-hidden select-none">
      {/* Top HUD Bar */}
      <header className="absolute top-0 inset-x-0 z-30 p-3 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              cameraState === 'STREAMING' && cameraFps > 0
                ? 'bg-emerald-400 animate-ping'
                : cameraState === 'INITIALIZING'
                ? 'bg-sky-400 animate-pulse'
                : 'bg-amber-400'
            }`}
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xs tracking-wider text-teal-300">
                AI 핸즈프리 시연 (Wearable HUD)
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-teal-950/80 text-teal-300 border border-teal-800">
                {operatingMode === 'SIMULTANEOUS' ? '동시 실행' : '자동 전환'}
              </span>
            </div>
            <div className="text-[10px] text-slate-300 flex items-center gap-1.5">
              <span>환자: {patient.name} ({patient.room})</span>
              <span>•</span>
              <span className="text-teal-400 font-mono">#{currentSession.sessionNumber}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Operating Mode Toggle */}
          <button
            type="button"
            onClick={() =>
              setOperatingMode((prev) => (prev === 'SIMULTANEOUS' ? 'AUTO_SWITCH' : 'SIMULTANEOUS'))
            }
            className="text-[10px] px-2 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 transition"
            title="동시 실행 vs 스마트 자동 전환 전환"
          >
            <Sliders className="w-3 h-3 text-purple-400" />
            <span>{operatingMode === 'SIMULTANEOUS' ? '동시 모드' : '전환 모드'}</span>
          </button>

          {/* Diagnostic Inspector */}
          <button
            type="button"
            onClick={handleOpenDiagnostics}
            className="text-[10px] px-2.5 py-1 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-700 text-purple-300 font-medium flex items-center gap-1 transition"
            title="하드웨어 및 브라우저 호환성 진단"
          >
            <Terminal className="w-3 h-3 text-purple-400" />
            <span>진단</span>
          </button>

          {/* Manual Exit Button: Always accessible if voice is unavailable or noisy */}
          <button
            type="button"
            onClick={() => requestDemoExit('BUTTON')}
            className="text-[10px] px-2.5 py-1 rounded-xl bg-rose-950/90 hover:bg-rose-900 border border-rose-700 text-rose-200 font-bold flex items-center gap-1 transition shadow-xs"
            title="웨어러블 핸즈프리 시연 종료"
          >
            <Square className="w-3 h-3 text-rose-400 fill-rose-400/40" />
            <span>시연 종료</span>
          </button>

          {/* Close / Exit Demo */}
          <button
            type="button"
            onClick={() => requestDemoExit('BUTTON')}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
            title="시연 모드 종료"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Viewport: Camera Feed + Augmented Reticle */}
      <div
        onClick={() => {
          if (videoRef.current && videoRef.current.paused && cameraState === 'STREAMING') {
            videoRef.current.play().catch(console.error);
          }
        }}
        className="relative flex-1 w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden"
      >
        {/* Hidden processing canvas for optical analysis */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Video element is ALWAYS rendered in DOM to preserve ref and prevent srcObject null timing issues */}
        <video
          ref={videoRef}
          playsInline
          webkit-playsinline="true"
          muted
          autoPlay
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            cameraState === 'STREAMING' && cameraFps > 0 ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Initializing / Connecting Overlay */}
        {cameraState === 'INITIALIZING' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 space-y-3 bg-slate-950/90 z-10">
            <RefreshCw className="w-8 h-8 text-teal-400 animate-spin" />
            <div className="text-center space-y-1">
              <h4 className="font-bold text-sm text-slate-200">후면 카메라 연결 중...</h4>
              <p className="text-xs text-slate-400">아이폰 비디오 스트림을 초기화하고 있습니다.</p>
            </div>
          </div>
        )}

        {/* Error Overlay with Reconnect Action */}
        {cameraState === 'ERROR' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 space-y-3 bg-slate-950/95 z-10">
            <AlertTriangle className="w-10 h-10 text-rose-400" />
            <div className="text-center space-y-1">
              <h4 className="font-bold text-sm text-rose-300">카메라 연결 오류</h4>
              <p className="text-xs text-slate-300 max-w-xs">{cameraError || '카메라 스트림을 시작할 수 없습니다.'}</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                startCamera();
              }}
              className="text-xs px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-teal-900/40 transition active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>카메라 다시 연결</span>
            </button>
          </div>
        )}

        {/* Standby / Step-Aware Audio Focus Mode (Steps 3-5) */}
        {cameraState === 'PAUSED' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 space-y-3 bg-slate-950/90 z-10">
            <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
              {currentTargetStep >= 3 ? (
                <Mic className="w-8 h-8 text-purple-400 animate-pulse" />
              ) : (
                <Camera className="w-8 h-8 text-slate-500" />
              )}
            </div>
            <div className="text-center space-y-1">
              <h4 className="font-bold text-sm text-slate-200">
                {currentTargetStep >= 3 ? '음성 사정 및 확인 단계 (카메라 대기 중)' : '카메라 일시 중지'}
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                {currentTargetStep >= 3
                  ? '스마트 자동 전환 정책에 따라 카메라를 일시 중지하고 음성 마이크에 집중합니다.'
                  : '스캔 단계 진입 시 카메라가 자동으로 가동됩니다.'}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                startCamera();
              }}
              className="text-xs px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold transition"
            >
              카메라 켜기
            </button>
          </div>
        )}

        {/* Tap to Resume Video Overlay (when stream is attached but playback is paused by Safari) */}
        {cameraState === 'STREAMING' && cameraFps === 0 && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (videoRef.current) {
                videoRef.current.play().then(() => {
                  setCameraError(null);
                }).catch((err) => {
                  console.error('Play error on tap:', err);
                });
              }
            }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 bg-black/70 backdrop-blur-xs cursor-pointer"
          >
            <Play className="w-12 h-12 text-teal-400 fill-teal-400/30 animate-pulse mb-2" />
            <p className="font-bold text-sm text-white">화면을 터치하여 카메라 영상을 시작하세요</p>
            <p className="text-[11px] text-slate-300 mt-1">iOS Safari 비디오 재생 권한 활성화</p>
          </div>
        )}

        {/* Optical Viewfinder Reticle (Only when camera is actively streaming with frames) */}
        {cameraState === 'STREAMING' && cameraFps > 0 && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
            <div
              className={`relative w-64 h-64 sm:w-72 sm:h-72 border-2 rounded-3xl overflow-hidden shadow-2xl transition-colors duration-300 ${
                lastScanStatus === 'MATCHED'
                  ? 'border-emerald-400 shadow-emerald-500/30'
                  : lastScanStatus === 'MISMATCH'
                  ? 'border-rose-400 shadow-rose-500/30'
                  : 'border-teal-400/50 shadow-teal-500/20'
              }`}
            >
              <div className="absolute top-2 left-2 w-6 h-6 border-t-4 border-l-4 border-teal-400 rounded-tl-lg" />
              <div className="absolute top-2 right-2 w-6 h-6 border-t-4 border-r-4 border-teal-400 rounded-tr-lg" />
              <div className="absolute bottom-2 left-2 w-6 h-6 border-b-4 border-l-4 border-teal-400 rounded-bl-lg" />
              <div className="absolute bottom-2 right-2 w-6 h-6 border-b-4 border-r-4 border-teal-400 rounded-br-lg" />

              <div
                className={`absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-teal-300 to-transparent animate-pulse shadow-[0_0_12px_#2dd4bf] top-1/2 -translate-y-1/2 ${
                  isEvaluatingRef.current ? 'opacity-100' : 'opacity-60'
                }`}
              />

              <div className="absolute bottom-3 inset-x-3 text-center">
                <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-black/70 text-teal-300 backdrop-blur-sm border border-teal-500/30 inline-block">
                  {currentTargetStep === 1 && '타겟: 1단계 환자 손목밴드 QR'}
                  {currentTargetStep === 2 && '타겟: 2단계 처방약물 Code 128 바코드'}
                  {currentTargetStep >= 3 && '음성 소견 청취 중'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Live Hardware Telemetry Pill (Distinctly shows Camera FPS and Actual Decoder Hz) */}
        <div className="absolute top-16 left-3 z-20 flex flex-wrap items-center gap-1.5 pointer-events-none">
          {/* Camera FPS */}
          <span
            className={`px-2 py-0.5 rounded-full backdrop-blur-md text-[10px] font-mono border flex items-center gap-1 ${
              cameraState === 'STREAMING' && cameraFps > 0
                ? 'bg-black/60 text-teal-300 border-teal-500/30'
                : cameraState === 'INITIALIZING'
                ? 'bg-sky-950/80 text-sky-300 border-sky-600 animate-pulse'
                : cameraState === 'ERROR'
                ? 'bg-rose-950/80 text-rose-300 border-rose-600'
                : 'bg-black/60 text-slate-400 border-slate-700'
            }`}
          >
            <Camera className="w-3 h-3 text-teal-400" />
            <span>
              {cameraState === 'STREAMING' && cameraFps > 0
                ? `${cameraFps} FPS`
                : cameraState === 'STREAMING'
                ? '0 FPS'
                : cameraState === 'INITIALIZING'
                ? '연결 중...'
                : '대기'}
            </span>
          </span>

          {/* Decoder Execution Rate (Hz) & Target */}
          {currentTargetStep <= 2 && (
            <span
              className={`px-2 py-0.5 rounded-full backdrop-blur-md text-[10px] font-mono border flex items-center gap-1 ${
                decoderHz > 0
                  ? 'bg-teal-950/80 text-teal-300 border-teal-600'
                  : 'bg-black/60 text-slate-400 border-slate-700'
              }`}
            >
              <Eye className="w-3 h-3 text-teal-400" />
              <span>
                디코더: {decoderHz} Hz ({currentTargetFormat})
              </span>
            </span>
          )}

          {/* Speech Mic Status */}
          <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-mono text-purple-300 border border-purple-500/30 flex items-center gap-1">
            <Mic className="w-3 h-3 text-purple-400" />
            <span>{isListening ? 'MIC ON' : 'STANDBY'}</span>
          </span>

          {/* Decode Status Tag */}
          <span
            className={`px-2 py-0.5 rounded-full backdrop-blur-md text-[10px] font-mono border ${
              lastScanStatus === 'MATCHED'
                ? 'bg-emerald-950 text-emerald-300 border-emerald-500'
                : lastScanStatus === 'MISMATCH'
                ? 'bg-rose-950 text-rose-300 border-rose-500'
                : lastScanStatus === 'DECODE_FAILED'
                ? 'bg-slate-900/80 text-slate-400 border-slate-700'
                : 'bg-black/60 text-slate-500 border-slate-800'
            }`}
          >
            {lastScanStatus === 'MATCHED'
              ? 'MATCHED'
              : lastScanStatus === 'MISMATCH'
              ? 'MISMATCH'
              : lastScanStatus === 'DECODE_FAILED'
              ? '분석 중 (미검출)'
              : '대기'}
          </span>
        </div>

        {/* Save feedback banner */}
        {saveMessage && (
          <div className="absolute top-24 inset-x-4 z-40 p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs font-medium flex items-center justify-between shadow-xl animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{saveMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSaveMessage(null)}
              className="text-slate-400 hover:text-white px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Error notification banner */}
        {(cameraError || voiceError) && cameraState !== 'ERROR' && (
          <div className="absolute top-24 inset-x-4 z-40 p-2.5 rounded-xl bg-rose-950/90 border border-rose-600 text-rose-200 text-xs font-medium flex items-center justify-between shadow-xl">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{cameraError || voiceError}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setCameraError(null);
                setVoiceError(null);
              }}
              className="text-slate-400 hover:text-white px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Detected Code Confirmation Overlay: Nurse Confirmation Required */}
        {detectedMatch && (
          <div
            className={`absolute inset-x-4 bottom-24 z-40 p-4 rounded-3xl border-2 text-white shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom duration-200 ${
              detectedMatch.isMatched
                ? 'bg-slate-900/95 border-emerald-400'
                : 'bg-rose-950/95 border-rose-500'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`p-1.5 rounded-lg ${
                    detectedMatch.isMatched
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {detectedMatch.isMatched ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-rose-300" />
                  )}
                </div>
                <div>
                  <h4
                    className={`font-extrabold text-sm ${
                      detectedMatch.isMatched ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {detectedMatch.label}
                  </h4>
                  <span className="text-[10px] text-slate-300 font-mono">
                    {detectedMatch.isMatched
                      ? '광학 자동 인식 성공 • 간호사 확인 후 저장'
                      : '경고: 기준 데이터와 일치하지 않습니다'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetectedMatch(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 my-2.5 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
              {detectedMatch.details.map((line, idx) => (
                <div key={idx} className="text-slate-200 font-medium">
                  • {line}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setDetectedMatch(null);
                  lastScannedCodeRef.current = '';
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                다시 스캔
              </button>
              <button
                type="button"
                disabled={isSaving || !detectedMatch.isMatched}
                onClick={handleConfirmDetectedCode}
                className={`flex-2 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg transition ${
                  detectedMatch.isMatched
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                }`}
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Firestore 저장 중...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>
                      {detectedMatch.step === 1
                        ? '환자 확인 및 Firestore 기록 (1/5)'
                        : '약물 바코드 일치 확인 및 기록 (2/5)'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom HUD Control Panel: Workflow Steps + Live Voice Feed */}
      <footer className="z-30 bg-slate-950/95 border-t border-slate-800/80 p-3.5 space-y-3">
        {/* Step Progression Ribbon */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-200 text-xs">
              현재 단계: {currentTargetStep} / 5
            </span>
            <span className="text-[10px] text-teal-400 font-semibold">
              {currentTargetStep === 1 && '(환자 식별 QR)'}
              {currentTargetStep === 2 && '(약물 바코드 Code 128)'}
              {currentTargetStep === 3 && '(IV Site 사정)'}
              {currentTargetStep === 4 && '(투여 시작)'}
              {currentTargetStep === 5 && '(투여 종료)'}
              {currentTargetStep === 6 && '(모든 행위 완료)'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((stepNum) => {
              const isDone =
                (stepNum === 1 && isPatientVerified) ||
                (stepNum === 2 && isMedicationVerified) ||
                (stepNum === 3 && isIvSiteAssessed) ||
                (stepNum === 4 && hasInfusionStarted) ||
                (stepNum === 5 && hasInfusionEnded);

              return (
                <div
                  key={stepNum}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isDone
                      ? 'bg-emerald-500 text-slate-950 font-extrabold'
                      : stepNum === currentTargetStep
                      ? 'bg-teal-900 border border-teal-400 text-teal-300 animate-pulse'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {isDone ? '✓' : stepNum}
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Voice Transcript Bar */}
        <div className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            <div className="p-1 rounded-lg bg-purple-500/20 text-purple-400 shrink-0">
              <Mic className={`w-3.5 h-3.5 ${isListening ? 'animate-pulse text-purple-300' : ''}`} />
            </div>
            <div className="truncate text-slate-300 text-[11px]">
              {currentTranscript ? (
                <span className="text-white font-medium">"{currentTranscript}"</span>
              ) : (
                <span className="text-slate-500 italic">
                  {isListening
                    ? '간호 소견 말씀 중... ("정맥주사 이상 없음", "항생제 시작")'
                    : '음성 인식 대기 중'}
                </span>
              )}
            </div>
          </div>

          {currentTranscript && (
            <button
              type="button"
              onClick={handleSaveCurrentVoiceNote}
              className="px-2.5 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] shrink-0 flex items-center gap-1 transition shadow-sm"
              title="인식된 텍스트를 VOICE_NOTE로 Firestore에 저장"
            >
              <Sparkles className="w-3 h-3" />
              <span>음성 저장</span>
            </button>
          )}
        </div>

        {/* Step 3/4/5 Action Buttons in HUD */}
        {currentTargetStep === 3 && (
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={async () => {
                setIsSaving(true);
                const res = await onTriggerEvent('IV_SITE_ASSESS', 'Voice Confirmation', {
                  source: 'VOICE_AI_CONFIRMED',
                  transcript: currentTranscript || 'IV 부위 발적/부종/통증 없음 (핸즈프리 확인)',
                });
                setIsSaving(false);
                if (res.success) setSaveMessage('IV Site 사정 완료 등록');
              }}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition active:scale-98"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>IV Site 정상 완료 확인</span>
            </button>
          </div>
        )}

        {currentTargetStep === 4 && (
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={async () => {
                setIsSaving(true);
                const res = await onTriggerEvent('MEDICATION_START', 'Voice Confirmation', {
                  source: 'VOICE_AI_CONFIRMED',
                  transcript: currentTranscript || '처방 항생제 점적 투여 시작 (핸즈프리 확인)',
                });
                setIsSaving(false);
                if (res.success) setSaveMessage('투여 시작 완료 등록 (4/5)');
              }}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition active:scale-98"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>항생제 투여 시작 확인</span>
            </button>
          </div>
        )}

        {currentTargetStep === 5 && (
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={async () => {
                setIsSaving(true);
                const res = await onTriggerEvent('MEDICATION_END', 'Voice Confirmation', {
                  source: 'VOICE_AI_CONFIRMED',
                  transcript: currentTranscript || '처방 항생제 주입 완료 및 투여 종료 (핸즈프리 확인)',
                });
                setIsSaving(false);
                if (res.success) setSaveMessage('투여 종료 완료 등록 (5/5)');
              }}
              className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition active:scale-98"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>항생제 투여 종료 확인</span>
            </button>
          </div>
        )}

        {currentTargetStep === 6 && (
          <div className="p-3 rounded-2xl bg-teal-950/90 border border-teal-500/70 text-center space-y-2 shadow-lg">
            <div className="font-extrabold flex items-center justify-center gap-1.5 text-teal-300 text-xs sm:text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>5단계 현장 간호 완수</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              "시연 종료"라고 말씀하시거나 아래 버튼을 누르면 PC Station 간호기록 관리 화면으로 이동합니다.
            </p>
            <button
              type="button"
              onClick={() => requestDemoExit('BUTTON')}
              className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-teal-900/40 transition active:scale-98"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>핸즈프리 시연 종료 및 Station 이동</span>
            </button>
          </div>
        )}

        {/* Voice Command Hint & Manual Exit Option */}
        {currentTargetStep < 6 && (
          <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
            <div className="flex items-center gap-1 text-purple-300 font-medium truncate pr-2">
              <Mic className="w-3 h-3 text-purple-400 shrink-0" />
              <span className="truncate">음성 명령: "시연 종료" 또는 "핸즈프리 종료"</span>
            </div>
            <button
              type="button"
              onClick={() => requestDemoExit('BUTTON')}
              className="text-rose-400 hover:text-rose-300 font-semibold underline underline-offset-2 shrink-0 transition"
            >
              수동 시연 종료
            </button>
          </div>
        )}
      </footer>

      {/* Incomplete Steps Exit Confirmation Modal (요구사항: 미완료 단계 확인 및 안전 종료) */}
      {isExitConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-amber-500/60 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                아직 완료되지 않은 단계가 있습니다.
              </h3>
              <p className="text-xs text-amber-300 font-bold">
                시연을 종료할까요?
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                현재 {completedStepsCount}/5 단계가 완료되었습니다. 시연을 종료해도 지금까지 수집된 실시간 이벤트와 세션 ID(#{currentSession.sessionNumber})는 안전하게 보존됩니다.
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-left space-y-1">
              <div className="text-slate-400 font-medium">미완료 간호 단계:</div>
              {incompleteSteps.map((label, idx) => (
                <div key={idx} className="text-amber-200 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span>{label}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsExitConfirmOpen(false)}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                계속 진행
              </button>
              <button
                type="button"
                onClick={() => executeExitFlow(false)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-900/40"
              >
                시연 종료
              </button>
            </div>

            <p className="text-[10px] text-slate-500">
              마이크에 대고 "종료" 또는 "계속"이라고 말씀하셔도 처리됩니다.
            </p>
          </div>
        </div>
      )}

      {/* Exit Feedback & Hardware Cleanup Overlay (요구사항: 피드백 후 자동 종료 및 Station 이동) */}
      {(exitFeedbackMessage || isProcessingExit) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-teal-500/60 rounded-3xl max-w-sm w-full p-6 text-center space-y-3.5 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-teal-500/20 text-teal-300 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-teal-400 animate-bounce" />
            </div>
            <div className="space-y-1">
              <h3 className="font-extrabold text-base text-white">
                {exitFeedbackMessage || '핸즈프리 시연을 종료합니다'}
              </h3>
              <p className="text-xs text-slate-300">
                카메라·마이크를 정상 해제하고 Station 주요 간호 작업으로 이동 중...
              </p>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-teal-400 text-[11px] font-mono pt-1">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>미디어 트랙 및 센서 자원 정리 중</span>
            </div>
          </div>
        </div>
      )}

      {/* Hardware Diagnostics Modal Inspector with Live Telemetry */}
      <HandsFreeDiagnosticsModal
        isOpen={isDiagModalOpen}
        onClose={handleCloseDiagnostics}
        recommendedMode={operatingMode}
        onSelectMode={(mode) => setOperatingMode(mode)}
        telemetry={{
          cameraFps,
          decoderHz,
          decodeAttempts,
          canvasDimensions,
          currentTargetFormat,
          lastDecodedRaw,
          lastStatus: lastScanStatus,
          firestoreSaveStatus,
        }}
      />
    </div>
  );
};
