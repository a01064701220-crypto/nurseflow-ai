import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, MicOff, CheckCircle2, AlertCircle, Sparkles, Volume2, Edit3, Tag } from 'lucide-react';

interface VoiceNursingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmVoiceEvent: (
    confirmedText: string,
    linkedStep?: string,
    extractedFindings?: { site?: string; hasPain?: boolean; hasRedness?: boolean; hasSwelling?: boolean },
    asWorkflowAction?: boolean
  ) => void;
  initialCategory?: string;
}

export const VoiceNursingModal: React.FC<VoiceNursingModalProps> = ({
  isOpen,
  onClose,
  onConfirmVoiceEvent,
  initialCategory = 'IV_SITE_ASSESS',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [selectedLinkedStep, setSelectedLinkedStep] = useState<string>(initialCategory);
  const [micSupported, setMicSupported] = useState(true);
  const [micError, setMicError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Quick preset voice phrases from clinical guidelines (purely for quick text autofill)
  const samplePhrases = [
    {
      linkedStep: 'IV_SITE_ASSESS',
      title: 'IV Site 정상 소견',
      text: '우측 전완 정맥주사 부위 확인했습니다. 발적과 부종, 통증은 관찰되지 않았습니다.',
    },
    {
      linkedStep: 'INFUSION_START',
      title: '투여 시작',
      text: '모의 IV 항생제 점적 투여 시작했습니다. 주입 속도 및 라인 개방성 확인 완료했습니다.',
    },
    {
      linkedStep: 'INFUSION_END',
      title: '투여 종료',
      text: '모의 IV 항생제 전량 투여 완료되어 점적 투여 종료했습니다.',
    },
  ];

  // Check speech recognition API support
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicSupported(false);
      setMicError('현재 브라우저에서는 실시간 음성 인식(Web Speech API)을 직접 지원하지 않습니다. 아래 텍스트 입력창을 이용하거나 샘플 문구를 터치해 주세요.');
    } else {
      setMicSupported(true);
      setMicError(null);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSelectedLinkedStep(initialCategory);
      setTranscript('');
      setMicError(null);
    } else {
      stopRecording();
    }
  }, [isOpen, initialCategory]);

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn(e);
      }
      recognitionRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setIsRecording(false);
    setAudioLevel(0);
  };

  const startRecording = async () => {
    setMicError(null);
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicSupported(false);
      setMicError('현재 브라우저에서 마이크 음성 인식이 지원되지 않습니다. 아래 직접 텍스트 입력을 이용해 주세요.');
      return;
    }

    try {
      // 1. Request microphone stream to visualize audio activity & check permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Audio visualizer simulation
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round(avg * 1.5)));
        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();

      // 2. Initialize Web Speech Recognition
      const recognition = new SpeechRecognition();
      recognition.lang = 'ko-KR';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript(finalTranscript.trim());
          // Optional: infer suggested linked step purely as a tag suggestion
          if (finalTranscript.includes('시작') || finalTranscript.includes('주입 시작')) {
            setSelectedLinkedStep('INFUSION_START');
          } else if (finalTranscript.includes('종료') || finalTranscript.includes('완료')) {
            setSelectedLinkedStep('INFUSION_END');
          } else if (finalTranscript.includes('부위') || finalTranscript.includes('발적') || finalTranscript.includes('부종')) {
            setSelectedLinkedStep('IV_SITE_ASSESS');
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setMicError('마이크 접근 권한이 차단되었습니다. 브라우저 설정에서 마이크 사용을 허용해 주세요.');
        } else if (event.error === 'no-speech') {
          // Ignore silence
        } else {
          setMicError(`음성 인식 오류 (${event.error}). 텍스트로 직접 입력할 수 있습니다.`);
        }
        stopRecording();
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Microphone error:', err);
      setIsRecording(false);
      setMicError(
        err.name === 'NotAllowedError'
          ? '마이크 권한이 허용되지 않았습니다. 브라우저에서 마이크 접근을 허용해 주세요.'
          : '마이크를 초기화할 수 없습니다. 직접 입력을 이용해 주세요.'
      );
    }
  };

  const handleApplyPreset = (phrase: { linkedStep: string; text: string }) => {
    // Purely fills text & sets reference tag. Does NOT block or trigger stage completion
    setSelectedLinkedStep(phrase.linkedStep);
    setTranscript(phrase.text);
  };

  const handleConfirm = (asWorkflowAction: boolean = false) => {
    if (!transcript.trim()) return;

    // Detect clinical observations from speech
    const text = transcript.trim();
    let hasPain = false;
    let hasRedness = false;
    let hasSwelling = false;
    let site = '우측 전완 (Right Forearm)';

    if (text.includes('좌측')) site = '좌측 전완 (Left Forearm)';
    if (text.includes('주관절') || text.includes('팔오금')) site = '우측 주관절 (Antecubital Fossa)';
    if (text.includes('수배') || text.includes('손등')) site = '우측 수배 (Dorsum of Hand)';

    // Check if red/swelling mentioned positively or negatively
    if (text.includes('발적 관찰') || text.includes('발적 있음') || text.includes('발적 보여')) {
      hasRedness = true;
    }
    if (text.includes('부종 관찰') || text.includes('부종 있음') || text.includes('부종 보여')) {
      hasSwelling = true;
    }
    if (text.includes('통증 호소') || text.includes('아프다고') || text.includes('통증 있음')) {
      hasPain = true;
    }

    const clinicalFindings = {
      site,
      hasPain,
      hasRedness,
      hasSwelling,
    };

    console.log('[confirmVoiceInput] Confirmed in VoiceNursingModal:', {
      source: asWorkflowAction ? 'VOICE_AI_CONFIRMED' : 'speech',
      asWorkflowAction,
      linkedStep: selectedLinkedStep || 'NONE',
      transcript: text,
      clinicalFindings,
    });

    onConfirmVoiceEvent(text, selectedLinkedStep || undefined, clinicalFindings, asWorkflowAction);
    stopRecording();
    onClose();
  };

  const handleConfirmAction = (asWorkflowAction: boolean) => {
    handleConfirm(asWorkflowAction);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                간호 행위 음성 입력 (Voice Nursing Input)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                한국어 음성 인식으로 간호 사정 및 구술 내용을 독립 이벤트(VOICE_NOTE)로 기록합니다
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopRecording();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Target Event Category Tag Selector (Purely metadata tag, never blocks) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                연계 간호 행위 태그 (선택)
              </label>
              <span className="text-[10px] text-slate-400">자유 음성 메모로 안전하게 다중 저장</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedLinkedStep('IV_SITE_ASSESS')}
                className={`py-2 px-2 rounded-xl text-[11px] font-medium border transition ${
                  selectedLinkedStep === 'IV_SITE_ASSESS'
                    ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-500 text-purple-700 dark:text-purple-300 font-bold'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                IV Site 사정
              </button>
              <button
                type="button"
                onClick={() => setSelectedLinkedStep('INFUSION_START')}
                className={`py-2 px-2 rounded-xl text-[11px] font-medium border transition ${
                  selectedLinkedStep === 'INFUSION_START'
                    ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-500 text-purple-700 dark:text-purple-300 font-bold'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                투여 시작
              </button>
              <button
                type="button"
                onClick={() => setSelectedLinkedStep('INFUSION_END')}
                className={`py-2 px-2 rounded-xl text-[11px] font-medium border transition ${
                  selectedLinkedStep === 'INFUSION_END'
                    ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-500 text-purple-700 dark:text-purple-300 font-bold'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                투여 종료
              </button>
              <button
                type="button"
                onClick={() => setSelectedLinkedStep('')}
                className={`py-2 px-2 rounded-xl text-[11px] font-medium border transition ${
                  !selectedLinkedStep
                    ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-500 text-purple-700 dark:text-purple-300 font-bold'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                일반 메모
              </button>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              ※ 연계 태그는 참고용이며, 해당 간호 단계의 완료 여부와 무관하게 언제든 자유롭게 추가 저장됩니다.
            </p>
          </div>

          {/* Microphone Interactive Record Button */}
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <div className="relative mb-3">
              {isRecording && (
                <div
                  className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping"
                  style={{ transform: `scale(${1 + audioLevel / 100})` }}
                />
              )}
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`relative w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-lg transition active:scale-95 ${
                  isRecording
                    ? 'bg-rose-600 text-white shadow-rose-600/30 ring-4 ring-rose-300 dark:ring-rose-900'
                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30'
                }`}
              >
                {isRecording ? (
                  <>
                    <MicOff className="w-8 h-8 animate-pulse" />
                    <span className="text-[10px] font-bold mt-0.5">중지</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-8 h-8" />
                    <span className="text-[10px] font-bold mt-0.5">음성 녹음</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 text-center">
              {isRecording
                ? '음성을 듣고 있습니다... 간호 내용을 말씀해 주세요'
                : '버튼을 누르고 간호 사정 및 수행 소견을 말씀해 주세요'}
            </p>

            {isRecording && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                <Volume2 className="w-3.5 h-3.5 animate-pulse" /> 마이크 감도: {audioLevel}%
              </div>
            )}

            {micError && (
              <div className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{micError}</span>
              </div>
            )}
          </div>

          {/* Quick Preset Phrases for Demonstration (Auto-Fill Only) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> 시연용 임상 추천 문구 (원클릭 자동 입력)
              </span>
              <span className="text-[10px] text-slate-400">터치 시 자동 입력</span>
            </div>
            <div className="space-y-1.5">
              {samplePhrases.map((phrase, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(phrase)}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-purple-400 dark:hover:border-purple-600 transition flex items-start justify-between gap-2"
                >
                  <div>
                    <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 block">
                      [{phrase.title}]
                    </span>
                    <span className="text-xs text-slate-700 dark:text-slate-200">
                      "{phrase.text}"
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Recognized Text Display & Manual Editor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Edit3 className="w-3.5 h-3.5" /> 음성 변환 결과 (간호사 직접 검토 및 수정 가능)
              </label>
              <span className="text-[11px] text-slate-400">
                {transcript.length}자
              </span>
            </div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="음성을 녹음하거나 이곳에 직접 간호 사정/구술 내용을 타이핑하세요..."
              rows={3}
              className="w-full text-xs p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              ※ 음성 인식 후 반드시 [확인 및 이벤트 반영]을 눌러야 실시간 Firestore에 저장됩니다.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              stopRecording();
              onClose();
            }}
            className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            취소
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!transcript.trim()}
              onClick={() => handleConfirmAction(false)}
              className="py-2 px-3 rounded-xl border border-purple-400 dark:border-purple-600 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40"
              title="단계 진행 없이 순수 음성 간호 기록(source: 'speech')으로 타임라인에 등록합니다."
            >
              <Mic className="w-3.5 h-3.5" /> 음성 메모로 저장
            </button>

            {selectedLinkedStep && selectedLinkedStep !== 'GENERAL' && (
              <button
                type="button"
                disabled={!transcript.trim()}
                onClick={() => handleConfirmAction(true)}
                className="py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-purple-600/20 disabled:shadow-none transition"
                title="음성 분석 소견을 바탕으로 간호 행위 단계를 실시간 완료 처리(source: 'VOICE_AI_CONFIRMED')합니다."
              >
                <CheckCircle2 className="w-4 h-4" /> AI 음성 확인 단계 완료
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

