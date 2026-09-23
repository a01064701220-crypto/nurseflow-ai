import {
  Patient,
  Prescription,
  NursingEvent,
  DraftNote,
  EmrRecord,
  DemoSession,
} from '../types';
import {
  StorageService,
  DEFAULT_PATIENT,
  DEFAULT_PRESCRIPTION,
  DEFAULT_NURSE,
} from './storageService';

export const INITIAL_PATIENT: Patient = DEFAULT_PATIENT;
export const INITIAL_PRESCRIPTION: Prescription = DEFAULT_PRESCRIPTION;

export class EmrService {
  static loadEvents(): NursingEvent[] {
    return StorageService.loadEvents();
  }

  static saveEvents(events: NursingEvent[]): void {
    StorageService.saveEvents(events);
  }

  static loadDraft(): DraftNote | null {
    return StorageService.loadDraft();
  }

  static saveDraft(draft: DraftNote | null): void {
    StorageService.saveDraft(draft);
  }

  static loadPrescription(): Prescription {
    return StorageService.loadPrescription();
  }

  static savePrescription(prescription: Prescription): void {
    StorageService.savePrescription(prescription);
  }

  static loadEmrRecords(): EmrRecord[] {
    return StorageService.loadEmrRecords();
  }

  static saveEmrRecords(records: EmrRecord[]): void {
    StorageService.saveEmrRecords(records);
  }

  static getCurrentSession(): DemoSession {
    return StorageService.getCurrentSession();
  }

  static async startNewSession(): Promise<DemoSession> {
    return await StorageService.startNewSession();
  }

  /**
   * Decoupled transmission interface to simulate hospital EMR / HIS interface.
   * Prevents duplicate transmissions and attaches electronic signature hash.
   */
  static async transmitToEmr(
    draftNote: DraftNote,
    events: NursingEvent[],
    patient: Patient
  ): Promise<{ success: boolean; emrRecord: EmrRecord }> {
    if (draftNote.status !== 'APPROVED') {
      throw new Error('승인되지 않은 기록은 EMR에 전송할 수 없습니다.');
    }

    // Simulate network delay (1.0s)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const existingRecords = this.loadEmrRecords();
    // Prevent duplicate transmission of identical version
    const duplicate = existingRecords.find(
      (r) => r.patientId === patient.id && r.version === draftNote.version && r.content === draftNote.content
    );
    if (duplicate) {
      return { success: true, emrRecord: duplicate };
    }

    const now = new Date();
    const formattedNow = now.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const signatureHash = `SHA256-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now().toString(16).toUpperCase()}`;

    const newEmrRecord: EmrRecord = {
      transferId: `TR-${Date.now()}`,
      emrRecordId: `EMR-${patient.id}-${Date.now()}`,
      chartNumber: `CHART-5W-${Math.floor(100000 + Math.random() * 900000)}`,
      patientId: patient.id,
      patientName: patient.name,
      room: patient.room,
      content: draftNote.content,
      approvedNurse: draftNote.approver || `${DEFAULT_NURSE.nurseName} 간호사`,
      approvedNurseId: DEFAULT_NURSE.nurseId,
      approvedAt: draftNote.approvedAt || formattedNow,
      transferredAt: formattedNow,
      version: draftNote.version,
      status: 'TRANSMITTED',
      signatureHash,
      eventCount: events.length,
      eventsSummary: events.map((e) => `[${e.eventTimestamp}] ${e.eventType} - ${e.eventDescription}`),
      targetSystem: '가상 차트 연계 서버 (Virtual Hospital EMR v4.2)',
    };

    const updated = [newEmrRecord, ...existingRecords];
    this.saveEmrRecords(updated);

    const updatedDraft: DraftNote = {
      ...draftNote,
      emrTransmitted: true,
      emrTransmittedAt: formattedNow,
    };
    this.saveDraft(updatedDraft);

    return { success: true, emrRecord: newEmrRecord };
  }

  static loadPastSessions(): DemoSession[] {
    return [this.getCurrentSession()];
  }
}
