import React from 'react';
import {
  CheckCircle2,
  Clock,
  Play,
  Square,
  Lock,
  Search,
  CheckSquare,
  Sparkles,
  QrCode,
  Barcode,
  Mic,
  RotateCcw,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';
import { NursingEvent, EventType } from '../types';

interface ActionControlsProps {
  events: NursingEvent[];
  onTriggerEvent: (eventType: EventType, source?: 'Manual Confirmation') => void;
  onOpenIvSiteModal: () => void;
  isIvSiteAssessed: boolean;
  onOpenQrScanner: () => void;
  onOpenBarcodeScanner: () => void;
  onOpenVoiceInput: () => void;
  onOpenNewSession: () => void;
}

export const ActionControls: React.FC<ActionControlsProps> = ({
  events,
  onTriggerEvent,
  onOpenIvSiteModal,
  isIvSiteAssessed,
  onOpenQrScanner,
  onOpenBarcodeScanner,
  onOpenVoiceInput,
  onOpenNewSession,
}) => {
  const hasPatientVerified = events.some((e) => e.eventType === 'PATIENT_VERIFY');
  const hasMedicationVerified = events.some((e) => e.eventType === 'MEDICATION_VERIFY');
  const hasInfusionStarted = events.some((e) => e.eventType === 'INFUSION_START');
  const hasInfusionEnded = events.some((e) => e.eventType === 'INFUSION_END');

  const getEvent = (type: EventType) => events.find((e) => e.eventType === type);

  const step1Evt = getEvent('PATIENT_VERIFY');
  const step2Evt = getEvent('MEDICATION_VERIFY');
  const step3Evt = getEvent('IV_SITE_ASSESS');
  const step4Evt = getEvent('INFUSION_START');
  const step5Evt = getEvent('INFUSION_END');

  const canDoStep2 = hasPatientVerified;
  const canDoStep3 = hasPatientVerified;
  const canDoStep4 = hasPatientVerified && hasMedicationVerified && isIvSiteAssessed && !hasInfusionStarted;
  const canDoStep5 = hasInfusionStarted && !hasInfusionEnded;

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-4 sm:p-6 space-y-4">
      {/* Action Header & Quick Access Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-700/70">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              간호 행위 입력 시스템 (STEP 2 스마트폰 QR·바코드·음성 연동)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            카메라와 마이크로 환자·약물·소견을 확인하거나 수동 버튼으로 동일한 타임라인에 누적합니다.
          </p>
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Voice Nursing Direct Button */}
          <button
            type="button"
            onClick={onOpenVoiceInput}
            className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
          >
            <Mic className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>음성 간호 입력 (STT)</span>
          </button>

          {/* New Session Button */}
          <button
            type="button"
            onClick={onOpenNewSession}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>새 시연 시작</span>
          </button>
        </div>
      </div>

      {/* Grid of 5 Step Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* 1. 환자 확인 (QR 스캔 또는 수동 확인) */}
        <div
          className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all duration-200 min-h-[140px] ${
            hasPatientVerified
              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60'
              : 'bg-white dark:bg-slate-700/40 border-teal-500 ring-2 ring-teal-500/20'
          }`}
        >
          <div>
            <div className="flex items-center justify-between w-full">
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                hasPatientVerified ? 'bg-emerald-500 text-white' : 'bg-teal-500 text-white'
              }`}>
                1
              </span>
              {hasPatientVerified ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {step1Evt?.eventSource === 'QR Scan' ? 'QR 확인됨' : '확인 완료'}
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300">
                  1단계: 환자확인
                </span>
              )}
            </div>

            <div className="mt-2">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                환자 확인
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                손목밴드 QR / 개방형 질문
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            {!hasPatientVerified ? (
              <>
                <button
                  type="button"
                  onClick={onOpenQrScanner}
                  className="w-full py-1.5 px-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>QR 스캔 (카메라)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onTriggerEvent('PATIENT_VERIFY', 'Manual Confirmation')}
                  className="w-full py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-[11px] font-medium transition"
                >
                  수동 확인 (대체)
                </button>
              </>
            ) : (
              <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center justify-between pt-1 border-t border-emerald-200 dark:border-emerald-800/40">
                <span className="text-slate-400 text-[10px]">{step1Evt?.eventSource}</span>
                <span className="font-bold">{step1Evt?.eventTimestamp}</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. 약물 확인 (바코드 스캔 또는 수동 5-Right 확인) */}
        <div
          className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all duration-200 min-h-[140px] ${
            hasMedicationVerified
              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60'
              : canDoStep2
              ? 'bg-white dark:bg-slate-700/40 border-sky-500 ring-2 ring-sky-500/20'
              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 opacity-60'
          }`}
        >
          <div>
            <div className="flex items-center justify-between w-full">
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                hasMedicationVerified
                  ? 'bg-emerald-500 text-white'
                  : canDoStep2
                  ? 'bg-sky-500 text-white'
                  : 'bg-slate-300 dark:bg-slate-600 text-slate-600'
              }`}>
                2
              </span>
              {hasMedicationVerified ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {step2Evt?.eventSource === 'Barcode Scan' ? '바코드 일치' : '5-Right 완료'}
                </span>
              ) : !canDoStep2 ? (
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Lock className="w-3 h-3" /> 1단계 필요
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-300">
                  2단계: 약물확인
                </span>
              )}
            </div>

            <div className="mt-2">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                약물 확인
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                모의 항생제 바코드 / 5-Right
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            {!hasMedicationVerified ? (
              <>
                <button
                  type="button"
                  disabled={!canDoStep2}
                  onClick={onOpenBarcodeScanner}
                  className="w-full py-1.5 px-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95"
                >
                  <Barcode className="w-3.5 h-3.5" />
                  <span>바코드 스캔 (카메라)</span>
                </button>
                <button
                  type="button"
                  disabled={!canDoStep2}
                  onClick={() => onTriggerEvent('MEDICATION_VERIFY', 'Manual Confirmation')}
                  className="w-full py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-[11px] font-medium transition"
                >
                  수동 확인 (대체)
                </button>
              </>
            ) : (
              <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center justify-between pt-1 border-t border-emerald-200 dark:border-emerald-800/40">
                <span className="text-slate-400 text-[10px]">{step2Evt?.eventSource}</span>
                <span className="font-bold">{step2Evt?.eventTimestamp}</span>
              </div>
            )}
          </div>
        </div>

        {/* 3. IV site 확인 (음성 지원 사정 모달) */}
        <div
          className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all duration-200 min-h-[140px] ${
            isIvSiteAssessed
              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60'
              : canDoStep3
              ? 'bg-white dark:bg-slate-700/40 border-indigo-500 ring-2 ring-indigo-500/20'
              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 opacity-60'
          }`}
        >
          <div>
            <div className="flex items-center justify-between w-full">
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                isIvSiteAssessed
                  ? 'bg-emerald-500 text-white'
                  : canDoStep3
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-300 dark:bg-slate-600 text-slate-600'
              }`}>
                3
              </span>
              {isIvSiteAssessed ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckSquare className="w-3.5 h-3.5" />
                  사정 완료
                </span>
              ) : !canDoStep3 ? (
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Lock className="w-3 h-3" /> 1단계 필요
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300">
                  3단계: 부위사정
                </span>
              )}
            </div>

            <div className="mt-2">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                IV site 확인
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                삽입부위, 발적/부종 (음성구술)
              </p>
            </div>
          </div>

          <div className="mt-3">
            <button
              type="button"
              disabled={!canDoStep3}
              onClick={onOpenIvSiteModal}
              className="w-full py-2 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{isIvSiteAssessed ? '사정창 열기 (수정)' : '사정 및 음성 구술'}</span>
            </button>
            {isIvSiteAssessed && step3Evt && (
              <div className="mt-1.5 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center justify-between pt-1 border-t border-emerald-200 dark:border-emerald-800/40">
                <span className="text-slate-400 text-[10px]">{step3Evt?.eventSource}</span>
                <span className="font-bold">{step3Evt?.eventTimestamp}</span>
              </div>
            )}
          </div>
        </div>

        {/* 4. 투여 시작 */}
        <div
          className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all duration-200 min-h-[140px] ${
            hasInfusionStarted
              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60'
              : canDoStep4
              ? 'bg-teal-500/10 dark:bg-teal-900/20 border-teal-500 ring-2 ring-teal-500/30'
              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 opacity-60'
          }`}
        >
          <div>
            <div className="flex items-center justify-between w-full">
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                hasInfusionStarted
                  ? 'bg-emerald-500 text-white'
                  : canDoStep4
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-300 dark:bg-slate-600 text-slate-600'
              }`}>
                4
              </span>
              {hasInfusionStarted ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <Play className="w-3 h-3 fill-current" />
                  투여 중
                </span>
              ) : !canDoStep4 ? (
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Lock className="w-3 h-3" /> 1~3단계 완료 필요
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-teal-600 text-white animate-pulse">
                  투여 준비 완료
                </span>
              )}
            </div>

            <div className="mt-2">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                투여 시작
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                정맥 점적 주입 개시
              </p>
            </div>
          </div>

          <div className="mt-3">
            {!hasInfusionStarted ? (
              <button
                type="button"
                disabled={!canDoStep4}
                onClick={() => onTriggerEvent('INFUSION_START', 'Manual Confirmation')}
                className="w-full py-2 px-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>투여 시작 터치</span>
              </button>
            ) : (
              <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center justify-between pt-1 border-t border-emerald-200 dark:border-emerald-800/40">
                <span className="text-slate-400 text-[10px]">{step4Evt?.eventSource}</span>
                <span className="font-bold">{step4Evt?.eventTimestamp}</span>
              </div>
            )}
          </div>
        </div>

        {/* 5. 투여 종료 */}
        <div
          className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all duration-200 min-h-[140px] ${
            hasInfusionEnded
              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60'
              : canDoStep5
              ? 'bg-rose-500/10 dark:bg-rose-900/20 border-rose-500 ring-2 ring-rose-500/30'
              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 opacity-60'
          }`}
        >
          <div>
            <div className="flex items-center justify-between w-full">
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                hasInfusionEnded
                  ? 'bg-emerald-500 text-white'
                  : canDoStep5
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-300 dark:bg-slate-600 text-slate-600'
              }`}>
                5
              </span>
              {hasInfusionEnded ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <Square className="w-3 h-3 fill-current" />
                  투여 완료
                </span>
              ) : !canDoStep5 ? (
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Lock className="w-3 h-3" /> 투여 중만 가능
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-600 text-white">
                  주입 진행 중
                </span>
              )}
            </div>

            <div className="mt-2">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                투여 종료
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                전량 주입 완료 및 종료 기록
              </p>
            </div>
          </div>

          <div className="mt-3">
            {!hasInfusionEnded ? (
              <button
                type="button"
                disabled={!canDoStep5}
                onClick={() => onTriggerEvent('INFUSION_END', 'Manual Confirmation')}
                className="w-full py-2 px-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>투여 종료 터치</span>
              </button>
            ) : (
              <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center justify-between pt-1 border-t border-emerald-200 dark:border-emerald-800/40">
                <span className="text-slate-400 text-[10px]">{step5Evt?.eventSource}</span>
                <span className="font-bold">{step5Evt?.eventTimestamp}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Safety guideline hint */}
      <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 flex-wrap gap-2">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-teal-500" />
          QR코드 스캔, 바코드 스캔, 음성 입력, 수동 확인 모두 단일 사실(Fact) 이벤트 타임라인으로 통합 기록됩니다.
        </span>
        <span className="font-mono text-[10px]">
          NurseFlow Unified Event Engine v2.0
        </span>
      </div>
    </div>
  );
};
