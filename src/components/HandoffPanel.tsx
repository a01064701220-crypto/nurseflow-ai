import React, { useEffect, useState } from 'react';
import { DemoSession, Nurse } from '../types';
import { loadApprovedNurses } from '../services/accessService';
import { StorageService } from '../services/storageService';

interface Props {
  session: DemoSession;
  currentUid: string;
  onUpdated: (session: DemoSession) => void;
  onClose: () => void;
}

export function HandoffPanel({ session, currentUid, onUpdated, onClose }: Props) {
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [selectedUid, setSelectedUid] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadApprovedNurses().then(setNurses).catch((error) => setMessage(error.message));
  }, []);

  const selected = nurses.find((entry) => entry.uid === selectedUid);
  const isParticipant = !!selectedUid && (session.participantUids || []).includes(selectedUid);
  const isOwner = session.ownerUid === currentUid;
  const isActive = session.activeNurseUid === currentUid && session.status === 'ACTIVE';

  async function run(action: () => Promise<DemoSession>, success: string) {
    setBusy(true);
    setMessage('');
    try {
      onUpdated(await action());
      setMessage(success);
    } catch (error: any) {
      setMessage(error?.message || '작업에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <section className="w-full max-w-lg rounded-2xl bg-white p-6 text-slate-900 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">간호사 교대 관리</h2>
          <button onClick={onClose} aria-label="닫기">닫기</button>
        </div>
        <p className="text-sm">현재 담당: {nurses.find((entry) => entry.uid === session.activeNurseUid)?.nurseName || '등록된 담당자'}</p>
        <p className="text-xs text-slate-600">참여 승인과 담당 교대는 별도 단계입니다. 교대 후 이전 담당자는 이 세션을 읽을 수 있지만 새 기록은 작성할 수 없습니다.</p>
        <label className="block text-sm font-medium" htmlFor="handoff-nurse">다음 간호사</label>
        <select id="handoff-nurse" value={selectedUid} onChange={(event) => setSelectedUid(event.target.value)} className="w-full rounded-lg border p-2">
          <option value="">간호사를 선택하세요</option>
          {nurses.filter((entry) => entry.uid && entry.uid !== currentUid).map((entry) => (
            <option key={entry.uid} value={entry.uid}>{entry.nurseName} ({entry.nurseId})</option>
          ))}
        </select>
        {selected && <p className="text-xs">참여 상태: {isParticipant ? '승인됨' : '미승인'}</p>}
        {message && <p role="status" className="text-sm text-teal-800">{message}</p>}
        <div className="flex flex-wrap gap-2">
          {isOwner && selectedUid && !isParticipant && (
            <button disabled={busy} className="rounded-lg bg-sky-700 px-4 py-2 text-white disabled:opacity-50" onClick={() => run(() => StorageService.addSessionParticipant(session.sessionId, selectedUid), '참여를 승인했습니다.')}>
              참여 승인
            </button>
          )}
          {isActive && selectedUid && isParticipant && (
            <button disabled={busy} className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-50" onClick={() => run(() => StorageService.handoffSession(session.sessionId, selectedUid), '담당 간호사를 교대했습니다.')}>
              담당 교대 확정
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
