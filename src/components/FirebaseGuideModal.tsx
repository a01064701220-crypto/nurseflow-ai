import React, { useState } from 'react';
import {
  X,
  Database,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  FileCode2,
  Lock,
  Layers,
  Sparkles,
  Smartphone,
  Monitor,
  Radio,
} from 'lucide-react';
import { StorageService } from '../services/storageService';
import firebaseConfig from '../../firebase-applet-config.json';

interface FirebaseGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseGuideModal: React.FC<FirebaseGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, section: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    }
  };

  const deployedRules = '현재 실제 게시 규칙은 주요 컬렉션의 공개 읽기와 인증 우회 쓰기를 허용합니다. 이 화면의 안내를 게시된 규칙 원문으로 사용하지 마세요. 작업용 사본의 firestore.rules는 기존 세션의 UID 매핑, 두 기기 로그인, 권한 테스트를 마친 후 별도 승인으로 게시해야 합니다.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Firebase Cloud Firestore 연결 상태
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  실시간 연동 활성화 (ONLINE)
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Google Cloud 인프라 기반 실시간 멀티 디바이스 간호 데이터 파이프라인
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-slate-700 dark:text-slate-300 text-xs">
          {/* Active Cloud Status Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent border border-emerald-500/30 flex items-start gap-3.5">
            <Radio className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 animate-pulse" />
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                클라우드 실시간 동기화 가동 중
              </h4>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                Google AI Studio를 통해 프로비저닝된 Cloud Firestore 데이터베이스와 연결되었습니다.
                이제 <strong>PC 노트북(Station)</strong>과 <strong>아이폰(Capture)</strong>이 서로 다른 물리적 기기에서도
                1초 미만의 지연 시간으로 이벤트를 실시간 공유합니다.
              </p>
            </div>
          </div>

          {/* Project & Database Configuration Box */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2.5">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-teal-600" />
                연동 인프라 제원
              </span>
              <span className="text-[10px] text-emerald-600 font-bold font-mono">
                CONNECTED
              </span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block text-[10px]">Firebase Project ID</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {firebaseConfig.projectId}
                </span>
              </div>
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block text-[10px]">Cloud Firestore Database</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate block">
                  {(firebaseConfig as any).firestoreDatabaseId || '(default)'}
                </span>
              </div>
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block text-[10px]">인증 계정 (Nurse Auth)</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  yang.rn@hospital.mock
                </span>
              </div>
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block text-[10px]">실시간 스트림 채널</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  onSnapshot Live Listener
                </span>
              </div>
            </div>
          </div>

          {/* Cross-device Architecture Diagram */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 text-xs">
              <Sparkles className="w-4 h-4 text-teal-600" />
              멀티 디바이스 실시간 데이터 파이프라인
            </h4>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center text-[11px] p-2 bg-slate-50 dark:bg-slate-950 rounded-xl">
              <div className="flex-1 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                <Smartphone className="w-4 h-4 text-sky-500 mx-auto mb-1" />
                <span className="font-bold block">아이폰 Capture</span>
                <span className="text-[10px] text-slate-400">QR·바코드·음성 수집</span>
              </div>
              <div className="text-slate-400 font-mono text-xs">➔ Firestore (setDoc) ➔</div>
              <div className="flex-1 p-2 bg-white dark:bg-slate-900 rounded-lg border border-teal-500/30">
                <Database className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                <span className="font-bold text-teal-600 dark:text-teal-400 block">Cloud Firestore</span>
                <span className="text-[10px] text-slate-400">Append-Only 영구 로그</span>
              </div>
              <div className="text-slate-400 font-mono text-xs">➔ onSnapshot (실시간) ➔</div>
              <div className="flex-1 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                <Monitor className="w-4 h-4 text-teal-500 mx-auto mb-1" />
                <span className="font-bold block">노트북 Station</span>
                <span className="text-[10px] text-slate-400">타임라인·AI기록·EMR</span>
              </div>
            </div>
          </div>

          {/* Security Rules Code Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                보안 규칙 전환 안내
              </h4>
            </div>
            <pre className="p-3 bg-slate-950 text-slate-300 font-mono text-[10px] rounded-xl overflow-x-auto border border-slate-800 leading-relaxed max-h-48">
              {deployedRules}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 bg-slate-50 dark:bg-slate-950 px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between z-10">
          <span className="text-[11px] text-slate-500">
            기존 로컬 시연 기록 및 EMR 전송 이력은 영구 보존됩니다.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
};
