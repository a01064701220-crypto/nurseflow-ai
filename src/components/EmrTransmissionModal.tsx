import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Send,
  Loader2,
  Server,
  Lock,
} from 'lucide-react';
import { DraftNote, NursingEvent, Patient, EmrRecord } from '../types';
import { EmrService } from '../services/emrService';

interface EmrTransmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftNote: DraftNote | null;
  events: NursingEvent[];
  patient: Patient;
  onTransmissionSuccess: (record: EmrRecord) => void;
  onViewEmrTab: () => void;
}

type TransmitState = 'IDLE' | 'TRANSMITTING' | 'SUCCESS' | 'ERROR';

export const EmrTransmissionModal: React.FC<EmrTransmissionModalProps> = ({
  isOpen,
  onClose,
  draftNote,
  events,
  patient,
  onTransmissionSuccess,
  onViewEmrTab,
}) => {
  const [status, setStatus] = useState<TransmitState>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transmittedRecord, setTransmittedRecord] = useState<EmrRecord | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStatus('IDLE');
      setErrorMessage(null);
      setTransmittedRecord(null);
    }
  }, [isOpen]);

  if (!isOpen || !draftNote) return null;

  const handleTransmit = async () => {
    setStatus('TRANSMITTING');
    setErrorMessage(null);

    try {
      const result = await EmrService.transmitToEmr(draftNote, events, patient);
      setTransmittedRecord(result.emrRecord);
      setStatus('SUCCESS');
      onTransmissionSuccess(result.emrRecord);
    } catch (err: any) {
      console.error('EMR transmission failed:', err);
      setStatus('ERROR');
      setErrorMessage(err.message || '가상 EMR 전송 중 네트워크 오류가 발생했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  가상 EMR 연동 전송 시뮬레이션
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                [Mock EMR / Hospital HIS Interface Simulation]
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Simulation Notice Banner (Strict Requirement) */}
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 mb-0.5">
              <Server className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              가상 환경 알림 (Mock EMR Notice)
            </div>
            <p className="text-[11px] leading-relaxed">
              본 전송은 실제 병원 의무기록 서버가 아닌 <strong>가상 EMR 시뮬레이터 저장소</strong>로 전송됩니다. 향후 표준 HL7/FHIR 인터페이스 어댑터를 통해 실제 병원 HIS/EMR과 직결될 수 있도록 계층이 분리되어 있습니다.
            </p>
          </div>

          {/* Record Summary to be transmitted */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-700/80 space-y-2 text-xs">
            <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
              <span className="text-slate-400">환자명 / 등록번호</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {patient.name} ({patient.id})
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
              <span className="text-slate-400">승인 간호사 (전자서명)</span>
              <span className="font-semibold text-teal-700 dark:text-teal-300">
                {draftNote.approver || '양두영 간호사'}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
              <span className="text-slate-400">기록 버전</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                v{draftNote.version}.0 (최종 승인본)
              </span>
            </div>
            <div className="pt-1">
              <span className="text-slate-400 block mb-1">전송 대상 간호기록 본문 요약:</span>
              <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300 line-clamp-3 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-700">
                {draftNote.content}
              </div>
            </div>
          </div>

          {/* Status Display Area */}
          {status === 'TRANSMITTING' && (
            <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex items-center gap-3 text-xs text-sky-800 dark:text-sky-300 animate-pulse">
              <Loader2 className="w-5 h-5 animate-spin text-sky-600 dark:text-sky-400" />
              <div>
                <p className="font-bold">가상 EMR 서버와 통신 중...</p>
                <p className="text-[11px] text-sky-600 dark:text-sky-400">
                  전자서명 해시 검증 및 간호기록 차트 암호화 전송 진행 중입니다.
                </p>
              </div>
            </div>
          )}

          {status === 'SUCCESS' && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 space-y-2 text-xs text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                가상 EMR에 간호기록이 정상적으로 저장되었습니다.
              </div>
              <p className="text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-400">
                차트 번호: <strong className="font-mono">{transmittedRecord?.chartNumber}</strong> | 
                서명 키: <strong className="font-mono">{transmittedRecord?.signatureHash}</strong>
              </p>
            </div>
          )}

          {status === 'ERROR' && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-2 text-xs text-rose-800 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div>
                <p className="font-bold">전송 실패</p>
                <p className="text-[11px]">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
          >
            닫기
          </button>

          {status === 'SUCCESS' ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onViewEmrTab();
              }}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-500/20 flex items-center gap-1.5"
            >
              가상 EMR 뷰어에서 확인하기
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={status === 'TRANSMITTING'}
              onClick={handleTransmit}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all active:scale-[0.98]"
            >
              <Send className="w-3.5 h-3.5" />
              {status === 'TRANSMITTING' ? '전송 중...' : '가상 EMR로 즉시 전송'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
