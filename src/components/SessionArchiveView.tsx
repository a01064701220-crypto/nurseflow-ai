import React, { useEffect, useState } from 'react';
import { Archive, Clock3, FileClock, RefreshCw, ShieldCheck } from 'lucide-react';
import { DemoSession, NursingEvent, isStep4, isStep5 } from '../types';
import { StorageService } from '../services/storageService';
import { TimelineSection } from './TimelineSection';

interface SessionArchiveViewProps {
  currentSession: DemoSession;
  currentEvents: NursingEvent[];
  onOpenSession: (sessionId: string) => Promise<void>;
  onStartNewSession: () => void;
}

const sessionDate = (session: DemoSession): string => {
  if (session.lastSyncAt) {
    const activity = new Date(session.lastSyncAt);
    if (!Number.isNaN(activity.getTime())) {
      const year = activity.getFullYear();
      const month = String(activity.getMonth() + 1).padStart(2, '0');
      const day = String(activity.getDate()).padStart(2, '0');
      return `${year}.${month}.${day}`;
    }
  }
  const match = /^SES-(\d{4})(\d{2})(\d{2})-/.exec(session.sessionId);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : '날짜 미확인';
};

const eventTime = (event?: NursingEvent): string => {
  if (!event) return '기록 없음';
  if (event.eventTimestamp) return event.eventTimestamp;
  const date = new Date(event.occurredAt || event.createdAt);
  return Number.isNaN(date.getTime()) ? '시간 미확인' : date.toLocaleTimeString('ko-KR');
};

export const SessionArchiveView: React.FC<SessionArchiveViewProps> = ({
  currentSession,
  currentEvents,
  onOpenSession,
  onStartNewSession,
}) => {
  const [sessions, setSessions] = useState<DemoSession[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<NursingEvent[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showRecordedOnly, setShowRecordedOnly] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingSessions(true);
    StorageService.loadAllSessions()
      .then((list) => {
        if (cancelled) return;
        setSessions(list);
        setSelectedId((previous) => list.some((item) => item.sessionId === previous)
          ? previous
          : (list.find((item) => (item.eventsCount || 0) > 0)?.sessionId || currentSession.sessionId));
        setMessage(list.length === 0 ? '조회할 수 있는 시연 세션이 없습니다.' : null);
      })
      .catch(() => {
        if (!cancelled) setMessage('세션 목록을 불러오지 못했습니다. 다시 조회해 주세요.');
      })
      .finally(() => {
        if (!cancelled) setLoadingSessions(false);
      });
    return () => { cancelled = true; };
  }, [currentSession.sessionId, refreshKey]);

  useEffect(() => {
    if (selectedId === currentSession.sessionId) {
      setSelectedEvents(currentEvents.filter((event) => event.sessionId === selectedId));
    }
  }, [currentEvents, currentSession.sessionId, selectedId]);

  useEffect(() => {
    if (!selectedId || selectedId === currentSession.sessionId) {
      setLoadingEvents(false);
      return;
    }
    let cancelled = false;
    setLoadingEvents(true);
    setMessage(null);
    StorageService.fetchSessionEventsFromFirestore(selectedId)
      .then((events) => {
        if (!cancelled) setSelectedEvents(events);
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedEvents([]);
          setMessage('이 세션의 기록을 읽지 못했습니다. 참여 권한과 연결 상태를 확인해 주세요.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingEvents(false);
      });
    return () => { cancelled = true; };
  }, [selectedId, currentSession.sessionId, refreshKey]);

  const selected = sessions.find((session) => session.sessionId === selectedId);
  const events = selectedEvents
    .filter((event) => event.sessionId === selectedId)
    .sort((a, b) => (a.occurredAt || a.createdAt).localeCompare(b.occurredAt || b.createdAt));
  const steps = [
    { label: '환자 확인', event: events.find((item) => item.eventType === 'PATIENT_VERIFY') },
    { label: '약물 대조', event: events.find((item) => item.eventType === 'MEDICATION_VERIFY') },
    { label: 'IV 사정', event: events.find((item) => item.eventType === 'IV_SITE_ASSESS') },
    { label: '투여 시작', event: events.find((item) => isStep4(item.eventType)) },
    { label: '투여 종료', event: events.find((item) => isStep5(item.eventType)) },
  ];
  const totalEvents = sessions.reduce((sum, session) => sum + (session.eventsCount || 0), 0);
  const visibleSessions = sessions.filter((session) => !showRecordedOnly
    || session.sessionId === currentSession.sessionId
    || (session.eventsCount || 0) > 0
    || session.emrTransmitted);

  return (
    <section className="space-y-5" aria-label="시연 기록 보관함">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-700 dark:text-teal-300">
              <Archive className="w-5 h-5" />
              <h2 className="text-lg font-extrabold">시연 기록 보관함</h2>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              참여 권한이 있는 세션의 간호 행동과 기록 시각을 조회합니다. 새 세션을 시작해도 이전 기록은 유지됩니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setRefreshKey((value) => value + 1)} className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold flex items-center gap-1.5" aria-label="기록 다시 조회">
              <RefreshCw className={`w-4 h-4 ${loadingSessions ? 'animate-spin' : ''}`} /> 다시 조회
            </button>
            <button type="button" onClick={onStartNewSession} className="rounded-lg bg-teal-700 hover:bg-teal-600 px-3 py-2 text-xs font-bold text-white">
              새 시연 세션 시작
            </button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><div className="text-xl font-bold">{sessions.length}</div><div className="text-xs text-slate-500 dark:text-slate-400">접근 가능 세션</div></div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><div className="text-xl font-bold">{totalEvents}</div><div className="text-xs text-slate-500 dark:text-slate-400">누적 행동 기록</div></div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><div className="text-xl font-bold">{sessions.filter((session) => session.emrTransmitted).length}</div><div className="text-xs text-slate-500 dark:text-slate-400">Mock EMR 전송 세션</div></div>
        </div>
      </div>

      {message && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">{message}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)] gap-5 items-start">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-sm space-y-2">
          <div className="flex items-center justify-between gap-2 px-2 py-1"><h3 className="text-sm font-bold">세션 목록</h3><button type="button" onClick={() => setShowRecordedOnly((value) => !value)} className="text-xs font-semibold text-teal-700 dark:text-teal-300">{showRecordedOnly ? '전체 보기' : '기록 있는 세션'}</button></div>
          {loadingSessions && <p className="px-2 py-5 text-sm text-slate-500">세션 조회 중...</p>}
          <div className="max-h-[38rem] overflow-y-auto space-y-2 pr-1">
          {!loadingSessions && visibleSessions.map((session) => (
            <button key={session.sessionId} type="button" onClick={() => setSelectedId(session.sessionId)} aria-current={selectedId === session.sessionId ? 'true' : undefined} className={`w-full rounded-xl border p-3 text-left transition ${selectedId === session.sessionId ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40' : 'border-slate-200 dark:border-slate-700 hover:border-teal-300'}`}>
              <div className="flex items-center justify-between gap-2"><span className="font-bold text-sm">세션 #{session.sessionNumber}</span><span className="text-[11px] text-slate-500">최근 {sessionDate(session)}</span></div>
              <div className="mt-1 truncate font-mono text-[11px] text-slate-600 dark:text-slate-300">{session.sessionId}</div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400"><span>{session.eventsCount || 0}건 · 시작 {session.startedAt || '시간 미확인'}</span><span>{session.sessionId === currentSession.sessionId ? '현재' : session.status === 'COMPLETED' ? '완료' : '이전'}</span></div>
            </button>
          ))}
          </div>
        </div>

        <div className="space-y-4 min-w-0">
          {selected && (
            <>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h3 className="font-bold text-base">세션 #{selected.sessionNumber} 행동 시간표</h3><p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1 break-all">{selected.sessionId}</p></div>
                  <button type="button" onClick={() => void onOpenSession(selected.sessionId)} disabled={selected.sessionId === currentSession.sessionId} className="rounded-lg border border-teal-300 dark:border-teal-800 px-3 py-2 text-xs font-semibold text-teal-700 dark:text-teal-300 disabled:opacity-50">{selected.sessionId === currentSession.sessionId ? '현재 열린 세션' : 'Station에서 열기'}</button>
                </div>
                <div className="mt-4 grid grid-cols-2 xl:grid-cols-5 gap-2">
                  {steps.map((step, index) => <div key={step.label} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3"><div className="text-[11px] text-slate-500 dark:text-slate-400">{index + 1}. {step.label}</div><div className="mt-1 flex items-center gap-1 font-mono text-xs font-bold"><Clock3 className="w-3.5 h-3.5 text-teal-600" />{loadingEvents ? '조회 중' : eventTime(step.event)}</div></div>)}
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><ShieldCheck className="w-3.5 h-3.5" /> 조회 전용 · 이 화면에서 기존 기록을 수정하지 않습니다.</p>
              </div>
              {loadingEvents ? <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500"><FileClock className="w-6 h-6 mx-auto mb-2" />기록을 불러오는 중...</div> : events.length > 0 ? <TimelineSection events={events} /> : <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">이 세션에 저장된 간호 행동 기록이 없습니다.</div>}
            </>
          )}
        </div>
      </div>
    </section>
  );
};
