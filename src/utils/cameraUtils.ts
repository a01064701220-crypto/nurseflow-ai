/**
 * Camera diagnostic and permission utilities for NurseFlow AI
 * Specifically optimized for mobile iOS Safari, standalone deployment URLs, and embedded iframe previews.
 */

export interface CameraDiagnosis {
  isSupported: boolean;
  isSecureContext: boolean;
  isInIframe: boolean;
  standaloneUrl: string;
}

export type CameraErrorCategory =
  | 'USER_DENIED'
  | 'INITIALIZATION_FAILED'
  | 'IFRAME_RESTRICTED'
  | 'DEVICE_NOT_FOUND'
  | 'DEVICE_IN_USE'
  | 'OVERCONSTRAINED'
  | 'INSECURE_CONTEXT'
  | 'UNKNOWN';

export interface CameraErrorInfo {
  category: CameraErrorCategory;
  title: string;
  message: string;
  actionGuide: string;
  isIframeIssue: boolean;
  rawError?: string;
}

/**
 * Basic environment checks
 */
export function diagnoseEnvironment(): CameraDiagnosis {
  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function';

  const isSecureContext =
    typeof window !== 'undefined'
      ? window.isSecureContext ?? (location.protocol === 'https:' || location.hostname === 'localhost')
      : true;

  const isInIframe =
    typeof window !== 'undefined' ? window.self !== window.top : false;

  const standaloneUrl = typeof window !== 'undefined' ? window.location.href : '';

  return {
    isSupported,
    isSecureContext,
    isInIframe,
    standaloneUrl,
  };
}

/**
 * Classifies camera error into distinct, actionable clinical/technical categories.
 * Clearly separates "카메라 권한 거부 (USER_DENIED)" from "카메라 초기화 실패 (INITIALIZATION_FAILED / HARDWARE)".
 */
export function classifyCameraError(err: any): CameraErrorInfo {
  const env = diagnoseEnvironment();
  const errorName = err?.name || '';
  const errorMsg = String(err?.message || err || '');
  const rawDesc = errorName ? `[${errorName}] ${errorMsg}` : errorMsg;

  // 1. Insecure Context Check (HTTP instead of HTTPS)
  if (!env.isSecureContext) {
    return {
      category: 'INSECURE_CONTEXT',
      title: 'HTTPS 보안 환경 필요',
      message: '웹 브라우저의 보안 정책상 카메라는 HTTPS 보안 연결에서만 활성화됩니다.',
      actionGuide: 'HTTPS 주소로 접속하거나 안전한 환경에서 실행해 주세요.',
      isIframeIssue: false,
      rawError: rawDesc,
    };
  }

  // 2. Iframe Restriction in Google AI Studio Preview
  if (
    env.isInIframe &&
    (errorName === 'SecurityError' ||
      (errorName === 'NotAllowedError' &&
        (errorMsg.includes('policy') || errorMsg.includes('context') || errorMsg.includes('allowed by'))))
  ) {
    return {
      category: 'IFRAME_RESTRICTED',
      title: 'AI Studio Preview 프레임 권한 제한',
      message: '아이폰 Safari 브라우저는 보안 정책상 임베디드 iframe 내부의 직접 카메라 접근을 제한합니다.',
      actionGuide: '아래 [독립 배포창에서 열기] 버튼을 눌러 독립 Safari 전체화면에서 실행하시면 카메라가 정상 작동합니다.',
      isIframeIssue: true,
      rawError: rawDesc,
    };
  }

  // 3. User Denied Permission (카메라 권한 거부)
  if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
    if (env.isInIframe) {
      return {
        category: 'IFRAME_RESTRICTED',
        title: '카메라 권한 차단 또는 iframe 제한',
        message: '카메라 권한이 차단되었거나, AI Studio 모바일 미리보기 iframe 환경에서 접근이 거부되었습니다.',
        actionGuide: 'Safari 설정에서 카메라 권한을 확인하거나, 아래 [독립 배포창에서 열기] 또는 [시연용 즉시 인식]을 이용해 주세요.',
        isIframeIssue: true,
        rawError: rawDesc,
      };
    }
    return {
      category: 'USER_DENIED',
      title: '카메라 접근 권한 거부',
      message: '브라우저에서 카메라 접근 요청이 사용자에 의해 거부되었습니다.',
      actionGuide: 'Safari 주소창 왼쪽 [가/AA] 버튼 또는 [설정 > Safari > 카메라]에서 "허용"으로 변경 후 재시도해 주세요.',
      isIframeIssue: false,
      rawError: rawDesc,
    };
  }

  // 4. Device Not Found
  if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
    return {
      category: 'DEVICE_NOT_FOUND',
      title: '카메라 장치 미감지',
      message: '기기에서 사용 가능한 후면 또는 기본 카메라 하드웨어를 찾을 수 없습니다.',
      actionGuide: '장치에 카메라가 연결되어 있는지 확인하거나, [시연용 즉시 인식] 버튼으로 시연을 계속 진행해 주세요.',
      isIframeIssue: false,
      rawError: rawDesc,
    };
  }

  // 5. Device In Use (다른 앱에서 사용 중)
  if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
    return {
      category: 'DEVICE_IN_USE',
      title: '카메라 하드웨어 접근 실패',
      message: '다른 앱(기본 카메라, FaceTime, 다른 브라우저 탭 등)에서 카메라를 이미 사용 중입니다.',
      actionGuide: '카메라를 사용 중인 다른 앱을 완전히 종료한 후 [카메라 다시 시도]를 눌러주세요.',
      isIframeIssue: false,
      rawError: rawDesc,
    };
  }

  // 6. Overconstrained (후면 카메라 제약 조건 불일치)
  if (errorName === 'OverconstrainedError' || errorMsg.includes('facingMode') || errorMsg.includes('exact')) {
    return {
      category: 'OVERCONSTRAINED',
      title: '후면 카메라 모드 제약',
      message: '기기에서 요청한 후면 카메라 모드를 직접 지원하지 않아 기본 카메라로 전환합니다.',
      actionGuide: '아래 [카메라 다시 시도]를 누르면 사용 가능한 기본 카메라로 자동 전환됩니다.',
      isIframeIssue: false,
      rawError: rawDesc,
    };
  }

  // 7. Generic Initialization Failed (카메라 초기화 실패)
  return {
    category: 'INITIALIZATION_FAILED',
    title: '카메라 초기화 실패',
    message: `카메라 스트림을 시작하지 못했습니다. (${rawDesc || '알 수 없는 오류'})`,
    actionGuide: '아래 [카메라 다시 시도]를 누르시거나, [시연용 즉시 인식] 버튼으로 시연을 진행해 주세요.',
    isIframeIssue: env.isInIframe,
    rawError: rawDesc,
  };
}

/**
 * Standard getUserMedia request strictly following environment facingMode string requirement
 */
export async function requestCameraStream(): Promise<MediaStream> {
  const env = diagnoseEnvironment();
  if (!env.isSupported) {
    throw new Error('이 브라우저에서는 카메라 API(getUserMedia)를 지원하지 않습니다.');
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'environment',
      },
    });
  } catch (err1: any) {
    console.warn('Environment rear camera failed, falling back to default camera:', err1);
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: true,
    });
  }
}
