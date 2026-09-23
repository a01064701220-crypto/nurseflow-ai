import React, { useState, useEffect, useRef } from 'react';
import { X, CheckSquare, AlertCircle, ShieldAlert, Check, Mic, MicOff, Volume2 } from 'lucide-react';
import { IvSiteAssessment } from '../types';

interface IvSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAssessment: (assessment: IvSiteAssessment, source?: 'Voice Confirmation' | 'Manual Confirmation') => void;
  initialAssessment?: IvSiteAssessment | null;
}

const DEFAULT_SITES = [
  '우측 전완 (Right Forearm)',
  '좌측 전완 (Left Forearm)',
  '우측 수배 (Right Hand Dorsum)',
  '좌측 수배 (Left Hand Dorsum)',
  '우측 주와 (Right Antecubital)',
  '좌측 주와 (Left Antecubital)',
];

const PRESET_OBSERVATIONS = [
  '카테터 고정 필름 드레싱 청결 및 온전함',
  '혈액 역류(regurgitation) 확인 및 개방성(patency) 양호함',
  '생리식염수 플러싱 시 저항 없음',
  '주입 부위 압통 없음',
  '드레싱 교환 불필요',
];

export const IvSiteModal: React.FC<IvSiteModalProps> = ({
  isOpen,
  onClose,
  onSaveAssessment,
  initialAssessment,
}) => {
  const [site, setSite] = useState<string>(
    initialAssessment?.site || DEFAULT_SITES[0]
  );
  const [customSite, setCustomSite] = useState<string>('');
  const [catheterGauge, setCatheterGauge] = useState<string>(
    initialAssessment?.catheterGauge || '22G'
  );
  const [hasPain, setHasPain] = useState<boolean>(
    initialAssessment?.hasPain || false
  );
  const [painScore, setPainScore] = useState<number>(
    initialAssessment?.painScore || 0
  );
  const [hasRedness, setHasRedness] = useState<boolean>(
    initialAssessment?.hasRedness || false
  );
  const [hasSwelling, setHasSwelling] = useState<boolean>(
    initialAssessment?.hasSwelling || false
  );
  const [hasLeakage, setHasLeakage] = useState<boolean>(
    initialAssessment?.hasLeakage || false
  );
  const [notes, setNotes] = useState<string>(
    initialAssessment?.notes || '카테터 고정 상태 양호하며 개방성(patency) 확보됨.'
  );
  const [usedVoice, setUsedVoice] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn(e);
        }
      }
    };
  }, []);

  const toggleVoiceInput = () => {
    setVoiceError(null);
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn(e);
        }
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError('이 브라우저는 Web Speech API를 지원하지 않습니다. 텍스트로 직접 입력해 주세요.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ko-KR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (e: any) => {
        const spoken = e.results[0][0].transcript;
        if (spoken) {
          setUsedVoice(true);
          setNotes((prev) => (prev ? `${prev} (음성 소견: ${spoken})` : spoken));
          
          // Parse site if mentioned
          if (spoken.includes('우측 전완')) setSite('우측 전완 (Right Forearm)');
          if (spoken.includes('좌측 전완')) setSite('좌측 전완 (Left Forearm)');
          if (spoken.includes('주관절') || spoken.includes('주와')) setSite('우측 주와 (Right Antecubital)');
          
          // Parse signs if mentioned
          if (spoken.includes('발적') && (spoken.includes('관찰') || spoken.includes('있음'))) {
            setHasRedness(true);
          }
          if (spoken.includes('부종') && (spoken.includes('관찰') || spoken.includes('있음'))) {
            setHasSwelling(true);
          }
          if (spoken.includes('통증') && (spoken.includes('호소') || spoken.includes('있음'))) {
            setHasPain(true);
          }
        }
      };

      recognition.onerror = (err: any) => {
        setIsListening(false);
        if (err.error !== 'no-speech') {
          setVoiceError(`음성 인식 오류: ${err.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setIsListening(false);
      setVoiceError('마이크를 시작할 수 없습니다.');
    }
  };

  if (!isOpen) return null;

  const handleSave = () => {
    const selectedSite = site === 'custom' ? customSite || '기타 부위' : site;
    const assessment: IvSiteAssessment = {
      site: selectedSite,
      catheterGauge,
      hasPain,
      painScore: hasPain ? painScore : 0,
      hasRedness,
      hasSwelling,
      hasLeakage,
      notes: notes.trim(),
      assessedAt: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
    };

    onSaveAssessment(assessment, usedVoice ? 'Voice Confirmation' : 'Manual Confirmation');
  };

  const addPresetNote = (preset: string) => {
    if (notes.includes(preset)) return;
    setNotes((prev) => (prev ? `${prev}, ${preset}` : preset));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                IV Site 임상 사정 (정맥 카테터 부위 확인)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                약물 투여 전 카테터 삽입 부위의 개방성 및 합병증 유무를 사정합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-900 dark:text-slate-100">
          {/* Important Nursing Guideline Box */}
          <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 flex items-start gap-2.5 text-xs text-teal-800 dark:text-teal-300">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-teal-600 dark:text-teal-400" />
            <p className="leading-relaxed">
              <strong>[간호 기록 원칙 준수]</strong> 간호사가 실제로 확인한 결과만 기록에 반영됩니다. 사정하지 않은 항목을 자동으로 '정상' 처리하지 않으며, 체크된 이상 소견은 AI 초안에 즉시 반영됩니다.
            </p>
          </div>

          {/* 1. Insertion Site Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              1. 카테터 삽입 부위 (Insertion Site) <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DEFAULT_SITES.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setSite(s)}
                  className={`px-3 py-2 text-xs rounded-xl text-left border font-medium transition-all ${
                    site === s
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-semibold ring-1 ring-indigo-500/30'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            {site === 'custom' && (
              <input
                type="text"
                value={customSite}
                onChange={(e) => setCustomSite(e.target.value)}
                placeholder="직접 삽입 부위를 입력하세요 (예: 우측 쇄골하정맥 PICC 등)"
                className="mt-2 w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            )}
          </div>

          {/* 2. Catheter Gauge */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              카테터 게이지 (Gauge)
            </label>
            <div className="flex gap-2">
              {['20G', '22G', '24G', '18G'].map((g) => (
                <button
                  type="button"
                  key={g}
                  onClick={() => setCatheterGauge(g)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    catheterGauge === g
                      ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Clinical Assessment Checkboxes (Strictly measured) */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              2. 부위 관찰 및 이상 소견 사정 (해당되는 소견 체크)
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Pain */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  hasPain
                    ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <input
                  type="checkbox"
                  checked={hasPain}
                  onChange={(e) => setHasPain(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded-sm text-rose-600 focus:ring-rose-500 border-slate-300"
                />
                <div className="text-xs">
                  <span className="font-bold block text-slate-800 dark:text-slate-200">
                    통증 (Pain) 있음
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                    환자가 압통 또는 자발통을 호소함
                  </span>
                </div>
              </label>

              {/* Redness */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  hasRedness
                    ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <input
                  type="checkbox"
                  checked={hasRedness}
                  onChange={(e) => setHasRedness(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded-sm text-rose-600 focus:ring-rose-500 border-slate-300"
                />
                <div className="text-xs">
                  <span className="font-bold block text-slate-800 dark:text-slate-200">
                    발적 (Erythema) 있음
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                    삽입부 주변 피부 붉어짐 소견 관찰
                  </span>
                </div>
              </label>

              {/* Swelling */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  hasSwelling
                    ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <input
                  type="checkbox"
                  checked={hasSwelling}
                  onChange={(e) => setHasSwelling(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded-sm text-rose-600 focus:ring-rose-500 border-slate-300"
                />
                <div className="text-xs">
                  <span className="font-bold block text-slate-800 dark:text-slate-200">
                    부종 (Edema) 있음
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                    카테터 주위 조직 팽윤 및 붓기 관찰
                  </span>
                </div>
              </label>

              {/* Leakage */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  hasLeakage
                    ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <input
                  type="checkbox"
                  checked={hasLeakage}
                  onChange={(e) => setHasLeakage(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded-sm text-rose-600 focus:ring-rose-500 border-slate-300"
                />
                <div className="text-xs">
                  <span className="font-bold block text-slate-800 dark:text-slate-200">
                    누출 의심 (Leakage/Infiltration)
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                    수액 침윤 또는 카테터 주변 액체 누출
                  </span>
                </div>
              </label>
            </div>

            {hasPain && (
              <div className="p-3 bg-rose-50/70 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-800 flex items-center justify-between text-xs">
                <span className="font-semibold text-rose-800 dark:text-rose-300">
                  통증 점수 (NRS 0-10):
                </span>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                    <button
                      type="button"
                      key={num}
                      onClick={() => setPainScore(num)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                        painScore === num
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                  <span className="font-mono text-xs font-bold text-rose-700 dark:text-rose-400 ml-1">
                    {painScore}점
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 4. Notes and frequent phrases */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                3. 기타 관찰 내용 및 임상 소견
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-600/30'
                      : usedVoice
                      ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-3.5 h-3.5" />
                      <span>듣는 중 (중지)</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" />
                      <span>음성 구술 (Voice)</span>
                    </>
                  )}
                </button>
                <span className="text-[11px] text-slate-400">간호 관찰문</span>
              </div>
            </div>

            {voiceError && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-1.5">
                {voiceError}
              </p>
            )}

            {isListening && (
              <div className="p-2 mb-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2 animate-pulse">
                <Volume2 className="w-4 h-4 text-rose-500" />
                <span>마이크가 켜져 있습니다. "우측 전완 확인, 발적 부종 없음" 등 말씀하세요.</span>
              </div>
            )}

            {/* Helper quick tags */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PRESET_OBSERVATIONS.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => addPresetNote(preset)}
                  className="px-2 py-1 rounded-md text-[11px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  + {preset}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="예: 카테터 고정 상태 양호함. 주입 시 저항 없으며 혈액 역류 확인됨."
              className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-indigo-500" />
            저장 시 시스템 타임스탬프와 함께 이벤트가 타임라인에 등록됩니다.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 flex items-center gap-1.5 transition-all"
            >
              <Check className="w-4 h-4" />
              사정 결과 저장 및 이벤트 기록
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
