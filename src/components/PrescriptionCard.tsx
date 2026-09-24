import React from 'react';
import { Pill, CheckCircle2, AlertTriangle, Syringe, Info, ShieldCheck } from 'lucide-react';
import { Prescription } from '../types';

interface PrescriptionCardProps {
  prescription: Prescription;
  isMedicationVerified: boolean;
  infusionStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

export const PrescriptionCard: React.FC<PrescriptionCardProps> = ({
  prescription,
  isMedicationVerified,
  infusionStatus,
}) => {
  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs overflow-hidden transition-all">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Medication Info */}
          <div className="flex items-start gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
              isMedicationVerified
                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
            }`}>
              <Syringe className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300">
                  {prescription.route}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {prescription.medicationName}
                </h3>

                {/* Medication Status Badge */}
                {isMedicationVerified ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/60">
                    <CheckCircle2 className="w-3 h-3" />
                    약물 확인 이벤트 기록됨
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60">
                    <AlertTriangle className="w-3 h-3" />
                    처방 확인 대기
                  </span>
                )}

                {/* Infusion Status Pill */}
                {infusionStatus === 'IN_PROGRESS' && (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-teal-500 text-white animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    현재 투여 중 (Infusing)
                  </span>
                )}
                {infusionStatus === 'COMPLETED' && (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-700 dark:bg-slate-600 text-slate-100">
                    투여 완료
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                <span>처방 번호: <strong className="font-mono text-slate-700 dark:text-slate-300">{prescription.id}</strong></span>
                <span>•</span>
                <span>처방의: {prescription.prescribedDoctor}</span>
                <span>•</span>
                <span>투여 방법: {prescription.instructions}</span>
              </p>
            </div>
          </div>

          {/* Quick verification indicator box */}
          <div className="flex items-center gap-2 self-start sm:self-center px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-700/50 text-xs">
            <ShieldCheck className={`w-4 h-4 ${isMedicationVerified ? 'text-emerald-500' : 'text-slate-400'}`} />
            <div className="text-left">
              <span className="text-[10px] text-slate-400 block">투약 안전 원칙</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {isMedicationVerified ? '처방 대조 기록됨 · 5-Rights 별도 확인' : '투약 전 대조 필요'}
              </span>
            </div>
          </div>
        </div>

        {/* Educational Mock Data Disclaimer (Strict Requirement) */}
        <div className="mt-3.5 p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50 flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-300">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <p className="leading-relaxed">
            <strong>[교육용 가상 데이터 안내]</strong> 본 처방 정보는 간호기록 자동화 시스템 개발 및 경진대회 시연용 모의 처방입니다. 실제 환자에게 적용되는 약물 투여량이나 임상 지침이 아니며, 시스템은 임의의 약물 용량을 자동 생성하지 않습니다.
          </p>
        </div>
      </div>
    </div>
  );
};
