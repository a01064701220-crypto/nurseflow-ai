import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  Activity,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  Layers,
  Terminal,
} from 'lucide-react';
import { NursingEvent, DemoSession } from '../types';
import { StorageService } from '../services/storageService';
import { auth } from '../services/firebase';
import firebaseConfig from '../../firebase-applet-config.json';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSession: DemoSession;
  events: NursingEvent[];
  firestoreEventsCount: number;
  listenerStatus: {
    state: 'LISTENING_SERVER' | 'LISTENING_CACHE' | 'ERROR' | 'INITIALIZING';
    lastSyncTime: string | null;
    errorMessage: string | null;
  };
  onSwitchSession: (sessionId: string) => Promise<void>;
  onForceRefresh: () => Promise<void>;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
  currentSession,
  events,
  firestoreEventsCount,
  listenerStatus,
  onSwitchSession,
  onForceRefresh,
}) => {
  const [allSessions, setAllSessions] = useState<DemoSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSwitching, setIsSwitching] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      loadSessionsList();
    }
  }, [isOpen]);

  const loadSessionsList = async () => {
    setIsLoadingSessions(true);
    try {
      const list = await StorageService.loadAllSessions();
      setAllSessions(list);
    } catch (err) {
      console.error('Failed to load sessions in diagnostics:', err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onForceRefresh();
    await loadSessionsList();
    setIsRefreshing(false);
  };

  const handleSelectSession = async (sid: string) => {
    if (sid === currentSession.sessionId) return;
    setIsSwitching(true);
    await onSwitchSession(sid);
    setIsSwitching(false);
  };

  if (!isOpen) return null;

  const localEvents = StorageService.loadEvents(currentSession.sessionId);
  const authUser = auth.currentUser;
  const authStatusDisplay = authUser
    ? authUser.isAnonymous
      ? '익명 인증됨 (Anonymous UID: ' + authUser.uid.slice(0, 6) + '...)'
      : `임상 간호사 계정 (${authUser.email || '양두영 RN'})`
    : '미인증 (인증 대기 중)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                NurseFlow AI 시스템 세션 및 데이터 진단
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
                  DEV TOOL
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                실제 Cloud Firestore 문서와 브라우저 로컬 상태의 정합성 진단
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              title="데이터 강제 재조회"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Firestore 읽기 건수
              </div>
              <div className="text-xl font-bold text-teal-600 dark:text-teal-400 mt-1">
                {firestoreEventsCount} <span className="text-xs font-normal text-slate-400">건</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">where sessionId == current</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                세션 로컬 저장소
              </div>
              <div className="text-xl font-bold text-sky-600 dark:text-sky-400 mt-1">
                {localEvents.length} <span className="text-xs font-normal text-slate-400">건</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">session-isolated storage</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                화면 최종 표시
              </div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {events.length} <span className="text-xs font-normal text-slate-400">건</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Active UI state</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                실시간 리스너 상태
              </div>
              <div className="flex items-center gap-1.5 mt-1 font-semibold text-xs">
                {listenerStatus.state === 'LISTENING_SERVER' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-emerald-600 dark:text-emerald-400 truncate">정상 (Server)</span>
                  </>
                ) : listenerStatus.state === 'LISTENING_CACHE' ? (
                  <>
                    <Activity className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span className="text-amber-600 dark:text-amber-400 truncate">캐시 (Offline/Cache)</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                    <span className="text-rose-600 dark:text-rose-400 truncate">오류 발생</span>
                  </>
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                {listenerStatus.lastSyncTime || '대기 중'}
              </div>
            </div>
          </div>

          {/* System Spec Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 font-semibold text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>기본 진단 매개변수</span>
              <span className="text-[11px] text-slate-400">클라우드 단일 진실 소스 원칙 준수</span>
            </div>

            <div className="px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs text-slate-500">현재 전체 sessionId</span>
              <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                {currentSession.sessionId}
              </span>
            </div>

            <div className="px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs text-slate-500">Firebase 프로젝트 ID</span>
              <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                {firebaseConfig.projectId}
                {(firebaseConfig as any).firestoreDatabaseId && (
                  <span className="text-slate-400 ml-1.5">
                    (DB: {(firebaseConfig as any).firestoreDatabaseId})
                  </span>
                )}
              </span>
            </div>

            <div className="px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs text-slate-500">인증 상태 (Auth Status)</span>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                {authStatusDisplay}
              </span>
            </div>

            <div className="px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs text-slate-500">Firestore 조회 경로 (Query Route)</span>
              <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                nursingEvents.where(&quot;sessionId&quot;, &quot;==&quot;, &quot;{currentSession.sessionId}&quot;)
              </span>
            </div>

            {listenerStatus.errorMessage && (
              <div className="px-4 py-2 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>리스너 에러: {listenerStatus.errorMessage}</span>
              </div>
            )}
          </div>

          {/* Current Session Events List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                현재 세션 바인딩 이벤트 목록 ({events.length}건)
              </h3>
              <span className="text-[11px] text-slate-400">
                {events.length === 0 ? '이벤트 없음 (0/5 단계)' : `현재 세션 진행: ${events.length}/5 완료`}
              </span>
            </div>

            {events.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                현재 활성 세션 [{currentSession.sessionId}]에 등록된 이벤트가 없습니다.
                <br />
                스마트폰에서 환자 QR 스캔 또는 모의 버튼을 클릭하면 실시간 반영됩니다.
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">단계 (EventType)</th>
                      <th className="px-3 py-2">세션 ID 일치</th>
                      <th className="px-3 py-2">출처</th>
                      <th className="px-3 py-2">기록 시각</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {events.map((evt) => {
                      const isMatchingSession = evt.sessionId === currentSession.sessionId;
                      return (
                        <tr key={evt.eventId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                            {evt.eventId.slice(0, 16)}...
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                            {evt.eventType}
                          </td>
                          <td className="px-3 py-2">
                            {isMatchingSession ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-teal-600 dark:text-teal-400 font-mono">
                                <CheckCircle2 className="w-3 h-3" /> 일치
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-mono font-bold">
                                <AlertCircle className="w-3 h-3" /> 불일치 ({evt.sessionId})
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{evt.eventSource}</td>
                          <td className="px-3 py-2 text-slate-400 font-mono">{evt.eventTimestamp}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Past Sessions Switcher (Supports Test A & Test D) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                등록된 시연 세션 기록 보관소 ({allSessions.length}개 세션)
              </h3>
              <span className="text-[11px] text-slate-400">Append-Only 보존 원칙 (기록 미삭제)</span>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 max-h-40 overflow-y-auto">
              {isLoadingSessions ? (
                <div className="p-4 text-center text-xs text-slate-400">세션 목록 불러오는 중...</div>
              ) : allSessions.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">등록된 세션이 없습니다.</div>
              ) : (
                allSessions.map((s) => {
                  const isCurrent = s.sessionId === currentSession.sessionId;
                  return (
                    <div
                      key={s.sessionId}
                      className={`px-4 py-2.5 flex items-center justify-between text-xs transition-colors ${
                        isCurrent
                          ? 'bg-teal-50/60 dark:bg-teal-950/30 font-medium'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {s.sessionId}
                        </span>
                        <span className="text-slate-400">
                          세션 #{s.sessionNumber || 1} • 시작: {s.startedAt || '--:--'} • 이벤트 {s.eventsCount || 0}건
                        </span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300">
                            현재 활성
                          </span>
                        )}
                      </div>

                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => handleSelectSession(s.sessionId)}
                          disabled={isSwitching}
                          className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 disabled:opacity-50"
                        >
                          전환하기 <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            시연 모드에서는 기본적으로 숨겨져 있으며, 헤더의 <strong>[진단]</strong> 버튼으로 열 수 있습니다.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-medium transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
