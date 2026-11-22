export type WorkspaceRole = 'patient' | 'caregiver' | 'doctor' | 'hospital_admin';

export type RelationshipLabel =
  | 'Parent'
  | 'Child'
  | 'Sibling'
  | 'Spouse / Partner'
  | 'Guardian'
  | 'Friend'
  | 'Other';

export type MedicationStatus = 'active' | 'completed' | 'stopped';

export type DoseState = 'scheduled' | 'due' | 'taken' | 'skipped' | 'overdue';

export type AlertDeliveryState =
  | 'created'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'acknowledged';

export type CareHistoryCategory =
  | 'prescription'
  | 'dose'
  | 'medication_change'
  | 'refill'
  | 'appointment'
  | 'report'
  | 'clinician_note'
  | 'caregiver_alert'
  | 'dadi_nani_share';

export interface Hospital {
  id: string;
  name: string;
  city: string;
  code: string;
  activeDepartments: string[];
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  licenseNumber: string;
  hospitalId: string;
  email: string;
}

export interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: string;
  bloodGroup?: string;
  hospitalId: string;
  assignedDoctorId: string;
  conditions: string[];
  allergies: string[];
  nextFollowUpDate?: string;
  lastReviewDate: string;
  dadiNaniPreferred?: boolean;
  preferredLanguageNote?: string;
}

export interface Medication {
  id: string;
  patientId: string;
  prescriptionId?: string;
  name: string;
  strength: string;
  doseAndRoute: string;
  instructions: string;
  scheduledTimes: string[]; // HH:mm
  asNeeded?: boolean;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  remainingQuantity?: number;
  unitLabel: string;
  refillThresholdDays: number;
  status: MedicationStatus;
  prescriberName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DoseLog {
  id: string;
  patientId: string;
  medicationId: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm
  status: 'taken' | 'skipped';
  skipReason?: string;
  recordedAt: string;
  recordedBy: string;
}

export interface PrescriptionExtractedItem {
  id: string;
  medicineName: string;
  strength: string;
  doseAndRoute: string;
  frequency: string;
  scheduledTimes: string[];
  durationDays?: number;
  instructions: string;
  quantity?: number;
  unclearFields: string[];
}

export interface Prescription {
  id: string;
  patientId: string;
  prescriberName?: string;
  clinicName?: string;
  prescriptionDate?: string;
  fileName: string;
  previewUrl?: string;
  extractionSource: 'live-ai' | 'simulated-sample' | 'manual';
  status: 'pending-review' | 'confirmed';
  items: PrescriptionExtractedItem[];
  createdAt: string;
  confirmedAt?: string;
}

export interface CaregiverPermissions {
  viewSchedules: boolean;
  receiveDoseAlerts: boolean;
  viewHistoryAndReports: boolean;
  viewClinicianNotes: boolean;
}

export interface CaregiverProfile {
  id: string;
  name: string;
  email: string;
  phoneLabel: string;
}

export interface CaregiverConnection {
  id: string;
  patientId: string;
  caregiverId: string;
  caregiverName: string;
  relationship: RelationshipLabel;
  contactPriority: 'primary' | 'secondary';
  status: 'invited' | 'accepted' | 'revoked';
  requestedBy?: 'patient' | 'caregiver';
  permissions: CaregiverPermissions;
  alertPreferences: {
    repeatedMissedThreshold: number;
    notifyOnRefillNeeded: boolean;
    notifyOnDadiNaniShare: boolean;
  };
  invitedAt: string;
  respondedAt?: string;
}

export interface FamilyMedicalHistoryItem {
  id: string;
  patientId: string;
  relationship: RelationshipLabel;
  reportedCondition: string;
  informationSource: string;
  recordedAt: string;
}

export interface CareAlert {
  id: string;
  patientId: string;
  caregiverId?: string;
  title: string;
  reason: string;
  severity: 'attention' | 'urgent';
  deliveryState: AlertDeliveryState;
  simulated: boolean;
  channelLabel: string;
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  followUpNote?: string;
}

export interface CareHistoryEvent {
  id: string;
  patientId: string;
  category: CareHistoryCategory;
  title: string;
  details: string;
  actorName: string;
  actorRole: WorkspaceRole | 'system';
  timestamp: string;
  restrictedToClinician?: boolean;
  sourceId?: string;
}

export interface ClinicianNote {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  title: string;
  content: string;
  createdAt: string;
  auditTrail: Array<{
    action: string;
    actor: string;
    timestamp: string;
  }>;
}

export interface UploadedReport {
  id: string;
  patientId: string;
  title: string;
  reportType: string;
  uploadedAt: string;
  summaryNote: string;
}

export interface AppointmentItem {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  scheduledFor: string;
  purpose: string;
  status: 'upcoming' | 'completed';
}

export interface DadiNaniEntry {
  id: string;
  patientId: string;
  authorName: string;
  entryType: 'problem' | 'home_comfort' | 'medicine_question';
  feelingSummary: string;
  symptoms: string[];
  homeComfortNote?: string;
  sharedWithCareCircle: boolean;
  sharedWithDoctor: boolean;
  createdAt: string;
}

export interface AttentionItem {
  id: string;
  patientId: string;
  label: 'Refill needed' | 'Review required' | 'Caregiver follow-up' | 'Missing details';
  severity: 'amber' | 'red';
  title: string;
  trigger: string;
  timePeriod: string;
  supportingRecords: string[];
  nextActionLabel: string;
  nextActionRoute: string;
}

export interface DigitalTwinScenario {
  horizonDays: 7 | 14 | 30;
  mode: 'baseline-all-taken' | 'omitted-doses' | 'refill-delay' | 'replenish-supply';
  omittedDatesCount: number;
  selectedMedicationId: string | 'all';
  refillDelayDays: number;
  replenishOnDayOffset: number;
  replenishQuantity: number;
  alertMissThreshold: number;
}

export interface DigitalTwinDayPoint {
  dayLabel: string;
  date: string;
  baselineAdherencePct: number;
  scenarioAdherencePct: number;
  baselineStock: number;
  scenarioStock: number;
  isSupplyGap: boolean;
  triggersAlert: boolean;
}

export interface DigitalTwinResult {
  projectedScheduledDoses: number;
  baselineCoveredDoses: number;
  scenarioCoveredDoses: number;
  baselineProjectedStockEnd: number;
  scenarioProjectedStockEnd: number;
  supplyGapDates: string[];
  baselineAdherencePct: number;
  scenarioAdherencePct: number;
  triggeredAlertEvents: Array<{
    date: string;
    reason: string;
    medicationName: string;
  }>;
  assumptions: string[];
  missingDataWarnings: string[];
  timeline: DigitalTwinDayPoint[];
}

export interface ManagedUserRecord {
  id: string;
  name: string;
  role: WorkspaceRole;
  hospitalId: string;
  email: string;
  active: boolean;
}

export interface DemoAccount {
  id: string;
  label: string;
  role: WorkspaceRole;
  actorId: string;
  actorName: string;
  subtitle: string;
}

export interface MedTwinState {
  hospital: Hospital;
  doctors: Doctor[];
  patients: Patient[];
  caregivers: CaregiverProfile[];
  connections: CaregiverConnection[];
  familyMedicalHistory: FamilyMedicalHistoryItem[];
  medications: Medication[];
  doseLogs: DoseLog[];
  prescriptions: Prescription[];
  alerts: CareAlert[];
  history: CareHistoryEvent[];
  clinicianNotes: ClinicianNote[];
  reports: UploadedReport[];
  appointments: AppointmentItem[];
  dadiNaniEntries: DadiNaniEntry[];
  managedUsers: ManagedUserRecord[];
  activePatientId: string;
  activeCaregiverId: string;
  activeDoctorId: string;
}
