import React, { useState } from 'react';
import {
  Database,
  ArrowLeft,
  FileCheck2,
  Calendar,
  Clock,
  ShieldCheck,
  Search,
  ExternalLink,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { EmrRecord, Patient } from '../types';

interface EmrViewerProps {
  records: EmrRecord[];
  patient: Patient;
  onBackToWorkflow: () => void;
}

export const EmrViewer: React.FC<EmrViewerProps> = ({
  records,
  patient,
  onBackToWorkflow,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(
    records.length > 0 ? records[0].emrRecordId : null
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredRecords = records.filter(
    (r) =>
      r.chartNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.approvedNurse.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top EMR System Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white shadow-lg border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToWorkflow}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              워크플로우로 복귀
            </button>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  가상 대학병원 EMR 시스템 (HIS Simulation)
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-teal-950 text-teal-300 border border-teal-800">
                  Mock EMR Data Repository
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                NurseFlow AI에서 최종 승인 후 전송된 전자간호기록(Electronic Nursing Records) 조회 저장소
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
              총 저장된 기록: <strong className="text-teal-400">{records.length}</strong>건
            </span>
          </div>
        </div>
      </div>

      {/* Patient EMR Header Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-bold text-sm text-slate-900 dark:text-white">
              환자: {patient.name} ({patient.gender === 'M' ? '남' : '여'}/{patient.age}세)
            </span>
            <span className="font-mono text-slate-500 dark:text-slate-400">
              차트등록번호: <strong>{patient.id}</strong>
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              병실: <strong>{patient.room}</strong>
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              진단명: <strong>{patient.diagnosis}</strong>
            </span>
          </div>

          {/* Search bar inside EMR */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="차트 번호, 기록 내용 검색..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>

      {/* EMR Records List */}
      {filteredRecords.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <Database className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
            가상 EMR에 전송된 간호기록이 없습니다.
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-md mx-auto mt-1 mb-4">
            메인 워크플로우 화면에서 IV 항생제 시나리오를 진행한 후, AI 초안을 검토·승인하고 <strong>[EMR 전송]</strong>을 실행해 보세요.
          </p>
          <button
            type="button"
            onClick={onBackToWorkflow}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-all shadow-md shadow-teal-500/20"
          >
            간호 워크플로우로 이동하기
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRecords.map((record) => {
            const isExpanded = expandedId === record.emrRecordId;
            return (
              <div
                key={record.emrRecordId}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs overflow-hidden transition-all"
              >
                {/* Record Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : record.emrRecordId)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                      <FileCheck2 className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                          {record.chartNumber}
                        </span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          전송 완료 (TRANSMITTED)
                        </span>
                        <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
                          버전: v{record.version}.0
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-teal-600" />
                          전송일시: {record.transferredAt}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                          <ShieldCheck className="w-3.5 h-3.5 text-teal-500" />
                          승인자: {record.approvedNurse}
                        </span>
                        <span>•</span>
                        <span>원천 이벤트: {record.eventCount}건 연계</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(record.emrRecordId, record.content);
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs flex items-center gap-1"
                      title="기록 복사"
                    >
                      {copiedId === record.emrRecordId ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedId === record.emrRecordId ? '복사됨' : '복사'}</span>
                    </button>

                    <div className="text-slate-400">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-1 border-t border-slate-100 dark:border-slate-700/80 space-y-4">
                    {/* Electronic Medical Note Content */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          [공식 간호기록 본문 - Nursing Clinical Note]
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          고유 식별자: {record.emrRecordId}
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 font-mono text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-slate-900 dark:text-slate-100">
                        {record.content}
                      </div>
                    </div>

                    {/* Digital Signature & Source Audit Trail */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* Security & Signature */}
                      <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-1">
                        <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                          전자서명 무결성 검증 (Digital Signature)
                        </div>
                        <p className="font-mono text-[11px] text-slate-500 break-all">
                          Hash: {record.signatureHash}
                        </p>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          ✓ 서명 간호사 자격 및 의무기록 위변조 방지 검증 완료
                        </p>
                      </div>

                      {/* Associated Raw Events */}
                      <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-1">
                        <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-sky-600" />
                          원천 이벤트 추적 (Traceability)
                        </div>
                        <ul className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5 max-h-20 overflow-y-auto">
                          {record.eventsSummary?.map((s, idx) => (
                            <li key={idx} className="truncate font-mono">
                              • {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
