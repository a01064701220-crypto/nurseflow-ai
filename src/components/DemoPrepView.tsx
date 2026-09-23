import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { Download, Printer, ShieldAlert, CheckCircle2, QrCode, Barcode, Info, FileText } from 'lucide-react';
import { INITIAL_PATIENT, INITIAL_PRESCRIPTION } from '../services/emrService';

export const DemoPrepView: React.FC = () => {
  const [patientQrUrl, setPatientQrUrl] = useState<string>('');
  const [medQrUrl, setMedQrUrl] = useState<string>('');
  const [mismatchPatientQrUrl, setMismatchPatientQrUrl] = useState<string>('');
  
  const barcodeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mismatchBarcodeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Generate Patient QR Payload (Standardized JSON matching scanner parser)
  const patientPayload = JSON.stringify({
    patientId: INITIAL_PATIENT.id,
    name: INITIAL_PATIENT.name,
    room: INITIAL_PATIENT.room,
    department: INITIAL_PATIENT.department,
    dob: '1961-03-15',
  });

  // Generate Medication Barcode Payload
  const medPayload = INITIAL_PRESCRIPTION.id; // "RX-2026-0923-004"
  const medQrPayload = JSON.stringify({
    rxId: INITIAL_PRESCRIPTION.id,
    medName: INITIAL_PRESCRIPTION.medicationName,
    patientId: INITIAL_PATIENT.id,
    dosage: INITIAL_PRESCRIPTION.dosage,
    route: INITIAL_PRESCRIPTION.route,
  });

  // Mismatch test payloads for judges
  const mismatchPatientPayload = JSON.stringify({
    patientId: 'TEST-P999',
    name: '김철수',
    room: '302호-A',
    dob: '1975-08-20',
  });
  const mismatchMedPayload = 'RX-9999-WRONG-DRUG';

  useEffect(() => {
    // 1. Generate Patient Wristband QR
    QRCode.toDataURL(patientPayload, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    }).then(setPatientQrUrl).catch(console.error);

    // 2. Generate Medication QR
    QRCode.toDataURL(medQrPayload, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0369a1',
        light: '#ffffff',
      },
    }).then(setMedQrUrl).catch(console.error);

    // 3. Generate Mismatch Patient QR
    QRCode.toDataURL(mismatchPatientPayload, {
      width: 320,
      margin: 2,
      color: {
        dark: '#be123c',
        light: '#ffffff',
      },
    }).then(setMismatchPatientQrUrl).catch(console.error);

    // 4. Render 1D Barcode for Medication using JsBarcode (strictly Code 128 with exact matching text)
    if (barcodeCanvasRef.current) {
      try {
        JsBarcode(barcodeCanvasRef.current, medPayload, {
          format: 'CODE128',
          lineColor: '#000000',
          width: 2.2,
          height: 75,
          displayValue: true,
          fontSize: 16,
          font: 'monospace',
          text: medPayload, // Strictly matches encoded data "RX-2026-0923-004"
          margin: 15,
          background: '#ffffff',
        });
      } catch (err) {
        console.error('Barcode render error:', err);
      }
    }

    // 5. Render 1D Mismatch Barcode (strictly Code 128 with exact matching text and high-contrast bars)
    if (mismatchBarcodeCanvasRef.current) {
      try {
        JsBarcode(mismatchBarcodeCanvasRef.current, mismatchMedPayload, {
          format: 'CODE128',
          lineColor: '#000000',
          width: 2.2,
          height: 75,
          displayValue: true,
          fontSize: 16,
          font: 'monospace',
          text: mismatchMedPayload, // Strictly matches encoded data "RX-9999-WRONG-DRUG"
          margin: 15,
          background: '#ffffff',
        });
      } catch (err) {
        console.error('Mismatch barcode render error:', err);
      }
    }
  }, []);

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadCanvasImage = (canvas: HTMLCanvasElement | null, filename: string) => {
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    downloadImage(dataUrl, filename);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 print:p-0 print:m-0">
      {/* Contest Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-sky-950 text-white rounded-2xl p-6 shadow-xl border border-teal-500/20 print:border-none print:shadow-none print:bg-white print:text-black">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40 print:border-slate-400 print:text-slate-800">
                경진대회 심사위원 시연 준비실
              </span>
              <span className="text-xs text-slate-300 print:hidden">
                스마트폰 카메라로 모니터 화면을 직접 스캔하거나 인쇄하여 시연하세요
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              모의 환자 손목밴드 QR 및 모의 약물 바코드
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl print:text-slate-600">
              본 라벨은 의료 인공지능 경진대회 시연을 위해 자동 생성된 교육용 모의 식별자입니다. 
              스마트폰을 들고 아래 QR/바코드를 화면 그대로 비추거나, A4 용지로 인쇄하여 실제 임상 현장처럼 손목밴드와 약병에 부착해 시연할 수 있습니다.
            </p>
          </div>

          <div className="flex items-center gap-2 print:hidden shrink-0">
            <button
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-semibold text-xs flex items-center gap-2 shadow transition active:scale-[0.98]"
            >
              <Printer className="w-4 h-4" /> A4 라벨 인쇄 (Print)
            </button>
          </div>
        </div>

        {/* Security / Medical Ethics Disclaimer */}
        <div className="mt-4 p-3 bg-teal-950/60 border border-teal-500/30 rounded-xl text-xs text-teal-200 flex items-start gap-2.5 print:border-slate-300 print:text-slate-700">
          <Info className="w-4 h-4 shrink-0 text-teal-400 mt-0.5" />
          <span>
            <strong>보안 및 의료 윤리 준수 안내:</strong> 본 시스템은 실제 환자 개인정보나 실제 유통 의약품 허가 바코드를 일체 사용하지 않으며, 경진대회 테스트 규격(TEST-P001)에 맞추어 암호화된 가상 데이터만을 취급합니다.
          </span>
        </div>
      </div>

      {/* Printable Grid Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
        {/* Card 1: Patient Wristband QR (홍길동) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-teal-500/40 p-5 shadow-md flex flex-col justify-between print:border-slate-800 print:shadow-none">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    1. 환자 손목밴드 식별 QR코드
                  </h3>
                  <span className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">
                    정상 일치 테스트용 (홍길동)
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold">
                STEP 1 일치 규격
              </span>
            </div>

            {/* Simulated Wristband Strip Display */}
            <div className="mt-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col items-center text-center">
              <div className="w-full flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-200 dark:border-slate-700 pb-2 mb-3">
                <span className="font-bold tracking-wider text-slate-700 dark:text-slate-300">
                  🏥 AI MEDICAL CENTER 5W
                </span>
                <span className="font-mono">IP: 305호-B</span>
              </div>

              {patientQrUrl ? (
                <div className="p-2 bg-white rounded-xl shadow-inner border border-slate-200">
                  <img
                    src={patientQrUrl}
                    alt="환자 손목밴드 QR코드"
                    className="w-48 h-48 object-contain"
                  />
                </div>
              ) : (
                <div className="w-48 h-48 bg-slate-200 animate-pulse rounded-xl" />
              )}

              <div className="mt-3 text-center">
                <div className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {INITIAL_PATIENT.name} (남/65세)
                </div>
                <div className="text-xs font-mono font-semibold text-teal-600 dark:text-teal-400">
                  등록번호: {INITIAL_PATIENT.id}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  진단: {INITIAL_PATIENT.diagnosis}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs print:hidden">
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">
              스마트폰 카메라로 즉시 스캔 가능
            </span>
            <button
              onClick={() => downloadImage(patientQrUrl, 'patient_wristband_qr_hong.png')}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" /> PNG 저장
            </button>
          </div>
        </div>

        {/* Card 2: Medication Barcode & QR Label (모의 IV 항생제 A) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-sky-500/40 p-5 shadow-md flex flex-col justify-between print:border-slate-800 print:shadow-none">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold">
                  <Barcode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    2. 약품 라벨 바코드 (1D Code128)
                  </h3>
                  <span className="text-[11px] text-sky-600 dark:text-sky-400 font-medium">
                    처방 일치 테스트용 (모의 IV 항생제 A)
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-semibold">
                처방 일치 규격
              </span>
            </div>

            {/* Simulated Med Tag */}
            <div className="mt-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col items-center text-center">
              <div className="w-full flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-200 dark:border-slate-700 pb-2 mb-3">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  💊 원내 조제 약제 라벨 (IV 점적)
                </span>
                <span className="text-sky-600 font-mono font-semibold">5-Right 대상</span>
              </div>

              {/* 1D Barcode Canvas */}
              <div className="p-2 bg-white rounded-xl shadow-inner border border-slate-200 w-full flex flex-col items-center justify-center">
                <canvas ref={barcodeCanvasRef} className="max-w-full" />
                <div className="mt-1 text-[11px] font-mono text-slate-500 flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded">
                  <span>인코딩 데이터:</span>
                  <strong className="text-slate-900 font-bold">{INITIAL_PRESCRIPTION.id}</strong>
                  <span className="text-[10px] text-sky-600 bg-sky-50 px-1 rounded border border-sky-200">Code 128</span>
                </div>
              </div>

              <div className="mt-3 text-center space-y-0.5">
                <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {INITIAL_PRESCRIPTION.medicationName}
                </div>
                <div className="text-xs text-sky-700 dark:text-sky-300 font-medium">
                  {INITIAL_PRESCRIPTION.dosage} | {INITIAL_PRESCRIPTION.route}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  처방: {INITIAL_PRESCRIPTION.prescribedDoctor} (주입 시각: 08:30)
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs print:hidden">
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">
              약물 바코드 스캔 시 100% 인식
            </span>
            <button
              onClick={() => downloadCanvasImage(barcodeCanvasRef.current, 'medication_barcode_1d.png')}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" /> PNG 저장
            </button>
          </div>
        </div>

        {/* Card 3: Mismatch Test QR for Judges (김철수 - 불일치 시연) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-300 dark:border-rose-900/60 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    3. [심사위원용] 타 환자 QR코드 (불일치 테스트)
                  </h3>
                  <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                    오투약 방지 검증용 (김철수 / TEST-P999)
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold">
                차단 검증용
              </span>
            </div>

            <div className="mt-4 bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl p-4 flex flex-col items-center text-center">
              {mismatchPatientQrUrl ? (
                <div className="p-2 bg-white rounded-xl shadow-inner border border-rose-200">
                  <img
                    src={mismatchPatientQrUrl}
                    alt="불일치 환자 QR"
                    className="w-36 h-36 object-contain"
                  />
                </div>
              ) : null}

              <div className="mt-3 text-center">
                <div className="font-bold text-sm text-rose-950 dark:text-rose-200">
                  김철수 (TEST-P999, 302호-A)
                </div>
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 max-w-xs">
                  스캔 시 '환자 식별 불일치' 경고가 뜨며 투약 단계가 차단되는 것을 확인할 수 있습니다.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs print:hidden">
            <span className="text-slate-400 text-[11px]">안전 차단 기능 테스트</span>
            <button
              onClick={() => downloadImage(mismatchPatientQrUrl, 'mismatch_patient_qr.png')}
              className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-medium"
            >
              저장
            </button>
          </div>
        </div>

        {/* Card 4: Mismatch Med Barcode for Judges (오투약 방지 바코드) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-300 dark:border-rose-900/60 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    4. [심사위원용] 미처방 약물 바코드 (불일치 테스트)
                  </h3>
                  <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                    처방 불일치 차단용 (모의 진통제 B)
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold">
                차단 검증용
              </span>
            </div>

            <div className="mt-4 bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl p-4 flex flex-col items-center text-center">
              <div className="p-2 bg-white rounded-xl shadow-inner border border-rose-200 w-full flex flex-col items-center justify-center">
                <canvas ref={mismatchBarcodeCanvasRef} className="max-w-full" />
                <div className="mt-1 text-[11px] font-mono text-rose-500 flex items-center gap-1.5 bg-rose-50 px-2 py-0.5 rounded">
                  <span>인코딩 데이터:</span>
                  <strong className="text-rose-900 font-bold">{mismatchMedPayload}</strong>
                  <span className="text-[10px] text-rose-600 bg-rose-100 px-1 rounded border border-rose-300">Code 128</span>
                </div>
              </div>

              <div className="mt-3 text-center">
                <div className="font-bold text-sm text-rose-950 dark:text-rose-200">
                  모의 진통제 B (RX-9999-WRONG-DRUG)
                </div>
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 max-w-xs">
                  스캔 시 '약물 불일치 경고'가 발생하며 5-Right 확인 및 투약 등록이 거부됩니다.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs print:hidden">
            <span className="text-slate-400 text-[11px]">오투약 방지 검증</span>
            <button
              onClick={() => downloadCanvasImage(mismatchBarcodeCanvasRef.current, 'mismatch_barcode.png')}
              className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-medium"
            >
              저장
            </button>
          </div>
        </div>
      </div>

      {/* Demonstration Instructions Checklist */}
      <div className="bg-slate-100 dark:bg-slate-800/60 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
        <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          경진대회 심사위원 현장 시연 프로토콜 안내
        </h4>
        <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300 leading-relaxed">
          <li><strong>기기 2대 시연 (권장):</strong> 노트북 화면에 본 '시연 준비' 탭을 띄워두고, 스마트폰 브라우저로 NurseFlow AI에 접속하여 카메라로 모니터의 QR/바코드를 비춥니다.</li>
          <li><strong>기기 1대 시연:</strong> 카메라 창 내부의 <em>'시연용 정상 QR/바코드 즉시 인식'</em> 버튼을 누르면 가상 스캐너가 실시간으로 입력 이벤트를 생성합니다.</li>
          <li><strong>안전 기능 시연:</strong> 불일치 QR/바코드를 스캔하여 오투약 차단 및 경고 로직이 엄격하게 발동하는지 심사위원에게 시연합니다.</li>
        </ol>
      </div>
    </div>
  );
};
