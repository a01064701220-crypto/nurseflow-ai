import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  X,
  Camera,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  UserCheck,
  Smartphone,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { Patient } from '../types';
import { classifyCameraError, CameraErrorInfo, diagnoseEnvironment } from '../utils/cameraUtils';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  expectedPatient: Patient;
  onConfirmVerification: (source: 'QR Scan', matchedPatient: Patient) => void;
  onSwitchToManual: () => void;
  isSessionCompleted?: boolean;
  onStartNewSession?: () => void;
}

interface ScannedResult {
  raw: string;
  patientId: string;
  patientName: string;
  room: string;
  isMatched: boolean;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  expectedPatient,
  onConfirmVerification,
  onSwitchToManual,
  isSessionCompleted = false,
  onStartNewSession,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<CameraErrorInfo | null>(null);
  const [scannedResult, setScannedResult] = useState<ScannedResult | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'qr-reader-patient-view';
  const env = diagnoseEnvironment();

  // Cleanly stops camera stream and resets container DOM
  const stopCamera = async () => {
    setIsScanning(false);
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('QR camera stop warning (safe):', e);
      } finally {
        html5QrCodeRef.current = null;
      }
    }

    const container = document.getElementById(readerElementId);
    if (container) {
      container.innerHTML = '';
    }
  };

  // Starts camera using standard string facingMode ("environment") with fallback to ("user")
  const startCamera = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setCameraError(null);
    setScannedResult(null);

    // Stop and clear any previous instance first
    await stopCamera();

    const container = document.getElementById(readerElementId);
    if (!container) {
      console.warn('Reader container DOM not yet available');
      return;
    }

    try {
      const qrScanner = new Html5Qrcode(readerElementId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      html5QrCodeRef.current = qrScanner;

      setIsScanning(true);

      // In html5-qrcode, facingMode MUST be string ("environment" | "user") or object with exact.
      // We do not pass qrbox so full frame is decoded without boundary cropping or duplicate library SVG overlays
      try {
        await qrScanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            aspectRatio: 1.0,
          },
          (decodedText) => {
            handleDecodedText(decodedText);
          },
          () => {
            // Frame evaluation callback
          }
        );
      } catch (envErr: any) {
        const errMsg = String(envErr?.message || envErr || '');
        console.warn('Rear camera start failed, attempting default camera fallback:', errMsg);
        // Fallback to user/front/default camera if rear camera is not present or overconstrained
        await qrScanner.start(
          { facingMode: 'user' },
          {
            fps: 15,
            aspectRatio: 1.0,
          },
          (decodedText) => {
            handleDecodedText(decodedText);
          },
          () => {}
        );
      }
    } catch (err: any) {
      console.error('Camera start error:', err);
      setIsScanning(false);
      const classified = classifyCameraError(err);
      setCameraError(classified);

      if (html5QrCodeRef.current) {
        try {
          html5QrCodeRef.current.clear();
        } catch (_) {}
        html5QrCodeRef.current = null;
      }
    }
  };

  const handleDecodedText = (decodedText: string) => {
    let scannedId = '';
    let scannedName = '';
    let scannedRoom = '';

    try {
      const parsed = JSON.parse(decodedText);
      scannedId = parsed.patientId || parsed.id || '';
      scannedName = parsed.name || parsed.patientName || '';
      scannedRoom = parsed.room || '';
    } catch {
      if (decodedText.includes('|')) {
        const parts = decodedText.split('|');
        scannedId = parts[0]?.trim();
        scannedName = parts[1]?.trim();
        scannedRoom = parts[2]?.trim();
      } else {
        scannedId = decodedText.trim();
      }
    }

    const isMatch =
      scannedId === expectedPatient.id ||
      (scannedName === expectedPatient.name && (!scannedId || scannedId === expectedPatient.id));

    // Clear camera error upon successful scan decode
    setCameraError(null);

    setScannedResult({
      raw: decodedText,
      patientId: scannedId || (isMatch ? expectedPatient.id : '미확인 ID'),
      patientName: scannedName || (isMatch ? expectedPatient.name : '미확인 환자'),
      room: scannedRoom || (isMatch ? expectedPatient.room : '미확인 병실'),
      isMatched: isMatch,
    });

    // Cleanly stop camera since QR is recognized
    stopCamera();
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        startCamera();
      }, 250);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
      setScannedResult(null);
      setCameraError(null);
    }
  }, [isOpen]);

  // Simulation handler for tests / demonstrations
  const handleSimulateScan = (match: boolean, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (match) {
      handleDecodedText(
        JSON.stringify({
          patientId: expectedPatient.id,
          name: expectedPatient.name,
          room: expectedPatient.room,
          dob: '1961-03-15',
        })
      );
    } else {
      handleDecodedText(
        JSON.stringify({
          patientId: 'TEST-P999',
          name: '김철수(타환자)',
          room: '302호-A',
          dob: '1975-08-20',
        })
      );
    }
  };

  // Final confirmation: creates event, closes modal, unlocks step 2
  const handleFinalConfirm = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!scannedResult || !scannedResult.isMatched) return;

    onConfirmVerification('QR Scan', expectedPatient);
    onClose();
  };

  const handleCopyUrl = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(env.standaloneUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                환자 손목밴드 QR코드 스캔 (STEP 1)
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                스마트폰 카메라로 환자 식별 밴드를 비춰 본인을 대조합니다
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
          {/* Completed Session Guidance Notice */}
          {isSessionCompleted && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-xs space-y-2 text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>현재 시연 세션이 이미 5단계까지 완료되었습니다.</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                새로운 환자 투약 시연을 진행하시려면 [새 시연 시작]을 눌러주세요. 기존 승인 기록과 가상 EMR 전송 내역은 안전하게 보존됩니다.
              </p>
              {onStartNewSession && (
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    onClose();
                    onStartNewSession();
                  }}
                  className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> 새 시연 세션 시작하기
                </button>
              )}
            </div>
          )}

          {/* Target Patient Badge */}
          <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-3 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400">처방 대상 환자: </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 ml-1">
                {expectedPatient.name} ({expectedPatient.id})
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 font-semibold font-mono">
              {expectedPatient.room}
            </span>
          </div>

          {/* If Result is Decoded: Show Prominent Result Card and Confirmation Action */}
          {scannedResult ? (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-2xl border text-xs space-y-3 ${
                  scannedResult.isMatched
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-2 text-sm">
                    {scannedResult.isMatched ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        환자 식별 일치 (MATCHED)
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                        환자 정보 불일치 (MISMATCH)
                      </>
                    )}
                  </span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/80 dark:bg-black/40 font-semibold">
                    {scannedResult.patientId}
                  </span>
                </div>

                <div className="space-y-1 text-xs pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-500 dark:text-slate-400">인식 환자명:</span>
                    <span className="font-semibold">{scannedResult.patientName}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-500 dark:text-slate-400">병실 정보:</span>
                    <span className="font-semibold">{scannedResult.room}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-500 dark:text-slate-400">등록 번호:</span>
                    <span className="font-mono">{scannedResult.patientId}</span>
                  </div>

                  {!scannedResult.isMatched && (
                    <div className="p-2.5 mt-2 rounded-lg bg-rose-100 dark:bg-rose-950 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-medium">
                      ⚠️ 처방 대상 환자({expectedPatient.name}, {expectedPatient.id})와 일치하지 않습니다! 투약을 중단하고 처방 환자의 손목밴드를 다시 스캔하세요.
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons for Scanned State */}
              <div className="space-y-2">
                {scannedResult.isMatched ? (
                  <button
                    type="button"
                    onClick={(e) => handleFinalConfirm(e)}
                    className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 active:scale-[0.98] transition"
                  >
                    <ShieldCheck className="w-5 h-5" />
                    환자 본인확인 완료 및 다음 단계(약물 확인) 진행
                  </button>
                ) : (
                  <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-center text-xs text-rose-600 dark:text-rose-400 font-bold">
                    불일치 환자이므로 승인이 차단되었습니다.
                  </div>
                )}

                <button
                  type="button"
                  onClick={(e) => startCamera(e)}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> 다시 스캔하기
                </button>
              </div>
            </div>
          ) : (
            /* Live Camera Viewfinder Box */
            <div className="relative bg-black rounded-xl overflow-hidden aspect-square max-w-[320px] mx-auto flex items-center justify-center border-2 border-slate-700 shadow-inner">
              <div id={readerElementId} className="w-full h-full" />

              {/* Scanning Overlay Guideline - Single Clean Viewfinder */}
              {isScanning && !cameraError && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  <div className="w-52 h-52 border-2 border-teal-400 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.3)]">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-teal-400 rounded-tl-sm" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-teal-400 rounded-tr-sm" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-teal-400 rounded-bl-sm" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-teal-400 rounded-br-sm" />
                    <div className="w-full h-0.5 bg-teal-400 shadow-[0_0_8px_#2dd4bf] animate-pulse absolute top-1/2 -translate-y-1/2" />
                  </div>
                  <p className="text-white text-xs mt-3 bg-black/80 px-3.5 py-1 rounded-full font-semibold shadow-md">
                    중앙 사각형 안에 환자 QR코드를 배치해 주세요
                  </p>
                </div>
              )}

              {/* Categorized Camera Error Diagnostics */}
              {cameraError && (
                <div className="absolute inset-0 bg-slate-950/95 p-4 flex flex-col items-center justify-center text-center overflow-y-auto">
                  <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-1.5 shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>

                  {/* Error Category Tag */}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800 text-amber-300 mb-1">
                    {cameraError.category === 'USER_DENIED' && '사용자 권한 거부'}
                    {cameraError.category === 'INITIALIZATION_FAILED' && '카메라 초기화 실패'}
                    {cameraError.category === 'IFRAME_RESTRICTED' && '브라우저/iframe 권한 제한'}
                    {cameraError.category === 'DEVICE_NOT_FOUND' && '카메라 장치 없음'}
                    {cameraError.category === 'DEVICE_IN_USE' && '카메라 장치 사용 중'}
                    {cameraError.category === 'INSECURE_CONTEXT' && 'HTTPS 보안 환경 필요'}
                    {cameraError.category === 'OVERCONSTRAINED' && '후면 카메라 모드 전환 필요'}
                    {cameraError.category === 'UNKNOWN' && '카메라 연결 실패'}
                  </span>

                  <h4 className="text-xs sm:text-sm font-bold text-white mb-0.5">
                    {cameraError.title}
                  </h4>
                  <p className="text-[11px] text-slate-300 mb-1.5 leading-tight">
                    {cameraError.message}
                  </p>
                  <p className="text-[10px] text-teal-300 mb-3 bg-teal-950/60 border border-teal-800/60 rounded-lg p-1.5 leading-tight">
                    💡 {cameraError.actionGuide}
                  </p>

                  {/* Action Buttons in Error State */}
                  <div className="space-y-1.5 w-full max-w-xs">
                    <button
                      type="button"
                      onClick={(e) => startCamera(e)}
                      className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm"
                    >
                      <RefreshCw className="w-3 h-3" /> 카메라 다시 시도 (Retry)
                    </button>

                    {env.isInIframe && (
                      <div className="space-y-1">
                        <a
                          href={env.standaloneUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-1.5 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition"
                        >
                          <ExternalLink className="w-3 h-3" /> 독립 배포창에서 열기 (Safari)
                        </a>
                        <button
                          type="button"
                          onClick={handleCopyUrl}
                          className="w-full py-1 px-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition"
                        >
                          {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{isCopied ? 'URL 복사 완료!' : '독립 URL 복사하기'}</span>
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleSimulateScan(true, e)}
                      className="w-full py-2 px-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95"
                    >
                      <UserCheck className="w-3.5 h-3.5" /> 시연용 정상 QR 즉시 인식 (테스트)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Simulation Row if Camera is Active without Scan Result */}
          {!scannedResult && !cameraError && (
            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={(e) => handleSimulateScan(true, e)}
                className="w-full py-2.5 px-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-200 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-teal-100 transition active:scale-95"
              >
                <UserCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>시연용 정상 QR 즉시 인식 (홍길동, TEST-P001)</span>
              </button>
              <button
                type="button"
                onClick={(e) => handleSimulateScan(false, e)}
                className="w-full py-1.5 px-3 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-[11px] font-medium hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
              >
                타 환자 QR 인식 테스트 (불일치 차단 검증)
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              stopCamera();
              onSwitchToManual();
            }}
            className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 underline"
          >
            카메라 대신 수동 확인 사용
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              stopCamera();
              onClose();
            }}
            className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
