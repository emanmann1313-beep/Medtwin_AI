import {
  CareAlert,
  CaregiverConnection,
  CaregiverPermissions,
  ClinicianNote,
  DadiNaniEntry,
  FamilyMedicalHistoryItem,
  MedTwinState,
  MedicationStatus,
  Prescription,
  RelationshipLabel,
  WorkspaceRole,
} from '@/src/types/medtwin';
import { buildSeedState } from '@/src/data/seedData';
import { addDaysIso } from '@/src/lib/utils';
import { getTodayIso } from '@/src/services/adherenceEngine';

const DEMO_STORAGE_KEY = 'medtwin_demo_state_v1';

export interface LogDoseInput {
  patientId: string;
  medicationId: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'taken' | 'skipped';
  skipReason?: string;
  recordedBy: string;
  actorRole: WorkspaceRole;
}

export interface ConfirmPrescriptionInput {
  patientId: string;
  prescription: Omit<Prescription, 'id' | 'createdAt' | 'status' | 'confirmedAt'>;
  confirmedBy: string;
}

export interface CreateCaregiverInviteInput {
  patientId: string;
  caregiverName: string;
  caregiverEmail: string;
  relationship: RelationshipLabel;
  contactPriority: 'primary' | 'secondary';
  permissions: CaregiverPermissions;
}

export interface IMedTwinService {
  loadState(): MedTwinState;
  saveState(state: MedTwinState): void;
  resetDemoState(): MedTwinState;
  logDose(state: MedTwinState, input: LogDoseInput): MedTwinState;
  undoDose(state: MedTwinState, logId: string, actorName: string): MedTwinState;
  confirmPrescriptionAndCreateSchedule(
    state: MedTwinState,
    input: ConfirmPrescriptionInput,
  ): MedTwinState;
  updateMedicationStatus(
    state: MedTwinState,
    medicationId: string,
    status: MedicationStatus,
    actorName: string,
    actorRole: WorkspaceRole,
  ): MedTwinState;
  replenishMedicationStock(
    state: MedTwinState,
    medicationId: string,
    addUnits: number,
    actorName: string,
  ): MedTwinState;
  createSimulatedAlert(
    state: MedTwinState,
    input: {
      patientId: string;
      caregiverId?: string;
      title: string;
      reason: string;
      severity: 'attention' | 'urgent';
    },
  ): MedTwinState;
  acknowledgeAlert(
    state: MedTwinState,
    alertId: string,
    caregiverName: string,
    followUpNote?: string,
  ): MedTwinState;
  inviteCaregiver(state: MedTwinState, input: CreateCaregiverInviteInput): MedTwinState;
  respondCaregiverInvite(
    state: MedTwinState,
    connectionId: string,
    decision: 'accepted' | 'revoked',
  ): MedTwinState;
  updateCaregiverPermissions(
    state: MedTwinState,
    connectionId: string,
    permissions: CaregiverPermissions,
    alertPreferences?: CaregiverConnection['alertPreferences'],
  ): MedTwinState;
  addFamilyMedicalHistory(
    state: MedTwinState,
    item: Omit<FamilyMedicalHistoryItem, 'id' | 'recordedAt'>,
  ): MedTwinState;
  addClinicianNote(
    state: MedTwinState,
    input: { patientId: string; doctorId: string; doctorName: string; title: string; content: string },
  ): MedTwinState;
  addDadiNaniEntry(
    state: MedTwinState,
    input: Omit<DadiNaniEntry, 'id' | 'createdAt'>,
  ): MedTwinState;
  assignPatientDoctor(
    state: MedTwinState,
    patientId: string,
    doctorId: string,
    adminName: string,
  ): MedTwinState;
  enrollPatient(
    state: MedTwinState,
    input: {
      name: string;
      age: number;
      gender: string;
      bloodGroup?: string;
      assignedDoctorId: string;
      conditions: string[];
    },
  ): MedTwinState;
  toggleManagedUserActive(state: MedTwinState, userId: string): MedTwinState;
}

export const demoMedTwinService: IMedTwinService = {
  loadState(): MedTwinState {
    try {
      const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
      if (!raw) {
        const fresh = buildSeedState();
        window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(fresh));
        return fresh;
      }
      return JSON.parse(raw) as MedTwinState;
    } catch {
      return buildSeedState();
    }
  },

  saveState(state: MedTwinState): void {
    try {
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors in restricted sandboxes
    }
  },

  resetDemoState(): MedTwinState {
    const fresh = buildSeedState();
    this.saveState(fresh);
    return fresh;
  },

  logDose(state: MedTwinState, input: LogDoseInput): MedTwinState {
    const existing = state.doseLogs.find(
      (l) =>
        l.patientId === input.patientId &&
        l.medicationId === input.medicationId &&
        l.scheduledDate === input.scheduledDate &&
        l.scheduledTime === input.scheduledTime,
    );

    // Prevent duplicate dose records or double stock subtraction on repeated clicks
    if (existing) {
      return state;
    }

    const med = state.medications.find((m) => m.id === input.medicationId);
    const nowIso = new Date().toISOString();
    const newLogId = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const nextLogs = [
      ...state.doseLogs,
      {
        id: newLogId,
        patientId: input.patientId,
        medicationId: input.medicationId,
        scheduledDate: input.scheduledDate,
        scheduledTime: input.scheduledTime,
        status: input.status,
        skipReason: input.skipReason?.trim() || undefined,
        recordedAt: nowIso,
        recordedBy: input.recordedBy,
      },
    ];

    // Subtract 1 unit from remainingQuantity only when marked taken
    const nextMeds = state.medications.map((m) => {
      if (m.id !== input.medicationId) return m;
      if (input.status === 'taken' && typeof m.remainingQuantity === 'number') {
        return {
          ...m,
          remainingQuantity: Math.max(0, m.remainingQuantity - 1),
          updatedAt: nowIso,
        };
      }
      return m;
    });

    const nextHistory = [
      {
        id: `hist-${Date.now()}`,
        patientId: input.patientId,
        category: 'dose' as const,
        title: `${med?.name ?? 'Medication'} ${med?.strength ?? ''} marked ${input.status}`,
        details:
          input.status === 'taken'
            ? `Confirmed for ${input.scheduledDate} at ${input.scheduledTime}.`
            : `Skipped for ${input.scheduledDate} at ${input.scheduledTime}${input.skipReason ? ` · Reason: ${input.skipReason}` : ''}.`,
        actorName: input.recordedBy,
        actorRole: input.actorRole,
        timestamp: nowIso,
        sourceId: newLogId,
      },
      ...state.history,
    ];

    const updated: MedTwinState = {
      ...state,
      doseLogs: nextLogs,
      medications: nextMeds,
      history: nextHistory,
    };
    this.saveState(updated);
    return updated;
  },

  undoDose(state: MedTwinState, logId: string, actorName: string): MedTwinState {
    const target = state.doseLogs.find((l) => l.id === logId);
    if (!target) return state;

    const nowIso = new Date().toISOString();
    const med = state.medications.find((m) => m.id === target.medicationId);

    const nextLogs = state.doseLogs.filter((l) => l.id !== logId);
    const nextMeds = state.medications.map((m) => {
      if (m.id !== target.medicationId) return m;
      if (target.status === 'taken' && typeof m.remainingQuantity === 'number') {
        return {
          ...m,
          remainingQuantity: m.remainingQuantity + 1,
          updatedAt: nowIso,
        };
      }
      return m;
    });

    const nextHistory = [
      {
        id: `hist-${Date.now()}`,
        patientId: target.patientId,
        category: 'medication_change' as const,
        title: `Undid dose entry for ${med?.name ?? 'Medication'}`,
        details: `Reverted ${target.status} entry for ${target.scheduledDate} at ${target.scheduledTime}.`,
        actorName,
        actorRole: 'patient' as const,
        timestamp: nowIso,
      },
      ...state.history,
    ];

    const updated: MedTwinState = {
      ...state,
      doseLogs: nextLogs,
      medications: nextMeds,
      history: nextHistory,
    };
    this.saveState(updated);
    return updated;
  },

  confirmPrescriptionAndCreateSchedule(
    state: MedTwinState,
    input: ConfirmPrescriptionInput,
  ): MedTwinState {
    const nowIso = new Date().toISOString();
    const todayStr = getTodayIso();
    const rxId = `rx-${Date.now()}`;

    const newRx: Prescription = {
      ...input.prescription,
      id: rxId,
      status: 'confirmed',
      createdAt: nowIso,
      confirmedAt: nowIso,
    };

    const newMeds = input.prescription.items.map((item, idx) => {
      const duration = item.durationDays && item.durationDays > 0 ? item.durationDays : 30;
      const times =
        item.scheduledTimes && item.scheduledTimes.length > 0 ? item.scheduledTimes : ['08:00'];
      return {
        id: `med-${Date.now()}-${idx}`,
        patientId: input.patientId,
        prescriptionId: rxId,
        name: item.medicineName,
        strength: item.strength || 'Unspecified',
        doseAndRoute: item.doseAndRoute || '1 tablet oral',
        instructions: item.instructions || 'Take as prescribed.',
        scheduledTimes: times,
        startDate: todayStr,
        endDate: addDaysIso(todayStr, duration),
        remainingQuantity: item.quantity,
        unitLabel: 'units',
        refillThresholdDays: 7,
        status: 'active' as const,
        prescriberName: input.prescription.prescriberName || 'Prescriber on file',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    });

    const newHistory = [
      {
        id: `hist-${Date.now()}`,
        patientId: input.patientId,
        category: 'prescription' as const,
        title: `Confirmed prescription (${input.prescription.fileName})`,
        details: `Activated ${newMeds.length} medication schedule(s): ${newMeds
          .map((m) => `${m.name} ${m.strength}`)
          .join(', ')}.`,
        actorName: input.confirmedBy,
        actorRole: 'patient' as const,
        timestamp: nowIso,
        sourceId: rxId,
      },
      ...state.history,
    ];

    const updated: MedTwinState = {
      ...state,
      prescriptions: [newRx, ...state.prescriptions],
      medications: [...newMeds, ...state.medications],
      history: newHistory,
    };
    this.saveState(updated);
    return updated;
  },

  updateMedicationStatus(
    state: MedTwinState,
    medicationId: string,
    status: MedicationStatus,
    actorName: string,
    actorRole: WorkspaceRole,
  ): MedTwinState {
    const nowIso = new Date().toISOString();
    const target = state.medications.find((m) => m.id === medicationId);
    if (!target) return state;

    const nextMeds = state.medications.map((m) =>
      m.id === medicationId ? { ...m, status, updatedAt: nowIso } : m,
    );

    const nextHistory = [
      {
        id: `hist-${Date.now()}`,
        patientId: target.patientId,
        category: 'medication_change' as const,
        title: `${target.name} ${target.strength} marked ${status}`,
        details: `Medication status updated from ${target.status} to ${status}.`,
        actorName,
        actorRole,
        timestamp: nowIso,
        sourceId: medicationId,
      },
      ...state.history,
    ];

    const updated: MedTwinState = { ...state, medications: nextMeds, history: nextHistory };
    this.saveState(updated);
    return updated;
  },

  replenishMedicationStock(
    state: MedTwinState,
    medicationId: string,
    addUnits: number,
    actorName: string,
  ): MedTwinState {
    const nowIso = new Date().toISOString();
    const target = state.medications.find((m) => m.id === medicationId);
    if (!target || addUnits <= 0) return state;

    const nextMeds = state.medications.map((m) =>
      m.id === medicationId
        ? {
            ...m,
            remainingQuantity: (m.remainingQuantity ?? 0) + addUnits,
            updatedAt: nowIso,
          }
        : m,
    );

    const nextHistory = [
      {
        id: `hist-${Date.now()}`,
        patientId: target.patientId,
        category: 'refill' as const,
        title: `Refill logged for ${target.name} ${target.strength}`,
        details: `Added +${addUnits} ${target.unitLabel} to remaining supply.`,
        actorName,
        actorRole: 'patient' as const,
        timestamp: nowIso,
        sourceId: medicationId,
      },
      ...state.history,
    ];

    const updated: MedTwinState = { ...state, medications: nextMeds, history: nextHistory };
    this.saveState(updated);
    return updated;
  },

  createSimulatedAlert(
    state: MedTwinState,
    input: {
      patientId: string;
      caregiverId?: string;
      title: string;
      reason: string;
      severity: 'attention' | 'urgent';
    },
  ): MedTwinState {
    const nowIso = new Date().toISOString();
    const acceptedConn = state.connections.find(
      (c) =>
        c.patientId === input.patientId &&
        c.status === 'accepted' &&
        c.permissions.receiveDoseAlerts &&
        (!input.caregiverId || c.caregiverId === input.caregiverId),
    );

    if (!acceptedConn) {
      return state;
    }

    const newAlert: CareAlert = {
      id: `alert-${Date.now()}`,
      patientId: input.patientId,
      caregiverId: acceptedConn.caregiverId,
      title: input.title,
      reason: input.reason,
      severity: input.severity,
      deliveryState: 'sent',
      simulated: true,
      channelLabel: `Simulated notification to ${acceptedConn.caregiverName}`,
      createdAt: nowIso,
    };

    const nextHistory = [
      {
        id: `hist-${Date.now()}`,
        patientId: input.patientId,
        category: 'caregiver_alert' as const,
        title: `Simulated Care Circle alert sent`,
        details: `${input.title} · Recipient: ${acceptedConn.caregiverName}`,
        actorName: 'MedTwin Alert Engine (Simulated)',
        actorRole: 'system' as const,
        timestamp: nowIso,
        sourceId: newAlert.id,
      },
      ...state.history,
    ];

    const updated: MedTwinState = {
      ...state,
      alerts: [newAlert, ...state.alerts],
      history: nextHistory,
    };
    this.saveState(updated);
    return updated;
  },

  acknowledgeAlert(
    state: MedTwinState,
    alertId: string,
    caregiverName: string,
    followUpNote?: string,
  ): MedTwinState {
    const nowIso = new Date().toISOString();
    const target = state.alerts.find((a) => a.id === alertId);
    if (!target) return state;

    const nextAlerts = state.alerts.map((a) =>
      a.id === alertId
        ? {
            ...a,
            deliveryState: 'acknowledged' as const,
            acknowledgedAt: nowIso,
            acknowledgedBy: caregiverName,
            followUpNote: followUpNote?.trim() || a.followUpNote,
          }
        : a,
    );

    const nextHistory = [
      {
        id: `hist-${Date.now()}`,
        patientId: target.patientId,
        category: 'caregiver_alert' as const,
        title: `Caregiver acknowledged alert`,
        details: `${target.title}${followUpNote ? ` · Follow-up: ${followUpNote}` : ''}`,
        actorName: caregiverName,
        actorRole: 'caregiver' as const,
        timestamp: nowIso,
        sourceId: alertId,
      },
      ...state.history,
    ];

    const updated: MedTwinState = {
      ...state,
      alerts: nextAlerts,
      history: nextHistory,
    };
    this.saveState(updated);
    return updated;
  },

  inviteCaregiver(state: MedTwinState, input: CreateCaregiverInviteInput): MedTwinState {
    const nowIso = new Date().toISOString();
    let caregiver = state.caregivers.find(
      (c) => c.email.toLowerCase() === input.caregiverEmail.toLowerCase(),
    );
    const nextCaregivers = [...state.caregivers];
    if (!caregiver) {
      caregiver = {
        id: `cg-${Date.now()}`,
        name: input.caregiverName,
        email: input.caregiverEmail,
        phoneLabel: 'Simulated Notification Channel',
      };
      nextCaregivers.push(caregiver);
    }

    const newConn: CaregiverConnection = {
      id: `conn-${Date.now()}`,
      patientId: input.patientId,
      caregiverId: caregiver.id,
      caregiverName: caregiver.name,
      relationship: input.relationship,
      contactPriority: input.contactPriority,
      status: 'invited',
      permissions: input.permissions,
      alertPreferences: {
        repeatedMissedThreshold: 2,
        notifyOnRefillNeeded: input.permissions.receiveDoseAlerts,
        notifyOnDadiNaniShare: true,
      },
      invitedAt: nowIso.slice(0, 10),
    };

    const updated: MedTwinState = {
      ...state,
      caregivers: nextCaregivers,
      connections: [newConn, ...state.connections],
    };
    this.saveState(updated);
    return updated;
  },

  respondCaregiverInvite(
    state: MedTwinState,
    connectionId: string,
    decision: 'accepted' | 'revoked',
  ): MedTwinState {
    const nowDate = new Date().toISOString().slice(0, 10);
    const nextConnections = state.connections.map((c) =>
      c.id === connectionId
        ? {
            ...c,
            status: decision,
            respondedAt: nowDate,
            permissions:
              decision === 'revoked'
                ? {
                    viewSchedules: false,
                    receiveDoseAlerts: false,
                    viewHistoryAndReports: false,
                    viewClinicianNotes: false,
                  }
                : c.permissions,
          }
        : c,
    );
    const updated: MedTwinState = { ...state, connections: nextConnections };
    this.saveState(updated);
    return updated;
  },

  updateCaregiverPermissions(
    state: MedTwinState,
    connectionId: string,
    permissions: CaregiverPermissions,
    alertPreferences?: CaregiverConnection['alertPreferences'],
  ): MedTwinState {
    const nextConnections = state.connections.map((c) =>
      c.id === connectionId
        ? {
            ...c,
            permissions,
            alertPreferences: alertPreferences ?? c.alertPreferences,
          }
        : c,
    );
    const updated: MedTwinState = { ...state, connections: nextConnections };
    this.saveState(updated);
    return updated;
  },

  addFamilyMedicalHistory(
    state: MedTwinState,
    item: Omit<FamilyMedicalHistoryItem, 'id' | 'recordedAt'>,
  ): MedTwinState {
    const newItem: FamilyMedicalHistoryItem = {
      ...item,
      id: `fmh-${Date.now()}`,
      recordedAt: new Date().toISOString().slice(0, 10),
    };
    const updated: MedTwinState = {
      ...state,
      familyMedicalHistory: [newItem, ...state.familyMedicalHistory],
    };
    this.saveState(updated);
    return updated;
  },

  addClinicianNote(
    state: MedTwinState,
    input: { patientId: string; doctorId: string; doctorName: string; title: string; content: string },
  ): MedTwinState {
    const nowIso = new Date().toISOString();
    const noteId = `note-${Date.now()}`;
    const newNote: ClinicianNote = {
      id: noteId,
      patientId: input.patientId,
      doctorId: input.doctorId,
      doctorName: input.doctorName,
      title: input.title,
      content: input.content,
      createdAt: nowIso,
      auditTrail: [
        {
          action: 'Note signed and published',
          actor: input.doctorName,
          timestamp: nowIso,
        },
      ],
    };

    const nextPatients = state.patients.map((p) =>
      p.id === input.patientId ? { ...p, lastReviewDate: nowIso.slice(0, 10) } : p,
    );

    const nextHistory = [
      {
        id: `hist-${Date.now()}`,
        patientId: input.patientId,
        category: 'clinician_note' as const,
        title: `Clinician note: ${input.title}`,
        details: input.content.slice(0, 140),
        actorName: input.doctorName,
        actorRole: 'doctor' as const,
        timestamp: nowIso,
        restrictedToClinician: true,
        sourceId: noteId,
      },
      ...state.history,
    ];

    const updated: MedTwinState = {
      ...state,
      patients: nextPatients,
      clinicianNotes: [newNote, ...state.clinicianNotes],
      history: nextHistory,
    };
    this.saveState(updated);
    return updated;
  },

  addDadiNaniEntry(
    state: MedTwinState,
    input: Omit<DadiNaniEntry, 'id' | 'createdAt'>,
  ): MedTwinState {
    const nowIso = new Date().toISOString();
    const entryId = `dn-${Date.now()}`;
    const newEntry: DadiNaniEntry = {
      ...input,
      id: entryId,
      createdAt: nowIso,
    };

    const nextHistory = [
      {
        id: `hist-${Date.now()}`,
        patientId: input.patientId,
        category: 'dadi_nani_share' as const,
        title: `Dadi-Nani Share: ${input.entryType.replace('_', ' ')}`,
        details: `${input.feelingSummary}${input.homeComfortNote ? ` · Comfort routine: ${input.homeComfortNote}` : ''}`,
        actorName: input.authorName,
        actorRole: 'patient' as const,
        timestamp: nowIso,
        sourceId: entryId,
      },
      ...state.history,
    ];

    let nextState: MedTwinState = {
      ...state,
      dadiNaniEntries: [newEntry, ...state.dadiNaniEntries],
      history: nextHistory,
    };

    if (input.sharedWithCareCircle) {
      const consented = nextState.connections.find(
        (c) =>
          c.patientId === input.patientId &&
          c.status === 'accepted' &&
          c.permissions.receiveDoseAlerts &&
          c.alertPreferences.notifyOnDadiNaniShare,
      );
      if (consented) {
        nextState = this.createSimulatedAlert(nextState, {
          patientId: input.patientId,
          caregiverId: consented.caregiverId,
          title: `Dadi-Nani update shared by ${input.authorName}`,
          reason: input.feelingSummary,
          severity: input.entryType === 'problem' ? 'attention' : 'attention',
        });
        return nextState;
      }
    }

    this.saveState(nextState);
    return nextState;
  },

  assignPatientDoctor(
    state: MedTwinState,
    patientId: string,
    doctorId: string,
    _adminName: string,
  ): MedTwinState {
    const nextPatients = state.patients.map((p) =>
      p.id === patientId ? { ...p, assignedDoctorId: doctorId } : p,
    );
    const updated: MedTwinState = { ...state, patients: nextPatients };
    this.saveState(updated);
    return updated;
  },

  enrollPatient(
    state: MedTwinState,
    input: {
      name: string;
      age: number;
      gender: string;
      bloodGroup?: string;
      assignedDoctorId: string;
      conditions: string[];
    },
  ): MedTwinState {
    const todayStr = getTodayIso();
    const nextNum = 10421 + state.patients.length;
    const newPatient = {
      id: `pat-${Date.now()}`,
      mrn: `MT-${nextNum}`,
      name: input.name,
      age: input.age,
      gender: input.gender,
      bloodGroup: input.bloodGroup?.trim() || undefined,
      hospitalId: state.hospital.id,
      assignedDoctorId: input.assignedDoctorId,
      conditions: input.conditions,
      allergies: ['None recorded'],
      nextFollowUpDate: addDaysIso(todayStr, 14),
      lastReviewDate: todayStr,
    };
    const updated: MedTwinState = {
      ...state,
      patients: [newPatient, ...state.patients],
    };
    this.saveState(updated);
    return updated;
  },

  toggleManagedUserActive(state: MedTwinState, userId: string): MedTwinState {
    const nextUsers = state.managedUsers.map((u) =>
      u.id === userId ? { ...u, active: !u.active } : u,
    );
    const updated: MedTwinState = { ...state, managedUsers: nextUsers };
    this.saveState(updated);
    return updated;
  },
};
