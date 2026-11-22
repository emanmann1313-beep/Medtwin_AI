import {
  CareAlert,
  CaregiverConnection,
  CaregiverPermissions,
  DoseLog,
  Medication,
  Patient,
} from '@/src/types/medtwin';
import {
  CONSENT_SCOPE_LIST,
  CaregiverAdherenceSummary,
  CaregiverAlertRecord,
  CaregiverConsentRecord,
  CaregiverInsightsResponse,
  ConsentScope,
  DigitalTwinRedactedInsight,
  RefillCountdownItem,
} from '@/src/types/caregiverContracts';
import {
  buildDoseSlotsForDate,
  computeAdherenceMetrics,
  computeRefillForecasts,
  getCurrentHhMm,
  getTodayIso,
} from '@/src/services/adherenceEngine';
import { addDaysIso } from '@/src/lib/utils';

export const USE_MOCKS: boolean =
  (import.meta.env.VITE_USE_MOCKS ?? 'true').toLowerCase() !== 'false';

export function permissionsToScopes(perms: CaregiverPermissions): ConsentScope[] {
  return CONSENT_SCOPE_LIST.filter((meta) => Boolean(perms[meta.permissionKey])).map(
    (meta) => meta.scope,
  );
}

export function scopesToPermissions(scopes: ConsentScope[]): CaregiverPermissions {
  const set = new Set(scopes);
  return {
    viewSchedules: set.has('view_schedules'),
    receiveDoseAlerts: set.has('receive_dose_alerts'),
    viewHistoryAndReports: set.has('view_history_reports'),
    viewClinicianNotes: set.has('view_clinician_notes'),
  };
}

export function toggleScopeInPermissions(
  perms: CaregiverPermissions,
  scope: ConsentScope,
  nextValue?: boolean,
): CaregiverPermissions {
  const meta = CONSENT_SCOPE_LIST.find((m) => m.scope === scope);
  if (!meta) return perms;
  const current = Boolean(perms[meta.permissionKey]);
  return {
    ...perms,
    [meta.permissionKey]: typeof nextValue === 'boolean' ? nextValue : !current,
  };
}

export function mapConnectionToConsentRecord(
  conn: CaregiverConnection,
  patients: Patient[],
): CaregiverConsentRecord {
  const pat = patients.find((p) => p.id === conn.patientId);
  return {
    id: conn.id,
    patient_id: conn.patientId,
    patient_name: pat?.name ?? 'Patient',
    caregiver_id: conn.caregiverId,
    caregiver_name: conn.caregiverName,
    relationship: conn.relationship,
    contact_priority: conn.contactPriority,
    status: conn.status,
    requested_by: conn.requestedBy,
    scopes: permissionsToScopes(conn.permissions),
    alert_threshold: conn.alertPreferences.repeatedMissedThreshold,
    notify_on_refill: conn.alertPreferences.notifyOnRefillNeeded,
    invited_at: conn.invitedAt,
    responded_at: conn.respondedAt,
  };
}

export function mapAlertToContractRecord(
  alert: CareAlert,
  patients: Patient[],
): CaregiverAlertRecord {
  const pat = patients.find((p) => p.id === alert.patientId);
  const lower = `${alert.title} ${alert.reason} ${alert.channelLabel}`.toLowerCase();

  let alertType: CaregiverAlertRecord['alert_type'] = 'missed_dose';
  if (alert.alertType === 'caregiver_invitation') {
    alertType = 'caregiver_invitation';
  } else if (alert.alertType === 'patient_assistance') {
    alertType = 'patient_assistance';
  } else if (
    alert.alertType === 'supply_running_low' ||
    alert.alertType === 'upcoming_refill' ||
    lower.includes('refill') ||
    lower.includes('supply') ||
    lower.includes('remaining')
  ) {
    alertType = 'refill_countdown';
  } else if (lower.includes('check-in') || lower.includes('assistance')) {
    alertType = 'checkin';
  }

  const channelKind: 'whatsapp' | 'sms' | 'in_app' =
    alert.channel ??
    (lower.includes('whatsapp') ? 'whatsapp' : lower.includes('sms') ? 'sms' : 'in_app');

  return {
    id: alert.id,
    patient_id: alert.patientId,
    patient_name: pat?.name ?? 'Patient',
    caregiver_id: alert.caregiverId,
    caregiver_name: alert.caregiverName,
    alert_type: alertType,
    title: alert.title,
    reason: alert.reason,
    severity: alert.severity,
    delivery_status: alert.deliveryState,
    channel: alert.channelLabel,
    channel_kind: channelKind,
    recipient_phone: alert.recipientPhone,
    message_body: alert.messageBody,
    provider_confirmed: alert.providerConfirmed,
    simulated: alert.simulated,
    created_at: alert.createdAt,
    acknowledged_at: alert.acknowledgedAt,
    acknowledged_by: alert.acknowledgedBy,
    follow_up_note: alert.followUpNote,
  };
}

function buildFallbackCaregiverInsights(params: {
  todayStr: string;
  caregiverId?: string;
  patients: Patient[];
  connections: CaregiverConnection[];
  medications: Medication[];
  doseLogs: DoseLog[];
}): CaregiverInsightsResponse {
  const adherenceSummaries: Record<string, CaregiverAdherenceSummary> = {};
  const refillCountdownsByPatient: Record<string, RefillCountdownItem[]> = {};
  const digitalTwinInsightsByPatient: Record<string, DigitalTwinRedactedInsight> = {};

  const accepted = params.connections.filter(
    (c) => (!params.caregiverId || c.caregiverId === params.caregiverId) && c.status === 'accepted',
  );

  for (const conn of accepted) {
    const pat = params.patients.find((p) => p.id === conn.patientId);
    if (!pat) continue;
    const canSchedules = Boolean(conn.permissions.viewSchedules);
    const canHistory = Boolean(conn.permissions.viewHistoryAndReports);

    if (canSchedules) {
      const m7 = computeAdherenceMetrics(pat.id, 7, params.medications, params.doseLogs);
      const m30 = computeAdherenceMetrics(pat.id, 30, params.medications, params.doseLogs);
      const todaySlots = buildDoseSlotsForDate(
        pat.id,
        params.todayStr,
        params.medications,
        params.doseLogs,
      );
      adherenceSummaries[pat.id] = {
        patient_id: pat.id,
        patient_name: pat.name,
        mrn: pat.mrn,
        access_granted: true,
        today_taken: todaySlots.filter((s) => s.state === 'taken').length,
        today_total: todaySlots.length,
        adherence_7d_pct: m7.adherencePct,
        adherence_30d_pct: m30.adherencePct,
        taken_7d: m7.takenCount,
        due_7d: m7.scheduledDueCount,
        skipped_7d: m7.skippedCount,
        unconfirmed_7d: m7.unconfirmedCount,
        calculated_by: 'demo-adapter-fallback',
      };

      const forecasts = computeRefillForecasts(pat.id, params.medications);
      refillCountdownsByPatient[pat.id] = forecasts
        .map((f): RefillCountdownItem => {
          const urgency =
            f.daysRemaining !== null && f.daysRemaining <= 2
              ? 'critical'
              : f.daysRemaining !== null && f.daysRemaining <= 7
                ? 'warning'
                : 'nominal';
          return {
            medication_id: f.medicationId,
            medication_name: f.medicationName,
            strength: f.strength,
            remaining_quantity: f.remainingQuantity,
            unit_label: f.unitLabel,
            daily_usage: f.dailyUsage,
            days_remaining: f.daysRemaining,
            estimated_refill_date: f.estimatedRefillDate,
            urgency,
            redacted: false,
          };
        })
        .sort((a, b) => (a.days_remaining ?? 999) - (b.days_remaining ?? 999));

      const lowStock = refillCountdownsByPatient[pat.id].filter(
        (r) => r.urgency === 'critical' || r.urgency === 'warning',
      );
      if (!canHistory) {
        digitalTwinInsightsByPatient[pat.id] = {
          patient_id: pat.id,
          access_level: 'schedule_only',
          redaction_reason:
            'Enable "view_history_reports" consent to view 14-day Digital Twin continuity projections.',
          projected_adherence_14d_pct: null,
          supply_runout_risk_count: lowStock.length,
          next_supply_gap_date: null,
          continuity_note:
            lowStock.length > 0
              ? `${lowStock.length} active medication(s) fall within the 7-day refill window.`
              : 'Recorded active supply exceeds 7 days across scheduled medicines.',
          disclaimer:
            'Restricted to schedule-level supply counts per caregiver consent; non-diagnostic.',
        };
      } else {
        const activeMeds = params.medications.filter(
          (m) =>
            m.patientId === pat.id &&
            m.status === 'active' &&
            !m.asNeeded &&
            m.scheduledTimes.length > 0,
        );
        let sched = 0;
        let covered = 0;
        for (const m of activeMeds) {
          const needed = m.scheduledTimes.length * 14;
          sched += needed;
          covered += Math.min(m.remainingQuantity ?? 0, needed);
        }
        const pct = sched > 0 ? Math.round((covered / sched) * 100) : 100;
        const firstGap = refillCountdownsByPatient[pat.id].find(
          (r) => r.days_remaining !== null && r.days_remaining < 14,
        );
        digitalTwinInsightsByPatient[pat.id] = {
          patient_id: pat.id,
          access_level: 'full',
          projected_adherence_14d_pct: pct,
          supply_runout_risk_count: lowStock.length,
          next_supply_gap_date:
            firstGap?.estimated_refill_date ??
            (firstGap?.days_remaining != null
              ? addDaysIso(params.todayStr, firstGap.days_remaining)
              : null),
          continuity_note:
            lowStock.length > 0
              ? `Without a refill, ${lowStock.map((m) => m.medication_name).join(', ')} will deplete within ${lowStock[0].days_remaining ?? 0} day(s) (${pct}% 14-day continuity).`
              : `Recorded supply covers 100% of scheduled doses for the next 14 days.`,
          disclaimer:
            'Deterministic supply & adherence continuity model from recorded stock and schedule; non-diagnostic.',
        };
      }
    } else {
      adherenceSummaries[pat.id] = {
        patient_id: pat.id,
        patient_name: pat.name,
        mrn: pat.mrn,
        access_granted: false,
        today_taken: 0,
        today_total: 0,
        adherence_7d_pct: null,
        adherence_30d_pct: null,
        taken_7d: 0,
        due_7d: 0,
        skipped_7d: 0,
        unconfirmed_7d: 0,
        calculated_by: 'demo-adapter-fallback',
      };
      refillCountdownsByPatient[pat.id] = [];
      digitalTwinInsightsByPatient[pat.id] = {
        patient_id: pat.id,
        access_level: 'redacted',
        redaction_reason:
          'Patient has not enabled the "view_schedules" consent scope for this Care Circle link.',
        projected_adherence_14d_pct: null,
        supply_runout_risk_count: 0,
        next_supply_gap_date: null,
        continuity_note:
          'Digital Twin supply and adherence insights are hidden until schedule consent is granted.',
        disclaimer:
          'Medication continuity simulation only; no clinical diagnosis or unvalidated predictions.',
      };
    }
  }

  return {
    calculatedBy: 'demo-adapter-fallback',
    generatedAt: new Date().toISOString(),
    adherenceSummaries,
    refillCountdownsByPatient,
    digitalTwinInsightsByPatient,
  };
}

export async function fetchBackendCaregiverInsights(params: {
  caregiverId?: string;
  patients: Patient[];
  connections: CaregiverConnection[];
  medications: Medication[];
  doseLogs: DoseLog[];
}): Promise<CaregiverInsightsResponse> {
  const todayStr = getTodayIso();
  const nowHhMm = getCurrentHhMm();

  try {
    const res = await fetch('/api/caregiver/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        todayStr,
        nowHhMm,
        caregiverId: params.caregiverId,
        patients: params.patients.map((p) => ({ id: p.id, name: p.name, mrn: p.mrn })),
        connections: params.connections,
        medications: params.medications,
        doseLogs: params.doseLogs,
      }),
    });

    if (!res.ok) {
      throw new Error(`Backend insights returned ${res.status}`);
    }

    return (await res.json()) as CaregiverInsightsResponse;
  } catch {
    return buildFallbackCaregiverInsights({
      todayStr,
      caregiverId: params.caregiverId,
      patients: params.patients,
      connections: params.connections,
      medications: params.medications,
      doseLogs: params.doseLogs,
    });
  }
}

export async function acknowledgeCaregiverAlertApi(params: {
  alertId: string;
  caregiverName: string;
  followUpNote?: string;
}): Promise<{ ok: boolean; viaBackend: boolean }> {
  try {
    const res = await fetch('/api/caregiver/alerts/acknowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return { ok: res.ok, viaBackend: res.ok };
  } catch {
    return { ok: true, viaBackend: false };
  }
}
