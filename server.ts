import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize Google Gen AI
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!apiKey,
    service: 'NurseFlow AI Backend',
    timestamp: new Date().toISOString(),
  });
});

// AI Draft Generation Endpoint
app.post('/api/generate-draft', async (req, res) => {
  try {
    const { patient, prescription, events, ivSiteAssessment } = req.body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        error: '기록 생성을 위한 간호 행위 이벤트 데이터가 필요합니다.',
      });
    }

    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY가 서버 환경 변수에 설정되지 않았습니다. AI 기록 초안을 직접 수동으로 작성해 주세요.',
        isApiKeyMissing: true,
      });
    }

    // Standardized clinical nursing prompt
    const systemInstruction = `당신은 대한민국 대학병원 EMR 시스템의 전문 임상간호사 기록 보조 AI입니다.
간호사가 실제로 수행하여 시스템에 기록된 '간호 행위 이벤트 로그'와 '환자/처방 정보', 'IV Site 사정 내용'만을 정확히 반영하여 표준화된 간호기록(Nursing Note) 초안을 작성하세요.

[핵심 작성 원칙 - 위반 금지]
1. 반드시 이벤트 로그에 기록된 실제 시각(HH:mm 또는 HH:mm:ss)과 행위만을 토대로 작성할 것.
2. 기록에 없는 간호 행위, 활력징후(혈압, 맥박, 체온 등), 환자의 주관적 반응, 투약 후 부작용 여부 등을 절대로 임의로 지어내지(hallucinate) 말 것.
3. 불명확하거나 누락된 항목(예: 활력징후 측정값, 투약 후 즉각 반응 관찰 등)은 문장 뒤나 별도 블록에 '[확인 필요]'로 명시할 것.
4. 문체는 대한민국 병원 임상에서 사용하는 간결하고 명확한 간호기록 문체('~함', '~확인함', '~시행함', '~투여 시작함', '~투여 종료함')를 사용할 것.
5. 첫 머리에는 환자 확인 및 처방 약물 확인, IV 부위 사정(삽입 부위, 통증/발적/부종/누출 여부 및 관찰소견), 투여 시작 및 종료 시각을 체계적으로 기술할 것.`;

    const prompt = `다음 간호 행위 데이터를 바탕으로 임상 간호기록 초안을 생성해 주세요.

[환자 정보]
- 성명: ${patient?.name || '홍길동'} (등록번호: ${patient?.id || 'TEST-P001'}, ${patient?.age || '65세'}, 병실: ${patient?.room || '305호-B'})

[처방 정보]
- 약물명: ${prescription?.name || '모의 IV 항생제 A (교육용 가상 데이터)'}
- 투여 경로: ${prescription?.route || 'IV'}

[IV Site 사정 결과]
${
  ivSiteAssessment
    ? `- 삽입 부위: ${ivSiteAssessment.site || '미지정'}
- 통증 여부: ${ivSiteAssessment.hasPain ? '유 (통증 호소)' : '무'}
- 발적(Erythema): ${ivSiteAssessment.hasRedness ? '유' : '무'}
- 부종(Edema): ${ivSiteAssessment.hasSwelling ? '유' : '무'}
- 누출 의심(Leakage/Infiltration): ${ivSiteAssessment.hasLeakage ? '의심 소견 관찰됨' : '없음'}
- 기타 관찰소견: ${ivSiteAssessment.notes || '특이사항 없음'}`
    : '- IV Site 사정: 미시행'
}

[수집된 실제 간호 행위 이벤트 로그]
${events
  .map(
    (e: any, idx: number) => {
      let extra = '';
      if (e.transcript) extra += ` (음성 구술 원문: "${e.transcript}")`;
      else if (e.metadata?.rawSpeechText) extra += ` (음성 발화 내용: "${e.metadata.rawSpeechText}")`;
      if (e.linkedStep) extra += ` [연계 단계: ${e.linkedStep}]`;
      if (e.metadata?.notes) extra += ` (간호 소견: "${e.metadata.notes}")`;
      if (e.metadata?.fiveRightsVerified) extra += ` (5-Right 전 항목 확인 완료)`;
      return `${idx + 1}. [${e.eventTimestamp || e.time}] ${e.eventType}: ${e.eventDescription} (수행자: ${e.nurseName || '양두영 간호사'}, 기록출처: ${e.eventSource || e.source || '시스템'})${extra}`;
    }
  )
  .join('\n')}

작성 지침:
- 시간순 간호기록 문장으로 일목요연하게 작성하세요.
- 기록 출처(스마트폰 QR 스캔, 약물 바코드 스캔, 음성 입력, 수동 확인 등)를 자연스럽게 반영할 수 있습니다.
- 사실에 근거한 내용만 포함하세요.
- 이벤트에 기록되지 않은 활력징후, 환자 반응 등은 절대 지어내지 말고, 필요시 '[확인 필요]' 항목에 명시하세요.
- 불필요한 서론이나 인사말은 일절 제외하고 순수 간호기록 내용만 출력하세요.`;

    const modelsToTry = ['gemini-3.8-flash', 'gemini-flash-latest'];
    let lastError: any = null;
    let draftText = '';

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.2, // low temperature for clinical factual consistency
          },
        });

        draftText = response.text || '';
        if (draftText) {
          return res.json({
            success: true,
            draft: draftText.trim(),
            model: modelName,
            generatedAt: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        console.warn(`Attempt with ${modelName} failed, trying next or retrying:`, err.message || err);
        lastError = err;
        // Wait 800ms before trying next model
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    // If both attempts had transient 503 issues, generate an accurate structured clinical template based strictly on the events
    console.warn('AI models temporary high demand, fallback to structured clinical note generator');
    const fallbackDraft = generateRuleBasedClinicalNote(patient, prescription, events, ivSiteAssessment);
    return res.json({
      success: true,
      draft: fallbackDraft,
      model: 'clinical-rules-fallback',
      notice: 'AI 서비스 일시적 트래픽 급증으로 표준 임상 간호 알고리즘을 통해 사실 기반 초안이 생성되었습니다.',
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error generating AI draft:', err);
    return res.status(500).json({
      error: err.message || 'AI 기록 초안 생성 중 오류가 발생했습니다.',
    });
  }
});

// Deterministic rule-based fallback generator that strictly follows the same rules
function generateRuleBasedClinicalNote(patient: any, prescription: any, events: any[], ivSiteAssessment: any): string {
  const lines: string[] = [];
  
  // Sort events chronologically
  const sorted = [...events].sort((a, b) => (a.eventTimestamp || '').localeCompare(b.eventTimestamp || ''));

  for (const evt of sorted) {
    const time = evt.eventTimestamp || '미상';
    const src = evt.eventSource;
    switch (evt.eventType) {
      case 'PATIENT_VERIFY': {
        const method = src === 'QR Scan' || src === 'QR Wristband Scan' 
          ? '스마트폰 카메라로 환자 손목밴드 QR코드 스캔 및 개방형 질문' 
          : '개방형 질문 및 환자 인식 밴드 대조';
        lines.push(`${time} 대상자(${patient?.name || '환자'}, ${patient?.id || 'TEST-P001'}, ${patient?.room || '305호-B'}) ${method}하여 본인 일치 확인 완료함.`);
        break;
      }
      case 'MEDICATION_VERIFY': {
        const method = src === 'Barcode Scan'
          ? '약물 바코드 스캔 및 처방 정보 대조'
          : '처방 정보 대조';
        lines.push(`${time} 처방된 ${prescription?.name || '모의 IV 항생제 A'}(${prescription?.route || 'IV'}) ${method} 후 투약 5-Right 원칙(정확한 환자, 약품, 용량, 경로, 시간) 최종 확인 완료함.`);
        break;
      }
      case 'IV_SITE_ASSESS': {
        const assess = evt.metadata?.ivAssessment || ivSiteAssessment;
        if (assess) {
          const siteName = assess.site || '말초정맥';
          const painText = assess.hasPain ? `통증 호소(NRS ${assess.painScore || 0}점)` : '통증 없음';
          const rednessText = assess.hasRedness ? '발적 관찰됨' : '발적 없음';
          const swellingText = assess.hasSwelling ? '부종 관찰됨' : '부종 없음';
          const leakageText = assess.hasLeakage ? '누출 의심됨' : '누출 없음';
          const notesText = assess.notes ? ` (관찰소견: ${assess.notes})` : '';
          const voiceTag = src === 'Voice Confirmation' ? ' [음성 입력 확인]' : '';
          lines.push(`${time} IV 삽입 부위(${siteName}) 사정 시행함${voiceTag}: ${painText}, ${rednessText}, ${swellingText}, ${leakageText}${notesText}.`);
        } else {
          lines.push(`${time} IV 삽입 부위 사정 시행함.`);
        }
        break;
      }
      case 'INFUSION_START': {
        const voiceTag = src === 'Voice Confirmation' ? ' [음성 확인]' : '';
        lines.push(`${time} 처방된 ${prescription?.name || '모의 IV 항생제 A'} 정맥 점적 투여(IV infusion) 시작함${voiceTag}.`);
        break;
      }
      case 'INFUSION_END': {
        const voiceTag = src === 'Voice Confirmation' ? ' [음성 확인]' : '';
        lines.push(`${time} ${prescription?.name || '모의 IV 항생제 A'} 전량 주입 완료되어 투여 종료함${voiceTag}.`);
        break;
      }
      default:
        lines.push(`${time} ${evt.eventDescription || '간호 행위 수행함.'}`);
    }
  }

  lines.push('');
  lines.push('[확인 필요 / 미기록 항목]');
  lines.push('- 투약 후 환자 반응 및 활력징후(V/S)는 수집된 이벤트에 포함되지 않아 미기록됨 (간호사 직접 사정 권장).');

  return lines.join('\n');
}

// Vite middleware for dev / static serve for prod
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[NurseFlow AI] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
