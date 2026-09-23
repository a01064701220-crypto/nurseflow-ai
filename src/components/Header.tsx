import React, { useEffect, useState } from 'react';
import {
  Activity,
  Moon,
  Sun,
  RotateCcw,
  Database,
  Layers,
  Clock,
  ShieldAlert,
  Smartphone,
  Printer,
  Menu,
  X,
  User,
  ChevronRight,
} from 'lucide-react';

export type TabType = 'workflow' | 'mobile' | 'timeline' | 'prep' | 'emr' | 'architecture';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  onResetDemo: () => void;
  emrCount: number;
  sessionNumber?: number;
  eventsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isDarkMode,
  toggleDarkMode,
  onResetDemo,
  emrCount,
  sessionNumber = 1,
  eventsCount = 0,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('ko-KR', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setCurrentDate(
        now.toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          weekday: 'short',
        })
      );
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md border-b transition-colors bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-18">
            {/* Brand Logo & Slogan */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-sky-400 flex items-center justify-center text-white shadow-md shadow-teal-500/20 shrink-0">
                <Activity className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    NurseFlow <span className="text-teal-600 dark:text-teal-400">AI</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60">
                    <ShieldAlert className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    STEP 2
                  </span>
                </div>
                <p className="hidden md:block text-xs text-slate-500 dark:text-slate-400 font-medium">
                  간호사는 환자에게 집중하고, 기록은 AI가 보조합니다.
                </p>
              </div>
            </div>

            {/* Desktop Center Navigation Tabs */}
            <nav className="hidden lg:flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('workflow')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'workflow'
                    ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                간호 워크플로우 & AI 기록
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('mobile')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'mobile'
                    ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 text-indigo-500" />
                스마트 모바일 뷰
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('prep')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'prep'
                    ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Printer className="w-3.5 h-3.5 text-amber-500" />
                시연 준비 (QR/바코드)
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('emr')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 relative ${
                  activeTab === 'emr'
                    ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                가상 EMR 통합 뷰어
                {emrCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-teal-500 text-white font-bold">
                    {emrCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('architecture')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'architecture'
                    ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                확장 아키텍처
              </button>
            </nav>

            {/* Desktop Right Controls */}
            <div className="hidden lg:flex items-center gap-2 sm:gap-3">
              {/* Live Clock */}
              <div className="flex flex-col items-end pr-2 border-r border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1 text-xs font-mono font-semibold text-slate-800 dark:text-slate-200">
                  <Clock className="w-3 h-3 text-teal-500" />
                  {currentTime}
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {currentDate}
                </span>
              </div>

              {/* Nurse Badge */}
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 flex items-center justify-center text-xs font-bold">
                  양
                </div>
                <div className="text-left leading-tight">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    양두영 <span className="font-normal text-[11px] text-slate-500 dark:text-slate-400">간호사</span>
                  </p>
                  <p className="text-[10px] text-teal-600 dark:text-teal-400">
                    내과 병동 5W (세션 #{sessionNumber})
                  </p>
                </div>
              </div>

              {/* Reset / New Session Button */}
              <button
                type="button"
                onClick={onResetDemo}
                title="새 시연 세션 시작"
                aria-label="새 시연 세션 시작"
                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Dark / Light Toggle */}
              <button
                type="button"
                onClick={toggleDarkMode}
                title={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
                aria-label="테마 전환"
                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {isDarkMode ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-600" />
                )}
              </button>
            </div>

            {/* Mobile Top Controls: Only Theme Toggle and More Menu */}
            <div className="flex lg:hidden items-center gap-1.5">
              <button
                type="button"
                onClick={toggleDarkMode}
                title={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
                aria-label="테마 전환"
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {isDarkMode ? (
                  <Sun className="w-5 h-5 text-amber-400" />
                ) : (
                  <Moon className="w-5 h-5 text-slate-600" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                title="더보기 메뉴 열기"
                aria-label="더보기 메뉴"
                className="p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile More Menu Modal / Drawer */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="w-full max-w-xs bg-white dark:bg-slate-900 h-full shadow-2xl p-5 flex flex-col justify-between border-l border-slate-200 dark:border-slate-800 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                    <User className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    간호사 프로필 & 설정
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Dedicated Nurse Profile Card */}
              <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500 text-white flex items-center justify-center font-bold text-base shadow-sm">
                    양
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      양두영 간호사
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      내과 병동 5W
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-400">EMR 담당자 ID:</span>
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                    NURSE-YDY-5W
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">현재 시연 세션:</span>
                  <span className="font-semibold text-teal-600 dark:text-teal-400">
                    세션 #{sessionNumber}
                  </span>
                </div>
              </div>

              {/* New Session Action */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onResetDemo();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-100 font-bold text-xs flex items-center justify-center gap-2 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                새 시연 세션 시작 (New Session)
              </button>

              {/* Additional Menus: Prep, Architecture */}
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  추가 시연 도구
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('prep');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full p-2.5 rounded-xl flex items-center justify-between text-xs font-semibold transition ${
                    activeTab === 'prep'
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Printer className="w-4 h-4 text-amber-500" />
                    시연 준비 (QR·바코드 인쇄)
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('architecture');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full p-2.5 rounded-xl flex items-center justify-between text-xs font-semibold transition ${
                    activeTab === 'architecture'
                      ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-teal-500" />
                    확장 아키텍처 & 웨어러블
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('emr');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full p-2.5 rounded-xl flex items-center justify-between text-xs font-semibold transition ${
                    activeTab === 'emr'
                      ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-sky-500" />
                    가상 EMR 이력 ({emrCount})
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Close Button in drawer footer */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Fixed Bottom Navigation (아이폰 Safe Area 고려) */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom,12px)] pt-1.5 px-2 shadow-lg lg:hidden">
        <div className="grid grid-cols-4 gap-1 max-w-md mx-auto">
          {/* 1. 워크플로우 */}
          <button
            type="button"
            onClick={() => setActiveTab('workflow')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition active:scale-95 ${
              activeTab === 'workflow'
                ? 'text-teal-600 dark:text-teal-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'workflow' ? 'bg-teal-500/10' : ''}`}>
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-[10px] sm:text-[11px] tracking-tight truncate w-full text-center">
              워크플로우
            </span>
          </button>

          {/* 2. 모바일 모드 */}
          <button
            type="button"
            onClick={() => setActiveTab('mobile')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition active:scale-95 ${
              activeTab === 'mobile'
                ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'mobile' ? 'bg-indigo-500/10' : ''}`}>
              <Smartphone className="w-5 h-5" />
            </div>
            <span className="text-[10px] sm:text-[11px] tracking-tight truncate w-full text-center">
              모바일 모드
            </span>
          </button>

          {/* 3. 타임라인 */}
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition active:scale-95 relative ${
              activeTab === 'timeline'
                ? 'text-teal-600 dark:text-teal-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
          >
            <div className={`p-1 rounded-lg relative ${activeTab === 'timeline' ? 'bg-teal-500/10' : ''}`}>
              <Clock className="w-5 h-5" />
              {eventsCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[9px] bg-teal-500 text-white font-bold">
                  {eventsCount}
                </span>
              )}
            </div>
            <span className="text-[10px] sm:text-[11px] tracking-tight truncate w-full text-center">
              타임라인
            </span>
          </button>

          {/* 4. 가상 EMR */}
          <button
            type="button"
            onClick={() => setActiveTab('emr')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition active:scale-95 relative ${
              activeTab === 'emr'
                ? 'text-sky-600 dark:text-sky-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
          >
            <div className={`p-1 rounded-lg relative ${activeTab === 'emr' ? 'bg-sky-500/10' : ''}`}>
              <Database className="w-5 h-5" />
              {emrCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[9px] bg-sky-500 text-white font-bold">
                  {emrCount}
                </span>
              )}
            </div>
            <span className="text-[10px] sm:text-[11px] tracking-tight truncate w-full text-center">
              가상 EMR
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};
