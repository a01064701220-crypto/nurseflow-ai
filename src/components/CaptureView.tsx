import React, { useState } from 'react';
import {
  QrCode,
  Barcode,
  Mic,
  Activity,
  Play,
  Square,
  CheckCircle2,
  Clock,
  RotateCcw,
  Smartphone,
  ChevronRight,
  Database,
  Monitor,
  Check,
  Radio,
  Copy,
  AlertTriangle,
  RefreshCw,
  Terminal,
  Sparkles,
  Cpu,
  Eye,
} from 'lucide-react';
import {
  Patient,
  MedicationOrder,
  DemoSession,
  NursingEvent,
  IvSiteAssessment,
  EventType,
  EventSource,
  AppMode,
  isStep4,
  isStep5,
} from '../types';
import { QrScannerModal } from './QrScannerModal';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { IvSiteModal } from './IvSiteModal';
import { VoiceNursingModal } from './VoiceNursingModal';
import { HandsFreeDemoView } from './HandsFreeDemoView';
import { HandsFreeDiagnosticsModal } from './HandsFreeDiagnosticsModal';

interface CaptureViewProps {
  nurse: any;
  patient: Patient;
  prescription: MedicationOrder;
  currentSession: DemoSession;
  events: NursingEvent[];
  ivSiteAssessment: IvSiteAssessment | null;
  onTriggerEvent: (
    eventType: EventType,
    source?: EventSource,
    metadata?: any
  ) => Promise<{ success: boolean; message?: string }>;
  onConfirmVerification: (
    source: 'QR Scan' | 'Barcode Scan',
    fiveRightsVerified?: boolean
  ) => Promise<void>;
  onSaveIvAssessment: (assessment: IvSiteAssessment) => void;
  onSaveVoiceNote: (transcript: string, linkedStep?: string, clinicalFindings?: any) => void;
  onStartNewSession: () => void;
  onSwitchMode: (mode: AppMode) => void;
  onOpenFirebaseGuide: () => void;
  onOpenDiagnostics?: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const CaptureView: React.FC<CaptureViewProps> = ({
  nurse,
  patient,
  prescription,
  currentSession,
  events,
  ivSiteAssessment,
  onTriggerEvent,
  onConfirmVerification,
  onSaveIvAssessment,
  onSaveVoiceNote,
  onStartNewSession,
  onSwitchMode,
  onOpenFirebaseGuide,
  onOpenDiagnostics,
  isDarkMode,
  onToggleDarkMode,
}) => {
  // Modal states
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [isIvOpen, setIsIvOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isHandsFreeOpen, setIsHandsFreeOpen] = useState(false);
  const [isHandsFreeDiagOpen, setIsHandsFreeDiagOpen] = useState(false);
  const [isNewSessionConfirmOpen, setIsNewSessionConfirmOpen] = useState(false);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [isCopiedSessionId, setIsCopiedSessionId] = useState(false);

  const copySessionId = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(currentSession.sessionId);
      setIsCopiedSessionId(true);
      setTimeout(() => setIsCopiedSessionId(false), 2000);
    }
  };

  // Workflow verification states derived strictly from synced events of THIS session
  const sessionEvents = events.filter((e) => e.sessionId === currentSession.sessionId);
  const isPatientVerified = sessionEvents.some((e) => e.eventType === 'PATIENT_VERIFY');
  const isMedicationVerified = sessionEvents.some((e) => e.eventType === 'MEDICATION_VERIFY');
  const isIvSiteAssessed = sessionEvents.some((e) => e.eventType === 'IV_SITE_ASSESS');
  const hasInfusionStarted = sessionEvents.some((e) => isStep4(e.eventType));
  const hasInfusionEnded = sessionEvents.some((e) => isStep5(e.eventType));
  const voiceNotesCount = sessionEvents.filter((e) => e.eventType === 'VOICE_NOTE').length;
  const hasVoiceNote = voiceNotesCount > 0;

  const completedCount = [
    isPatientVerified,
    isMedicationVerified,
    isIvSiteAssessed,
    hasInfusionStarted,
    hasInfusionEnded,
  ].filter(Boolean).length;

  // Next recommended action for mobile nurse
  let nextAction = {
    step: 1,
    title: '환자 손목밴드 QR 스캔',
    desc: '환자 신원(홍길동, 305호)을 확인하기 위해 손목밴드 QR을 스캔하세요.',
    action: () => setIsQrOpen(true),
    icon: QrCode,
    color: 'teal',
  };

  if (!isPatientVerified) {
    nextAction = {
      step: 1,
      title: '환자 손목밴드 QR 스캔',
      desc: '환자 신원(홍길동, 305호)을 확인하기 위해 손목밴드 QR을 스캔하세요.',
      action: () => setIsQrOpen(true),
      icon: QrCode,
      color: 'teal',
    };
  } else if (!isMedicationVerified) {
    nextAction = {
      step: 2,
      title: '약물 1D 바코드 스캔',
      desc: '처방된 항생제 A(RX-2026-0923-004) 바코드를 스캔하여 5-Right를 검증하세요.',
      action: () => setIsBarcodeOpen(true),
      icon: Barcode,
      color: 'sky',
    };
  } else if (!isIvSiteAssessed) {
    nextAction = {
      step: 3,
      title: 'IV Site 사정 (음성 또는 터치)',
      desc: '정맥 주입 부위의 부종, 발적, 통증 여부를 음성 또는 터치로 기록하세요.',
      action: () => setIsIvOpen(true),
      icon: Activity,
      color: 'indigo',
    };
  } else if (!hasInfusionStarted) {
    nextAction = {
      step: 4,
      title: 'IV 투여 시작 기록',
      desc: '약물 주입을 시작하고 시작 시각을 타임라인에 등록하세요.',
      action: async () => {
        setIsSavingEvent(true);
        setSaveErrorMessage(null);
        const res = await onTriggerEvent('MEDICATION_START', 'Manual Confirmation');
        setIsSavingEvent(false);
        if (!res.success) {
          setSaveErrorMessage(res.message || '투여 시작 기록 저장에 실패했습니다.');
        }
      },
      icon: Play,
      color: 'emerald',
    };
  } else if (!hasInfusionEnded) {
    nextAction = {
      step: 5,
      title: 'IV 투여 종료 기록',
      desc: '처방 용량 전량 주입 완료 후 투여 종료 시각을 기록하세요.',
      action: async () => {
        setIsSavingEvent(true);
        setSaveErrorMessage(null);
        const res = await onTriggerEvent('MEDICATION_END', 'Manual Confirmation');
        setIsSavingEvent(false);
        if (!res.success) {
          setSaveErrorMessage(res.message || '투여 종료 기록 저장에 실패했습니다.');
        }
      },
      icon: Square,
      color: 'purple',
    };
  } else {
    nextAction = {
      step: 6,
      title: '모든 현장 간호 행위 완료',
      desc: 'Station에서 Gemini AI 간호기록 초안이 대기 중입니다.',
      action: () => onSwitchMode('STATION'),
      icon: CheckCircle2,
      color: 'teal',
    };
  }

  // Handle patient verification save strictly with await
  const handleConfirmPatientQr = async () => {
    setIsSavingEvent(true);
    setSaveErrorMessage(null);
    try {
      const res = await onTriggerEvent('PATIENT_VERIFY', 'QR Scan', {
        deviceType: 'MOBILE_CAPTURE',
        fiveRightsVerified: false,
      });
      setIsSavingEvent(false);
      if (res.success) {
        setIsQrOpen(false);
      } else {
        setSaveErrorMessage(res.message || '환자 확인 이벤트 클라우드 저장 실패');
      }
    } catch (err: any) {
      setIsSavingEvent(false);
      setSaveErrorMessage(`클라우드 오류: ${err.message || err}`);
    }
  };

  // Handle medication barcode save strictly with await
  const handleConfirmMedicationBarcode = async (fiveRightsVerified: boolean = false) => {
    setIsSavingEvent(true);
    setSaveErrorMessage(null);
    try {
      const res = await onTriggerEvent('MEDICATION_VERIFY', 'Barcode Scan', {
        deviceType: 'MOBILE_CAPTURE',
        scannedCode: prescription.id,
        fiveRightsVerified,
      });
      setIsSavingEvent(false);
      if (res.success) {
        setIsBarcodeOpen(false);
      } else {
        setSaveErrorMessage(res.message || '약물 확인 이벤트 클라우드 저장 실패');
      }
    } catch (err: any) {
      setIsSavingEvent(false);
      setSaveErrorMessage(`클라우드 오류: ${err.message || err}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between pb-12">
      {/* Mobile Top App Bar */}
      <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-tight text-white">
                NurseFlow Capture
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 font-bold border border-sky-800">
                현장 모바일
              </span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-300 font-medium">Firestore 실시간 연동</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Hands-Free Demo Launch Button */}
          <button
            type="button"
            onClick={() => setIsHandsFreeOpen(true)}
            className="text-xs px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-950 to-teal-950 hover:from-purple-900 hover:to-teal-900 border border-purple-600/70 text-purple-200 font-bold flex items-center gap-1.5 transition shadow-sm"
            title="웨어러블 대체용 AI 핸즈프리 시연 시작"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[11px]">핸즈프리</span>
          </button>

          {/* Diagnostics Button */}
          {onOpenDiagnostics && (
            <button
              type="button"
              onClick={onOpenDiagnostics}
              className="text-xs px-2 py-1.5 rounded-xl bg-teal-950/80 hover:bg-teal-900 border border-teal-800 text-teal-300 font-medium flex items-center gap-1 transition"
              title="시스템 및 동기화 진단"
            >
              <Terminal className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-[11px]">진단</span>
            </button>
          )}

          {/* Switch to PC Station */}
          <button
            type="button"
            onClick={() => onSwitchMode('STATION')}
            className="text-xs px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium flex items-center gap-1 transition"
            title="PC 간호사 스테이션 화면으로 전환"
          >
            <Monitor className="w-3.5 h-3.5 text-teal-400" />
            <span className="text-[11px]">Station</span>
          </button>

          {/* Switch to Portal */}
          <button
            type="button"
            onClick={() => onSwitchMode('PORTAL')}
            className="text-xs px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="포털"
          >
            포털
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-4">
        {/* Full Session ID Bar: Guaranteeing visibility of full sessionId */}
        <div className="bg-slate-950 rounded-2xl p-3 border border-teal-500/30 flex items-center justify-between text-xs shadow-xs">
          <div className="space-y-0.5 overflow-hidden pr-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-slate-400 font-medium">동기화 세션 ID (Station 일치):</span>
            </div>
            <div className="font-mono font-bold text-xs text-teal-300 truncate">
              {currentSession.sessionId}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={copySessionId}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="세션 ID 복사"
            >
              {isCopiedSessionId ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-teal-950/80 text-teal-300 border border-teal-800">
              #{currentSession.sessionNumber}
            </span>
          </div>
        </div>

        {/* Global Save Error Banner */}
        {saveErrorMessage && (
          <div className="p-3 bg-rose-950/80 border border-rose-700 rounded-2xl flex items-start gap-2.5 text-xs text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">이벤트 저장 실패:</span>
              <span>{saveErrorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSaveErrorMessage(null)}
              className="text-slate-400 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Patient & Prescription Context Badge */}
        <div className="bg-slate-800/80 rounded-2xl p-3.5 border border-slate-700 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">{patient.name}</span>
              <span className="text-[11px] text-slate-400">({patient.gender}/{patient.age}세)</span>
              <span className="font-mono text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-teal-400 font-semibold">
                {patient.room}
              </span>
            </div>
            <span className="font-mono text-[10px] text-slate-400">{patient.id}</span>
          </div>

          <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
            <div className="text-slate-300 truncate">
              <span className="text-slate-400">투약 처방: </span>
              <strong className="text-sky-300 font-semibold">{prescription.medicationName}</strong>
            </div>
            <span className="font-mono text-[10px] text-slate-400 ml-2 shrink-0">
              {prescription.route}
            </span>
          </div>
        </div>

        {/* AI Hands-Free Wearable Demo Banner (STEP 4-A) */}
        <div className="bg-gradient-to-br from-purple-950/70 via-slate-900 to-teal-950/70 rounded-2xl p-4 border border-purple-500/40 space-y-3 shadow-lg shadow-purple-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold font-mono tracking-wider text-purple-300 uppercase flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              웨어러블 시연 모드 (STEP 4-A)
            </span>
            <button
              type="button"
              onClick={() => setIsHandsFreeDiagOpen(true)}
              className="text-[10px] font-mono text-purple-300 hover:text-white bg-purple-900/50 hover:bg-purple-850 px-2 py-0.5 rounded-full border border-purple-700/60 flex items-center gap-1 transition"
              title="아이폰 Safari 카메라 및 음성 동시 작동 점검"
            >
              <Cpu className="w-3 h-3 text-purple-400" />
              <span>하드웨어 진단</span>
            </button>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 shrink-0 mt-0.5 border border-purple-500/30">
              <Eye className="w-5 h-5" />
            </div>
            <div className="space-y-1 flex-1">
              <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                <span>AI 핸즈프리 시연</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-teal-950 text-teal-300 border border-teal-800 font-normal">
                  자동인식 HUD
                </span>
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                카메라가 현재 단계(환자 QR ➔ 약물 바코드)를 자동 감지하고 간호 음성 소견을 청취합니다.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsHandsFreeOpen(true)}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-teal-600 hover:from-purple-500 hover:to-teal-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 active:scale-98 transition"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>AI 핸즈프리 시연 시작</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Next Clinical Action Banner */}
        <div className="bg-gradient-to-br from-teal-900/40 via-slate-800 to-slate-900 rounded-2xl p-4 border border-teal-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold font-mono tracking-wider text-teal-400 uppercase flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-teal-400 animate-pulse" />
              다음 추천 간호 행위
            </span>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded-full border border-slate-700">
              단계 {nextAction.step} / 5
            </span>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/20 text-teal-300 shrink-0 mt-0.5">
              <nextAction.icon className="w-5 h-5" />
            </div>
            <div className="space-y-1 flex-1">
              <h4 className="font-bold text-sm text-white">{nextAction.title}</h4>
              <p className="text-xs text-slate-300 leading-relaxed">{nextAction.desc}</p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSavingEvent}
            onClick={nextAction.action}
            className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-teal-900/30 active:scale-98 transition"
          >
            {isSavingEvent ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Firestore에 저장 중...</span>
              </>
            ) : (
              <>
                <span>실행하기</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Nursing Action Grid (Step 1 to 5) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium px-1">
            <span>현장 간호 수집 항목 (5대 원칙 및 절차)</span>
            <span className="text-[11px] text-teal-400 font-mono font-bold">
              {completedCount} / 5 완료
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Step 1: Patient QR */}
            <button
              type="button"
              onClick={() => setIsQrOpen(true)}
              className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition ${
                isPatientVerified
                  ? 'bg-emerald-950/40 border-emerald-600/80 text-emerald-200'
                  : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
                  <QrCode className="w-4 h-4" />
                </div>
                {isPatientVerified ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-900/80 text-emerald-300 flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> 완료
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">1단계</span>
                )}
              </div>
              <div>
                <div className="font-bold text-xs">환자 QR 스캔</div>
                <div className="text-[10px] text-slate-400">손목밴드 식별</div>
              </div>
            </button>

            {/* Step 2: Medication Barcode (Code 128) */}
            <button
              type="button"
              onClick={() => setIsBarcodeOpen(true)}
              className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition ${
                isMedicationVerified
                  ? 'bg-emerald-950/40 border-emerald-600/80 text-emerald-200'
                  : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
                  <Barcode className="w-4 h-4" />
                </div>
                {isMedicationVerified ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-900/80 text-emerald-300 flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> 완료
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">2단계</span>
                )}
              </div>
              <div>
                <div className="font-bold text-xs">약물 바코드 스캔</div>
                <div className="text-[10px] text-slate-400">Code 128 & 5-Right</div>
              </div>
            </button>

            {/* Step 3: IV Site Assessment */}
            <button
              type="button"
              onClick={() => setIsIvOpen(true)}
              className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition ${
                isIvSiteAssessed
                  ? 'bg-emerald-950/40 border-emerald-600/80 text-emerald-200'
                  : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Activity className="w-4 h-4" />
                </div>
                {isIvSiteAssessed ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-900/80 text-emerald-300 flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> 완료
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">3단계</span>
                )}
              </div>
              <div>
                <div className="font-bold text-xs">IV Site 사정</div>
                <div className="text-[10px] text-slate-400">발적/부종/통증</div>
              </div>
            </button>

            {/* Voice Input Button (Independent multi-recordable voice notes) */}
            <button
              type="button"
              onClick={() => setIsVoiceOpen(true)}
              className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition active:scale-95 ${
                hasVoiceNote
                  ? 'bg-purple-950/40 hover:bg-purple-950/60 border-purple-500/70 text-purple-200'
                  : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className={`p-1.5 rounded-lg ${hasVoiceNote ? 'bg-purple-500/20 text-purple-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  <Mic className="w-4 h-4" />
                </div>
                {hasVoiceNote ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-900/80 text-purple-300 flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> 완료 {voiceNotesCount > 1 ? `(${voiceNotesCount})` : ''}
                  </span>
                ) : (
                  <span className="text-[10px] text-rose-400 font-mono">MIC</span>
                )}
              </div>
              <div>
                <div className="font-bold text-xs flex items-center gap-1">
                  <span>음성 간호 입력</span>
                  {hasVoiceNote && <span className="text-[10px] text-purple-400 font-normal">+추가</span>}
                </div>
                <div className="text-[10px] text-slate-400">
                  {hasVoiceNote ? `${voiceNotesCount}건 기록됨 (추가 가능)` : '실시간 음성 기록'}
                </div>
              </div>
            </button>

            {/* Step 4: Infusion Start */}
            <button
              type="button"
              disabled={hasInfusionStarted || isSavingEvent}
              onClick={async () => {
                setIsSavingEvent(true);
                setSaveErrorMessage(null);
                const res = await onTriggerEvent('MEDICATION_START', 'Manual Confirmation');
                setIsSavingEvent(false);
                if (!res.success) {
                  setSaveErrorMessage(res.message || '투여 시작 기록 저장 실패');
                }
              }}
              className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition ${
                hasInfusionStarted
                  ? 'bg-emerald-950/40 border-emerald-600/80 text-emerald-200 opacity-90'
                  : 'bg-emerald-950/20 hover:bg-emerald-950/40 border-emerald-700/60 text-emerald-200 active:scale-95'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Play className="w-4 h-4" />
                </div>
                {hasInfusionStarted ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-300">
                    시작됨
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">4단계</span>
                )}
              </div>
              <div>
                <div className="font-bold text-xs">투여 시작</div>
                <div className="text-[10px] text-slate-400">시작 시각 기록</div>
              </div>
            </button>

            {/* Step 5: Infusion End */}
            <button
              type="button"
              disabled={hasInfusionEnded || !hasInfusionStarted || isSavingEvent}
              onClick={async () => {
                setIsSavingEvent(true);
                setSaveErrorMessage(null);
                const res = await onTriggerEvent('MEDICATION_END', 'Manual Confirmation');
                setIsSavingEvent(false);
                if (!res.success) {
                  setSaveErrorMessage(res.message || '투여 종료 기록 저장 실패');
                }
              }}
              className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition ${
                hasInfusionEnded
                  ? 'bg-purple-950/40 border-purple-600/80 text-purple-200 opacity-90'
                  : !hasInfusionStarted
                  ? 'bg-slate-900 border-slate-800 text-slate-500 opacity-50 cursor-not-allowed'
                  : 'bg-purple-950/20 hover:bg-purple-950/40 border-purple-700/60 text-purple-200 active:scale-95'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                  <Square className="w-4 h-4" />
                </div>
                {hasInfusionEnded ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-900 text-purple-300">
                    종료됨
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">5단계</span>
                )}
              </div>
              <div>
                <div className="font-bold text-xs">투여 종료</div>
                <div className="text-[10px] text-slate-400">전량 주입 확인</div>
              </div>
            </button>
          </div>
        </div>

        {/* Live Synchronized Event Stream for Nurse */}
        <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-400" />
              최근 발생 이벤트 (Station 실시간 공유)
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {sessionEvents.length}건
            </span>
          </div>

          {sessionEvents.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-700 rounded-xl">
              현재 세션에 아직 기록된 이벤트가 없습니다. 상단의 1단계(환자 QR)부터 시작해 보세요.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
              {sessionEvents.slice(-4).reverse().map((ev) => (
                <div
                  key={ev.eventId}
                  className="p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                      <span>{ev.eventType}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{ev.eventDescription}</p>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 ml-2 shrink-0">
                    {ev.eventTimestamp}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Session Reset & Station Transition Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setIsNewSessionConfirmOpen(true)}
            className="flex-1 py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
            <span>새 시연 세션 시작</span>
          </button>

          <button
            type="button"
            onClick={() => onSwitchMode('STATION')}
            className="flex-1 py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Station 대시보드</span>
          </button>
        </div>
      </main>

      {/* Patient QR Scanner Modal */}
      <QrScannerModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        expectedPatient={patient}
        onConfirmVerification={(source, matchedPatient) => handleConfirmPatientQr()}
        onSwitchToManual={() => {
          setIsQrOpen(false);
          handleConfirmPatientQr();
        }}
        isSessionCompleted={isPatientVerified}
        onStartNewSession={onStartNewSession}
      />

      {/* Medication Barcode Scanner Modal (Code 128) */}
      <BarcodeScannerModal
        isOpen={isBarcodeOpen}
        onClose={() => setIsBarcodeOpen(false)}
        expectedPrescription={prescription}
        patient={patient}
        onConfirmVerification={(source, verified) => handleConfirmMedicationBarcode(verified)}
        onSwitchToManual={() => {
          setIsBarcodeOpen(false);
          handleConfirmMedicationBarcode(true);
        }}
        isSessionCompleted={isMedicationVerified}
        onStartNewSession={onStartNewSession}
      />

      {/* IV Site Assessment Modal */}
      <IvSiteModal
        isOpen={isIvOpen}
        onClose={() => setIsIvOpen(false)}
        onSaveAssessment={(assessment) => {
          onSaveIvAssessment(assessment);
          setIsIvOpen(false);
        }}
        initialAssessment={ivSiteAssessment}
      />

      {/* Voice Nursing Input Modal (Supports VOICE_NOTE and VOICE_AI_CONFIRMED) */}
      <VoiceNursingModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onConfirmVoiceEvent={async (text, linkedStep, clinicalFindings, asWorkflowAction) => {
          if (asWorkflowAction && linkedStep) {
            let eventTypeToTrigger: EventType | null = null;
            if (isStep4(linkedStep)) eventTypeToTrigger = 'MEDICATION_START';
            else if (isStep5(linkedStep)) eventTypeToTrigger = 'MEDICATION_END';
            else if (linkedStep === 'IV_SITE_ASSESS') eventTypeToTrigger = 'IV_SITE_ASSESS';

            if (eventTypeToTrigger) {
              await onTriggerEvent(eventTypeToTrigger, 'Voice Confirmation', {
                transcript: text,
                source: 'VOICE_AI_CONFIRMED',
                clinicalFindings,
              });
            } else {
              onSaveVoiceNote(text, linkedStep, clinicalFindings);
            }
          } else {
            onSaveVoiceNote(text, linkedStep, clinicalFindings);
          }
          setIsVoiceOpen(false);
        }}
      />

      {/* AI Hands-Free Wearable Demo View (STEP 4-A) */}
      <HandsFreeDemoView
        isOpen={isHandsFreeOpen}
        onClose={() => setIsHandsFreeOpen(false)}
        nurse={nurse}
        patient={patient}
        prescription={prescription}
        currentSession={currentSession}
        events={events}
        onTriggerEvent={onTriggerEvent}
        onConfirmVerification={onConfirmVerification}
        onSaveVoiceNote={onSaveVoiceNote}
      />

      {/* Hands-Free Hardware Diagnostics Modal */}
      <HandsFreeDiagnosticsModal
        isOpen={isHandsFreeDiagOpen}
        onClose={() => setIsHandsFreeDiagOpen(false)}
      />

      {/* New Session Confirmation Modal */}
      {isNewSessionConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-950 text-amber-400 flex items-center justify-center">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">
                  새 시연 세션을 시작할까요?
                </h3>
                <p className="text-xs text-slate-400">
                  현재 세션의 실시간 이벤트는 안전하게 보존되며 새 세션이 발급됩니다.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewSessionConfirmOpen(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsNewSessionConfirmOpen(false);
                  onStartNewSession();
                }}
                className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition shadow-xs"
              >
                새 세션 시작
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
