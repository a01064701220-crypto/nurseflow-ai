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
  ChevronDown,
  ChevronUp,
  Database,
  RefreshCw,
  PlusCircle,
  Copy,
  Check,
  Terminal,
  Menu,
  X,
  Sparkles,
  ShieldCheck,
  UserCheck,
  Pill,
  Camera,
  ArrowLeft,
  ArrowRight,
  Sliders,
  Layers,
  Archive,
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
import { SessionArchiveView } from './SessionArchiveView';

export type StationTab = 'dashboard' | 'records' | 'prep' | 'archive';

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
  onOpenSession: (sessionId: string) => Promise<void>;
  onUpdateDraft: (draft: NursingRecord) => Promise<void>;
  onOpenEmrModal: () => void;
  isEmrModalOpen: boolean;
  onCloseEmrModal: () => void;
  onTransmissionSuccess: (record: EMRTransfer) => void;
  onSwitchMode: (mode: AppMode) => void;
  onOpenFirebaseGuide: () => void;
  onOpenDiagnostics?: () => void;
  onOpenHandoff?: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onSimulateEvent: (eventType: EventType, source?: EventSource) => void;
  stationScrollTarget?: string | null;
  onClearScrollTarget?: () => void;
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
  onOpenSession,
  onUpdateDraft,
  onOpenEmrModal,
  isEmrModalOpen,
  onCloseEmrModal,
  onTransmissionSuccess,
  onSwitchMode,
  onOpenFirebaseGuide,
  onOpenDiagnostics,
  onOpenHandoff,
  isDarkMode,
  onToggleDarkMode,
  onSimulateEvent,
  stationScrollTarget,
  onClearScrollTarget,
}) => {
  const [activeTab, setActiveTab] = useState<StationTab>('dashboard');
  const [isSessionConfirmOpen, setIsSessionConfirmOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isCopiedSessionId, setIsCopiedSessionId] = useState<boolean>(false);

  // Mobile auxiliary layout collapsible states
  const [isMobileTimelineExpanded, setIsMobileTimelineExpanded] = useState<boolean>(false);
  const [isMobileDraftExpanded, setIsMobileDraftExpanded] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

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

  const scrollToMobileDraft = () => {
    setIsMobileDraftExpanded(true);
    setTimeout(() => {
      document.getElementById('mobile-draft-container')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Scroll to requested section (e.g. mobile-quick-actions) on navigation from handsfree demo
  useEffect(() => {
    if (stationScrollTarget) {
      setActiveTab('dashboard');
      const timer = setTimeout(() => {
        const el = document.getElementById(stationScrollTarget);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        onClearScrollTarget?.();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [stationScrollTarget, onClearScrollTarget]);

  // A newly created or reopened session starts on its own dashboard.
  useEffect(() => {
    setActiveTab('dashboard');
  }, [currentSession.sessionId]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Station Header */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Desktop controls wrap into a dedicated navigation row at narrower PC widths. */}
        <div className="hidden md:grid grid-cols-[minmax(0,1fr)_auto] max-w-7xl mx-auto px-4 lg:px-8 py-2.5 items-center gap-x-4 gap-y-2">
          {/* Brand & Mode Identification */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black shadow-md shadow-teal-600/20 shrink-0">
              <Monitor className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                  NurseFlow Station
                </span>
                <span className="hidden lg:inline-flex text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-bold border border-teal-300 dark:border-teal-800 whitespace-nowrap">
                  PC 간호 데스크
                </span>
                <span className="hidden xl:inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Cloud Firestore 실시간 연동
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {nurse.accountType === 'EDUCATIONAL_DEMO'
                  ? `교육용 시연 · ${nurse.nurseName} · 면허 미검증`
                  : `병동 ${nurse.department} · ${nurse.nurseName} 간호사${nurse.licenseNumber ? ` (${nurse.licenseNumber})` : ''}`}
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav aria-label="간호사 데스크 메뉴" className="col-span-2 grid grid-cols-4 gap-1 w-full max-w-3xl mx-auto bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`min-w-0 px-2 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
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
              className={`min-w-0 px-2 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
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
              className={`min-w-0 px-2 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'prep'
                  ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>라벨 준비실</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('archive')}
              className={`min-w-0 px-2 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'archive'
                  ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Archive className="w-3.5 h-3.5 shrink-0" />
              <span>시연 기록 보관함</span>
            </button>
          </nav>

          {/* Quick Action & Modals Trigger (Desktop) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Open Phone QR Modal */}
            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="text-xs px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-100 font-semibold flex items-center gap-1.5 shadow-xs transition whitespace-nowrap"
              title="스마트폰에서 현장 수집기(Capture) 연결"
            >
              <Smartphone className="w-3.5 h-3.5 text-sky-600" />
              <span className="hidden lg:inline">아이폰 연결 QR</span>
              <span className="lg:hidden">연결 QR</span>
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

        {/* Dedicated Mobile Header (Problem 1: Concise mobile-only header) */}
        <div className="flex md:hidden items-center justify-between h-14 px-3.5 gap-2 w-full">
          {/* 1. NurseFlow Station & Session Status */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black shrink-0 shadow-xs">
              <Monitor className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white truncate">
                  NurseFlow Station
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                <span className="font-bold text-teal-600 dark:text-teal-400">#{currentSession.sessionNumber}</span>
                <span>·</span>
                <span className={completedStepsCount === 5 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-700 dark:text-slate-300 font-medium'}>
                  {completedStepsCount}/5 {completedStepsCount === 5 ? '완료' : '진행'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Theme Toggle + Capture Button + More Menu */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-800 transition text-xs"
              title="테마 전환"
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
            <button
              type="button"
              disabled={!canWrite}
              onClick={() => onSwitchMode('CAPTURE')}
              className="px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/70 border border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 font-bold text-xs flex items-center gap-1 hover:bg-sky-100 transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
              title="웨어러블 모바일 Capture로 전환"
            >
              <Smartphone className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Capture</span>
            </button>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1 hover:bg-slate-200 transition"
              aria-label="더보기 메뉴 열기"
            >
              <Menu className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span>더보기</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {!canWrite && (
          <div role="status" className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            <strong>세션 #{currentSession.sessionNumber} · 조회 전용</strong>
            <span className="block mt-1">{currentSession.status !== 'ACTIVE'
              ? '완료된 세션의 기록을 볼 수 있습니다. 새 기록은 작성할 수 없습니다.'
              : '현재 담당 간호사가 아니므로 기록을 볼 수 있지만 이 세션에 새 기록을 작성할 수 없습니다.'}</span>
          </div>
        )}
        {/* ========================================================================= */}
        {/* DESKTOP LAYOUT (md:block) - Preserved exactly as the primary PC workstation */}
        {/* ========================================================================= */}
        <div className="hidden md:block space-y-6">
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

          {/* Desktop Tab 1: Dashboard View */}
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

          {/* Desktop Tab 2: EMR Records History */}
          {activeTab === 'records' && (
            <EmrViewer
              records={emrRecords}
              patient={patient}
              onBackToWorkflow={() => setActiveTab('dashboard')}
            />
          )}

          {/* Desktop Tab 3: Label Preparation Tab */}
          {activeTab === 'prep' && <DemoPrepView />}

          {/* PC-only, read-only archive of authorized cloud sessions. */}
          {activeTab === 'archive' && (
            <SessionArchiveView
              currentSession={currentSession}
              currentEvents={sessionEvents}
              onOpenSession={onOpenSession}
              onStartNewSession={() => setIsSessionConfirmOpen(true)}
            />
          )}
        </div>

        {/* ========================================================================= */}
        {/* MOBILE LAYOUT (block md:hidden) - Purpose-built auxiliary companion view */}
        {/* ========================================================================= */}
        <div className="block md:hidden space-y-4">
          {/* Sub-tab Navigation if not on main dashboard */}
          {activeTab !== 'dashboard' && activeTab !== 'archive' && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="text-xs font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>대시보드로 돌아가기</span>
              </button>
              <span className="text-xs text-slate-500 font-medium">
                {activeTab === 'records' ? '가상 EMR 기록원' : '라벨 준비실'}
              </span>
            </div>
          )}

          {/* Mobile Secondary Tab Views */}
          {activeTab === 'records' && (
            <EmrViewer
              records={emrRecords}
              patient={patient}
              onBackToWorkflow={() => setActiveTab('dashboard')}
            />
          )}

          {activeTab === 'prep' && <DemoPrepView />}

          {/* Mobile Primary Dashboard Auxiliary View */}
          {(activeTab === 'dashboard' || activeTab === 'archive') && (
            <>
              {/* Wearable Prototype Context Banner */}
              <div className="p-3 bg-gradient-to-r from-teal-950/60 to-slate-900 rounded-2xl border border-teal-500/30 text-xs text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5 text-teal-300 font-bold text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                  <span>간호 스테이션 모바일 보조 관제</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  모바일은 웨어러블 Capture 시뮬레이션용 보조 화면입니다. PC 데스크톱 Station이 통합 타임라인 및 의무기록 관리의 중심입니다.
                </p>
              </div>

              {/* 1. 환자 및 세션 요약 & 2. 현재 간호 행위 완료 상태 (예: 5/5) */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-base text-slate-900 dark:text-white">
                        {patient.name}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {patient.room} · {patient.gender}/{patient.age}세
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      처방: <strong className="text-slate-900 dark:text-slate-200">{prescription.medicationName}</strong> ({prescription.route})
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-800 block">
                      세션 #{currentSession.sessionNumber}
                    </span>
                    <span className={`text-[10px] font-bold mt-1 block ${completedStepsCount === 5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                      {completedStepsCount}/5 단계 {completedStepsCount === 5 ? '완료' : '진행'}
                    </span>
                  </div>
                </div>

                {/* 5-Rights & Clinical Procedure Mini Badges */}
                <div className="grid grid-cols-5 gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-center font-semibold">
                  <div className={`p-1 rounded-lg ${isPatientVerified ? 'bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                    1. 환자
                  </div>
                  <div className={`p-1 rounded-lg ${isMedicationVerified ? 'bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border border-sky-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                    2. 약물
                  </div>
                  <div className={`p-1 rounded-lg ${isIvSiteAssessed ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                    3. 사정
                  </div>
                  <div className={`p-1 rounded-lg ${hasInfusionStarted ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                    4. 투여
                  </div>
                  <div className={`p-1 rounded-lg ${hasInfusionEnded ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                    5. 종료
                  </div>
                </div>

                {/* Session ID & Live Sync status */}
                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5 truncate pr-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span className="font-mono truncate">{currentSession.sessionId}</span>
                  </div>
                  <button
                    type="button"
                    onClick={copySessionId}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition shrink-0"
                    title="세션 ID 복사"
                  >
                    {isCopiedSessionId ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* 3, 4, 5. Primary Action Hub (요구사항 3, 4, 5 핵심 버튼) */}
              <div
                id="mobile-quick-actions"
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 scroll-mt-20"
              >
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>주요 간호 작업 바로가기</span>
                </h4>

                <div className="space-y-2.5">
                  {/* 3. AI 간호기록 초안 생성 버튼 */}
                  <button
                    type="button"
                    onClick={scrollToMobileDraft}
                    className="w-full p-3.5 rounded-2xl border border-teal-300 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 text-left hover:bg-teal-100 dark:hover:bg-teal-900/40 transition flex items-center justify-between shadow-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900 dark:text-teal-200">
                        <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                        <span>{draftNote ? 'AI 간호기록 초안 (작성 완료)' : 'AI 간호기록 초안 생성'}</span>
                      </div>
                      <p className="text-[11px] text-teal-700 dark:text-teal-400">
                        {draftNote
                          ? '초안 작성 완료됨 · 클릭하여 상세 내용 열람 및 재작성'
                          : sessionEvents.length > 0
                          ? `현장 수집 이벤트 (${sessionEvents.length}건) 기반 AI 초안 생성하기`
                          : '현장 수집 이벤트 대기 중 (클릭 시 초안 작성기 이동)'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-300">
                        {draftNote ? '초안 완료' : '초안 생성'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    </div>
                  </button>

                  {/* 4. 기록 검토·수정 및 간호사 최종 승인 버튼 */}
                  <button
                    type="button"
                    onClick={scrollToMobileDraft}
                    className={`w-full p-3.5 rounded-2xl border text-left transition flex items-center justify-between shadow-xs ${
                      draftNote?.status === 'APPROVED'
                        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                        : draftNote
                        ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/60 text-slate-400 cursor-not-allowed opacity-80'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <CheckCircle2 className={`w-4 h-4 ${draftNote?.status === 'APPROVED' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
                        <span>
                          {draftNote?.status === 'APPROVED'
                            ? '간호사 최종 승인 완료 ✓'
                            : '기록 검토·수정 및 간호사 최종 승인'}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-90">
                        {draftNote?.status === 'APPROVED'
                          ? `${draftNote.approver || nurse.nurseName} 간호사 전자서명 완료 (클릭하여 승인본 열람)`
                          : draftNote
                          ? 'AI 초안 소견 검토, 오탈자 보완 및 간호사 전자서명 진행'
                          : 'AI 간호기록 초안 생성 후 검토 및 승인 가능'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        draftNote?.status === 'APPROVED'
                          ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                          : draftNote
                          ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {draftNote?.status === 'APPROVED' ? '승인 완료' : draftNote ? '검토 대기' : '초안 필요'}
                      </span>
                      <ChevronRight className="w-4 h-4 opacity-70" />
                    </div>
                  </button>

                  {/* 5. Mock EMR 전송 및 전송 결과 조회 버튼 */}
                  <button
                    type="button"
                    disabled={draftNote?.emrTransmitted || emrRecords.length > 0 ? false : !canWrite || draftNote?.status !== 'APPROVED'}
                    onClick={() => {
                      if (draftNote?.emrTransmitted || emrRecords.length > 0) {
                        setActiveTab('records');
                      } else if (draftNote?.status === 'APPROVED') {
                        onOpenEmrModal();
                      }
                    }}
                    className={`w-full p-3.5 rounded-2xl border text-left transition flex items-center justify-between shadow-xs ${
                      draftNote?.emrTransmitted || emrRecords.length > 0
                        ? 'border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-100 hover:bg-sky-100 dark:hover:bg-sky-900/40'
                        : draftNote?.status === 'APPROVED'
                        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/60 text-slate-400 cursor-not-allowed opacity-80'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <Database className={`w-4 h-4 ${draftNote?.emrTransmitted || emrRecords.length > 0 ? 'text-sky-600 dark:text-sky-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
                        <span>
                          {draftNote?.emrTransmitted || emrRecords.length > 0
                            ? `Mock EMR 전송 결과 조회 (${emrRecords.length}건)`
                            : 'Mock EMR 전송 및 결과 조회'}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-90">
                        {draftNote?.emrTransmitted || emrRecords.length > 0
                          ? '가상 EMR 시스템 전송 상세 및 전송 영수증 즉시 확인'
                          : draftNote?.status === 'APPROVED'
                          ? '간호기록 승인 완료됨 · 원내 Mock EMR 전송 시뮬레이션 실행'
                          : '간호사 최종 승인 완료 후 EMR 전송이 활성화됩니다'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        draftNote?.emrTransmitted || emrRecords.length > 0
                          ? 'bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200'
                          : draftNote?.status === 'APPROVED'
                          ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {draftNote?.emrTransmitted || emrRecords.length > 0 ? '전송 완료' : draftNote?.status === 'APPROVED' ? '전송 가능' : '승인 대기'}
                      </span>
                      <ChevronRight className="w-4 h-4 opacity-70" />
                    </div>
                  </button>

                  {/* Sub Quick Links: Capture mode & QR */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      disabled={!canWrite}
                      onClick={() => onSwitchMode('CAPTURE')}
                      className="p-2.5 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 text-left hover:bg-purple-100 transition flex items-center justify-between disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center gap-2">
                        <Camera className="w-3.5 h-3.5 text-purple-600" />
                        <span className="text-xs font-bold">Capture 모드</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-purple-400" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsQrModalOpen(true)}
                      className="p-2.5 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 text-left hover:bg-sky-100 transition flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-3.5 h-3.5 text-sky-600" />
                        <span className="text-xs font-bold">아이폰 QR</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-sky-400" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 6. '통합 간호 행위 타임라인 보기' 접기/펼치기 버튼 */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsMobileTimelineExpanded((prev) => !prev)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
                  aria-expanded={isMobileTimelineExpanded}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          통합 간호 행위 타임라인 보기
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                          {sessionEvents.length}건
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {isMobileTimelineExpanded ? '클릭하여 타임라인 접기' : '클릭하여 세부 간호행위 내역 펼치기'}
                      </p>
                    </div>
                  </div>
                  {isMobileTimelineExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </button>

                {isMobileTimelineExpanded && (
                  <div className="p-4 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-200">
                    <TimelineSection events={sessionEvents} />
                  </div>
                )}
              </div>

              {/* 4. Collapsible Detailed AI Draft & Editor (기본적으로 접기) */}
              <div
                id="mobile-draft-container"
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setIsMobileDraftExpanded((prev) => !prev)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
                  aria-expanded={isMobileDraftExpanded}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          AI 간호기록 상세 및 서명
                        </span>
                        {draftNote?.status === 'APPROVED' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            승인 완료
                          </span>
                        ) : draftNote ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            검토 대기
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {isMobileDraftExpanded ? '클릭하여 상세 기록 접기' : '초안 편집, 간호사 승인, 감사 이력'}
                      </p>
                    </div>
                  </div>
                  {isMobileDraftExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </button>

                {isMobileDraftExpanded && (
                  <div className="p-4 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-200">
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
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* ========================================================================= */}
      {/* MOBILE MORE MENU (Drawer / Bottom Sheet) - Handoff moved here */}
      {/* ========================================================================= */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Menu className="w-4 h-4 text-teal-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  간호 스테이션 더보기 메뉴
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {/* 간호사 교대 관리 (Moved from fixed floating button on mobile) */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenHandoff?.();
                }}
                className="w-full p-3 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-800 text-left flex items-center justify-between text-teal-900 dark:text-teal-100 hover:bg-teal-100 transition"
              >
                <div className="flex items-center gap-3">
                  <UserCheck className="w-5 h-5 text-teal-600" />
                  <div>
                    <span className="font-bold text-xs block">간호사 교대 관리</span>
                    <span className="text-[11px] text-teal-700 dark:text-teal-400">
                      다음 간호사에게 세션 참여 승인 및 담당 인계
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-teal-500" />
              </button>

              {/* 가상 EMR 기록원 */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setActiveTab('records');
                }}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-left flex items-center justify-between text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-slate-500" />
                  <div>
                    <span className="font-bold text-xs block">가상 EMR 기록원</span>
                    <span className="text-[11px] text-slate-400">
                      전송된 EMR 기록 ({emrRecords.length}건) 조회
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* 라벨 준비실 */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setActiveTab('prep');
                }}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-left flex items-center justify-between text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <div className="flex items-center gap-3">
                  <Printer className="w-5 h-5 text-slate-500" />
                  <div>
                    <span className="font-bold text-xs block">라벨 준비실</span>
                    <span className="text-[11px] text-slate-400">
                      환자 손목밴드 및 약물 1D 바코드 인쇄/미리보기
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* 새 시연 세션 시작 */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsSessionConfirmOpen(true);
                }}
                className="w-full p-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-left flex items-center justify-between text-amber-900 dark:text-amber-100 hover:bg-amber-100 transition"
              >
                <div className="flex items-center gap-3">
                  <RotateCcw className="w-5 h-5 text-amber-600" />
                  <div>
                    <span className="font-bold text-xs block">새 시연 세션 시작</span>
                    <span className="text-[11px] text-amber-700 dark:text-amber-400">
                      현재 세션 유지 및 신규 클라우드 세션 생성
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-500" />
              </button>

              {/* 시스템 진단 */}
              {onOpenDiagnostics && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenDiagnostics();
                  }}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-left flex items-center justify-between text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <div className="flex items-center gap-3">
                    <Terminal className="w-5 h-5 text-teal-600" />
                    <div>
                      <span className="font-bold text-xs block">시스템 및 동기화 진단</span>
                      <span className="text-[11px] text-slate-400">
                        Firestore 실시간 리스너 및 캐시 상태 점검
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              )}

              {/* Firebase 가이드 */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenFirebaseGuide();
                }}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-left flex items-center justify-between text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-amber-600" />
                  <div>
                    <span className="font-bold text-xs block">Firebase 연동 가이드</span>
                    <span className="text-[11px] text-slate-400">
                      보안 규칙 및 Firestore 클라우드 설정 정보
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* 화면 모드 전환 (라이트/다크 모드) */}
              <button
                type="button"
                onClick={() => {
                  onToggleDarkMode();
                }}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-left flex items-center justify-between text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 flex items-center justify-center text-sm">
                    {isDarkMode ? '☀️' : '🌙'}
                  </div>
                  <div>
                    <span className="font-bold text-xs block">
                      화면 모드 전환 ({isDarkMode ? '다크 모드' : '라이트 모드'})
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {isDarkMode ? '밝은 라이트 테마로 변경' : '어두운 다크 테마로 변경'}
                    </span>
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono font-bold text-slate-600 dark:text-slate-300">
                  {isDarkMode ? 'DARK' : 'LIGHT'}
                </span>
              </button>

              {/* 포털 시작 화면 */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onSwitchMode('PORTAL');
                }}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-left flex items-center justify-between text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <div className="flex items-center gap-3">
                  <Monitor className="w-5 h-5 text-slate-500" />
                  <div>
                    <span className="font-bold text-xs block">포털 시작 화면</span>
                    <span className="text-[11px] text-slate-400">모드 선택 포털로 복귀</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      )}

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
                  현재 세션(#{currentSession.sessionNumber})의 기록은 PC 시연 기록 보관함에서 계속 조회할 수 있고, 신규 클라우드 세션으로 이동합니다.
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
