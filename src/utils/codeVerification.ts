import { Patient, MedicationOrder } from '../types';

const textField = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

export interface PatientVerificationResult {
  raw: string;
  scannedId: string;
  scannedName: string;
  scannedRoom: string;
  isMatch: boolean;
  status: 'MATCHED' | 'MISMATCH';
  message: string;
  details: string[];
}

export interface MedicationVerificationResult {
  raw: string;
  rxId: string;
  medName: string;
  patientId: string;
  isMatch: boolean;
  status: 'MATCHED' | 'MISMATCH';
  message: string;
  details: string[];
  fiveRights: {
    rightPatient: boolean;
    rightDrug: boolean;
    rightDose: boolean;
    rightRoute: boolean;
    rightTime: boolean;
  };
}

/**
 * Parses and verifies patient wristband QR text against the expected patient record
 */
export function verifyPatientQrCode(rawText: string, expectedPatient: Patient): PatientVerificationResult {
  const raw = rawText.trim();
  let scannedId = '';
  let scannedName = '';
  let scannedRoom = '';

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid code payload');
    scannedId = textField(parsed.patientId || parsed.id);
    scannedName = textField(parsed.name || parsed.patientName);
    scannedRoom = textField(parsed.room);
  } catch {
    if (raw.includes('|')) {
      const parts = raw.split('|');
      scannedId = parts[0]?.trim() || '';
      scannedName = parts[1]?.trim() || '';
      scannedRoom = parts[2]?.trim() || '';
    } else {
      scannedId = raw;
    }
  }

  // Verification rule: ID matches or Name matches if ID is missing/matches
  const idMatched = scannedId ? scannedId === expectedPatient.id : false;
  const nameMatched = scannedName ? scannedName === expectedPatient.name : false;
  const isMatch = idMatched && (!scannedName || nameMatched);

  const displayId = scannedId || (isMatch ? expectedPatient.id : '미확인 ID');
  const displayName = scannedName || (isMatch ? expectedPatient.name : '미확인 환자');
  const displayRoom = scannedRoom || (isMatch ? expectedPatient.room : '미확인 병실');

  const details = [
    `환자 성명: ${displayName} ${isMatch ? `(${expectedPatient.gender}/${expectedPatient.age}세)` : ''}`,
    `환자 등록번호: ${displayId}`,
    `배정 병실: ${displayRoom}`,
    `기대 환자: ${expectedPatient.name} (${expectedPatient.id} / ${expectedPatient.room})`,
  ];

  return {
    raw,
    scannedId: displayId,
    scannedName: displayName,
    scannedRoom: displayRoom,
    isMatch,
    status: isMatch ? 'MATCHED' : 'MISMATCH',
    message: isMatch
      ? `환자 확인 일치: ${displayName} (${displayId})`
      : `경고: 처방 대상 환자와 불일치 (${displayName} / ${displayId})`,
    details,
  };
}

/**
 * Parses and verifies medication Code 128 / QR text against expected prescription and patient
 */
export function verifyMedicationBarcode(
  rawText: string,
  expectedPrescription: MedicationOrder,
  expectedPatient: Patient
): MedicationVerificationResult {
  const raw = rawText.trim();
  let rxId = '';
  let medName = '';
  let pId = '';

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid code payload');
    rxId = textField(parsed.rxId || parsed.id);
    medName = textField(parsed.medName || parsed.medicationName);
    pId = textField(parsed.patientId);
  } catch {
    rxId = raw;
    if (rxId === expectedPrescription.id) {
      medName = expectedPrescription.medicationName;
    } else if (rxId === 'RX-9999-WRONG-DRUG' || rxId.includes('WRONG')) {
      medName = '모의 진통제 B (처방 외 약물)';
    } else {
      medName = '미등록 약품';
    }
  }

  // Exact prescription ID match check (e.g. RX-2026-0923-004)
  const isRxMatch = rxId === expectedPrescription.id;
  const isPatientMatch = !pId || pId === expectedPatient.id;
  const isMatch = isRxMatch && isPatientMatch && (!medName || medName === expectedPrescription.medicationName);

  const fiveRights = {
    rightPatient: isPatientMatch,
    rightDrug: isRxMatch,
    rightDose: isMatch,
    rightRoute: isMatch,
    rightTime: isMatch,
  };

  const details = [
    `처방 번호: ${rxId} (${isRxMatch ? '처방 일치' : '불일치 경고'})`,
    `약품 명칭: ${medName || expectedPrescription.medicationName}`,
    `처방 용법: ${expectedPrescription.dosage} / ${expectedPrescription.route}`,
    `5-Rights: ${isMatch ? '처방번호 일치 — 용량·경로·시간은 간호사 직접 대조 필요' : '처방 불일치 - 투약 중단 권고'}`,
  ];

  return {
    raw,
    rxId,
    medName: medName || expectedPrescription.medicationName,
    patientId: pId || expectedPatient.id,
    isMatch,
    status: isMatch ? 'MATCHED' : 'MISMATCH',
    message: isMatch
      ? `처방 약물 일치: ${expectedPrescription.medicationName} (${rxId})`
      : `경고: 처방 약물 불일치 (${rxId})`,
    details,
    fiveRights,
  };
}
