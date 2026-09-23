import React from 'react';
import {
  Clock,
  UserCheck,
  Pill,
  Search,
  Play,
  Square,
  ShieldCheck,
  Layers,
  ChevronRight,
  QrCode,
  Barcode,
  Mic,
  CheckCircle2,
} from 'lucide-react';
import { NursingEvent, EventType, EventSource } from '../types';

interface TimelineSectionProps {
  events: NursingEvent[];
}

export const TimelineSection: React.FC<TimelineSectionProps> = ({ events }) => {
  const getEventIcon = (type: EventType) => {
    switch (type) {
      case 'PATIENT_VERIFY':
        return <UserCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
      case 'MEDICATION_VERIFY':
        return <Pill className="w-4 h-4 text-sky-600 dark:text-sky-400" />;
      case 'IV_SITE_ASSESS':
        return <Search className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'INFUSION_START':
      case 'MEDICATION_START':
        return <Play className="w-4 h-4 text-emerald-600 dark:text-emerald-400 fill-current" />;
      case 'INFUSION_END':
      case 'MEDICATION_END':
        return <Square className="w-4 h-4 text-rose-600 dark:text-rose-400 fill-current" />;
      case 'VOICE_NOTE':
        return <Mic className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  const getEventBadgeColor = (type: EventType) => {
    switch (type) {
      case 'PATIENT_VERIFY':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800';
      case 'MEDICATION_VERIFY':
        return 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800';
      case 'IV_SITE_ASSESS':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      case 'INFUSION_START':
      case 'MEDICATION_START':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'INFUSION_END':
      case 'MEDICATION_END':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      case 'VOICE_NOTE':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200';
    }
  };

  const getSourceBadge = (source: EventSource, explicitSource?: string) => {
    const s = explicitSource || source;
    if (s === 'VOICE_AI_CONFIRMED' || source === 'Voice Confirmation' || source === 'Voice Command') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 font-mono text-[10px] font-semibold border border-purple-200 dark:border-purple-800">
          <Mic className="w-3 h-3" /> VOICE_AI_CONFIRMED
        </span>
      );
    }
    if (s === 'speech') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 font-mono text-[10px] font-semibold border border-purple-200 dark:border-purple-800">
          <Mic className="w-3 h-3" /> speech (Voice Note)
        </span>
      );
    }
    if (s === 'QR_SCAN' || source === 'QR Scan' || source === 'QR Wristband Scan') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 font-mono text-[10px] font-semibold border border-teal-200 dark:border-teal-800">
          <QrCode className="w-3 h-3" /> QR_SCAN
        </span>
      );
    }
    if (s === 'BARCODE_SCAN' || source === 'Barcode Scan') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300 font-mono text-[10px] font-semibold border border-sky-200 dark:border-sky-800">
          <Barcode className="w-3 h-3" /> BARCODE_SCAN
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 font-mono text-[10px] font-medium border border-slate-200 dark:border-slate-600">
        MANUAL_CONFIRMATION
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-4 sm:p-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-100 dark:border-slate-700/70">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            통합 간호 행위 타임라인 (Unified Event Timeline)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            QR·바코드·음성·수동 입력이 단일 이벤트 버스에 시간순으로 불변(Immutable) 누적됩니다.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold font-mono">
            누적 이벤트: {events.length}건
          </span>
        </div>
      </div>

      {/* Timeline List */}
      {events.length === 0 ? (
        <div className="py-12 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/20">
          <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2.5" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            아직 기록된 간호 행위 이벤트가 없습니다.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            상단의 1단계 'QR 스캔' 또는 '수동 확인' 버튼을 눌러 시나리오를 시작해 보세요.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:top-3 before:bottom-3 before:left-3 sm:before:left-4 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
          {events.map((evt, idx) => {
            const isLast = idx === events.length - 1;
            return (
              <div key={evt.eventId} className="relative group">
                {/* Node icon on line */}
                <div className="absolute -left-6 sm:-left-8 top-1 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white dark:bg-slate-800 border-2 border-teal-500 flex items-center justify-center shadow-xs z-10">
                  {getEventIcon(evt.eventType)}
                </div>

                {/* Event Card */}
                <div className={`p-4 rounded-xl border transition-all ${
                  isLast
                    ? 'bg-slate-50/90 dark:bg-slate-900/40 border-teal-500/40 shadow-xs'
                    : 'bg-white dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/70 hover:border-slate-300'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    {/* Timestamp & Type */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700/70">
                        {evt.eventTimestamp}
                      </span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${getEventBadgeColor(evt.eventType)}`}>
                        {evt.eventType === 'PATIENT_VERIFY' && '환자 확인'}
                        {evt.eventType === 'MEDICATION_VERIFY' && '약물 확인'}
                        {evt.eventType === 'IV_SITE_ASSESS' && 'IV Site 사정'}
                        {(evt.eventType === 'INFUSION_START' || evt.eventType === 'MEDICATION_START') && '투여 시작'}
                        {(evt.eventType === 'INFUSION_END' || evt.eventType === 'MEDICATION_END') && '투여 종료'}
                        {evt.eventType === 'VOICE_NOTE' && '음성 간호 기록'}
                      </span>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {evt.eventDescription}
                      </span>
                    </div>

                    {/* Metadata Badges: Nurse, Source, Result */}
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
                        <ShieldCheck className="w-3 h-3 text-teal-500" />
                        {evt.nurseName}
                      </span>
                      <span>•</span>
                      {getSourceBadge(evt.eventSource || 'Manual Confirmation', evt.source)}
                      {evt.verificationResult && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> {evt.verificationResult}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dedicated VOICE_NOTE Card */}
                  {evt.eventType === 'VOICE_NOTE' && (
                    <div className="mt-2.5 p-3 rounded-xl bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/60 text-xs space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                          <Mic className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          음성 구술 원문 (Voice Transcript)
                        </span>
                        {evt.linkedStep && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-200/70 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 font-semibold border border-purple-300 dark:border-purple-700">
                            연계: {
                              evt.linkedStep === 'IV_SITE_ASSESS' ? 'IV Site 사정' :
                              evt.linkedStep === 'INFUSION_START' ? '투여 시작' :
                              evt.linkedStep === 'INFUSION_END' ? '투여 종료' : evt.linkedStep
                            }
                          </span>
                        )}
                      </div>
                      <p className="text-slate-800 dark:text-slate-200 font-medium italic pl-2 border-l-2 border-purple-400 dark:border-purple-600">
                        "{evt.transcript || evt.metadata?.transcript || evt.metadata?.rawSpeechText || evt.eventDescription}"
                      </p>
                      {evt.metadata?.clinicalFindings && (
                        <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                          <span>부위: {evt.metadata.clinicalFindings.site || '우측 전완'}</span>
                          <span>•</span>
                          <span className={evt.metadata.clinicalFindings.hasPain ? 'text-rose-600 font-bold' : ''}>
                            통증: {evt.metadata.clinicalFindings.hasPain ? '유' : '무'}
                          </span>
                          <span>•</span>
                          <span className={evt.metadata.clinicalFindings.hasRedness ? 'text-rose-600 font-bold' : ''}>
                            발적: {evt.metadata.clinicalFindings.hasRedness ? '유' : '무'}
                          </span>
                          <span>•</span>
                          <span className={evt.metadata.clinicalFindings.hasSwelling ? 'text-rose-600 font-bold' : ''}>
                            부종: {evt.metadata.clinicalFindings.hasSwelling ? '유' : '무'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Speech transcript highlight for other events with rawSpeechText */}
                  {evt.eventType !== 'VOICE_NOTE' && evt.metadata?.rawSpeechText && (
                    <div className="mt-2.5 p-2 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                      <span>간호사 음성 발화: "{evt.metadata.rawSpeechText}"</span>
                    </div>
                  )}

                  {/* Specific Metadata Payload Display */}
                  {evt.eventType === 'IV_SITE_ASSESS' && evt.metadata?.ivAssessment && (
                    <div className="mt-3 p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 text-xs space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap text-indigo-950 dark:text-indigo-200 font-semibold">
                        <span>삽입 부위: <strong>{evt.metadata.ivAssessment.site}</strong> ({evt.metadata.ivAssessment.catheterGauge || '22G'})</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-400 flex-wrap">
                        <span className={evt.metadata.ivAssessment.hasPain ? 'text-rose-600 font-bold' : ''}>
                          통증: {evt.metadata.ivAssessment.hasPain ? `유 (${evt.metadata.ivAssessment.painScore || 0}점)` : '무'}
                        </span>
                        <span>•</span>
                        <span className={evt.metadata.ivAssessment.hasRedness ? 'text-rose-600 font-bold' : ''}>
                          발적: {evt.metadata.ivAssessment.hasRedness ? '유 (관찰됨)' : '무'}
                        </span>
                        <span>•</span>
                        <span className={evt.metadata.ivAssessment.hasSwelling ? 'text-rose-600 font-bold' : ''}>
                          부종: {evt.metadata.ivAssessment.hasSwelling ? '유 (부종)' : '무'}
                        </span>
                        <span>•</span>
                        <span className={evt.metadata.ivAssessment.hasLeakage ? 'text-rose-600 font-bold' : ''}>
                          누출 의심: {evt.metadata.ivAssessment.hasLeakage ? '의심' : '없음'}
                        </span>
                      </div>
                      {evt.metadata.ivAssessment.notes && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                          관찰소견: "{evt.metadata.ivAssessment.notes}"
                        </p>
                      )}
                    </div>
                  )}

                  {evt.eventType === 'MEDICATION_VERIFY' && (
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <ChevronRight className="w-3 h-3 text-sky-500" />
                        <span>처방 확인 내역: 모의 IV 항생제 A (IV 정맥 점적)</span>
                      </div>
                      {evt.metadata?.fiveRightsVerified && (
                        <span className="text-sky-700 dark:text-sky-300 font-medium">
                          5-Right 전 항목 확인 완료
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
