import React, { useState } from 'react';
import { User, ChevronDown, ChevronUp, AlertCircle, Bed, Calendar, Stethoscope } from 'lucide-react';
import { Patient } from '../types';

interface PatientCardProps {
  patient: Patient;
  isVerified: boolean;
  onVerifyClick?: () => void;
}

export const PatientCard: React.FC<PatientCardProps> = ({
  patient,
  isVerified,
}) => {
  const [showDetails, setShowDetails] = useState<boolean>(false);

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs overflow-hidden transition-all">
      {/* Primary Patient Banner */}
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Patient Identity */}
          <div className="flex items-start sm:items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-inner transition-colors ${
              isVerified 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              <User className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {patient.name}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  {patient.gender === 'M' ? '남성' : '여성'} / {patient.age}세
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md font-mono font-medium bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/50 dark:border-teal-800/50">
                  {patient.id}
                </span>

                {isVerified ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/60">
                    ✓ 환자 본인확인 완료
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60">
                    <AlertCircle className="w-3 h-3" />
                    확인 대기
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Bed className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  {patient.room} ({patient.department})
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Stethoscope className="w-3.5 h-3.5 text-sky-500" />
                  {patient.diagnosis}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Toggle Detail */}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="self-end sm:self-center text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
          >
            {showDetails ? '임상 기본정보 접기' : '임상 기본정보 펼치기'}
            {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Collapsible Clinical Baseline Details */}
        {showDetails && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/70 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl">
              <span className="text-slate-400 dark:text-slate-500 text-[11px] block">입원일자</span>
              <span className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                <Calendar className="w-3 h-3 text-slate-400" />
                {patient.admissionDate}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl">
              <span className="text-slate-400 dark:text-slate-500 text-[11px] block">담당 주치의</span>
              <span className="font-medium text-slate-700 dark:text-slate-200 mt-0.5 block">
                {patient.attendingPhysician}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl">
              <span className="text-slate-400 dark:text-slate-500 text-[11px] block">혈액형</span>
              <span className="font-medium text-slate-700 dark:text-slate-200 mt-0.5 block">
                {patient.bloodType}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl">
              <span className="text-slate-400 dark:text-slate-500 text-[11px] block">약물/식이 알레르기</span>
              <span className="font-medium text-slate-700 dark:text-slate-200 mt-0.5 block truncate" title={patient.allergies.join(', ')}>
                {patient.allergies.join(', ')}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
