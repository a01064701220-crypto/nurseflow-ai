import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { DemoSession, Nurse } from '../types';
import { db, ensureAuthenticated } from './firebase';

export async function loadApprovedNurse(): Promise<Nurse> {
  const user = await ensureAuthenticated();
  const profile = await getDoc(doc(db, 'nurses', user.uid));
  if (!profile.exists() || profile.data().approved !== true) {
    throw new Error('승인된 간호사 계정이 아닙니다. 관리자에게 접근 등록을 요청하세요.');
  }
  return { ...(profile.data() as Nurse), uid: user.uid };
}

export async function loadApprovedNurses(): Promise<Nurse[]> {
  await loadApprovedNurse();
  const results = await getDocs(query(collection(db, 'nurses'), where('approved', '==', true)));
  return results.docs.map((entry) => ({ ...(entry.data() as Nurse), uid: entry.id }));
}

export function isSessionParticipant(session: DemoSession, uid: string): boolean {
  return session.ownerUid === uid || (session.participantUids || []).includes(uid);
}

export function assertSessionAccess(session: DemoSession, uid: string, write = false): void {
  if (!isSessionParticipant(session, uid)) {
    throw new Error('이 세션에 대한 접근 권한이 없습니다.');
  }
  if (write && (session.status !== 'ACTIVE' || session.activeNurseUid !== uid)) {
    throw new Error('현재 담당 간호사만 활성 세션에 기록할 수 있습니다.');
  }
}
