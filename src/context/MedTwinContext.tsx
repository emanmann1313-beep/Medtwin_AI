import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  CaregiverConnection,
  CaregiverPermissions,
  DadiNaniEntry,
  DemoAccount,
  FamilyMedicalHistoryItem,
  MedTwinState,
  MedicationStatus,
  Patient,
  WorkspaceRole,
} from '@/src/types/medtwin';
import { DEMO_ACCOUNTS } from '@/src/data/seedData';
import {
  ConfirmPrescriptionInput,
  CreateCaregiverInviteInput,
  LogDoseInput,
  demoMedTwinService,
} from '@/src/services/medtwinService';
import { useToast } from '@/src/components/ui/toast';

interface MedTwinContextValue {
  state: MedTwinState;
  isLoading: boolean;
  activeDemoAccount: DemoAccount;
  activeRole: WorkspaceRole;
  activePatient: Patient;
  dadiNaniMode: boolean;
  setDadiNaniMode: (val: boolean) => void;
  assistantOpen: boolean;
  setAssistantOpen: (val: boolean) => void;
  switchDemoAccount: (accountId: string) => void;
  setActivePatientId: (patientId: string) => void;
  resetDemo: () => void;
  logDose: (input: Omit<LogDoseInput, 'recordedBy' | 'actorRole'>) => void;
  undoDose: (logId: string) => void;
  confirmPrescription: (input: Omit<ConfirmPrescriptionInput, 'confirmedBy'>) => void;
  updateMedicationStatus: (medicationId: string, status: MedicationStatus) => void;
  replenishMedicationStock: (medicationId: string, addUnits: number) => void;
  createSimulatedAlert: (input: {
    patientId: string;
    caregiverId?: string;
    title: string;
    reason: string;
    severity: 'attention' | 'urgent';
  }) => boolean;
  acknowledgeAlert: (alertId: string, followUpNote?: string) => void;
  inviteCaregiver: (input: CreateCaregiverInviteInput) => void;
  respondCaregiverInvite: (connectionId: string, decision: 'accepted' | 'revoked') => void;
  updateCaregiverPermissions: (
    connectionId: string,
    permissions: CaregiverPermissions,
    alertPreferences?: CaregiverConnection['alertPreferences'],
  ) => void;
  addFamilyMedicalHistory: (item: Omit<FamilyMedicalHistoryItem, 'id' | 'recordedAt'>) => void;
  addClinicianNote: (input: { patientId: string; title: string; content: string }) => void;
  addDadiNaniEntry: (input: Omit<DadiNaniEntry, 'id' | 'createdAt' | 'authorName'>) => void;
  assignPatientDoctor: (patientId: string, doctorId: string) => void;
  enrollPatient: (input: {
    name: string;
    age: number;
    gender: string;
    bloodGroup?: string;
    assignedDoctorId: string;
    conditions: string[];
  }) => void;
  toggleManagedUserActive: (userId: string) => void;
}

const MedTwinContext = createContext<MedTwinContextValue | null>(null);

export function MedTwinProvider({ children }: { children: React.ReactNode }) {
  const { pushToast } = useToast();
  const [state, setState] = useState<MedTwinState>(() => demoMedTwinService.loadState());
  const [isLoading, setIsLoading] = useState(true);
  const [activeDemoAccountId, setActiveDemoAccountId] = useState<string>(DEMO_ACCOUNTS[0].id);
  const [dadiNaniMode, setDadiNaniMode] = useState<boolean>(false);
  const [assistantOpen, setAssistantOpen] = useState<boolean>(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 180);
    return () => window.clearTimeout(timer);
  }, []);

  const activeDemoAccount = useMemo(
    () => DEMO_ACCOUNTS.find((a) => a.id === activeDemoAccountId) ?? DEMO_ACCOUNTS[0],
    [activeDemoAccountId],
  );

  const activeRole = activeDemoAccount.role;

  const activePatient = useMemo(
    () => state.patients.find((p) => p.id === state.activePatientId) ?? state.patients[0],
    [state.patients, state.activePatientId],
  );

  const switchDemoAccount = useCallback(
    (accountId: string) => {
      const account = DEMO_ACCOUNTS.find((a) => a.id === accountId);
      if (!account) return;
      setActiveDemoAccountId(account.id);

      setState((prev) => {
        const next = { ...prev };
        if (account.role === 'patient') {
          next.activePatientId = account.actorId;
        } else if (account.role === 'caregiver') {
          next.activeCaregiverId = account.actorId;
        } else if (account.role === 'doctor') {
          next.activeDoctorId = account.actorId;
        }
        demoMedTwinService.saveState(next);
        return next;
      });

      if (account.id === 'demo-patient-2') {
        setDadiNaniMode(true);
      }

      pushToast({
        title: `Switched demo workspace`,
        description: `Viewing as ${account.actorName} (${account.role.replace('_', ' ')}).`,
        variant: 'info',
      });
    },
    [pushToast],
  );

  const setActivePatientId = useCallback((patientId: string) => {
    setState((prev) => {
      const next = { ...prev, activePatientId: patientId };
      demoMedTwinService.saveState(next);
      return next;
    });
  }, []);

  const resetDemo = useCallback(() => {
    const fresh = demoMedTwinService.resetDemoState();
    setState(fresh);
    setActiveDemoAccountId(DEMO_ACCOUNTS[0].id);
    setDadiNaniMode(false);
    pushToast({
      title: 'Demo data reset',
      description: 'Restored all 12 synthetic patients, schedules, and Care Circle states.',
      variant: 'success',
    });
  }, [pushToast]);

  const logDose = useCallback(
    (input: Omit<LogDoseInput, 'recordedBy' | 'actorRole'>) => {
      setState((prev) => {
        const next = demoMedTwinService.logDose(prev, {
          ...input,
          recordedBy: activeDemoAccount.actorName,
          actorRole: activeRole,
        });
        if (next === prev) {
          pushToast({
            title: 'Dose already recorded',
            description: 'This scheduled slot was already logged.',
            variant: 'info',
          });
          return prev;
        }
        pushToast({
          title: input.status === 'taken' ? 'Dose marked as taken' : 'Skipped dose recorded',
          description: 'Schedule, adherence charts, and care history updated.',
          variant: input.status === 'taken' ? 'success' : 'warning',
        });
        return next;
      });
    },
    [activeDemoAccount.actorName, activeRole, pushToast],
  );

  const undoDose = useCallback(
    (logId: string) => {
      setState((prev) => demoMedTwinService.undoDose(prev, logId, activeDemoAccount.actorName));
      pushToast({
        title: 'Entry undone',
        description: 'Dose log removed and medication stock restored.',
        variant: 'info',
      });
    },
    [activeDemoAccount.actorName, pushToast],
  );

  const confirmPrescription = useCallback(
    (input: Omit<ConfirmPrescriptionInput, 'confirmedBy'>) => {
      setState((prev) =>
        demoMedTwinService.confirmPrescriptionAndCreateSchedule(prev, {
          ...input,
          confirmedBy: activeDemoAccount.actorName,
        }),
      );
      pushToast({
        title: 'Prescription confirmed',
        description: 'New medication schedule activated and logged to care history.',
        variant: 'success',
      });
    },
    [activeDemoAccount.actorName, pushToast],
  );

  const updateMedicationStatus = useCallback(
    (medicationId: string, status: MedicationStatus) => {
      setState((prev) =>
        demoMedTwinService.updateMedicationStatus(
          prev,
          medicationId,
          status,
          activeDemoAccount.actorName,
          activeRole,
        ),
      );
      pushToast({
        title: `Medication marked ${status}`,
        variant: 'info',
      });
    },
    [activeDemoAccount.actorName, activeRole, pushToast],
  );

  const replenishMedicationStock = useCallback(
    (medicationId: string, addUnits: number) => {
      setState((prev) =>
        demoMedTwinService.replenishMedicationStock(
          prev,
          medicationId,
          addUnits,
          activeDemoAccount.actorName,
        ),
      );
      pushToast({
        title: 'Refill recorded',
        description: `Added +${addUnits} units to medication supply.`,
        variant: 'success',
      });
    },
    [activeDemoAccount.actorName, pushToast],
  );

  const createSimulatedAlert = useCallback(
    (input: {
      patientId: string;
      caregiverId?: string;
      title: string;
      reason: string;
      severity: 'attention' | 'urgent';
    }) => {
      let created = false;
      setState((prev) => {
        const next = demoMedTwinService.createSimulatedAlert(prev, input);
        created = next !== prev;
        return next;
      });
      if (created) {
        pushToast({
          title: 'Simulated caregiver alert sent',
          description: 'Visible in Care Circle and Caregiver Workspace.',
          variant: 'warning',
        });
      } else {
        pushToast({
          title: 'No consented caregiver recipient',
          description: 'Enable "Receive dose alerts" on an accepted Care Circle member first.',
          variant: 'error',
        });
      }
      return created;
    },
    [pushToast],
  );

  const acknowledgeAlert = useCallback(
    (alertId: string, followUpNote?: string) => {
      setState((prev) =>
        demoMedTwinService.acknowledgeAlert(prev, alertId, activeDemoAccount.actorName, followUpNote),
      );
      pushToast({
        title: 'Alert acknowledged',
        description: 'Acknowledgement and follow-up note added to patient care history.',
        variant: 'success',
      });
    },
    [activeDemoAccount.actorName, pushToast],
  );

  const inviteCaregiver = useCallback(
    (input: CreateCaregiverInviteInput) => {
      setState((prev) => demoMedTwinService.inviteCaregiver(prev, input));
      pushToast({
        title: 'Care Circle invitation created',
        description: `Sent simulated invite to ${input.caregiverName}.`,
        variant: 'success',
      });
    },
    [pushToast],
  );

  const respondCaregiverInvite = useCallback(
    (connectionId: string, decision: 'accepted' | 'revoked') => {
      setState((prev) => demoMedTwinService.respondCaregiverInvite(prev, connectionId, decision));
      pushToast({
        title: decision === 'accepted' ? 'Care Circle connection accepted' : 'Access revoked',
        variant: decision === 'accepted' ? 'success' : 'warning',
      });
    },
    [pushToast],
  );

  const updateCaregiverPermissions = useCallback(
    (
      connectionId: string,
      permissions: CaregiverPermissions,
      alertPreferences?: CaregiverConnection['alertPreferences'],
    ) => {
      setState((prev) =>
        demoMedTwinService.updateCaregiverPermissions(
          prev,
          connectionId,
          permissions,
          alertPreferences,
        ),
      );
      pushToast({
        title: 'Permissions updated',
        description: 'Caregiver access settings saved.',
        variant: 'success',
      });
    },
    [pushToast],
  );

  const addFamilyMedicalHistory = useCallback(
    (item: Omit<FamilyMedicalHistoryItem, 'id' | 'recordedAt'>) => {
      setState((prev) => demoMedTwinService.addFamilyMedicalHistory(prev, item));
      pushToast({
        title: 'Family history recorded',
        description: 'Stored separately from Care Circle access permissions.',
        variant: 'success',
      });
    },
    [pushToast],
  );

  const addClinicianNote = useCallback(
    (input: { patientId: string; title: string; content: string }) => {
      setState((prev) =>
        demoMedTwinService.addClinicianNote(prev, {
          ...input,
          doctorId: prev.activeDoctorId,
          doctorName:
            prev.doctors.find((d) => d.id === prev.activeDoctorId)?.name ??
            activeDemoAccount.actorName,
        }),
      );
      pushToast({
        title: 'Clinician note saved',
        description: 'Audit trail entry recorded and patient review date updated.',
        variant: 'success',
      });
    },
    [activeDemoAccount.actorName, pushToast],
  );

  const addDadiNaniEntry = useCallback(
    (input: Omit<DadiNaniEntry, 'id' | 'createdAt' | 'authorName'>) => {
      setState((prev) =>
        demoMedTwinService.addDadiNaniEntry(prev, {
          ...input,
          authorName: activePatient.name,
        }),
      );
      pushToast({
        title: 'Shared via Dadi-Nani Mode',
        description: input.sharedWithCareCircle
          ? 'Saved to Care History and shared with consented Care Circle.'
          : 'Saved to your personal comfort & problem journal.',
        variant: 'success',
      });
    },
    [activePatient.name, pushToast],
  );

  const assignPatientDoctor = useCallback(
    (patientId: string, doctorId: string) => {
      setState((prev) =>
        demoMedTwinService.assignPatientDoctor(
          prev,
          patientId,
          doctorId,
          activeDemoAccount.actorName,
        ),
      );
      pushToast({
        title: 'Care team assignment updated',
        variant: 'success',
      });
    },
    [activeDemoAccount.actorName, pushToast],
  );

  const enrollPatient = useCallback(
    (input: {
      name: string;
      age: number;
      gender: string;
      bloodGroup?: string;
      assignedDoctorId: string;
      conditions: string[];
    }) => {
      setState((prev) => demoMedTwinService.enrollPatient(prev, input));
      pushToast({
        title: 'Patient enrolled',
        description: `${input.name} registered at ${state.hospital.name}.`,
        variant: 'success',
      });
    },
    [pushToast, state.hospital.name],
  );

  const toggleManagedUserActive = useCallback(
    (userId: string) => {
      setState((prev) => demoMedTwinService.toggleManagedUserActive(prev, userId));
      pushToast({
        title: 'Staff access status updated',
        variant: 'info',
      });
    },
    [pushToast],
  );

  const value: MedTwinContextValue = {
    state,
    isLoading,
    activeDemoAccount,
    activeRole,
    activePatient,
    dadiNaniMode,
    setDadiNaniMode,
    assistantOpen,
    setAssistantOpen,
    switchDemoAccount,
    setActivePatientId,
    resetDemo,
    logDose,
    undoDose,
    confirmPrescription,
    updateMedicationStatus,
    replenishMedicationStock,
    createSimulatedAlert,
    acknowledgeAlert,
    inviteCaregiver,
    respondCaregiverInvite,
    updateCaregiverPermissions,
    addFamilyMedicalHistory,
    addClinicianNote,
    addDadiNaniEntry,
    assignPatientDoctor,
    enrollPatient,
    toggleManagedUserActive,
  };

  return <MedTwinContext.Provider value={value}>{children}</MedTwinContext.Provider>;
}

export function useMedTwin() {
  const ctx = useContext(MedTwinContext);
  if (!ctx) {
    throw new Error('useMedTwin must be used inside MedTwinProvider');
  }
  return ctx;
}
