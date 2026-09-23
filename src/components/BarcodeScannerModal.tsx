import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  X,
  Camera,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Barcode,
  ShieldAlert,
  CheckSquare,
  Square,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  RotateCcw,
  Upload,
  FileImage,
  Info,
  Loader2,
  Sparkles,
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { Prescription, Patient } from '../types';
import { classifyCameraError, CameraErrorInfo, diagnoseEnvironment } from '../utils/cameraUtils';
import { decodeFromCanvas, decodeBarcodeFromFile } from '../utils/zxingBarcodeDecoder';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  expectedPrescription: Prescription;
  patient: Patient;
  onConfirmVerification: (source: 'Barcode Scan', fiveRightsVerified: boolean) => void;
  onSwitchToManual: () => void;
  isSessionCompleted?: boolean;
  onStartNewSession?: () => void;
}

export type ScannerStatus = 'IDLE' | 'SCANNING' | 'DECODE_FAILED' | 'DECODED_MISMATCH' | 'DECODED_MATCHED';

interface ScannedMedResult {
  raw: string;
  prescriptionId: string;
  medicationName: string;
  patientId: string;
  isMatched: boolean;
  source: 'camera' | 'file' | 'sample';
  format: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  expectedPrescription,
  patient,
  onConfirmVerification,
  onSwitchToManual,
  isSessionCompleted = false,
  onStartNewSession,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<ScannerStatus>('IDLE');
  const [cameraError, setCameraError] = useState<CameraErrorInfo | null>(null);
  const [decodeFailReason, setDecodeFailReason] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<ScannedMedResult | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);

  // 5-Right individual checklist state (auto-checked ONLY upon valid DECODED_MATCHED)
  const [fiveRights, setFiveRights] = useState({
    rightPatient: false,
    rightDrug: false,
    rightDose: false,
    rightRoute: false,
    rightTime: false,
  });

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const zxingTimerRef = useRef<number | null>(null);
  const zxingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isScanningRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const readerElementId = 'barcode-reader-medication-view';
  const env = diagnoseEnvironment();

  const stopZxingLoop = () => {
    if (zxingTimerRef.current) {
      clearInterval(zxingTimerRef.current);
      zxingTimerRef.current = null;
    }
  };

  const stopCamera = async () => {
    isScanningRef.current = false;
    setIsScanning(false);
    stopZxingLoop();

    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Barcode camera stop warning (safe):', e);
      } finally {
        html5QrCodeRef.current = null;
      }
    }

    const container = document.getElementById(readerElementId);
    if (container) {
      container.innerHTML = '';
    }
  };

  /**
   * Continuous high-speed video frame analyzer using ZXing library:
   * Captures raw video frames from the camera without boundary cropping, converts to 1-byte grayscale,
   * and runs dual-pass binarizers (GlobalHistogram + Hybrid) for reliable Code 128 / EAN / UPC detection on iOS Safari & Android.
   */
  const startZxingLoop = () => {
    stopZxingLoop();
    zxingTimerRef.current = window.setInterval(() => {
      if (!isScanningRef.current) return;
      const container = document.getElementById(readerElementId);
      if (!container) return;
      const videoEl = container.querySelector('video') as HTMLVideoElement | null;
      if (!videoEl || videoEl.readyState < 2 || videoEl.videoWidth === 0) return;

      if (!zxingCanvasRef.current) {
        zxingCanvasRef.current = document.createElement('canvas');
      }
      const canvas = zxingCanvasRef.current;
      if (canvas.width !== videoEl.videoWidth || canvas.height !== videoEl.videoHeight) {
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
      }
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const res = decodeFromCanvas(canvas);
      if (res.success && res.text) {
        console.log('[ZXing Barcode Decoder] Real-time detected:', res.text, res.format);
        handleDecodedBarcode(res.text, 'camera', res.format || 'CODE_128');
      }
    }, 150);
  };

  const startCamera = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setCameraError(null);
    setDecodeFailReason(null);
    setScannedResult(null);
    setScannerStatus('SCANNING');

    // Stop and clear any previous instance first
    await stopCamera();

    const container = document.getElementById(readerElementId);
    if (!container) {
      console.warn('Barcode reader container DOM not yet ready');
      return;
    }

    try {
      const barcodeScanner = new Html5Qrcode(readerElementId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });
      html5QrCodeRef.current = barcodeScanner;

      isScanningRef.current = true;
      setIsScanning(true);

      // CRITICAL: We do NOT pass qrbox so html5-qrcode does NOT crop the frame
      // and does NOT render its own duplicate shaded SVG overlay!
      // This leaves only our single clean horizontal rectangular guide.
      try {
        await barcodeScanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            aspectRatio: 1.0,
          },
          (decodedText) => {
            handleDecodedBarcode(decodedText, 'camera', 'CODE_128');
          },
          () => {}
        );
      } catch (envErr: any) {
        console.warn('Rear camera start failed, attempting user camera fallback:', envErr);
        await barcodeScanner.start(
          { facingMode: 'user' },
          {
            fps: 15,
            aspectRatio: 1.0,
          },
          (decodedText) => {
            handleDecodedBarcode(decodedText, 'camera', 'CODE_128');
          },
          () => {}
        );
      }

      // Start continuous ZXing video analyzer loop
      startZxingLoop();
    } catch (err: any) {
      console.error('Barcode camera start error:', err);
      isScanningRef.current = false;
      setIsScanning(false);
      stopZxingLoop();
      setScannerStatus('IDLE');
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

  /**
   * Processes genuine decoded barcode text:
   * 1. Displays exact raw string returned by the optical decoder.
   * 2. Compares raw string with expected prescription ID (RX-2026-0923-004).
   * 3. Categorizes status as DECODED_MATCHED or DECODED_MISMATCH.
   */
  const handleDecodedBarcode = (
    decodedText: string,
    source: 'camera' | 'file' | 'sample' = 'camera',
    format: string = 'CODE_128'
  ) => {
    const raw = decodedText.trim();
    if (!raw) return;

    let rxId = '';
    let medName = '';
    let pId = '';

    try {
      const parsed = JSON.parse(raw);
      rxId = (parsed.rxId || parsed.id || '').trim();
      medName = (parsed.medName || parsed.medicationName || '').trim();
      pId = (parsed.patientId || '').trim();
    } catch {
      rxId = raw;
      if (rxId === expectedPrescription.id || rxId.includes('0923-004')) {
        medName = expectedPrescription.medicationName;
      } else if (rxId === 'RX-9999-WRONG-DRUG' || rxId.includes('WRONG')) {
        medName = '모의 진통제 B (처방 외 약물)';
      }
    }

    // Exact prescription ID match check: RX-2026-0923-004
    const isRxMatch = rxId === expectedPrescription.id;
    const isPatientMatch = !pId || pId === patient.id;
    const isMatched = isRxMatch && isPatientMatch;

    // Clear any previous decode or camera errors
    setCameraError(null);
    setDecodeFailReason(null);

    if (isMatched) {
      setScannerStatus('DECODED_MATCHED');
      // Auto-populate 5-Rights ONLY when matched
      setFiveRights({
        rightPatient: true,
        rightDrug: true,
        rightDose: true,
        rightRoute: true,
        rightTime: true,
      });
    } else {
      setScannerStatus('DECODED_MISMATCH');
      setFiveRights({
        rightPatient: false,
        rightDrug: false,
        rightDose: false,
        rightRoute: false,
        rightTime: false,
      });
    }

    setScannedResult({
      raw,
      prescriptionId: rxId || raw,
      medicationName: medName || (isMatched ? expectedPrescription.medicationName : '처방 외 미승인 의약품'),
      patientId: pId || (isPatientMatch ? patient.id : '미확인 대상자'),
      isMatched,
      source,
      format: format || 'CODE_128',
    });

    stopCamera();
  };

  /**
   * Genuine Image File Upload Handler (PNG, JPG) using ZXing Decoder
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingFile(true);
    setDecodeFailReason(null);
    setCameraError(null);

    try {
      const result = await decodeBarcodeFromFile(file);
      if (result.success && result.text) {
        handleDecodedBarcode(result.text, 'file', result.format || 'CODE_128');
      } else {
        // STATE 1: DECODE FAILED (Barcode itself could not be parsed from image pixels)
        setScannedResult(null);
        setScannerStatus('DECODE_FAILED');
        setDecodeFailReason(
          result.error || '이미지에서 유효한 바코드(Code 128 / EAN / UPC) 패턴을 감지하지 못했습니다.'
        );
      }
    } catch (err: any) {
      setScannedResult(null);
      setScannerStatus('DECODE_FAILED');
      setDecodeFailReason(`이미지 분석 중 오류 발생: ${err?.message || err}`);
    } finally {
      setIsAnalyzingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /**
   * Genuine Optical Decoder Verification on Generated Barcodes:
   * Renders the barcode onto an offscreen canvas and runs the exact same ZXing decoder.
   * Proves real optical decoding for demo and testing without bypassing logic.
   */
  const handleRealDecoderTest = (isTargetMed: boolean) => {
    setIsAnalyzingFile(true);
    setDecodeFailReason(null);

    setTimeout(() => {
      try {
        const canvas = document.createElement('canvas');
        const testPayload = isTargetMed ? expectedPrescription.id : 'RX-9999-WRONG-DRUG';

        JsBarcode(canvas, testPayload, {
          format: 'CODE128',
          lineColor: '#000000',
          width: 2.2,
          height: 75,
          displayValue: true,
          fontSize: 16,
          font: 'monospace',
          text: testPayload,
          margin: 15,
          background: '#ffffff',
        });

        const res = decodeFromCanvas(canvas);
        if (res.success && res.text) {
          handleDecodedBarcode(res.text, 'sample', res.format || 'CODE_128');
        } else {
          setScannerStatus('DECODE_FAILED');
          setDecodeFailReason('바코드 디코더가 캔버스 이미지에서 바코드를 감지하지 못했습니다.');
        }
      } catch (err: any) {
        setScannerStatus('DECODE_FAILED');
        setDecodeFailReason(String(err?.message || err));
      } finally {
        setIsAnalyzingFile(false);
      }
    }, 50);
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
      setDecodeFailReason(null);
      setScannerStatus('IDLE');
    }
  }, [isOpen]);

  const toggleRight = (key: keyof typeof fiveRights) => {
    setFiveRights((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAllFiveRights = () => {
    const allChecked = Object.values(fiveRights).every(Boolean);
    setFiveRights({
      rightPatient: !allChecked,
      rightDrug: !allChecked,
      rightDose: !allChecked,
      rightRoute: !allChecked,
      rightTime: !allChecked,
    });
  };

  const allFiveRightsChecked = Object.values(fiveRights).every(Boolean);

  const handleFinalConfirm = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!scannedResult || !scannedResult.isMatched || !allFiveRightsChecked) return;

    onConfirmVerification('Barcode Scan', true);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col my-auto max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden File Input for Image Upload */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
              <Barcode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base flex items-center gap-2">
                <span>모의 항생제 바코드 스캔 (STEP 2)</span>
                <span className="text-[10px] font-mono font-normal bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded border border-sky-300 dark:border-sky-800">
                  ZXing Code 128
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                약품 라벨의 바코드를 해독하여 처방번호와 5-Right를 교차 대조합니다
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

          {/* Target Prescription Information Card */}
          <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-3 text-xs space-y-1.5 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">처방 대상 환자:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {patient.name} ({patient.id}, {patient.room})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">처방전 처방번호 (기대값):</span>
              <span className="font-mono font-bold text-sky-700 dark:text-sky-300 bg-white dark:bg-slate-900 px-2.5 py-0.5 rounded border border-sky-300 dark:border-sky-800">
                {expectedPrescription.id}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">처방 약물명 / 경로:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {expectedPrescription.medicationName} ({expectedPrescription.dosage}, {expectedPrescription.route})
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* STATE 1: DECODE FAILED (Barcode pattern cannot be detected)               */}
          {/* ========================================================================= */}
          {scannerStatus === 'DECODE_FAILED' && decodeFailReason && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-2xl text-xs space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-300 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  1. DECODE FAILED (바코드 해독 실패)
                </span>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-rose-200 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200">
                  인식 패턴 없음
                </span>
              </div>

              <p className="text-rose-900 dark:text-rose-200 text-xs leading-relaxed">
                {decodeFailReason}
              </p>

              <div className="p-2.5 bg-white/80 dark:bg-black/40 rounded-xl text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
                <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-sky-500" /> 촬영/업로드 시 확인 사항:
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
                  <li>바코드 막대선이 직사각형 가이드 중앙에 수평으로 위치하는지 확인해 주세요.</li>
                  <li>바코드 좌우의 <strong>흰색 여백(Quiet Zone)</strong>이 잘리지 않도록 넉넉하게 비춰주세요.</li>
                  <li>시연 준비실에서 <strong>[라벨 PNG 저장]</strong>한 선명한 원본 이미지를 업로드하시면 즉시 해독됩니다.</li>
                </ul>
              </div>

              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" /> 다른 이미지 파일 선택
                </button>
                <button
                  type="button"
                  onClick={(e) => startCamera(e)}
                  className="flex-1 py-2 px-3 rounded-xl border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 font-semibold text-xs hover:bg-rose-100 dark:hover:bg-rose-950/60 transition flex items-center justify-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" /> 카메라 다시 시작
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STATE 2 & 3: DECODED / MATCHED or DECODED / MISMATCH                      */}
          {/* ========================================================================= */}
          {scannedResult && (
            <div className="space-y-4">
              {/* DEMO MODE: Real Decoded Raw String & Format Display */}
              <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 border border-slate-700 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold flex items-center gap-1.5 text-sky-400">
                    <Barcode className="w-4 h-4" /> 실제 디코더 해독 결과 (DEMO MODE)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 font-semibold">
                    {scannedResult.source === 'file' && '이미지 파일 디코딩'}
                    {scannedResult.source === 'camera' && '실시간 카메라 디코딩'}
                    {scannedResult.source === 'sample' && '캔버스 샘플 디코딩'}
                  </span>
                </div>

                <div className="bg-black/90 border border-slate-700/80 rounded-xl px-3.5 py-3 font-mono text-base font-bold text-white tracking-wider break-all select-all flex items-center justify-between">
                  <span>{scannedResult.raw}</span>
                  <span className="text-[11px] text-sky-400 font-sans font-medium ml-2 shrink-0 bg-sky-950/90 px-2 py-0.5 rounded border border-sky-700">
                    {scannedResult.format || 'CODE_128'}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>
                    광학 바코드 라벨의 바 패턴으로부터 디코더 엔진이 직접 추출한 실제 원본 데이터입니다.
                  </span>
                </div>
              </div>

              {/* Status Comparison Card: DECODED / MATCHED vs DECODED / MISMATCH */}
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
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        3. DECODED / MATCHED (처방 일치)
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                        2. DECODED / MISMATCH (처방 불일치)
                      </>
                    )}
                  </span>
                  <span
                    className={`font-mono text-xs px-2.5 py-1 rounded-full font-bold border ${
                      scannedResult.isMatched
                        ? 'bg-emerald-100 dark:bg-emerald-900/60 border-emerald-400 text-emerald-800 dark:text-emerald-200'
                        : 'bg-rose-100 dark:bg-rose-900/60 border-rose-400 text-rose-800 dark:text-rose-200'
                    }`}
                  >
                    {scannedResult.isMatched ? '처방 일치 승인 ✓' : '투약 진행 차단 ⚠️'}
                  </span>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2.5 rounded-xl bg-white/80 dark:bg-black/30">
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">해독된 처방번호</span>
                      <strong className="font-mono text-slate-900 dark:text-slate-100 font-bold text-xs">
                        {scannedResult.prescriptionId}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/80 dark:bg-black/30">
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">처방전 기대번호</span>
                      <strong className="font-mono text-slate-900 dark:text-slate-100 font-bold text-xs">
                        {expectedPrescription.id}
                      </strong>
                    </div>
                  </div>

                  {scannedResult.isMatched ? (
                    <div className="p-2.5 rounded-xl bg-emerald-100/70 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs">
                      ✓ 처방된 모의 IV 항생제 A와 일치합니다. 아래 투약 5대 원칙(5-Right) 교차 검증 후 투약을 승인하세요.
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold space-y-1.5">
                      <div>
                        ⚠️ [오투약 방지 차단] 해독된 코드('{scannedResult.raw}')가 처방된 번호('{expectedPrescription.id}')와 일치하지 않는 미처방 약물입니다!
                      </div>
                      <div className="text-[11px] font-normal text-rose-700 dark:text-rose-300">
                        환자 안전을 위해 본 약물의 5-Right 승인 및 다음 단계 진행이 시스템적으로 엄격히 거부되었습니다.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 5-Right Checklist Box (Enabled ONLY when DECODED / MATCHED) */}
              {scannedResult.isMatched && (
                <div className="bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                      <ShieldAlert className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                      <span>투약 5대 원칙 (5-Right) 교차 검증</span>
                    </div>
                    <button
                      type="button"
                      onClick={toggleAllFiveRights}
                      className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-semibold"
                    >
                      {allFiveRightsChecked ? '전체 해제' : '전체 확인 완료'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label
                      onClick={() => toggleRight('rightPatient')}
                      className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition ${
                        fiveRights.rightPatient
                          ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-400 text-sky-900 dark:text-sky-200 font-medium'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {fiveRights.rightPatient ? (
                        <CheckSquare className="w-4 h-4 text-sky-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span>1. 정확한 환자 ({patient.name})</span>
                    </label>

                    <label
                      onClick={() => toggleRight('rightDrug')}
                      className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition ${
                        fiveRights.rightDrug
                          ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-400 text-sky-900 dark:text-sky-200 font-medium'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {fiveRights.rightDrug ? (
                        <CheckSquare className="w-4 h-4 text-sky-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span>2. 정확한 약물 (항생제 A)</span>
                    </label>

                    <label
                      onClick={() => toggleRight('rightDose')}
                      className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition ${
                        fiveRights.rightDose
                          ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-400 text-sky-900 dark:text-sky-200 font-medium'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {fiveRights.rightDose ? (
                        <CheckSquare className="w-4 h-4 text-sky-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span>3. 정확한 용량 ({expectedPrescription.dosage})</span>
                    </label>

                    <label
                      onClick={() => toggleRight('rightRoute')}
                      className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition ${
                        fiveRights.rightRoute
                          ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-400 text-sky-900 dark:text-sky-200 font-medium'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {fiveRights.rightRoute ? (
                        <CheckSquare className="w-4 h-4 text-sky-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span>4. 정확한 경로 ({expectedPrescription.route})</span>
                    </label>

                    <label
                      onClick={() => toggleRight('rightTime')}
                      className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition sm:col-span-2 ${
                        fiveRights.rightTime
                          ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-400 text-sky-900 dark:text-sky-200 font-medium'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {fiveRights.rightTime ? (
                        <CheckSquare className="w-4 h-4 text-sky-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span>5. 정확한 시간 (정규 투약 시각)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                {scannedResult.isMatched ? (
                  <button
                    type="button"
                    disabled={!allFiveRightsChecked}
                    onClick={(e) => handleFinalConfirm(e)}
                    className="w-full py-3.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 active:scale-[0.98] transition disabled:shadow-none"
                  >
                    <ShieldCheck className="w-5 h-5" />
                    5-Right 확인 완료 및 투약 승인 (타임라인 기록)
                  </button>
                ) : (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-xl text-center text-xs text-rose-700 dark:text-rose-300 font-bold">
                    🚫 처방 불일치 의약품이므로 다음 단계 진행이 차단되었습니다.
                  </div>
                )}

                <button
                  type="button"
                  onClick={(e) => startCamera(e)}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> 다시 스캔하기 (카메라 재시작)
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* CAMERA VIEWFINDER & SINGLE HORIZONTAL RECTANGULAR GUIDE                   */}
          {/* ========================================================================= */}
          {!scannedResult && (
            <div className="space-y-3">
              <div className="relative bg-black rounded-2xl overflow-hidden aspect-4/3 max-w-[340px] mx-auto flex items-center justify-center border-2 border-slate-700 shadow-inner">
                {/* Real-time HTML5-QRCode Video Mount Container */}
                <div id={readerElementId} className="w-full h-full" />

                {/* SINGLE VISUAL RECTANGULAR GUIDE (No duplicate library overlay) */}
                {isScanning && !cameraError && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    {/* Horizontal Rectangular Guide with Quiet Zone clearance */}
                    <div className="w-72 h-36 border-2 border-sky-400 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                      {/* Corner Accents */}
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-sky-400 rounded-tl-sm" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-sky-400 rounded-tr-sm" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-sky-400 rounded-bl-sm" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-sky-400 rounded-br-sm" />
                      {/* Horizontal Scanning Line */}
                      <div className="w-full h-0.5 bg-sky-400 shadow-[0_0_8px_#38bdf8] animate-pulse absolute top-1/2 -translate-y-1/2" />
                    </div>
                    {/* Clear Guidance Text */}
                    <p className="text-white text-xs mt-3 bg-black/80 px-3.5 py-1 rounded-full font-semibold shadow-md flex items-center gap-1.5">
                      <Barcode className="w-3.5 h-3.5 text-sky-400" />
                      바코드 전체와 양쪽 여백이 가로 직사각형 안에 보이도록 맞춰주세요
                    </p>
                  </div>
                )}

                {/* File analyzing loading overlay */}
                {isAnalyzingFile && (
                  <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-white text-xs gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                    <span className="font-semibold">바코드 이미지 광학 디코딩 분석 중...</span>
                  </div>
                )}

                {/* Categorized Camera Error Diagnostics */}
                {cameraError && (
                  <div className="absolute inset-0 bg-slate-950/95 p-4 flex flex-col items-center justify-center text-center overflow-y-auto">
                    <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-1.5 shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>

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
                    <p className="text-[10px] text-sky-300 mb-3 bg-sky-950/60 border border-sky-800/60 rounded-lg p-1.5 leading-tight">
                      💡 {cameraError.actionGuide}
                    </p>

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
                    </div>
                  </div>
                )}
              </div>

              {/* ========================================================================= */}
              {/* IMAGE FILE UPLOAD & REAL ZXING DECODER TESTS                              */}
              {/* ========================================================================= */}
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-200 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    바코드 이미지 직접 업로드 테스트 (PNG / JPG)
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  촬영한 사진 또는 시연 준비실에서 다운로드한 바코드 이미지를 업로드하여 동일한 디코더 엔진으로 즉시 해독합니다.
                </p>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 rounded-xl bg-white dark:bg-slate-900 border-2 border-dashed border-sky-400/80 hover:border-sky-500 text-sky-700 dark:text-sky-300 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition active:scale-[0.99]"
                >
                  <FileImage className="w-4 h-4" />
                  <span>바코드 이미지 파일 선택 (.png, .jpg)</span>
                </button>

                {/* Real Optical Decoder Verification Buttons on Sample Canvas */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 space-y-1.5">
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                    ZXing 광학 디코더 엔진 직접 검증 (모의 캔버스 픽셀 해독):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleRealDecoderTest(true)}
                      className="py-2 px-2.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-200 text-[11px] font-semibold flex items-center justify-center gap-1.5 hover:bg-sky-100 transition"
                    >
                      <Barcode className="w-3.5 h-3.5 text-sky-600" />
                      <span>정상 처방 바코드 실제 해독</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRealDecoderTest(false)}
                      className="py-2 px-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 hover:bg-rose-100 transition"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      <span>불일치 바코드 실제 해독</span>
                    </button>
                  </div>
                </div>
              </div>
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
            바코드 대신 수동 확인 사용
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
