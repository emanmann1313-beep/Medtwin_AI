import {
  AlertDeliveryState,
  CaregiverPermissions,
  RelationshipLabel,
} from '@/src/types/medtwin';

export type ConsentScope =
  | 'view_schedules'
  | 'receive_dose_alerts'
  | 'view_history_reports'
  | 'view_clinician_notes';

export interface ConsentScopeMeta {
  scope: ConsentScope;
  permissionKey: keyof CaregiverPermissions;
  label: string;
  shortLabel: string;
  description: string;
}

export const CONSENT_SCOPE_LIST: ConsentScopeMeta[] = [
  {
    scope: 'view_schedules',
    permissionKey: 'viewSchedules',
    label: 'View medication schedules',
    shortLabel: 'Schedules',
    description: 'Daily dose slots, adherence summaries, and supply refill countdowns.',
  },
  {
    scope: 'receive_dose_alerts',
    permissionKey: 'receiveDoseAlerts',
    label: 'Receive missed-dose & refill alerts',
    shortLabel: 'Dose alerts',
    description: 'Notifications when repeated unconfirmed doses or low refills occur.',
  },
  {
    scope: 'view_history_reports',
    permissionKey: 'viewHistoryAndReports',
    label: 'View care history & reports',
    shortLabel: 'History & reports',
    description: 'Medication change log, uploaded reports, and Digital Twin supply insights.',
  },
  {
    scope: 'view_clinician_notes',
    permissionKey: 'viewClinicianNotes',
    label: 'View clinician notes',
    shortLabel: 'Clinician notes',
    description: 'Read-only visibility into shared doctor visit notes.',
  },
];

export interface CaregiverConsentRecord {
  id: string;
  patient_id: string;
  patient_name: string;
  caregiver_id: string;
  caregiver_name: string;
  relationship: RelationshipLabel;
  contact_priority: 'primary' | 'secondary';
  status: 'invited' | 'accepted' | 'revoked';
  requested_by?: 'patient' | 'caregiver';
  scopes: ConsentScope[];
  alert_threshold: number;
  notify_on_refill: boolean;
  invited_at: string;
  responded_at?: string;
}

export type RefillUrgency = 'critical' | 'warning' | 'nominal';

export interface RefillCountdownItem {
  medication_id: string;
  medication_name: string;
  strength: string;
  remaining_quantity: number | null;
  unit_label: string;
  daily_usage: number;
  days_remaining: number | null;
  estimated_refill_date: string | null;
  urgency: RefillUrgency;
  redacted: boolean;
}

export interface CaregiverAdherenceSummary {
  patient_id: string;
  patient_name: string;
  mrn: string;
  access_granted: boolean;
  today_taken: number;
  today_total: number;
  adherence_7d_pct: number | null;
  adherence_30d_pct: number | null;
  taken_7d: number;
  due_7d: number;
  skipped_7d: number;
  unconfirmed_7d: number;
  calculated_by: 'backend-api' | 'demo-adapter-fallback';
}

export interface DigitalTwinRedactedInsight {
  patient_id: string;
  access_level: 'full' | 'schedule_only' | 'redacted';
  redaction_reason?: string;
  projected_adherence_14d_pct: number | null;
  supply_runout_risk_count: number;
  next_supply_gap_date: string | null;
  continuity_note: string;
  disclaimer: string;
}

export interface CaregiverAlertRecord {
  id: string;
  patient_id: string;
  patient_name: string;
  caregiver_id?: string;
  caregiver_name?: string;
  alert_type: 'missed_dose' | 'refill_countdown' | 'checkin' | 'caregiver_invitation' | 'patient_assistance';
  title: string;
  reason: string;
  severity: 'attention' | 'urgent';
  delivery_status: AlertDeliveryState;
  channel: string;
  channel_kind: 'whatsapp' | 'sms' | 'in_app';
  recipient_phone?: string;
  message_body?: string;
  provider_confirmed?: boolean;
  simulated: boolean;
  created_at: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  follow_up_note?: string;
}

export interface CaregiverInsightsResponse {
  calculatedBy: 'backend-api' | 'demo-adapter-fallback';
  generatedAt: string;
  adherenceSummaries: Record<string, CaregiverAdherenceSummary>;
  refillCountdownsByPatient: Record<string, RefillCountdownItem[]>;
  digitalTwinInsightsByPatient: Record<string, DigitalTwinRedactedInsight>;
}
