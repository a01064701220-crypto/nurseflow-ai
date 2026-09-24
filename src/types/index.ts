export type EventSource = 
  | 'Manual Confirmation'
  | 'QR Scan'
  | 'Barcode Scan'
  | 'Voice Confirmation'
  | 'QR Wristband Scan'
  | 'Voice Command'
  | 'Wearable Sensor'
  | 'NurseFlow Capture'
  | 'NurseFlow Station';

export type EventType = 
  | 'PATIENT_VERIFY'
  | 'MEDICATION_VERIFY'
  | 'IV_SITE_ASSESS'
  | 'INFUSION_START'
  | 'MEDICATION_START'
  | 'INFUSION_END'
  | 'MEDICATION_END'
  | 'VOICE_NOTE'
  | 'NURSE_HANDOFF';

export const isStep4 = (type?: string | null): boolean =>
  type === 'MEDICATION_START' || type === 'INFUSION_START';

export const isStep5 = (type?: string | null): boolean =>
  type === 'MEDICATION_END' || type === 'INFUSION_END';

export type EventStatus = 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';

export interface Nurse {
  uid?: string;
  approved?: boolean;
  nurseId: string; // e.g. "NURSE-2026-001"
  nurseName: string; // e.g. "양두영"
  licenseNumber: string; // e.g. "RN-89412"
  department: string; // e.g. "내과 병동 5W"
  shift: 'DAY' | 'EVENING' | 'NIGHT';
  role: 'PRIMARY_RN' | 'CHARGE_RN';
  email?: string;
}

export interface IvSiteAssessment {
  site: string; // e.g. '우측 전완 (Right Forearm)'
  catheterGauge?: string; // e.g. '22G'
  hasPain: boolean;
  painScore?: number; // 0-10
  hasRedness: boolean;
  hasSwelling: boolean;
  hasLeakage: boolean;
  notes: string;
  assessedAt: string;
}

export interface NursingEvent {
  // Required fields according to clinical event specification
  eventId: string; // Unique ID (e.g., "evt_1727083812_01")
  sessionId: string; // e.g. "SES-20260923-XORN0"
  patientId: string; // e.g. "TEST-P001"
  nurseId: string; // e.g. "NURSE-2026-001"
  nurseUid?: string;
  eventType: EventType;
  source: string; // e.g. "MANUAL_CONFIRMATION", "VOICE_AI_CONFIRMED", "speech", "QR_SCAN", "BARCODE_SCAN"
  occurredAt: string; // ISO 8601 string
  createdAt: string; // ISO 8601 creation timestamp

  // Contextual and clinical audit fields
  nurseName?: string; // e.g. "양두영"
  eventTimestamp?: string; // e.g. "14:32:05"
  rawDate?: string; // ISO string
  eventDescription: string;
  eventSource?: EventSource;
  eventStatus?: EventStatus;
  verificationResult?: 'MATCHED' | 'MISMATCHED' | 'CONFIRMED' | 'WARNING';
  details?: string;
  transcript?: string; // recognized voice text
  linkedStep?: string; // related clinical stage if tagged (e.g. 'IV_SITE_ASSESS')
  metadata?: {
    ivAssessment?: IvSiteAssessment;
    medicationName?: string;
    route?: string;
    notes?: string;
    scannedCode?: string;
    rawSpeechText?: string;
    transcript?: string;
    linkedStep?: string;
    source?: string;
    clinicalFindings?: any;
    fiveRightsVerified?: boolean;
    deviceType?: 'MOBILE_CAPTURE' | 'STATION_PC' | 'WEARABLE';
    [key: string]: any;
  };
}

export interface Patient {
  id: string; // e.g. "TEST-P001"
  name: string; // "홍길동"
  gender: 'M' | 'F';
  age: number; // 65
  room: string; // "305호-B"
  department: string; // "내과 (Internal Medicine)"
  diagnosis: string; // "폐렴 의증 (R/O Pneumonia) - 가상 데이터"
  admissionDate: string;
  attendingPhysician: string;
  bloodType: string;
  allergies: string[];
  bedNumber?: string;
}

export interface MedicationOrder {
  id: string; // e.g. "RX-2026-0923-004"
  prescriptionId?: string; // alias for id
  patientId: string;
  medicationName: string; // "모의 IV 항생제 A"
  route: string; // "IV (정맥주사)"
  status: 'PENDING_VERIFY' | 'VERIFIED' | 'IN_PROGRESS' | 'ADMINISTERED';
  dosage: string;
  instructions: string;
  prescribedDoctor: string;
  orderTime: string;
  isEducationalMock: boolean;
  barcodeValue?: string; // Code 128 raw string
}

// Prescription is maintained as an alias/subtype for backward compatibility
export type Prescription = MedicationOrder;

export interface EditHistoryItem {
  version: number;
  content: string;
  editedAt: string;
  editor: string;
  reason?: string;
}

export interface NursingRecord {
  id: string; // Unique Note ID
  recordId?: string; // alias for id
  patientId: string;
  sessionId?: string;
  nurseId?: string;
  nurseUid?: string;
  content: string;
  status: 'DRAFT_PENDING_REVIEW' | 'APPROVED';
  version: number;
  generatedBy: string; // "Gemini 3.8 Flash (AI 보조)" | "간호사 직접 작성"
  generatedAt: string;
  approvedAt?: string;
  approver?: string; // "양두영 간호사"
  approverId?: string;
  approverUid?: string;
  editHistory: EditHistoryItem[];
  emrTransmitted: boolean;
  emrTransmittedAt?: string;
}

// DraftNote is maintained as an alias for backward compatibility
export type DraftNote = NursingRecord;

export interface EMRTransfer {
  transferId: string; // Unique transfer ID
  nursingRecordId?: string;
  sessionId?: string;
  nurseUid?: string;
  emrRecordId: string;
  chartNumber: string;
  patientId: string;
  patientName: string;
  room: string;
  content: string;
  approvedNurse: string;
  approvedNurseId?: string;
  approvedAt: string;
  transferredAt: string;
  version: number;
  status: 'TRANSMITTED' | 'FAILED' | 'PENDING';
  signatureHash: string;
  eventCount: number;
  eventsSummary: string[];
  targetSystem?: string; // e.g. "Virtual Hospital EMR v4.2"
}

// EmrRecord is maintained as an alias for backward compatibility
export type EmrRecord = EMRTransfer;

export type TransmissionStatus = 'IDLE' | 'PENDING' | 'TRANSMITTING' | 'SUCCESS' | 'ERROR';

export interface DemoSession {
  sessionId: string;
  ownerUid?: string;
  participantUids?: string[];
  activeNurseUid?: string;
  handoffHistory?: Array<{ fromUid: string; toUid: string; at: string }>;
  sessionNumber: number;
  nurseId?: string;
  patientId?: string;
  status?: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  startedAt: string;
  endedAt?: string;
  eventsCount: number;
  emrTransmitted: boolean;
  lastSyncAt?: string;
}

export type AppMode = 'PORTAL' | 'STATION' | 'CAPTURE';

export interface SyncStatus {
  isCloudConnected: boolean; // false until actual Firebase is provisioned
  isLocalSynced: boolean; // true via BroadcastChannel
  lastEventId?: string;
  channelClientsCount: number;
  mode: AppMode;
}
