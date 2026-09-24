import React, { useState } from 'react';
import {
  Sparkles,
  Edit3,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Send,
  History,
  FileText,
  ShieldCheck,
  Check,
  X,
  AlertCircle,
  Database,
} from 'lucide-react';
import {
  DraftNote,
  NursingEvent,
  Patient,
  Prescription,
  IvSiteAssessment,
  EditHistoryItem,
  Nurse,
} from '../types';

interface AiDraftSectionProps {
  nurse: Nurse;
  canWrite: boolean;
  patient: Patient;
  prescription: Prescription;
  events: NursingEvent[];
  ivSiteAssessment: IvSiteAssessment | null;
  draftNote: DraftNote | null;
  onUpdateDraft: (draft: DraftNote) => Promise<void>;
  onOpenEmrModal: () => void;
}

export const AiDraftSection: React.FC<AiDraftSectionProps> = ({
  nurse,
  canWrite,
  patient,
  prescription,
  events,
  ivSiteAssessment,
  draftNote,
  onUpdateDraft,
  onOpenEmrModal,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editContent, setEditContent] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // Trigger AI Draft Generation via Backend Proxy (/api/generate-draft)
  const handleGenerateDraft = async () => {
    if (!canWrite) {
      setErrorMessage('현재 담당 간호사만 새 초안을 생성할 수 있습니다.');
      return;
    }
    if (events.length === 0) {
      setErrorMessage('간호 행위 이벤트가 최소 1건 이상 기록되어야 AI 초안을 생성할 수 있습니다.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/generate-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patient: {
            id: patient.id,
            name: patient.name,
            age: patient.age,
            room: patient.room,
            department: patient.department,
          },
          prescription: {
            name: prescription.medicationName,
            route: prescription.route,
          },
          events: events.map((e) => ({
            eventType: e.eventType,
            eventTimestamp: e.eventTimestamp,
            eventDescription: e.eventDescription,
            nurseName: e.nurseName,
            eventSource: e.eventSource,
            transcript: e.transcript || e.metadata?.transcript || e.metadata?.rawSpeechText,
            linkedStep: e.linkedStep || e.metadata?.linkedStep,
            metadata: {
              fiveRightsVerified: e.metadata?.fiveRightsVerified === true,
              ivAssessment: e.metadata?.ivAssessment,
            },
          })),
          ivSiteAssessment,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'AI 기록 생성에 실패했습니다.');
      }

      const generatedContent = data.draft;
      const now = new Date().toLocaleTimeString('ko-KR', { hour12: false });

      const newDraft: DraftNote = {
        id: `DRAFT-${Date.now()}`,
        patientId: patient.id,
        content: generatedContent,
        status: 'DRAFT_PENDING_REVIEW', // Mandatory rule: AI output MUST be pending nurse verification
        version: 1,
        generatedBy: data.model === 'clinical-rules-fallback'
          ? '규칙 기반 대체 템플릿 (Gemini 생성 아님)'
          : `Google Gemini ${data.model || ''} (AI 보조)`,
        generatedAt: now,
        editHistory: [],
        emrTransmitted: false,
      };

      await onUpdateDraft(newDraft);
      setEditContent(generatedContent);
      setIsEditing(false);
    } catch (err: any) {
      console.error('AI Draft generation error:', err);
      setErrorMessage(
        err.message || 'AI 서비스 통신 중 오류가 발생했습니다. 직접 간호기록을 작성할 수 있습니다.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Switch to Manual Edit Mode
  const handleStartEdit = () => {
    if (!canWrite) return;
    setEditContent(draftNote ? draftNote.content : '');
    setIsEditing(true);
    setEditReason('');
  };

  // Save Edits without Final Approval yet
  const handleSaveEdit = async () => {
    if (!canWrite) return;
    if (!draftNote) {
      // Created manually from scratch
      const now = new Date().toLocaleTimeString('ko-KR', { hour12: false });
      const newDraft: DraftNote = {
        id: `DRAFT-${Date.now()}`,
        patientId: patient.id,
        content: editContent.trim(),
        status: 'DRAFT_PENDING_REVIEW',
        version: 1,
        generatedBy: '간호사 직접 작성',
        generatedAt: now,
        editHistory: [],
        emrTransmitted: false,
      };
      try {
        await onUpdateDraft(newDraft);
      } catch (error: any) {
        setErrorMessage(error?.message || '기록 저장에 실패했습니다.');
        return;
      }
      setIsEditing(false);
      return;
    }

    const now = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    const historyItem: EditHistoryItem = {
      version: draftNote.version,
      content: draftNote.content,
      editedAt: now,
      editor: `${nurse.nurseName} 간호사`,
      reason: editReason || '간호사 임상 검토 및 문구 수정',
    };

    const updated: DraftNote = {
      ...draftNote,
      id: draftNote.status === 'APPROVED' ? `DRAFT-${Date.now()}` : draftNote.id,
      content: editContent.trim(),
      status: 'DRAFT_PENDING_REVIEW',
      version: draftNote.version + 1,
      editHistory: [historyItem, ...draftNote.editHistory],
      emrTransmitted: false,
    };
    if (draftNote.status === 'APPROVED') {
      delete updated.approvedAt;
      delete updated.approver;
      delete updated.approverId;
      delete updated.approverUid;
      delete updated.emrTransmittedAt;
      delete updated.nurseUid;
      delete updated.nurseId;
    }

    try {
      await onUpdateDraft(updated);
    } catch (error: any) {
      setErrorMessage(error?.message || '기록 저장에 실패했습니다.');
      return;
    }
    setIsEditing(false);
  };

  // Review & Approve (최종 승인)
  const handleApprove = async () => {
    if (!canWrite) return;
    if (!draftNote) return;
    if (draftNote.status === 'APPROVED') {
      setErrorMessage('승인된 기록은 직접 덮어쓸 수 없습니다. 수정본을 새 초안으로 저장한 뒤 승인해 주세요.');
      return;
    }

    const now = new Date().toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const approvedDraft: DraftNote = {
      ...draftNote,
      content: isEditing ? editContent.trim() : draftNote.content,
      status: 'APPROVED',
      approvedAt: now,
      approver: `${nurse.nurseName} 간호사`,
      approverId: nurse.nurseId,
    };

    try {
      await onUpdateDraft(approvedDraft);
    } catch (error: any) {
      setErrorMessage(error?.message || '승인 저장에 실패했습니다.');
      return;
    }
    setIsEditing(false);
  };

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-slate-700/70">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              AI 간호기록 초안 생성 및 간호사 검토·승인
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            수집된 이벤트 타임라인과 IV 사정 소견을 바탕으로 Gemini AI가 임상 간호기록 초안을 생성합니다.
          </p>
          {!canWrite && <p className="text-xs text-amber-700">현재 세션의 담당 간호사가 아니므로 기록을 읽기 전용으로 표시합니다.</p>}
        </div>

        {/* Primary AI Draft Trigger Button */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            disabled={!canWrite || isLoading || events.length === 0}
            onClick={handleGenerateDraft}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md ${
              events.length === 0
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                : isLoading
                ? 'bg-teal-500 text-white cursor-wait opacity-80'
                : 'bg-gradient-to-r from-teal-500 to-sky-500 hover:from-teal-600 hover:to-sky-600 text-white shadow-teal-500/20 active:scale-[0.98]'
            }`}
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Gemini 임상기록 생성 중...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>AI 기록 초안 생성</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Message Box (Graceful Degradation & Manual Fallback) */}
      {errorMessage && (
        <div className="mb-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <div>
              <strong className="block font-bold">초안 생성 안내:</strong>
              <span>{errorMessage}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleStartEdit}
            disabled={!canWrite}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs whitespace-nowrap self-end sm:self-center"
          >
            직접 수동 작성하기
          </button>
        </div>
      )}

      {/* Empty State when no draft generated yet */}
      {!draftNote && !isEditing && (
        <div className="py-12 px-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/20">
          <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2.5" />
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            생성된 간호기록 초안이 없습니다.
          </h4>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-md mx-auto mt-1">
            간호 행위 이벤트를 1개 이상 기록한 뒤 상단의 <strong>[AI 기록 초안 생성]</strong> 버튼을 누르면 사실에 입각한 임상 기록이 자동 작성됩니다.
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={handleStartEdit}
              disabled={!canWrite}
              className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline inline-flex items-center gap-1"
            >
              <Edit3 className="w-3.5 h-3.5" />
              또는 간호사가 직접 기록 작성하기
            </button>
          </div>
        </div>
      )}

      {/* Active Draft or Edit Mode */}
      {(draftNote || isEditing) && (
        <div className="space-y-4">
          {/* Note Status & Metadata Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              {draftNote?.status === 'APPROVED' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/60">
                  <CheckCircle className="w-3.5 h-3.5" />
                  간호사 최종 승인 완료
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60">
                  <AlertCircle className="w-3.5 h-3.5" />
                  간호사 확인 대기 (Pending Verification)
                </span>
              )}

              <span className="text-slate-500 dark:text-slate-400 font-mono">
                버전: <strong>v{draftNote?.version || 1}.0</strong>
              </span>

              {draftNote?.approvedAt && (
                <span className="text-slate-500 dark:text-slate-400">
                  승인시각: {draftNote.approvedAt} ({draftNote.approver})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
              <span>작성 출처: {draftNote?.generatedBy || '간호사 직접 작성'}</span>
              {draftNote?.editHistory && draftNote.editHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-teal-600 dark:text-teal-400 font-medium hover:underline flex items-center gap-1 ml-1"
                >
                  <History className="w-3 h-3" />
                  이력 ({draftNote.editHistory.length})
                </button>
              )}
            </div>
          </div>

          {/* Note Content Area */}
          {isEditing ? (
            /* Editing Mode */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-teal-600" />
                  간호기록 직접 수정 (간호사 권한)
                </label>
                <span className="text-[11px] text-slate-400">
                  {editContent.length} 글자
                </span>
              </div>

              <textarea
                rows={7}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="간호기록 내용을 작성하거나 수정하세요."
                className="w-full p-4 rounded-xl font-mono text-xs sm:text-sm leading-relaxed border border-teal-500/50 dark:border-teal-500/50 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-teal-500 shadow-inner"
              />

              {draftNote && draftNote.status === 'APPROVED' && (
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="수정 사유를 입력하세요 (예: 환자 주관적 통증 호소 추가 기재)"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
              )}

              {/* Edit Actions */}
              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                >
                  수정 취소
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={!canWrite}
                    className="px-4 py-2 text-xs font-bold rounded-lg border border-teal-500 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                  >
                    수정본 저장 (초안 유지)
                  </button>
                  {draftNote?.status !== 'APPROVED' && <button
                    type="button"
                    onClick={handleApprove}
                    disabled={!canWrite}
                    className="px-5 py-2 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-500/20 flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    수정 후 즉시 검토 및 승인
                  </button>}
                </div>
              </div>
            </div>
          ) : (
            /* View Mode */
            <div className="relative">
              <div className="p-4 sm:p-5 rounded-xl font-mono text-xs sm:text-sm leading-relaxed whitespace-pre-wrap border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-900/40 text-slate-800 dark:text-slate-200 shadow-inner">
                {draftNote?.content}
              </div>

              {/* Action Buttons: 기록 수정, 다시 생성, 검토 및 승인 */}
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-2">
                  {/* 기록 수정 버튼 */}
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    disabled={!canWrite}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    기록 수정
                  </button>

                  {/* AI 초안 다시 생성 */}
                  <button
                    type="button"
                    disabled={!canWrite || isLoading}
                    onClick={handleGenerateDraft}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    AI 초안 다시 생성
                  </button>
                </div>

                {/* 검토 및 승인 / EMR 전송 */}
                <div className="flex items-center gap-2">
                  {draftNote?.status !== 'APPROVED' ? (
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={!canWrite}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-500/20 flex items-center gap-1.5 transition-all active:scale-[0.98]"
                    >
                      <CheckCircle className="w-4 h-4" />
                      검토 및 승인 (최종 확정)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onOpenEmrModal}
                      disabled={!canWrite}
                      className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-[0.98] ${
                        draftNote.emrTransmitted
                          ? 'bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white'
                          : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/20'
                      }`}
                    >
                      <Database className="w-4 h-4" />
                      {draftNote.emrTransmitted ? 'EMR 재전송 / 전송 결과 조회' : 'EMR 전송 (가상 시뮬레이션)'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Revision History Collapsible */}
          {showHistory && draftNote?.editHistory && draftNote.editHistory.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-3">
              <div className="flex items-center justify-between font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <History className="w-4 h-4 text-teal-600" />
                  기록 변경 이력 (Audit Trail)
                </span>
                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                {draftNote.editHistory.map((item, index) => (
                  <div
                    key={index}
                    className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>버전 v{item.version}.0 ({item.editor})</span>
                      <span>{item.editedAt}</span>
                    </div>
                    {item.reason && (
                      <p className="text-teal-700 dark:text-teal-400 font-semibold text-[11px] mt-0.5">
                        사유: {item.reason}
                      </p>
                    )}
                    <p className="mt-1 font-mono text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                      {item.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Safety & Compliance Card */}
      <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-700/50 flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <ShieldCheck className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>[의료 안전 및 AI 보조 정책]</strong> AI는 기록에 없는 행위나 활력징후, 투약 결과를 지어내지 않으며, 반드시 간호사의 최종 승인 절차를 거친 기록만 EMR로 전송됩니다.
        </p>
      </div>
    </div>
  );
};
