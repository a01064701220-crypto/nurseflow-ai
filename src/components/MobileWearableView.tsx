import React, { useState } from 'react';
import {
  Smartphone,
  QrCode,
  Barcode,
  Mic,
  CheckCircle2,
  Play,
  Square,
  Activity,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  FileText,
  Clock,
  Send,
  Eye,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { Patient, Prescription, NursingEvent, IvSiteAssessment } from '../types';
import { diagnoseEnvironment } from '../utils/cameraUtils';

interface MobileWearableViewProps {
  patient: Patient;
  prescription: Prescription;
  events: NursingEvent[];
  ivSiteAssessment: IvSiteAssessment | null;
  onOpenQrScanner: () => void;
  onOpenBarcodeScanner: () => void;
  onOpenVoiceInput: () => void;
  onOpenIvSiteModal: () => void;
  onTriggerStart: () => void;
  onTriggerEnd: () => void;
  onGoToDraft: () => void;
  onOpenNewSessionConfirm: () => void;
}

export const MobileWearableView: React.FC<MobileWearableViewProps> = ({
  patient,
  prescription,
  events,
  ivSiteAssessment,
  onOpenQrScanner,
  onOpenBarcodeScanner,
  onOpenVoiceInput,
  onOpenIvSiteModal,
  onTriggerStart,
  onTriggerEnd,
  onGoToDraft,
  onOpenNewSessionConfirm,
}) => {
  // Determine step completion states
  const hasPatientVerify = events.some((e) => e.eventType === 'PATIENT_VERIFY');
  const hasMedVerify = events.some((e) => e.eventType === 'MEDICATION_VERIFY');
  const hasIvSiteAssess = events.some((e) => e.eventType === 'IV_SITE_ASSESS');
  const hasInfusionStart = events.some((e) => e.eventType === 'INFUSION_START');
  const hasInfusionEnd = events.some((e) => e.eventType === 'INFUSION_END');

  const env = diagnoseEnvironment();
  const [isCopied, setIsCopied] = useState(false);

  // Next recommended action
  let nextActionLabel = '1. 환자 손목밴드 QR 스캔';
  if (!hasPatientVerify) {
    nextActionLabel = '1. 환자 손목밴드 QR 스캔';
  } else if (!hasMedVerify) {
    nextActionLabel = '2. 약물 바코드 스캔';
  } else if (!hasIvSiteAssess) {
    nextActionLabel = '3. IV Site 사정 (음성 또는 터치)';
  } else if (!hasInfusionStart) {
    nextActionLabel = '4. IV 투여 시작';
  } else if (!hasInfusionEnd) {
    nextActionLabel = '5. IV 투여 종료';
  } else {
    nextActionLabel = '투여 완료 (AI 간호기록 생성 가능)';
  }

  const handleCopyUrl = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(env.standaloneUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-4 pb-16">
      {/* Wearable / Mobile Concept Notice Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-lg border border-teal-500/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <Smartphone className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-xs tracking-wide">
              모바일 간호사 시연 뷰 (Wearable Concept)
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/40">
            모바일 최적화
          </span>
        </div>
        <p className="text-[11px] text-slate-300 leading-relaxed">
          스마트 안경 및 웨어러블 센서가 간호사의 손동작과 음성을 감지해 행위를 자동 수집하는 미래 임상 워크플로우를 스마트폰 터치/카메라/마이크로 모의 시연합니다.
        </p>

        {/* If inside iframe on iOS, guide user to direct URL */}
        {env.isInIframe && (
          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
            <span className="text-[10px] text-sky-300 leading-tight">
              📱 아이폰 카메라 직접 실행이 필요하신가요?
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <a
                href={env.standaloneUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold flex items-center gap-1 transition"
              >
                <ExternalLink className="w-3 h-3" /> Safari 전체화면
              </a>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[10px] transition"
                title="URL 복사"
              >
                {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Patient & Prescription Quick Status Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base text-slate-900 dark:text-slate-100">
              {patient.name}
            </span>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {patient.id}
            </span>
            <span className="text-xs text-teal-700 dark:text-teal-400 font-medium">
              {patient.room}
            </span>
          </div>
          <button
            onClick={onOpenNewSessionConfirm}
            className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-teal-600 underline font-medium"
          >
            새 시연 시작
          </button>
        </div>

        {/* Prescription Mini Bar */}
        <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
          <div>
            <span className="text-slate-400 block text-[10px]">처방 약물</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {prescription.medicationName} ({prescription.route})
            </span>
          </div>
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-mono">
            {prescription.status === 'ADMINISTERED'
              ? '투여 완료'
              : prescription.status === 'VERIFIED'
              ? '확인 완료'
              : '확인 대기'}
          </span>
        </div>

        {/* Step Progress Pill */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>5단계 진행 상태</span>
            <span className="font-semibold text-teal-600 dark:text-teal-400">
              {nextActionLabel}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1 h-2">
            <div className={`rounded-full ${hasPatientVerify ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
            <div className={`rounded-full ${hasMedVerify ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
            <div className={`rounded-full ${hasIvSiteAssess ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
            <div className={`rounded-full ${hasInfusionStart ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
            <div className={`rounded-full ${hasInfusionEnd ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
          </div>
        </div>
      </div>

      {/* Big Thumb-Friendly Quick Action Grid (1-Hand Usability) */}
      <div className="grid grid-cols-2 gap-3">
        {/* Button 1: Patient QR Scan */}
        <button
          type="button"
          onClick={onOpenQrScanner}
          className={`p-4 rounded-2xl flex flex-col items-start justify-between shadow-sm transition active:scale-[0.97] border min-h-[105px] text-left ${
            hasPatientVerify
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-teal-500 shadow-md ring-2 ring-teal-500/20'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              <QrCode className="w-6 h-6" />
            </div>
            {hasPatientVerify && (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            )}
          </div>
          <div>
            <div className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-2">
              환자 QR 스캔
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {hasPatientVerify ? '환자 확인 완료됨' : '손목밴드 카메라 인식'}
            </div>
          </div>
        </button>

        {/* Button 2: Medication Barcode Scan */}
        <button
          type="button"
          onClick={onOpenBarcodeScanner}
          className={`p-4 rounded-2xl flex flex-col items-start justify-between shadow-sm transition active:scale-[0.97] border min-h-[105px] text-left ${
            hasMedVerify
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
              : !hasPatientVerify
              ? 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-sky-500 shadow-md ring-2 ring-sky-500/20'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
              <Barcode className="w-6 h-6" />
            </div>
            {hasMedVerify && (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            )}
          </div>
          <div>
            <div className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-2">
              약물 바코드 스캔
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {hasMedVerify ? '처방번호 일치 기록됨' : '약품 라벨 바코드'}
            </div>
          </div>
        </button>

        {/* Button 3: Voice Nursing Input */}
        <button
          type="button"
          onClick={onOpenVoiceInput}
          className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col items-start justify-between shadow-md hover:border-indigo-500 transition active:scale-[0.97] min-h-[105px] text-left"
        >
          <div className="flex items-center justify-between w-full">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Mic className="w-6 h-6" />
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold">
              STT 음성
            </span>
          </div>
          <div>
            <div className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-2">
              음성 간호 입력
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              "부위 확인 완료" 등 발화
            </div>
          </div>
        </button>

        {/* Button 4: IV Site Assessment */}
        <button
          type="button"
          onClick={onOpenIvSiteModal}
          className={`p-4 rounded-2xl flex flex-col items-start justify-between shadow-sm transition active:scale-[0.97] border min-h-[105px] text-left ${
            hasIvSiteAssess
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-amber-500'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Activity className="w-6 h-6" />
            </div>
            {hasIvSiteAssess && (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            )}
          </div>
          <div>
            <div className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-2">
              IV Site 사정
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {hasIvSiteAssess ? '정맥 부위 사정 완료' : '발적/부종/통증 점검'}
            </div>
          </div>
        </button>
      </div>

      {/* Large Sequential Infusion Buttons */}
      <div className="space-y-2">
        {!hasInfusionStart ? (
          <button
            type="button"
            disabled={!hasMedVerify || !hasIvSiteAssess}
            onClick={onTriggerStart}
            className="w-full py-4 px-5 rounded-2xl bg-teal-600 hover:bg-teal-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 disabled:shadow-none transition active:scale-[0.98]"
          >
            <Play className="w-5 h-5 fill-current" />
            {hasMedVerify && hasIvSiteAssess
              ? '▶️ 4. IV 항생제 투여 시작 (Infusion Start)'
              : '이전 단계(환자·약물·부위 확인)를 먼저 완료하세요'}
          </button>
        ) : !hasInfusionEnd ? (
          <button
            type="button"
            onClick={onTriggerEnd}
            className="w-full py-4 px-5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 transition active:scale-[0.98] animate-pulse"
          >
            <Square className="w-5 h-5 fill-current" />
            ⏹️ 5. IV 항생제 투여 종료 (Infusion End)
          </button>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={onGoToDraft}
              className="w-full py-4 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition active:scale-[0.98]"
            >
              <Sparkles className="w-5 h-5" />
              5단계 투여 완료! AI 간호기록 작성 및 승인으로 이동
            </button>
            <button
              type="button"
              onClick={onOpenNewSessionConfirm}
              className="w-full py-3 px-4 rounded-xl border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 text-xs font-bold flex items-center justify-center gap-2 hover:bg-teal-100 transition active:scale-[0.98]"
            >
              <span>새 시연 세션 시작 (New Demo Session)</span>
            </button>
          </div>
        )}
      </div>

      {/* Live Recent Events Stream */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-teal-600" />
            실시간 기록 이벤트 로그 ({events.length}건)
          </h4>
          <span className="text-[10px] text-slate-400">단일 이벤트 버스 수렴</span>
        </div>

        {events.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            아직 기록된 이벤트가 없습니다. 환자 QR 스캔부터 시작하세요.
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {[...events].reverse().map((evt) => (
              <div
                key={evt.eventId}
                className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs flex items-start justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] font-bold text-teal-600 dark:text-teal-400">
                      [{evt.eventTimestamp}]
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {evt.eventDescription}
                    </span>
                  </div>
                  {evt.metadata?.rawSpeechText && (
                    <p className="text-[11px] text-indigo-600 dark:text-indigo-400 italic">
                      "발화: {evt.metadata.rawSpeechText}"
                    </p>
                  )}
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap ${
                    evt.eventSource === 'QR Scan'
                      ? 'bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300'
                      : evt.eventSource === 'Barcode Scan'
                      ? 'bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300'
                      : evt.eventSource === 'Voice Confirmation'
                      ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {evt.eventSource}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Bottom Quick Action to EMR / AI Draft */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onGoToDraft}
          className="w-full py-3 px-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 text-indigo-800 dark:text-indigo-300 text-xs font-semibold flex items-center justify-center gap-2 transition"
        >
          <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          간호기록 초안 검토 및 가상 EMR 전송 화면 보기
        </button>
      </div>
    </div>
  );
};
