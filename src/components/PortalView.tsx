import React, { useState, useEffect } from 'react';
import {
  Monitor,
  Smartphone,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Database,
  Activity,
  CheckCircle2,
  Info,
  Clock,
  Layers,
  HeartPulse,
} from 'lucide-react';
import { AppMode } from '../types';
import { StorageService } from '../services/storageService';

interface PortalViewProps {
  onSelectMode: (mode: AppMode, rememberPreference: boolean) => void;
  onOpenFirebaseGuide: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const PortalView: React.FC<PortalViewProps> = ({
  onSelectMode,
  onOpenFirebaseGuide,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const [rememberPreference, setRememberPreference] = useState(true);
  const [detectedType, setDetectedType] = useState<'DESKTOP' | 'MOBILE'>('DESKTOP');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isMobileAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      const isNarrowScreen = window.innerWidth <= 768;
      const isTouchOnly = 'ontouchstart' in window && navigator.maxTouchPoints > 0;

      if (isMobileAgent || (isNarrowScreen && isTouchOnly)) {
        setDetectedType('MOBILE');
      } else {
        setDetectedType('DESKTOP');
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-teal-50/20 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-8">
      {/* Top Header */}
      <div className="max-w-5xl mx-auto w-full flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black shadow-md shadow-teal-600/20">
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
                NurseFlow AI
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-bold border border-teal-300 dark:border-teal-800">
                STEP 3-A
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              차세대 스마트 간호 행위 수집 및 AI 의무기록 지원 시스템
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenFirebaseGuide}
            className="text-xs px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition flex items-center gap-1.5 font-semibold"
          >
            <Database className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Firebase 연동 준비 안내</span>
            <span className="sm:hidden">Firebase</span>
          </button>

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

      {/* Main Mode Selection Card Grid */}
      <div className="max-w-4xl mx-auto w-full my-auto py-8 space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100/80 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 text-xs font-semibold border border-teal-200 dark:border-teal-800">
            <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>기기 맞춤형 듀얼 뷰포트 아키텍처</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            접속하실 간호 작업 화면을 선택하세요
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed">
            NurseFlow AI는 PC용 <strong>간호사 스테이션</strong>과 스마트폰용 <strong>현장 수집기</strong>로 분리되어
            하나의 시연 세션 및 환자 타임라인을 실시간으로 상호 연동합니다.
          </p>
        </div>

        {/* 2 Mode Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: NurseFlow Station (PC) */}
          <div
            onClick={() => onSelectMode('STATION', rememberPreference)}
            className={`group relative rounded-3xl p-6 sm:p-7 border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
              detectedType === 'DESKTOP'
                ? 'bg-white dark:bg-slate-900 border-teal-500 shadow-xl shadow-teal-500/10 ring-2 ring-teal-400/30'
                : 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-teal-400 shadow-md'
            }`}
          >
            {detectedType === 'DESKTOP' && (
              <div className="absolute -top-3 right-6 px-3 py-0.5 rounded-full bg-teal-600 text-white text-[11px] font-bold shadow-md flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>현재 기기(PC) 추천</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <Monitor className="w-7 h-7" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition">
                    NurseFlow Station
                  </h2>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                    PC 전용
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  병동 간호사 데스크용 통합 관리 및 AI 간호기록 대시보드
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                  <span>실시간 간호 행위 타임라인 모니터링 (Capture 연동)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                  <span>Gemini AI 간호기록 자동 초안 생성 및 수정</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                  <span>간호사 검토·전자서명 및 가상 EMR 전송 관리</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                  <span>시연 준비실 (환자 QR / 약물 바코드 라벨 인쇄)</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 flex items-center justify-between text-teal-700 dark:text-teal-300 font-bold text-sm">
              <span>스테이션 화면으로 시작하기</span>
              <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-950 flex items-center justify-center group-hover:translate-x-1 transition">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Card 2: NurseFlow Capture (Mobile) */}
          <div
            onClick={() => onSelectMode('CAPTURE', rememberPreference)}
            className={`group relative rounded-3xl p-6 sm:p-7 border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
              detectedType === 'MOBILE'
                ? 'bg-white dark:bg-slate-900 border-sky-500 shadow-xl shadow-sky-500/10 ring-2 ring-sky-400/30'
                : 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-sky-400 shadow-md'
            }`}
          >
            {detectedType === 'MOBILE' && (
              <div className="absolute -top-3 right-6 px-3 py-0.5 rounded-full bg-sky-600 text-white text-[11px] font-bold shadow-md flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>현재 기기(스마트폰) 추천</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <Smartphone className="w-7 h-7" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition">
                    NurseFlow Capture
                  </h2>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                    모바일 현장용
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  스마트폰 및 향후 스마트 안경/웨어러블을 대체하는 현장 데이터 수집기
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                  <span>실제 후면 카메라 기반 환자 QR 손목밴드 스캔</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                  <span>ZXing Code 128 약물 바코드 정밀 광학 스캔</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                  <span>실시간 마이크 음성 간호 입력 (Web Speech API)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                  <span>IV site 사정 및 투여 시작/종료 시각 자동 전송</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 flex items-center justify-between text-sky-700 dark:text-sky-300 font-bold text-sm">
              <span>현장 수집 화면으로 시작하기</span>
              <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-950 flex items-center justify-center group-hover:translate-x-1 transition">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Preference Checkbox */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-xs text-slate-500 dark:text-slate-400 pt-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberPreference}
              onChange={(e) => setRememberPreference(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
            />
            <span>이 기기에서 선택한 모드를 기억하고 다음 접속 시 바로 이동</span>
          </label>

          <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>

          <span className="text-[11px]">
            ※ 진입 후에도 상단 스위처를 통해 언제든지 자유롭게 모드를 전환할 수 있습니다.
          </span>
        </div>
      </div>

      {/* Bottom Footer Info */}
      <div className="max-w-5xl mx-auto w-full pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>로컬 실시간 채널(BroadcastChannel) 동기화 대기 중</span>
        </div>
        <div>
          <span>NurseFlow AI © 2026. Hospital Nursing Innovation System.</span>
        </div>
      </div>
    </div>
  );
};
