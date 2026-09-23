import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  Mic,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Play,
  Square,
  ShieldCheck,
  AlertCircle,
  Terminal,
  Cpu,
  Layers,
  Sparkles,
  Volume2,
  Eye,
  Database,
  ScanLine,
} from 'lucide-react';
import { decodeBarcodeOrQrFromVideo } from '../utils/zxingBarcodeDecoder';
import { diagnoseEnvironment } from '../utils/cameraUtils';

interface DiagnosticResult {
  testId: string;
  name: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'WARNING' | 'FAILED';
  details: string;
  metrics?: Record<string, string | number | boolean>;
  timestamp?: string;
}

export interface LiveTelemetryData {
  cameraFps: number;
  decoderHz: number;
  decodeAttempts: number;
  canvasDimensions: { width: number; height: number };
  currentTargetFormat: 'QR_CODE' | 'CODE_128' | 'NONE';
  lastDecodedRaw: string;
  lastStatus: 'IDLE' | 'SCANNING' | 'MATCHED' | 'MISMATCH' | 'DECODE_FAILED';
  firestoreSaveStatus: 'IDLE' | 'SAVING' | 'SUCCESS' | 'FAILED';
}

interface HandsFreeDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendedMode?: 'SIMULTANEOUS' | 'AUTO_SWITCH';
  onSelectMode?: (mode: 'SIMULTANEOUS' | 'AUTO_SWITCH') => void;
  telemetry?: LiveTelemetryData;
}

export const HandsFreeDiagnosticsModal: React.FC<HandsFreeDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  recommendedMode = 'AUTO_SWITCH',
  onSelectMode,
  telemetry,
}) => {
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [selectedOperatingMode, setSelectedOperatingMode] = useState<'SIMULTANEOUS' | 'AUTO_SWITCH'>(recommendedMode);

  // Results for 5 required diagnostic checkpoints
  const [results, setResults] = useState<Record<string, DiagnosticResult>>({
    camera: {
      testId: 'camera',
      name: '1. 후면 카메라 실행 점검',
      status: 'PENDING',
      details: '대기 중 - 아이폰 후면 카메라(environment) 스트림과 해상도, live 상태를 검증합니다.',
    },
    decoder: {
      testId: 'decoder',
      name: '2. QR 및 Code 128 디코더 점검',
      status: 'PENDING',
      details: '대기 중 - ZXing Multi-Pass(Center-Crop/Rotation) 엔진을 점검합니다.',
    },
    mic: {
      testId: 'mic',
      name: '3. 마이크 권한 및 Web Speech 인식 점검',
      status: 'PENDING',
      details: '대기 중 - iOS Safari webkitSpeechRecognition과 한국어(ko-KR) 음성 엔진을 점검합니다.',
    },
    concurrentStart: {
      testId: 'concurrentStart',
      name: '4. 카메라 구동 중 음성인식 시작 점검',
      status: 'PENDING',
      details: '대기 중 - 비디오 스트림이 활성화된 상태에서 SpeechRecognition이 충돌 없이 시작되는지 점검합니다.',
    },
    concurrentSustained: {
      testId: 'concurrentSustained',
      name: '5. 음성인식 중 카메라 프레임·해독 유지 점검',
      status: 'PENDING',
      details: '대기 중 - 음성 입력 중 비디오 프레임이 프리징되지 않고 바코드 해독 루프가 유지되는지(FPS 측정) 점검합니다.',
    },
  });

  // Diagnostic live states
  const [liveFps, setLiveFps] = useState<number>(0);
  const [liveDecodeCount, setLiveDecodeCount] = useState<number>(0);
  const [liveVoiceTranscript, setLiveVoiceTranscript] = useState<string>('');
  const [liveVoiceStatus, setLiveVoiceStatus] = useState<string>('IDLE');
  const [overallVerdict, setOverallVerdict] = useState<{
    simultaneousSupported: boolean;
    recommendation: 'SIMULTANEOUS' | 'AUTO_SWITCH';
    summary: string;
  } | null>(null);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const diagnosticGenerationRef = useRef(0);
  const speechActiveRef = useRef(false);
  const animFrameRef = useRef<number | null>(null);

  const env = diagnoseEnvironment();

  // Clean up all streams and listeners on unmount or close
  const cleanupAll = () => {
    diagnosticGenerationRef.current++;
    speechActiveRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }
    setLiveVoiceStatus('IDLE');
    setLiveFps(0);
  };

  useEffect(() => {
    if (!isOpen) {
      cleanupAll();
    }
    return () => {
      cleanupAll();
    };
  }, [isOpen]);

  const updateResult = (id: string, patch: Partial<DiagnosticResult>) => {
    setResults((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...patch,
        timestamp: new Date().toLocaleTimeString(),
      },
    }));
  };

  // 1. Test Rear Camera
  const testRearCamera = async (): Promise<boolean> => {
    updateResult('camera', { status: 'RUNNING', details: '카메라 권한 요청 및 후면 스트림 연결 중...' });
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('브라우저에서 getUserMedia API를 지원하지 않습니다 (HTTPS 환경 확인 필요).');
      }

      const generation = diagnosticGenerationRef.current;
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
        console.warn('Rear camera direct request fallback:', rearErr);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      if (generation !== diagnosticGenerationRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return false;
      }
      cameraStreamRef.current = stream;
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings ? videoTrack.getSettings() : {};

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.playsInline = true;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }

      updateResult('camera', {
        status: 'SUCCESS',
        details: `후면 카메라 정상 가동: "${videoTrack.label || 'Camera'}" (${settings.width || 1280}x${settings.height || 720}, ${videoTrack.readyState})`,
        metrics: {
          label: videoTrack.label || 'Default Camera',
          readyState: videoTrack.readyState,
          facingMode: (settings as any).facingMode || 'environment',
          width: settings.width || 'auto',
          height: settings.height || 'auto',
        },
      });
      return true;
    } catch (err: any) {
      console.error('Camera test error:', err);
      updateResult('camera', {
        status: 'FAILED',
        details: `카메라 실행 실패: ${err.name || 'Error'} - ${err.message || err}`,
        metrics: { error: err.name || 'UNKNOWN' },
      });
      return false;
    }
  };

  // 2. Test Barcode & QR Decoder Engine
  const testDecoderEngine = async (): Promise<boolean> => {
    updateResult('decoder', { status: 'RUNNING', details: '광학 디코더 엔진(ZXing Multi-Pass) 검증 중...' });
    try {
      const video = videoRef.current;
      if (!video) throw new Error('카메라 프레임이 준비되지 않았습니다.');
      const result = await decodeBarcodeOrQrFromVideo(video, 'ALL', canvasRef.current);
      setLiveDecodeCount(prev => prev + 1);
      updateResult('decoder', {
        status: result.success ? 'SUCCESS' : 'WARNING',
        details: result.success
          ? `실제 코드 해독 성공: ${result.format} / ${result.text}`
          : result.error || '실제 프레임 해독 호출 완료. 코드는 미검출 — QR/Code128 라벨을 비추고 다시 검사하세요.',
        metrics: { engine: result.engine || 'none', decoded: result.success,
          width: result.canvasDimensions?.width || 0, height: result.canvasDimensions?.height || 0 },
      });
      return result.success;
    } catch (err: any) {
      updateResult('decoder', {
        status: 'FAILED',
        details: `디코더 엔진 오류: ${err.message || err}`,
      });
      return false;
    }
  };

  // 3. Test Microphone & Web Speech Recognition
  const testMicrophoneAndSpeech = async (): Promise<boolean> => {
    updateResult('mic', { status: 'RUNNING', details: 'Web Speech API 및 마이크 권한 확인 중...' });
    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        updateResult('mic', {
          status: 'FAILED',
          details: '현재 브라우저에 Web Speech API(webkitSpeechRecognition)가 지원되지 않습니다.',
          metrics: { apiAvailable: false },
        });
        return false;
      }

      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStream.getTracks().forEach((t) => t.stop());
      } catch (micErr: any) {
        console.warn('Microphone permission check warning:', micErr);
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'ko-KR';

      return new Promise<boolean>((resolve) => {
        let isResolved = false;

        const timeoutId = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            try {
              recognition.stop();
            } catch (_) {}
            updateResult('mic', {
              status: 'WARNING',
              details: '음성 인식 시작 대기 시간 초과 (아이폰 설정에서 마이크 및 음성 인식 권한을 확인해 주세요).',
              metrics: { timeout: true },
            });
            resolve(false);
          }
        }, 5000);

        recognition.onstart = () => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            setLiveVoiceStatus('LISTENING (정상 감지 중)');
            updateResult('mic', {
              status: 'SUCCESS',
              details: 'iOS Safari webkitSpeechRecognition 엔진 정상 시작됨 (ko-KR 한국어 음성 대기)',
              metrics: {
                api: 'webkitSpeechRecognition',
                lang: 'ko-KR',
                started: true,
              },
            });
            try {
              recognition.stop();
            } catch (_) {}
            resolve(true);
          }
        };

        recognition.onerror = (evt: any) => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            updateResult('mic', {
              status: 'FAILED',
              details: `음성 인식 오류 발생: ${evt.error || 'Unknown error'}`,
              metrics: { error: evt.error },
            });
            resolve(false);
          }
        };

        try {
          recognition.start();
        } catch (err: any) {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            updateResult('mic', {
              status: 'FAILED',
              details: `음성 시작 호출 예외: ${err.message || err}`,
            });
            resolve(false);
          }
        }
      });
    } catch (err: any) {
      updateResult('mic', {
        status: 'FAILED',
        details: `음성 인식 테스트 예외: ${err.message || err}`,
      });
      return false;
    }
  };

  // 4. Test Concurrent Start: While camera is actively rolling, can we start mic?
  const testConcurrentStart = async (): Promise<boolean> => {
    updateResult('concurrentStart', {
      status: 'RUNNING',
      details: '카메라 비디오 스트림이 활성화된 상태에서 음성 인식 시작(동시 오디오 세션 획득) 검증 중...',
    });

    if (!cameraStreamRef.current || !videoRef.current) {
      updateResult('concurrentStart', {
        status: 'FAILED',
        details: '선행 카메라 스트림이 활성화되지 않아 동시 시작을 테스트할 수 없습니다.',
      });
      return false;
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        updateResult('concurrentStart', {
          status: 'FAILED',
          details: 'Web Speech API 미지원',
        });
        return false;
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'ko-KR';
      recognitionRef.current = rec;

      return new Promise<boolean>((resolve) => {
        let isResolved = false;

        const timeout = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            updateResult('concurrentStart', {
              status: 'WARNING',
              details: '카메라 구동 중 음성 시작 응답 지연 (iOS 사파리에서 마이크 세션 획득이 지연되었습니다).',
            });
            resolve(false);
          }
        }, 4000);

        rec.onend = () => { speechActiveRef.current = false; };
        rec.onstart = () => {
          speechActiveRef.current = true;
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeout);
            setLiveVoiceStatus('CONCURRENT_ACTIVE (카메라+마이크 동시 활성)');
            updateResult('concurrentStart', {
              status: 'SUCCESS',
              details: '카메라 비디오가 켜진 상태에서 마이크 음성 인식이 정상 시작됨 (자원 충돌 없음)',
              metrics: { concurrentSessionStarted: true },
            });
            resolve(true);
          }
        };

        rec.onerror = (e: any) => {
          speechActiveRef.current = false;
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeout);
            updateResult('concurrentStart', {
              status: 'FAILED',
              details: `카메라 작동 중 음성 시작 실패 (${e.error}): iOS Safari에서 카메라/마이크 동시 자원 점유가 차단되었습니다.`,
              metrics: { error: e.error },
            });
            resolve(false);
          }
        };

        try {
          rec.start();
        } catch (e: any) {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeout);
            updateResult('concurrentStart', {
              status: 'FAILED',
              details: `동시 시작 예외: ${e.message || e}`,
            });
            resolve(false);
          }
        }
      });
    } catch (err: any) {
      updateResult('concurrentStart', {
        status: 'FAILED',
        details: `동시 시작 점검 예외: ${err.message || err}`,
      });
      return false;
    }
  };

  // 5. Test Sustained Frames & Decode: Does camera video stay alive while voice is active?
  const testConcurrentSustained = async (): Promise<boolean> => {
    updateResult('concurrentSustained', {
      status: 'RUNNING',
      details: '음성 인식 구동 상태에서 실시간 비디오 FPS 및 바코드 해독 루프 지속 여부 계측 중 (3초)...',
    });

    if (!videoRef.current || !cameraStreamRef.current) {
      updateResult('concurrentSustained', {
        status: 'FAILED',
        details: '카메라 비디오 엘리먼트가 준비되지 않았습니다.',
      });
      return false;
    }

    const videoEl = videoRef.current;
    let framesRendered = 0;
    let lastVideoTime = -1;
    let lastDecodeTime = 0;
    let decoding = false;
    const generation = diagnosticGenerationRef.current;
    let speechSustained = speechActiveRef.current;
    let decodesExecuted = 0;
    const startTime = performance.now();

    return new Promise<boolean>((resolve) => {
      let isFinished = false;

      const checkLoop = () => {
        if (isFinished) return;
        if (generation !== diagnosticGenerationRef.current) { isFinished = true; resolve(false); return; }
        speechSustained = speechSustained && speechActiveRef.current;

        if (videoEl.readyState >= 2 && !videoEl.paused && !videoEl.ended) {
          if (videoEl.currentTime !== lastVideoTime) {
            framesRendered++;
            lastVideoTime = videoEl.currentTime;
          }
          if (!decoding && performance.now() - lastDecodeTime >= 180) {
            decoding = true;
            lastDecodeTime = performance.now();

          // Run real video decoder
          decodeBarcodeOrQrFromVideo(videoEl, 'ALL', canvasRef.current)
            .then(() => {
              decodesExecuted++;
              setLiveDecodeCount(decodesExecuted);
            })
            .catch(() => {})
            .finally(() => { decoding = false; });
          }
        }

        const elapsed = (performance.now() - startTime) / 1000;
        const currentFps = Math.round(framesRendered / Math.max(elapsed, 0.1));
        setLiveFps(currentFps);

        if (elapsed >= 3.0) {
          isFinished = true;
          const avgFps = Math.round(framesRendered / elapsed);
          const isStable = avgFps >= 12 && decodesExecuted > 0 && speechSustained;

          if (isStable) {
            updateResult('concurrentSustained', {
              status: 'SUCCESS',
              details: `동시 구동 중 카메라 프레임 프리징 없음: 평균 ${avgFps} FPS 유지, 3초간 ${decodesExecuted}회 디코드 루프 연속 통과`,
              metrics: {
                fps: avgFps,
                decodes: decodesExecuted,
                durationSeconds: 3.0,
                stable: true,
              },
            });
            resolve(true);
          } else {
            updateResult('concurrentSustained', {
              status: 'WARNING',
              details: `카메라 프레임 저하 감지 (${avgFps} FPS, 총 ${framesRendered}프레임): iOS WebKit 리소스 경합 발생`,
              metrics: {
                fps: avgFps,
                decodes: decodesExecuted,
                stable: false,
              },
            });
            resolve(false);
          }
          return;
        }

        animFrameRef.current = requestAnimationFrame(checkLoop);
      };

      animFrameRef.current = requestAnimationFrame(checkLoop);
    });
  };

  // Run all tests sequentially
  const handleRunAllTests = async () => {
    cleanupAll();
    const generation = diagnosticGenerationRef.current;
    setIsRunningAll(true);
    setOverallVerdict(null);

    const camOk = await testRearCamera();
    await new Promise((r) => setTimeout(r, 400));
    if (generation !== diagnosticGenerationRef.current) return;

    const decOk = await testDecoderEngine();
    await new Promise((r) => setTimeout(r, 400));
    if (generation !== diagnosticGenerationRef.current) return;

    const micOk = await testMicrophoneAndSpeech();
    await new Promise((r) => setTimeout(r, 400));
    if (generation !== diagnosticGenerationRef.current) return;

    let concStartOk = false;
    if (camOk && micOk) {
      concStartOk = await testConcurrentStart();
      await new Promise((r) => setTimeout(r, 400));
    if (generation !== diagnosticGenerationRef.current) return;
    } else {
      updateResult('concurrentStart', {
        status: 'WARNING',
        details: '카메라 또는 마이크 테스트 실패로 건너뜀',
      });
    }

    let concSustainedOk = false;
    if (camOk && concStartOk) {
      concSustainedOk = await testConcurrentSustained();
    } else {
      updateResult('concurrentSustained', {
        status: 'WARNING',
        details: '카메라 또는 마이크 테스트 실패로 건너뜀',
      });
    }

    setIsRunningAll(false);

    const isSimultaneousReliable = camOk && decOk && micOk && concStartOk && concSustainedOk;
    const verdict: {
      simultaneousSupported: boolean;
      recommendation: 'SIMULTANEOUS' | 'AUTO_SWITCH';
      summary: string;
    } = {
      simultaneousSupported: isSimultaneousReliable,
      recommendation: isSimultaneousReliable ? 'SIMULTANEOUS' : 'AUTO_SWITCH',
      summary: isSimultaneousReliable
        ? '현재 브라우저에서 3초간 영상·음성·해독 호출이 유지됐습니다. 실제 아이폰에서 QR와 Code128을 각각 확인해 주세요.'
        : 'iOS Safari 미디어 세션 특성상 동시 구동 시 오디오 점유 또는 프레임 드랍이 발생할 수 있습니다. 스캔 단계(카메라)와 소견 입력 단계(음성)를 안전하게 번갈아 활성화하는 [스마트 자동 전환 모드]를 추천합니다.',
    };

    setOverallVerdict(verdict);
    setSelectedOperatingMode(verdict.recommendation);
    if (onSelectMode) {
      onSelectMode(verdict.recommendation);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>하드웨어 및 디코더 진단 계측 도구</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                  STEP 4-A
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                카메라 FPS, 디코더 Hz, 프레임 해상도, 해독 문자열, 판정 상태 실측
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              cleanupAll();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SECTION 1: LIVE TELEMETRY DASHBOARD (From Main HandsFree Scanner) */}
        {telemetry && (
          <div className="bg-slate-950/90 p-4 border-b border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-teal-400" />
                <span className="text-xs font-bold text-teal-300 uppercase tracking-wider">
                  메인 핸즈프리 실시간 계측 지표 (Live Telemetry)
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                총 시도: {telemetry.decodeAttempts}회
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* 1. Camera FPS */}
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-0.5">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Camera className="w-3 h-3 text-teal-400" />
                  <span>카메라 렌더링</span>
                </div>
                <div className="text-sm font-mono font-extrabold text-white">
                  {telemetry.cameraFps} <span className="text-xs font-normal text-slate-400">FPS</span>
                </div>
              </div>

              {/* 2. Decoder Executions per Second (Hz) */}
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-0.5">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Eye className="w-3 h-3 text-teal-400" />
                  <span>디코더 실행 빈도</span>
                </div>
                <div className="text-sm font-mono font-extrabold text-teal-300">
                  {telemetry.decoderHz} <span className="text-xs font-normal text-slate-400">Hz/초</span>
                </div>
              </div>

              {/* 3. Canvas Frame Size */}
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-0.5">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-purple-400" />
                  <span>Canvas 분석 크기</span>
                </div>
                <div className="text-xs font-mono font-bold text-purple-300 truncate">
                  {telemetry.canvasDimensions.width > 0
                    ? `${telemetry.canvasDimensions.width} × ${telemetry.canvasDimensions.height}`
                    : '준비 대기'}
                </div>
              </div>

              {/* 4. Target Format */}
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-0.5">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <ScanLine className="w-3 h-3 text-sky-400" />
                  <span>해독 대상 포맷</span>
                </div>
                <div className="text-xs font-mono font-extrabold text-sky-300 truncate">
                  {telemetry.currentTargetFormat === 'QR_CODE'
                    ? 'QR_CODE (환자)'
                    : telemetry.currentTargetFormat === 'CODE_128'
                    ? 'CODE_128 (약물)'
                    : 'NONE (대기)'}
                </div>
              </div>
            </div>

            {/* Detailed Status Breakdown: Distinguish Waiting vs Decode Failed vs Matched */}
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">해독 판정 상태:</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    telemetry.lastStatus === 'MATCHED'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                      : telemetry.lastStatus === 'MISMATCH'
                      ? 'bg-rose-950 text-rose-300 border border-rose-600'
                      : telemetry.lastStatus === 'DECODE_FAILED'
                      ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {telemetry.lastStatus === 'MATCHED' && '✓ MATCHED (기준 데이터 일치)'}
                  {telemetry.lastStatus === 'MISMATCH' && '⚠ MISMATCH (불일치 감지)'}
                  {telemetry.lastStatus === 'DECODE_FAILED' && '● 호출 정상 / 프레임 내 패턴 미검출 (DECODE FAILED)'}
                  {telemetry.lastStatus === 'IDLE' && '○ 디코더 대기 중 (미호출 상태)'}
                  {telemetry.lastStatus === 'SCANNING' && '스캔 중...'}
                </span>
              </div>

              {/* Last decoded raw string */}
              <div className="text-[11px] text-slate-300 truncate font-mono">
                <span className="text-slate-400">최근 해독 문자열: </span>
                {telemetry.lastDecodedRaw ? (
                  <span className="text-teal-300 font-semibold">{telemetry.lastDecodedRaw}</span>
                ) : (
                  <span className="text-slate-500 italic">(아직 감지된 코드 없음)</span>
                )}
              </div>

              {/* Firestore Event Save Status */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Database className="w-3.5 h-3.5 text-sky-400" />
                  <span>Firestore 이벤트 저장:</span>
                </div>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    telemetry.firestoreSaveStatus === 'SUCCESS'
                      ? 'bg-emerald-950 text-emerald-300'
                      : telemetry.firestoreSaveStatus === 'SAVING'
                      ? 'bg-sky-950 text-sky-300 animate-pulse'
                      : telemetry.firestoreSaveStatus === 'FAILED'
                      ? 'bg-rose-950 text-rose-300'
                      : 'text-slate-500'
                  }`}
                >
                  {telemetry.firestoreSaveStatus === 'SUCCESS'
                    ? 'SUCCESS (동기화 완료)'
                    : telemetry.firestoreSaveStatus === 'SAVING'
                    ? 'SAVING...'
                    : telemetry.firestoreSaveStatus === 'FAILED'
                    ? 'FAILED'
                    : 'IDLE (대기)'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: STANDALONE HARDWARE SELF-TEST PANEL */}
        <div className="bg-slate-950 px-5 py-3 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div className="relative w-20 h-14 bg-black rounded-lg overflow-hidden border border-slate-700 shrink-0">
              <video
                ref={videoRef}
                playsInline
                webkit-playsinline="true"
                muted
                autoPlay
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute top-1 left-1 px-1 py-0.2 bg-black/60 rounded text-[9px] font-mono text-teal-300">
                {liveFps} FPS
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-teal-400" />
                <span>카메라: {cameraStreamRef.current ? 'LIVE' : '대기'} ({liveFps} FPS)</span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-purple-400" />
                <span className="truncate max-w-[200px]">음성: {liveVoiceStatus}</span>
              </div>
              <div className="text-[10px] font-mono text-slate-500">
                실측 디코드 누적: {liveDecodeCount}회
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={isRunningAll}
            onClick={handleRunAllTests}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900/60 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-900/30 transition shrink-0"
          >
            {isRunningAll ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>진단 계측 중...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>5대 항목 전체 진단</span>
              </>
            )}
          </button>
        </div>

        {/* Test List Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-800/60">
          {Object.values(results).map((item) => {
            const isSuccess = item.status === 'SUCCESS';
            const isRunning = item.status === 'RUNNING';
            const isWarning = item.status === 'WARNING';
            const isFailed = item.status === 'FAILED';

            return (
              <div key={item.testId} className="pt-3 first:pt-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5">
                      {isRunning && <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" />}
                      {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {isWarning && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                      {isFailed && <AlertCircle className="w-4 h-4 text-rose-400" />}
                      {item.status === 'PENDING' && (
                        <div className="w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center text-[9px] text-slate-500">
                          -
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-white">{item.name}</h4>
                      <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{item.details}</p>
                      {item.metrics && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {Object.entries(item.metrics).map(([k, v]) => (
                            <span
                              key={k}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                            >
                              {k}: {String(v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded shrink-0 ${
                      isSuccess
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : isRunning
                        ? 'bg-sky-950 text-sky-300 border border-sky-800 animate-pulse'
                        : isWarning
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : isFailed
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Verdict & Recommended Mode Selector */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
          {overallVerdict && (
            <div
              className={`p-3 rounded-2xl border text-xs leading-relaxed space-y-1 ${
                overallVerdict.simultaneousSupported
                  ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
                  : 'bg-amber-950/40 border-amber-700/60 text-amber-200'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5">
                {overallVerdict.simultaneousSupported ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
                <span>실측 진단 결과 및 임상 권고 모드</span>
              </div>
              <p className="text-[11px] opacity-90">{overallVerdict.summary}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] text-slate-400">
              권장 동작 모드: <span className="text-white font-bold">{selectedOperatingMode === 'SIMULTANEOUS' ? '동시 실행 모드' : '스마트 자동 전환 모드'}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                cleanupAll();
                onClose();
              }}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-lg shadow-teal-900/30 transition active:scale-95"
            >
              닫기 및 적용
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
