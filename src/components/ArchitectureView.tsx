import React from 'react';
import {
  Layers,
  QrCode,
  Barcode,
  Mic,
  Glasses,
  Watch,
  Database,
  Cpu,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Play,
} from 'lucide-react';
import { EventSource, NursingEvent } from '../types';

interface ArchitectureViewProps {
  onInjectSimulatedDeviceEvent: (source: EventSource, description: string) => void;
  onBackToWorkflow: () => void;
}

export const ArchitectureView: React.FC<ArchitectureViewProps> = ({
  onInjectSimulatedDeviceEvent,
  onBackToWorkflow,
}) => {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white border border-teal-900/50 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
                <Layers className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-bold">
                NurseFlow AI 시스템 아키텍처 및 기기 확장성
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              웨어러블, 스마트 안경, 바코드/QR 리더, 음성 인식 등 다양한 디바이스 이벤트를 단일 <strong>통합 간호 이벤트 버스(Unified Nursing Event Bus)</strong>로 수렴하여 AI 초안 생성 엔진과 완벽히 연동되는 확장형 구조입니다.
            </p>
          </div>

          <button
            type="button"
            onClick={onBackToWorkflow}
            className="self-start sm:self-center px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold text-xs shadow-md shadow-teal-500/20 transition-all"
          >
            메인 워크플로우로 돌아가기
          </button>
        </div>
      </div>

      {/* Architecture Pipeline Visual Diagram */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 sm:p-6 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          엔드-투-엔드(End-to-End) 데이터 파이프라인
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative">
          {/* Step 1: Input Modalities */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">1. 다중 입력 디바이스</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 font-bold">확장형</span>
            </div>
            <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                모바일/태블릿 원터치 확인 (STEP 1)
              </li>
              <li className="flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-sky-500" />
                환자 손목밴드 QR 스캔
              </li>
              <li className="flex items-center gap-1.5">
                <Barcode className="w-3.5 h-3.5 text-indigo-500" />
                약품 바코드/GS1 리더기
              </li>
              <li className="flex items-center gap-1.5">
                <Glasses className="w-3.5 h-3.5 text-amber-500" />
                스마트 안경 시야각 자동 인식
              </li>
              <li className="flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-rose-500" />
                간호사 음성 받아쓰기 (STT)
              </li>
            </ul>
          </div>

          {/* Step 2: Unified Event Pipeline */}
          <div className="p-4 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-900 dark:text-teal-200">2. 공통 이벤트 버스</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-teal-200 dark:bg-teal-900 text-teal-900 dark:text-teal-200 font-mono font-bold">Standard</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              모든 디바이스 이벤트는 정형화된 <strong className="font-mono text-teal-700 dark:text-teal-300">NursingEvent</strong> 구조체로 규격화되어 불변 타임라인으로 누적됩니다.
            </p>
            <div className="p-2 rounded bg-white dark:bg-slate-900 font-mono text-[10px] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              EventId, Timestamp, Source, Type, Status, Metadata
            </div>
          </div>

          {/* Step 3: AI Documentation Engine */}
          <div className="p-4 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-900 dark:text-sky-200">3. Gemini 임상기록 AI</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-sky-200 dark:bg-sky-900 text-sky-900 dark:text-sky-200 font-bold">AI Studio</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              누적된 사실(Fact) 로그만을 근거로 표준 임상 간호 문체 초안 생성. 비존재 데이터 날조(Hallucination) 원천 차단 및 간호사 최종 승인 루프.
            </p>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
              <Sparkles className="w-3 h-3" />
              Human-in-the-Loop 승인 필수
            </div>
          </div>

          {/* Step 4: EMR Integration Layer */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">4. EMR 전송 어댑터</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono font-bold">FHIR/HL7</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              승인된 간호기록을 공유 Mock EMR에 저장하고 시연용 식별값을 표시합니다. 실제 전자서명이나 병원 HIS/EMR 전송은 수행하지 않습니다.
            </p>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              <Database className="w-3 h-3" />
              중복 방지 & 감사 추적 보장
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Device Simulation Sandbox for Evaluators */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Watch className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              경진대회 심사위원용 디바이스 모의 주입기 (Device Event Simulation)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              아래 버튼을 누르면 웨어러블/QR/스마트안경 이벤트가 즉시 동일한 타임라인에 누적되어 AI 엔진으로 전달되는 확장성을 직접 검증할 수 있습니다.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Inject QR Wristband Scan */}
          <button
            type="button"
            onClick={() =>
              onInjectSimulatedDeviceEvent(
                'QR Wristband Scan',
                '환자 손목밴드 2D 바코드 스캐너 인식 (TEST-P001)'
              )
            }
            className="p-3.5 rounded-xl border border-sky-300 dark:border-sky-800/80 bg-sky-50/50 dark:bg-sky-950/20 text-left hover:bg-sky-100/60 dark:hover:bg-sky-900/40 transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <QrCode className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-200 dark:bg-sky-900 text-sky-800 dark:text-sky-200">
                시뮬레이션
              </span>
            </div>
            <h4 className="font-bold text-xs text-slate-900 dark:text-white">
              손목밴드 QR 인식
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              QR Wristband Scan 이벤트 타임라인 주입
            </p>
          </button>

          {/* Inject Medication Barcode Scan */}
          <button
            type="button"
            onClick={() =>
              onInjectSimulatedDeviceEvent(
                'Barcode Scan',
                '약물 앰플 1D 바코드 자동 식별 (모의 항생제 GS1 코드)'
              )
            }
            className="p-3.5 rounded-xl border border-indigo-300 dark:border-indigo-800/80 bg-indigo-50/50 dark:bg-indigo-950/20 text-left hover:bg-indigo-100/60 dark:hover:bg-indigo-900/40 transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <Barcode className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                시뮬레이션
              </span>
            </div>
            <h4 className="font-bold text-xs text-slate-900 dark:text-white">
              약물 바코드 스캔
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Barcode Scan 이벤트 타임라인 주입
            </p>
          </button>

          {/* Inject Smart Glasses Event */}
          <button
            type="button"
            onClick={() =>
              onInjectSimulatedDeviceEvent(
                'Wearable Sensor',
                '스마트 안경 카메라 시선 추적: IV 점적 속도(gtt) 및 수액 챔버 확인'
              )
            }
            className="p-3.5 rounded-xl border border-teal-300 dark:border-teal-800/80 bg-teal-50/50 dark:bg-teal-950/20 text-left hover:bg-teal-100/60 dark:hover:bg-teal-900/40 transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <Glasses className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-200 dark:bg-teal-900 text-teal-800 dark:text-teal-200">
                시뮬레이션
              </span>
            </div>
            <h4 className="font-bold text-xs text-slate-900 dark:text-white">
              스마트 안경 센서
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Wearable Sensor 이벤트 타임라인 주입
            </p>
          </button>

          {/* Inject Voice Note Event */}
          <button
            type="button"
            onClick={() =>
              onInjectSimulatedDeviceEvent(
                'Voice Command',
                '음성 명령: "홍길동 환자 모의 항생제 A 투여 시작 완료"'
              )
            }
            className="p-3.5 rounded-xl border border-rose-300 dark:border-rose-800/80 bg-rose-50/50 dark:bg-rose-950/20 text-left hover:bg-rose-100/60 dark:hover:bg-rose-900/40 transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <Mic className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
                시뮬레이션
              </span>
            </div>
            <h4 className="font-bold text-xs text-slate-900 dark:text-white">
              간호사 음성 입력
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Voice Command 이벤트 타임라인 주입
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};
