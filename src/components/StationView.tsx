import React, { useState, useEffect } from 'react';
import {
  Monitor,
  Activity,
  FileText,
  Printer,
  RotateCcw,
  Smartphone,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Database,
  RefreshCw,
  PlusCircle,
  Copy,
  Check,
  Terminal,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  Patient,
  MedicationOrder,
  DemoSession,
  NursingEvent,
  IvSiteAssessment,
  NursingRecord,
  EMRTransfer,
  AppMode,
  EventType,
  EventSource,
  isStep4,
  isStep5,
} from '../types';
import { PatientCard } from './PatientCard';
import { PrescriptionCard } from './PrescriptionCard';
import { TimelineSection } from './TimelineSection';
import { AiDraftSection } from './AiDraftSection';
import { EmrViewer } from './EmrViewer';
import { DemoPrepView } from './DemoPrepView';
import { EmrTransmissionModal } from './EmrTransmissionModal';

export type StationTab = 'dashboard' | 'records' | 'prep';

interface StationViewProps {
  nurse: any;
  canWrite: boolean;
  patient: Patient;
  prescription: MedicationOrder;
  currentSession: DemoSession;
  events: NursingEvent[];
  ivSiteAssessment: IvSiteAssessment | null;
  draftNote: NursingRecord | null;
  emrRecords: EMRTransfer[];
  onStartNewSession: () => void;
  onUpdateDraft: (draft: NursingRecord) => Promise<void>;
  onOpenEmrModal: () => void;
  isEmrModalOpen: boolean;
  onCloseEmrModal: () => void;
  onTransmissionSuccess: (record: EMRTransfer) => void;
  onSwitchMode: (mode: AppMode) => void;
  onOpenFirebaseGuide: () => void;
  onOpenDiagnostics?: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onSimulateEvent: (eventType: EventType, source?: EventSource) => void;
}

export const StationView: React.FC<StationViewProps> = ({
  nurse,
  canWrite,
  patient,
  prescription,
  currentSession,
  events,
  ivSiteAssessment,
  draftNote,
  emrRecords,
  onStartNewSession,
  onUpdateDraft,
  onOpenEmrModal,
  isEmrModalOpen,
  onCloseEmrModal,
  onTransmissionSuccess,
  onSwitchMode,
  onOpenFirebaseGuide,
  onOpenDiagnostics,
  isDarkMode,
  onToggleDarkMode,
  onSimulateEvent,
}) => {
  const [activeTab, setActiveTab] = useState<StationTab>('dashboard');
  const [isSessionConfirmOpen, setIsSessionConfirmOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isCopiedSessionId, setIsCopiedSessionId] = useState<boolean>(false);

  // Strict session-scoped events: ignore any events from other sessions
  const sessionEvents = events.filter((e) => e.sessionId === currentSession.sessionId);

  // Build clean standalone URL containing full session ID
  const captureUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?mode=capture&session=${encodeURIComponent(currentSession.sessionId)}`
    : `?mode=capture&session=${encodeURIComponent(currentSession.sessionId)}`;

  useEffect(() => {
    QRCode.toDataURL(captureUrl, {
      width: 260,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.warn('QR gen err:', err));
  }, [captureUrl]);

  const copySessionId = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(currentSession.sessionId);
      setIsCopiedSessionId(true);
      setTimeout(() => setIsCopiedSessionId(false), 2000);
    }
  };

  const isPatientVerified = sessionEvents.some((e) => e.eventType === 'PATIENT_VERIFY');
  const isMedicationVerified = sessionEvents.some((e) => e.eventType === 'MEDICATION_VERIFY');
  const isIvSiteAssessed = sessionEvents.some((e) => e.eventType === 'IV_SITE_ASSESS');
  const hasInfusionStarted = sessionEvents.some((e) => isStep4(e.eventType));
  const hasInfusionEnded = sessionEvents.some((e) => isStep5(e.eventType));

  const completedStepsCount = [
    isPatientVerified,
    isMedicationVerified,
    isIvSiteAssessed,
    hasInfusionStarted,
    hasInfusionEnded,
  ].filter(Boolean).length;

  const infusionStatus = hasInfusionEnded
    ? 'COMPLETED'
    : hasInfusionStarted
    ? 'IN_PROGRESS'
    : 'NOT_STARTED';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Station Header */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand & Mode Identification */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black shadow-md shadow-teal-600/20 shrink-0">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                  NurseFlow Station
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-bold border border-teal-300 dark:border-teal-800">
                  PC 간호 데스크
                </span>
                <span className="hidden md:inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Cloud Firestore 실시간 연동
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                병동 {nurse.department} · {nurse.nurseName} 간호사 ({nurse.licenseNumber})
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'dashboard'
                  ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>간호 관리 대시보드</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('records')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'records'
                  ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>가상 EMR 기록원 ({emrRecords.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('prep')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'prep'
                  ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>라벨 준비실</span>
            </button>
          </nav>

          {/* Quick Action & Modals Trigger */}
          <div className="flex items-center gap-2">
            {/* Open Phone QR Modal */}
            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="text-xs px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-100 font-semibold flex items-center gap-1.5 shadow-xs transition"
              title="스마트폰에서 현장 수집기(Capture) 연결"
            >
              <Smartphone className="w-3.5 h-3.5 text-sky-600" />
              <span className="hidden lg:inline">아이폰 연결 QR</span>
              <span className="lg:hidden">아이폰 연결</span>
            </button>

            {/* Diagnostics Button */}
            {onOpenDiagnostics && (
              <button
                type="button"
                onClick={onOpenDiagnostics}
                className="text-xs px-2.5 py-1.5 rounded-xl border border-teal-300 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 font-medium flex items-center gap-1.5 transition"
                title="시스템 및 Firestore 동기화 진단"
              >
                <Terminal className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>진단</span>
              </button>
            )}

            {/* Switch to Portal */}
            <button
              type="button"
              onClick={() => onSwitchMode('PORTAL')}
              className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="화면 선택 포털로 이동"
            >
              포털
            </button>

            {/* Firebase Guide Modal */}
            <button
              type="button"
              onClick={onOpenFirebaseGuide}
              className="text-xs p-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition"
              title="Firebase 연동 상태 및 가이드"
            >
              <Database className="w-4 h-4 text-amber-600" />
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-800 transition text-xs"
              title="테마 전환"
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        {/* Mobile secondary tab bar */}
        <div className="sm:hidden flex items-center justify-around border-t border-slate-200 dark:border-slate-800 px-2 py-1 bg-slate-50 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`py-1 px-2 text-xs font-semibold ${
              activeTab === 'dashboard' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-500'
            }`}
          >
            대시보드
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('records')}
            className={`py-1 px-2 text-xs font-semibold ${
              activeTab === 'records' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-500'
            }`}
          >
            EMR 이력 ({emrRecords.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('prep')}
            className={`py-1 px-2 text-xs font-semibold ${
              activeTab === 'prep' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-500'
            }`}
          >
            라벨 준비실
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Full Session ID & Remote Capture Sync Banner */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 flex flex-col items-center justify-center font-mono font-bold shrink-0">
              <span className="text-[10px] text-teal-500">세션</span>
              <span className="text-sm">#{currentSession.sessionNumber}</span>
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  전체 세션 ID:
                </span>
                <span className="font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-white px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-800 text-teal-700 dark:text-teal-300">
                  {currentSession.sessionId}
                </span>
                <button
                  type="button"
                  onClick={copySessionId}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  title="세션 ID 복사"
                >
                  {isCopiedSessionId ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800">
                  진행 중 ({completedStepsCount}/5 완료)
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                아이폰 카메라로 QR을 스캔하여 전체 세션 ID({currentSession.sessionId})에 연결하면 수집된 이벤트가 본 화면 타임라인에 실시간 갱신됩니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsSessionConfirmOpen(true)}
              className="text-xs px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 font-semibold flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
              <span>새 시연 세션 시작</span>
            </button>

            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="text-xs px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold flex items-center gap-1.5 shadow-sm transition"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>아이폰 연결 QR</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Dashboard View */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Top Grid: Patient & Medication Order Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PatientCard patient={patient} isVerified={isPatientVerified} />
              <PrescriptionCard
                prescription={prescription}
                isMedicationVerified={isMedicationVerified}
                infusionStatus={infusionStatus}
              />
            </div>

            {/* Real-time Timeline and AI Draft Section Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5 space-y-4">
                <TimelineSection events={sessionEvents} />
              </div>

              <div className="lg:col-span-7 space-y-4">
                <AiDraftSection
                  nurse={nurse}
                  canWrite={canWrite}
                  patient={patient}
                  prescription={prescription}
                  events={sessionEvents}
                  ivSiteAssessment={ivSiteAssessment}
                  draftNote={draftNote}
                  onUpdateDraft={onUpdateDraft}
                  onOpenEmrModal={onOpenEmrModal}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: EMR Records History */}
        {activeTab === 'records' && (
          <EmrViewer
            records={emrRecords}
            patient={patient}
            onBackToWorkflow={() => setActiveTab('dashboard')}
          />
        )}

        {/* Tab 3: Label Preparation Tab */}
        {activeTab === 'prep' && <DemoPrepView />}
      </main>

      {/* Confirmation Modal for Resetting Demo Session */}
      {isSessionConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  새로운 시연 세션을 시작하시겠습니까?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  현재 세션(#{currentSession.sessionNumber})의 실시간 이벤트는 안전하게 보존되며 신규 클라우드 세션이 발급됩니다.
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-xl border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-200 space-y-1">
              <p className="font-semibold">보존 안내:</p>
              <p>기존에 작성된 가상 EMR 전송 기록 및 전자서명 내역은 그대로 유지됩니다.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSessionConfirmOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSessionConfirmOpen(false);
                  onStartNewSession();
                }}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition shadow-xs"
              >
                새 세션 시작
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal for Phone Capture Connection */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-950 text-sky-600 flex items-center justify-center mx-auto">
              <Smartphone className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                아이폰에서 NurseFlow Capture 열기
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                아이폰 카메라로 아래 QR 코드를 스캔하면 현재 Station의 <strong>전체 세션 ID</strong>로 클라우드에 자동 연결됩니다.
              </p>
            </div>

            {/* Rendered Live QR Code */}
            {qrDataUrl ? (
              <div className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <img
                  src={qrDataUrl}
                  alt="스마트폰 Capture 연결 QR코드"
                  className="w-52 h-52 object-contain"
                />
                <div className="mt-2 text-center">
                  <span className="text-[10px] text-slate-400 font-medium block">연결 대상 전체 세션 ID:</span>
                  <span className="text-xs font-mono font-bold text-teal-700 dark:text-teal-300">
                    {currentSession.sessionId}
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-52 h-52 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-2xl mx-auto text-xs text-slate-400">
                QR 코드 생성 중...
              </div>
            )}

            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-left text-xs space-y-1">
              <span className="text-slate-400 text-[10px] font-medium block">Capture 직접 접속 링크:</span>
              <a
                href={captureUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sky-600 dark:text-sky-400 text-[11px] underline break-all font-semibold block"
              >
                {captureUrl}
              </a>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <a
                href={captureUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 px-3 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                새 창으로 열기
              </a>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMR Transmission Modal */}
      <EmrTransmissionModal
        isOpen={isEmrModalOpen}
        onClose={onCloseEmrModal}
        draftNote={draftNote}
        events={sessionEvents}
        patient={patient}
        onTransmissionSuccess={onTransmissionSuccess}
        onViewEmrTab={() => {
          onCloseEmrModal();
          setActiveTab('records');
        }}
      />
    </div>
  );
};
