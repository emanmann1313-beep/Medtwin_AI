import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  AlertDeliveryState,
  CareAlertChannel,
  CareAlertType,
  CaregiverConnection,
  CaregiverPermissions,
  DadiNaniEntry,
  DemoAccount,
  FamilyMedicalHistoryItem,
  MedTwinState,
  MedicationStatus,
  MessagingProviderStatus,
  Patient,
  WorkspaceRole,
} from '@/src/types/medtwin';
import { DirectoryEntry, DoctorAuthorizationRecord } from '@/src/types/auth';
import { DEMO_ACCOUNTS } from '@/src/data/seedData';
import {
  ConfirmPrescriptionInput,
  CreateCaregiverInviteInput,
  LogDoseInput,
  UpdateCaregiverContactInput,
  demoMedTwinService,
} from '@/src/services/medtwinService';
import {
  ScopedWorkspacePayload,
  apiFetch,
  fetchScopedWorkspaceApi,
} from '@/src/services/authService';
import { useAuth } from '@/src/context/AuthContext';
import { useToast } from '@/src/components/ui/toast';

function buildEmptyAuthState(userId: string, role: WorkspaceRole, actorName: string): MedTwinState {
  return {
    hospital: {
      id: 'hosp-unassigned',
      name: 'MedTwin Connected Care',
      city: '',
      code: 'MT-CARE',
      activeDepartments: ['Primary Care'],
    },
    doctors: [],
    patients: [],
    caregivers: [],
    connections: [],
    familyMedicalHistory: [],
    medications: [],
    doseLogs: [],
    prescriptions: [],
    alerts: [],
    history: [],
    clinicianNotes: [],
    reports: [],
    appointments: [],
    dadiNaniEntries: [],
    managedUsers: [],
    activePatientId: '',
    activeCaregiverId: role === 'caregiver' ? userId : '',
    activeDoctorId: role === 'doctor' ? userId : '',
  };
}

const FALLBACK_EMPTY_PATIENT: Patient = {
  id: '',
  mrn: 'No patient selected',
  name: 'No authorized patient yet',
  age: 0,
  gender: 'Not specified',
  hospitalId: '',
  assignedDoctorId: '',
  conditions: [],
  allergies: [],
  lastReviewDate: new Date().toISOString().slice(0, 10),
};

interface MedTwinContextValue {
  state: MedTwinState;
  isLoading: boolean;
  isRealAccountMode: boolean;
  hasPatients: boolean;
  activeDemoAccount: DemoAccount;
  activeRole: WorkspaceRole;
  activePatient: Patient;
  doctorAuthorizations: DoctorAuthorizationRecord[];
  directory: DirectoryEntry[];
  dadiNaniMode: boolean;
  setDadiNaniMode: (val: boolean) => void;
  dadiNaniLanguage: 'en' | 'hi' | 'pa';
  setDadiNaniLanguage: (lang: 'en' | 'hi' | 'pa') => void;
  assistantOpen: boolean;
  setAssistantOpen: (val: boolean) => void;
  switchDemoAccount: (accountId: string) => void;
  setActivePatientId: (patientId: string) => void;
  resetDemo: () => void;
  refreshWorkspace: () => Promise<void>;
  logDose: (input: Omit<LogDoseInput, 'recordedBy' | 'actorRole'>) => void;
  undoDose: (logId: string) => void;
  confirmPrescription: (input: Omit<ConfirmPrescriptionInput, 'confirmedBy'>) => void;
  updateMedicationStatus: (medicationId: string, status: MedicationStatus) => void;
  replenishMedicationStock: (medicationId: string, addUnits: number) => void;
  createSimulatedAlert: (input: {
    patientId: string;
    caregiverId?: string;
    alertType?: CareAlertType;
    channel?: CareAlertChannel;
    recipientPhone?: string;
    messageBody?: string;
    title: string;
    reason: string;
    severity: 'attention' | 'urgent';
  }) => boolean;
  dispatchCaregiverAlert: (input: {
    patientId: string;
    connectionId?: string;
    caregiverId?: string;
    caregiverName?: string;
    alertType: CareAlertType;
    channel: CareAlertChannel;
    recipientPhone?: string;
    title: string;
    reason: string;
    messageBody: string;
    severity?: 'attention' | 'urgent';
    deliveryMode: 'draft' | 'opened_messaging_app' | 'automated';
  }) => Promise<{ ok: boolean; error?: string }>;
  providerStatus: MessagingProviderStatus;
  acknowledgeAlert: (alertId: string, followUpNote?: string) => void;
  inviteCaregiver: (input: CreateCaregiverInviteInput) => void;
  updateCaregiverContact: (input: UpdateCaregiverContactInput) => void;
  removeCaregiverContact: (connectionId: string) => void;
  requestPatientConnectionAsCaregiver: (
    patientEmailOrMrn: string,
    relationship: CreateCaregiverInviteInput['relationship'],
  ) => Promise<void>;
  respondCaregiverInvite: (connectionId: string, decision: 'accepted' | 'revoked') => void;
  updateCaregiverPermissions: (
    connectionId: string,
    permissions: CaregiverPermissions,
    alertPreferences?: CaregiverConnection['alertPreferences'],
  ) => void;
  authorizeDoctorByEmail: (doctorEmail: string) => Promise<void>;
  respondDoctorAuthorization: (authorizationId: string, decision: 'authorized' | 'revoked') => Promise<void>;
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
  const { user, isAuthenticated, isDemoMode } = useAuth();
  const { pushToast } = useToast();

  const [demoState, setDemoState] = useState<MedTwinState>(() => demoMedTwinService.loadState());
  const [authWorkspace, setAuthWorkspace] = useState<MedTwinState | null>(null);
  const [doctorAuthorizations, setDoctorAuthorizations] = useState<DoctorAuthorizationRecord[]>([]);
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [activeDemoAccountId, setActiveDemoAccountId] = useState<string>(DEMO_ACCOUNTS[0].id);
  const [dadiNaniMode, setDadiNaniMode] = useState<boolean>(false);
  const [dadiNaniLanguage, setDadiNaniLanguage] = useState<'en' | 'hi' | 'pa'>('en');
  const [assistantOpen, setAssistantOpen] = useState<boolean>(false);
  const [providerStatus, setProviderStatus] = useState<MessagingProviderStatus>({
    whatsappProviderConfigured: false,
    smsProviderConfigured: false,
    whatsappProviderLabel: 'Not configured (manual WhatsApp launch ready)',
    smsProviderLabel: 'Not configured (manual SMS app launch ready)',
  });

  useEffect(() => {
    let active = true;
    fetch('/api/alerts/provider-status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MessagingProviderStatus | null) => {
        if (active && data) setProviderStatus(data);
      })
      .catch(() => {
        // Safe offline default
      });
    return () => {
      active = false;
    };
  }, []);

  const isRealAccountMode = Boolean(
  isAuthenticated && user && !isDemoMode
);

  const applyScopedPayload = useCallback((payload: ScopedWorkspacePayload) => {
    setAuthWorkspace((prev) => {
      const preservedActive =
        prev?.activePatientId && payload.workspace.patients.some((p) => p.id === prev.activePatientId)
          ? prev.activePatientId
          : payload.workspace.activePatientId;
      return {
        ...payload.workspace,
        activePatientId: preservedActive,
      };
    });
    setDoctorAuthorizations(payload.doctorAuthorizations);
    setDirectory(payload.directory);
  }, []);

  const refreshWorkspace = useCallback(async () => {
    if (isDemoMode || !isAuthenticated || !user) return;
    setIsLoading(true);
    try {
      const payload = await fetchScopedWorkspaceApi();
      applyScopedPayload(payload);
    } catch (err) {
      pushToast({
        title: 'Failed to load workspace',
        description: err instanceof Error ? err.message : 'Unable to reach server.',
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [applyScopedPayload, isAuthenticated, isDemoMode, pushToast, user]);

  
useEffect(() => {
  if (isAuthenticated && user && !isDemoMode) {
    setDadiNaniLanguage(user.preferredLanguage || 'en');
    refreshWorkspace();
  } else {
    setAuthWorkspace(null);
    setDoctorAuthorizations([]);
    setDirectory([]);
    const timer = window.setTimeout(() => setIsLoading(false), 120);
    return () => window.clearTimeout(timer);
  }
}, [isAuthenticated, isDemoMode, refreshWorkspace, user]);

  const state = useMemo(() => {
    if (isRealAccountMode && user) {
      return authWorkspace ?? buildEmptyAuthState(user.id, user.role, user.fullName);
    }
    return demoState;
  }, [authWorkspace, demoState, isRealAccountMode, user]);

  const activeDemoAccount = useMemo<DemoAccount>(() => {
    if (isRealAccountMode && user) {
      return {
        id: user.id,
        label: `${user.fullName} (${user.role.replace('_', ' ')})`,
        role: user.role,
        actorId: user.role === 'patient' ? user.linkedPatientId || user.id : user.id,
        actorName: user.fullName,
        subtitle:
          user.role === 'doctor' || user.role === 'hospital_admin'
            ? `Verification: ${user.verificationStatus.replace('_', ' ')}`
            : user.email,
      };
    }
    return DEMO_ACCOUNTS.find((a) => a.id === activeDemoAccountId) ?? DEMO_ACCOUNTS[0];
  }, [activeDemoAccountId, isRealAccountMode, user]);

  const activeRole = activeDemoAccount.role;

  const activePatient = useMemo(() => {
    if (state.patients.length === 0) return FALLBACK_EMPTY_PATIENT;
    return state.patients.find((p) => p.id === state.activePatientId) ?? state.patients[0];
  }, [state.patients, state.activePatientId]);

  const hasPatients = state.patients.length > 0;

  const switchDemoAccount = useCallback(
    (accountId: string) => {
      if (isRealAccountMode) return;
      const account = DEMO_ACCOUNTS.find((a) => a.id === accountId);
      if (!account) return;
      setActiveDemoAccountId(account.id);

      setDemoState((prev) => {
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
        title: 'Switched demo workspace',
        description: `Viewing as ${account.actorName} (${account.role.replace('_', ' ')}).`,
        variant: 'info',
      });
    },
    [isRealAccountMode, pushToast],
  );

  const setActivePatientId = useCallback(
    (patientId: string) => {
      if (isRealAccountMode) {
        setAuthWorkspace((prev) => (prev ? { ...prev, activePatientId: patientId } : prev));
        return;
      }
      setDemoState((prev) => {
        const next = { ...prev, activePatientId: patientId };
        demoMedTwinService.saveState(next);
        return next;
      });
    },
    [isRealAccountMode],
  );

  const resetDemo = useCallback(() => {
    if (isRealAccountMode) return;
    const fresh = demoMedTwinService.resetDemoState();
    setDemoState(fresh);
    setActiveDemoAccountId(DEMO_ACCOUNTS[0].id);
    setDadiNaniMode(false);
    pushToast({
      title: 'Demo data reset',
      description: 'Restored all synthetic demo patients, schedules, and Care Circle states.',
      variant: 'success',
    });
  }, [isRealAccountMode, pushToast]);

  const runServerMutation = useCallback(
    async (url: string, body: unknown, successToast?: { title: string; description?: string; variant?: 'success' | 'info' | 'warning' }) => {
      try {
        const payload = await apiFetch<ScopedWorkspacePayload>(url, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        applyScopedPayload(payload);
        if (successToast) pushToast(successToast);
      } catch (err) {
        pushToast({
          title: 'Action not permitted',
          description: err instanceof Error ? err.message : 'Unable to save change.',
          variant: 'error',
        });
        throw err;
      }
    },
    [applyScopedPayload, pushToast],
  );

  const logDose = useCallback(
    (input: Omit<LogDoseInput, 'recordedBy' | 'actorRole'>) => {
      if (isRealAccountMode) {
        void runServerMutation('/api/workspace/dose', input, {
          title: input.status === 'taken' ? 'Dose marked as taken' : 'Skipped dose recorded',
          description: 'Schedule and adherence updated.',
          variant: input.status === 'taken' ? 'success' : 'warning',
        });
        return;
      }
      setDemoState((prev) => {
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
    [activeDemoAccount.actorName, activeRole, isRealAccountMode, pushToast, runServerMutation],
  );

  const undoDose = useCallback(
    (logId: string) => {
      if (isRealAccountMode) {
        void runServerMutation('/api/workspace/dose/undo', { logId }, {
          title: 'Entry undone',
          description: 'Dose log removed and medication stock restored.',
          variant: 'info',
        });
        return;
      }
      setDemoState((prev) => demoMedTwinService.undoDose(prev, logId, activeDemoAccount.actorName));
      pushToast({
        title: 'Entry undone',
        description: 'Dose log removed and medication stock restored.',
        variant: 'info',
      });
    },
    [activeDemoAccount.actorName, isRealAccountMode, pushToast, runServerMutation],
  );

  const confirmPrescription = useCallback(
    (input: Omit<ConfirmPrescriptionInput, 'confirmedBy'>) => {
      if (isRealAccountMode) {
        void runServerMutation('/api/workspace/prescription', input, {
          title: 'Prescription confirmed',
          description: 'New medication schedule activated and saved.',
          variant: 'success',
        });
        return;
      }
      setDemoState((prev) =>
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
    [activeDemoAccount.actorName, isRealAccountMode, pushToast, runServerMutation],
  );

  const updateMedicationStatus = useCallback(
    (medicationId: string, status: MedicationStatus) => {
      if (isRealAccountMode) {
        void runServerMutation('/api/workspace/medication/status', { medicationId, status }, {
          title: `Medication marked ${status}`,
          variant: 'info',
        });
        return;
      }
      setDemoState((prev) =>
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
    [activeDemoAccount.actorName, activeRole, isRealAccountMode, pushToast, runServerMutation],
  );

  const replenishMedicationStock = useCallback(
    (medicationId: string, addUnits: number) => {
      if (isRealAccountMode) {
        void runServerMutation('/api/workspace/medication/refill', { medicationId, addUnits }, {
          title: 'Refill recorded',
          description: `Added +${addUnits} units to medication supply.`,
          variant: 'success',
        });
        return;
      }
      setDemoState((prev) =>
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
    [activeDemoAccount.actorName, isRealAccountMode, pushToast, runServerMutation],
  );

  const createSimulatedAlert = useCallback(
    (input: {
      patientId: string;
      caregiverId?: string;
      alertType?: CareAlertType;
      channel?: CareAlertChannel;
      recipientPhone?: string;
      messageBody?: string;
      title: string;
      reason: string;
      severity: 'attention' | 'urgent';
    }) => {
      if (isRealAccountMode) {
        pushToast({
          title: 'Alert rules active',
          description: 'Use WhatsApp, SMS, or configured automated alert dispatch for registered accounts.',
          variant: 'info',
        });
        return true;
      }
      let created = false;
      setDemoState((prev) => {
        const next = demoMedTwinService.createSimulatedAlert(prev, input);
        created = next !== prev;
        return next;
      });
      if (created) {
        pushToast({
          title: 'Simulated caregiver alert sent',
          description: 'Visible in Caregiver Contacts, Caregiver Hub, and Alert History.',
          variant: 'warning',
        });
      } else {
        pushToast({
          title: 'No consented caregiver recipient',
          description: 'Enable "Receive dose alerts" on an accepted Care Circle contact first.',
          variant: 'error',
        });
      }
      return created;
    },
    [isRealAccountMode, pushToast],
  );

  const dispatchCaregiverAlert = useCallback(
    async (input: {
      patientId: string;
      connectionId?: string;
      caregiverId?: string;
      caregiverName?: string;
      alertType: CareAlertType;
      channel: CareAlertChannel;
      recipientPhone?: string;
      title: string;
      reason: string;
      messageBody: string;
      severity?: 'attention' | 'urgent';
      deliveryMode: 'draft' | 'opened_messaging_app' | 'automated';
    }): Promise<{ ok: boolean; error?: string }> => {
      if (isRealAccountMode) {
        try {
          const res = await apiFetch<
            ScopedWorkspacePayload & {
              providerConfirmed: boolean;
              providerConfigured: boolean;
              error?: string;
            }
          >('/api/alerts/dispatch', {
            method: 'POST',
            body: JSON.stringify(input),
          });
          applyScopedPayload(res);
          pushToast({
            title:
              input.deliveryMode === 'opened_messaging_app'
                ? `${input.channel.toUpperCase()} link opened`
                : input.deliveryMode === 'draft'
                  ? 'Alert draft saved'
                  : 'Automated alert dispatched',
            description:
              input.deliveryMode === 'opened_messaging_app'
                ? 'Recorded "Opened Messaging App" in Alert History.'
                : res.error,
            variant: input.deliveryMode === 'draft' ? 'info' : 'success',
          });
          return { ok: true };
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unable to send alert.';
          pushToast({
            title: 'Messaging delivery unavailable',
            description: msg,
            variant: 'error',
          });
          return { ok: false, error: msg };
        }
      }

      // Demo mode: never claim automated provider delivery unless explicitly simulated
      if (input.deliveryMode === 'automated') {
        const providerMissing =
          (input.channel === 'whatsapp' && !providerStatus.whatsappProviderConfigured) ||
          (input.channel === 'sms' && !providerStatus.smsProviderConfigured);
        if (providerMissing) {
          const msg =
            'Automated WhatsApp/SMS delivery is unavailable without provider API credentials. Use manual WhatsApp / SMS or Demo Simulation.';
          pushToast({
            title: 'Automated delivery unavailable',
            description: msg,
            variant: 'warning',
          });
          return { ok: false, error: msg };
        }
      }

      const nextDeliveryState: AlertDeliveryState =
        input.deliveryMode === 'automated' ? 'sent' : input.deliveryMode;

      setDemoState((prev) =>
        demoMedTwinService.recordAlertEvent(prev, {
          ...input,
          deliveryState: nextDeliveryState,
          simulated: true,
          actorName: activeDemoAccount.actorName,
          actorRole: activeRole,
        }),
      );
      pushToast({
        title:
          nextDeliveryState === 'opened_messaging_app'
            ? 'Messaging app prepared (Demo)'
            : nextDeliveryState === 'draft'
              ? 'Alert draft saved'
              : 'Simulated alert logged',
        description: 'Recorded in Caregiver Alert History.',
        variant: nextDeliveryState === 'draft' ? 'info' : 'success',
      });
      return { ok: true };
    },
    [
      activeDemoAccount.actorName,
      activeRole,
      applyScopedPayload,
      isRealAccountMode,
      providerStatus.smsProviderConfigured,
      providerStatus.whatsappProviderConfigured,
      pushToast,
    ],
  );

  const acknowledgeAlert = useCallback(
    (alertId: string, followUpNote?: string) => {
      if (isRealAccountMode) return;
      setDemoState((prev) =>
        demoMedTwinService.acknowledgeAlert(prev, alertId, activeDemoAccount.actorName, followUpNote),
      );
      pushToast({
        title: 'Alert acknowledged',
        description: 'Acknowledgement and follow-up note added to patient care history.',
        variant: 'success',
      });
    },
    [activeDemoAccount.actorName, isRealAccountMode, pushToast],
  );

  const inviteCaregiver = useCallback(
    (input: CreateCaregiverInviteInput) => {
      if (isRealAccountMode) {
        void runServerMutation('/api/access/caregiver-request', input, {
          title: 'Caregiver contact added',
          description: `Invitation prepared for ${input.caregiverName}. Consent acceptance required before sharing medication details.`,
          variant: 'success',
        });
        return;
      }
      setDemoState((prev) => demoMedTwinService.inviteCaregiver(prev, input));
      pushToast({
        title: 'Caregiver contact added',
        description: `Created simulated invitation for ${input.caregiverName}.`,
        variant: 'success',
      });
    },
    [isRealAccountMode, pushToast, runServerMutation],
  );

  const updateCaregiverContact = useCallback(
    (input: UpdateCaregiverContactInput) => {
      if (isRealAccountMode) {
        void runServerMutation('/api/access/caregiver-update', input, {
          title: 'Caregiver contact updated',
          description: 'Contact details and alert preferences saved.',
          variant: 'success',
        });
        return;
      }
      setDemoState((prev) => demoMedTwinService.updateCaregiverContact(prev, input));
      pushToast({
        title: 'Caregiver contact updated',
        description: 'Contact details and alert preferences saved.',
        variant: 'success',
      });
    },
    [isRealAccountMode, pushToast, runServerMutation],
  );

  const removeCaregiverContact = useCallback(
    (connectionId: string) => {
      if (isRealAccountMode) {
        void runServerMutation('/api/access/caregiver-remove', { connectionId }, {
          title: 'Caregiver contact removed',
          description: 'Contact removed and Care Circle data sharing ended.',
          variant: 'warning',
        });
        return;
      }
      setDemoState((prev) =>
        demoMedTwinService.removeCaregiverContact(prev, connectionId, activeDemoAccount.actorName),
      );
      pushToast({
        title: 'Caregiver contact removed',
        description: 'Contact removed and Care Circle data sharing ended.',
        variant: 'warning',
      });
    },
    [activeDemoAccount.actorName, isRealAccountMode, pushToast, runServerMutation],
  );

  const requestPatientConnectionAsCaregiver = useCallback(
    async (
      patientEmailOrMrn: string,
      relationship: CreateCaregiverInviteInput['relationship'],
    ) => {
      if (!isRealAccountMode) {
        pushToast({
          title: 'Sign in required',
          description: 'Sending connection requests to registered patients requires a caregiver account.',
          variant: 'info',
        });
        return;
      }
      await runServerMutation(
        '/api/access/caregiver-request',
        { patientEmailOrMrn, relationship },
        {
          title: 'Connection request sent',
          description: 'Waiting for patient approval before health data is shared.',
          variant: 'success',
        },
      );
    },
    [isRealAccountMode, pushToast, runServerMutation],
  );

  const respondCaregiverInvite = useCallback(
    (connectionId: string, decision: 'accepted' | 'revoked') => {
      if (isRealAccountMode) {
        void runServerMutation('/api/access/caregiver-respond', { connectionId, decision }, {
          title: decision === 'accepted' ? 'Care Circle connection approved' : 'Access revoked',
          variant: decision === 'accepted' ? 'success' : 'warning',
        });
        return;
      }
      setDemoState((prev) => demoMedTwinService.respondCaregiverInvite(prev, connectionId, decision));
      pushToast({
        title: decision === 'accepted' ? 'Care Circle connection accepted' : 'Access revoked',
        variant: decision === 'accepted' ? 'success' : 'warning',
      });
    },
    [isRealAccountMode, pushToast, runServerMutation],
  );

  const updateCaregiverPermissions = useCallback(
    (
      connectionId: string,
      permissions: CaregiverPermissions,
      alertPreferences?: CaregiverConnection['alertPreferences'],
    ) => {
      if (isRealAccountMode) {
        void runServerMutation(
          '/api/access/caregiver-permissions',
          { connectionId, permissions, alertPreferences },
          {
            title: 'Permissions updated',
            description: 'Caregiver access settings saved.',
            variant: 'success',
          },
        );
        return;
      }
      setDemoState((prev) =>
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
    [isRealAccountMode, pushToast, runServerMutation],
  );

  const authorizeDoctorByEmail = useCallback(
    async (doctorEmail: string) => {
      if (!isRealAccountMode) return;
      await runServerMutation(
        '/api/access/doctor-authorization',
        { doctorEmail },
        {
          title: 'Doctor authorized',
          description: 'This clinician can now view your authorized medication profile.',
          variant: 'success',
        },
      );
    },
    [isRealAccountMode, runServerMutation],
  );

  const respondDoctorAuthorization = useCallback(
    async (authorizationId: string, decision: 'authorized' | 'revoked') => {
      if (!isRealAccountMode) return;
      await runServerMutation(
        '/api/access/doctor-authorization',
        { authorizationId, decision },
        {
          title: decision === 'authorized' ? 'Doctor access granted' : 'Doctor access revoked',
          variant: decision === 'authorized' ? 'success' : 'warning',
        },
      );
    },
    [isRealAccountMode, runServerMutation],
  );

  const addFamilyMedicalHistory = useCallback(
    (item: Omit<FamilyMedicalHistoryItem, 'id' | 'recordedAt'>) => {
      if (isRealAccountMode) {
        pushToast({
          title: 'Recorded locally',
          description: 'Family medical history noted.',
          variant: 'info',
        });
        return;
      }
      setDemoState((prev) => demoMedTwinService.addFamilyMedicalHistory(prev, item));
      pushToast({
        title: 'Family history recorded',
        description: 'Stored separately from Care Circle access permissions.',
        variant: 'success',
      });
    },
    [isRealAccountMode, pushToast],
  );

  const addClinicianNote = useCallback(
    (input: { patientId: string; title: string; content: string }) => {
      if (isRealAccountMode) {
        void runServerMutation('/api/workspace/clinician-note', input, {
          title: 'Clinician note saved',
          description: 'Audit trail recorded and patient review date updated.',
          variant: 'success',
        });
        return;
      }
      setDemoState((prev) =>
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
    [activeDemoAccount.actorName, isRealAccountMode, pushToast, runServerMutation],
  );

  const addDadiNaniEntry = useCallback(
    (input: Omit<DadiNaniEntry, 'id' | 'createdAt' | 'authorName'>) => {
      if (isRealAccountMode) {
        void runServerMutation('/api/workspace/dadi-nani', input, {
          title: 'Shared via Dadi-Nani Mode',
          description: input.sharedWithCareCircle
            ? 'Saved to Care History and shared with consented Care Circle.'
            : 'Saved to your personal comfort & problem journal.',
          variant: 'success',
        });
        return;
      }
      setDemoState((prev) =>
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
    [activePatient.name, isRealAccountMode, pushToast, runServerMutation],
  );

  const assignPatientDoctor = useCallback(
    (patientId: string, doctorId: string) => {
      if (isRealAccountMode) return;
      setDemoState((prev) =>
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
    [activeDemoAccount.actorName, isRealAccountMode, pushToast],
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
      if (isRealAccountMode) {
        void runServerMutation('/api/hospital/enroll-patient', input, {
          title: 'Patient enrolled',
          description: `${input.name} registered to organization.`,
          variant: 'success',
        });
        return;
      }
      setDemoState((prev) => demoMedTwinService.enrollPatient(prev, input));
      pushToast({
        title: 'Patient enrolled',
        description: `${input.name} registered at ${state.hospital.name}.`,
        variant: 'success',
      });
    },
    [isRealAccountMode, pushToast, runServerMutation, state.hospital.name],
  );

  const toggleManagedUserActive = useCallback(
    (userId: string) => {
      if (isRealAccountMode) return;
      setDemoState((prev) => demoMedTwinService.toggleManagedUserActive(prev, userId));
      pushToast({
        title: 'Staff access status updated',
        variant: 'info',
      });
    },
    [isRealAccountMode, pushToast],
  );

  const value: MedTwinContextValue = {
    state,
    isLoading,
    isRealAccountMode,
    hasPatients,
    activeDemoAccount,
    activeRole,
    activePatient,
    doctorAuthorizations,
    directory,
    dadiNaniMode,
    setDadiNaniMode,
    dadiNaniLanguage,
    setDadiNaniLanguage,
    assistantOpen,
    setAssistantOpen,
    switchDemoAccount,
    setActivePatientId,
    resetDemo,
    refreshWorkspace,
    logDose,
    undoDose,
    confirmPrescription,
    updateMedicationStatus,
    replenishMedicationStock,
    createSimulatedAlert,
    dispatchCaregiverAlert,
    providerStatus,
    acknowledgeAlert,
    inviteCaregiver,
    updateCaregiverContact,
    removeCaregiverContact,
    requestPatientConnectionAsCaregiver,
    respondCaregiverInvite,
    updateCaregiverPermissions,
    authorizeDoctorByEmail,
    respondDoctorAuthorization,
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
