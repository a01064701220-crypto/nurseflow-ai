import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  BinaryBitmap,
  GlobalHistogramBinarizer,
  HybridBinarizer,
  Result,
} from '@zxing/library';

// Cached format-specific readers for high performance & minimal GC allocations
let cachedQrReader: MultiFormatReader | null = null;
let cachedBarcode1DReader: MultiFormatReader | null = null;
let cachedAllReader: MultiFormatReader | null = null;

function getQrReader(): MultiFormatReader {
  if (!cachedQrReader) {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    cachedQrReader = new MultiFormatReader();
    cachedQrReader.setHints(hints);
  }
  return cachedQrReader;
}

function getBarcode1DReader(): MultiFormatReader {
  if (!cachedBarcode1DReader) {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    cachedBarcode1DReader = new MultiFormatReader();
    cachedBarcode1DReader.setHints(hints);
  }
  return cachedBarcode1DReader;
}

function getAllReader(): MultiFormatReader {
  if (!cachedAllReader) {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.UPC_E,
      BarcodeFormat.EAN_13,
      BarcodeFormat.UPC_A,
      BarcodeFormat.CODE_39,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    cachedAllReader = new MultiFormatReader();
    cachedAllReader.setHints(hints);
  }
  return cachedAllReader;
}

export interface DetailedDecodeResult {
  success: boolean;
  text: string;
  format?: string;
  engine?: 'native' | 'zxing_center' | 'zxing_rotated' | 'zxing_full' | 'none';
  canvasDimensions?: { width: number; height: number };
  error?: string;
}

/**
 * Converts browser RGBA ImageData (4 bytes/pixel) to Grayscale 1-byte/pixel Uint8ClampedArray
 */
export function rgbaToGrayscale(srcData: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const pixelCount = width * height;
  const gray = new Uint8ClampedArray(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    gray[i] = (srcData[idx] * 299 + srcData[idx + 1] * 587 + srcData[idx + 2] * 114) / 1000;
  }
  return gray;
}

/**
 * Decodes barcode or QR code from ImageData using format-specific ZXing reader
 */
export function decodeFromImageData(
  imageData: ImageData,
  targetFormat: 'QR_CODE' | 'CODE_128' | 'ALL' = 'ALL'
): { success: boolean; text: string; format?: string } {
  const { width, height, data } = imageData;
  if (width === 0 || height === 0 || !data || data.length === 0) {
    return { success: false, text: '' };
  }

  const grayBuffer = rgbaToGrayscale(data, width, height);
  const luminanceSource = new RGBLuminanceSource(grayBuffer, width, height);

  const reader =
    targetFormat === 'QR_CODE'
      ? getQrReader()
      : targetFormat === 'CODE_128'
      ? getBarcode1DReader()
      : getAllReader();

  // Pass 1: HybridBinarizer (adaptive local thresholding - optimal for QR codes & phone screens)
  try {
    const bitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
    const result: Result = reader.decodeWithState(bitmap);
    if (result && result.getText()) {
      return {
        success: true,
        text: result.getText(),
        format: BarcodeFormat[result.getBarcodeFormat()],
      };
    }
  } catch (_) {
    try {
      reader.reset();
    } catch (__) {}
  }

  // Pass 2: GlobalHistogramBinarizer (standard for 1D printed barcodes)
  try {
    const bitmap = new BinaryBitmap(new GlobalHistogramBinarizer(luminanceSource));
    const result: Result = reader.decodeWithState(bitmap);
    if (result && result.getText()) {
      return {
        success: true,
        text: result.getText(),
        format: BarcodeFormat[result.getBarcodeFormat()],
      };
    }
  } catch (_) {
    try {
      reader.reset();
    } catch (__) {}
  }

  return { success: false, text: '' };
}

/**
 * Decodes from HTMLCanvasElement with contrast enhancement and rotation fallbacks
 */
export function decodeFromCanvas(
  canvas: HTMLCanvasElement,
  targetFormat: 'QR_CODE' | 'CODE_128' | 'ALL' = 'ALL'
): { success: boolean; text: string; format?: string; rotated?: boolean } {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width === 0 || canvas.height === 0) {
    return { success: false, text: '' };
  }

  // 1. Direct pass
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pass1 = decodeFromImageData(imgData, targetFormat);
  if (pass1.success) return pass1;

  // 2. 90-degree rotated pass (critical for 1D barcodes when smartphone is held in portrait)
  if (targetFormat === 'CODE_128' || targetFormat === 'ALL') {
    try {
      const rotCanvas = document.createElement('canvas');
      rotCanvas.width = canvas.height;
      rotCanvas.height = canvas.width;
      const rotCtx = rotCanvas.getContext('2d', { willReadFrequently: true });
      if (rotCtx) {
        rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
        rotCtx.rotate((90 * Math.PI) / 180);
        rotCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
        const rotImgData = rotCtx.getImageData(0, 0, rotCanvas.width, rotCanvas.height);
        const passRot = decodeFromImageData(rotImgData, targetFormat);
        if (passRot.success) {
          return { ...passRot, rotated: true };
        }
      }
    } catch (_) {}
  }

  // 3. High-contrast / binarized pass (handles glare on phone screens or dim lighting)
  try {
    const contrastData = ctx.createImageData(canvas.width, canvas.height);
    const src = imgData.data;
    const dst = contrastData.data;
    const len = src.length;
    for (let i = 0; i < len; i += 4) {
      const lum = (src[i] * 299 + src[i + 1] * 587 + src[i + 2] * 114) / 1000;
      const v = lum > 128 ? 255 : 0;
      dst[i] = v;
      dst[i + 1] = v;
      dst[i + 2] = v;
      dst[i + 3] = 255;
    }
    const passContrast = decodeFromImageData(contrastData, targetFormat);
    if (passContrast.success) return passContrast;
  } catch (_) {}

  return { success: false, text: '' };
}

/**
 * Universal High-Performance Decoder for Video Elements
 * 1. Uses shared ZXing luminance decoding without awaiting native detection
 * 2. Crops center reticle region at 1:1 native sensor sharpness (prevents aspect ratio warping & blur)
 * 3. Rotates 90-deg for Code 128 barcodes when mobile is held in portrait
 * 4. Falls back to full-frame if center-crop misses
 */
export async function decodeBarcodeOrQrFromVideo(
  video: HTMLVideoElement,
  targetFormat: 'QR_CODE' | 'CODE_128' | 'ALL',
  workCanvas?: HTMLCanvasElement | null
): Promise<DetailedDecodeResult> {
  if (
    !video ||
    video.readyState < 2 ||
    video.paused ||
    video.ended ||
    video.videoWidth === 0 ||
    video.videoHeight === 0
  ) {
    return { success: false, text: '', engine: 'none', error: 'Video stream not ready' };
  }

  const vw = video.videoWidth;
  const vh = video.videoHeight;

  // Use the shared ZXing pixel path deterministically. A pending native detect()
  // must never prevent Safari from reaching the software decoder.

  // Create or reuse work canvas
  const canvas = workCanvas || document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { success: false, text: '', engine: 'none', error: 'Canvas 2D context unavailable' };
  }

  let frameError: string | undefined;

  // 2. Strategy A: Center Reticle Crop (1:1 Native Sensor Resolution)
  // This extracts the exact area aligned with the user viewfinder without squashing or resizing
  const cropSize = Math.min(vw, vh) * 0.7; // 70% of shortest edge
  const sx = Math.floor((vw - cropSize) / 2);
  const sy = Math.floor((vh - cropSize) / 2);

  canvas.width = Math.floor(cropSize);
  canvas.height = Math.floor(cropSize);

  try {
    ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, canvas.width, canvas.height);
    const centerResult = decodeFromCanvas(canvas, targetFormat);
    if (centerResult.success && centerResult.text) {
      return {
        success: true,
        text: centerResult.text,
        format: centerResult.format || targetFormat,
        engine: centerResult.rotated ? 'zxing_rotated' : 'zxing_center',
        canvasDimensions: { width: canvas.width, height: canvas.height },
      };
    }
  } catch (err: any) { frameError = err?.message || 'Canvas frame read failed'; }

  // 3. Strategy B: Full Frame (preserves natural aspect ratio)
  try {
    // Limit max resolution to 960x540 to avoid high CPU lag while maintaining aspect ratio
    const scale = Math.min(1, 960 / Math.max(vw, vh));
    const fw = Math.floor(vw * scale);
    const fh = Math.floor(vh * scale);

    canvas.width = fw;
    canvas.height = fh;
    ctx.drawImage(video, 0, 0, fw, fh);

    const fullResult = decodeFromCanvas(canvas, targetFormat);
    if (fullResult.success && fullResult.text) {
      return {
        success: true,
        text: fullResult.text,
        format: fullResult.format || targetFormat,
        engine: 'zxing_full',
        canvasDimensions: { width: fw, height: fh },
      };
    }
  } catch (_) {}

  return {
    success: false,
    text: '',
    engine: 'none',
    error: frameError,
    canvasDimensions: { width: canvas.width, height: canvas.height },
  };
}

/**
 * Decodes barcode from an uploaded image File using ZXing
 */
export async function decodeBarcodeFromFile(
  file: File
): Promise<{ success: boolean; text: string; format?: string; error?: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            resolve({ success: false, text: '', error: 'Canvas 2D context 생성 실패' });
            return;
          }
          ctx.drawImage(img, 0, 0);
          const result = decodeFromCanvas(canvas, 'ALL');
          if (result.success) {
            resolve(result);
          } else {
            resolve({
              success: false,
              text: '',
              error: '이미지에서 바코드(Code 128 / EAN / QR) 패턴을 감지하지 못했습니다.',
            });
          }
        } catch (err: any) {
          resolve({
            success: false,
            text: '',
            error: `이미지 해독 중 예외 발생: ${err?.message || err}`,
          });
        }
      };
      img.onerror = () => {
        resolve({ success: false, text: '', error: '이미지 파일을 불러올 수 없습니다.' });
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      resolve({ success: false, text: '', error: '파일 읽기 실패' });
    };
    reader.readAsDataURL(file);
  });
}
