import {
  AttentionItem,
  CareAlert,
  DoseLog,
  DoseState,
  Medication,
  Prescription,
} from '@/src/types/medtwin';
import { addDaysIso, formatShortDate } from '@/src/lib/utils';

export interface ScheduledDoseSlot {
  slotKey: string;
  patientId: string;
  medication: Medication;
  scheduledDate: string;
  scheduledTime: string;
  state: DoseState;
  log?: DoseLog;
}

export interface AdherenceMetrics {
  periodDays: number;
  scheduledDueCount: number;
  takenCount: number;
  skippedCount: number;
  unconfirmedCount: number;
  adherencePct: number | null; // null when 0 due doses
  dailySeries: Array<{
    date: string;
    label: string;
    taken: number;
    skipped: number;
    unconfirmed: number;
    due: number;
    adherencePct: number;
  }>;
}

export interface RefillForecast {
  medicationId: string;
  medicationName: string;
  strength: string;
  remainingQuantity: number | null;
  unitLabel: string;
  dailyUsage: number;
  daysRemaining: number | null;
  estimatedRefillDate: string | null;
  needsRefill: boolean;
}

export function getCurrentHhMm(now: Date = new Date()): string {
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function getTodayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildDoseSlotsForDate(
  patientId: string,
  dateStr: string,
  medications: Medication[],
  doseLogs: DoseLog[],
  now: Date = new Date(),
): ScheduledDoseSlot[] {
  const todayStr = getTodayIso(now);
  const nowHhMm = getCurrentHhMm(now);

  const slots: ScheduledDoseSlot[] = [];

  for (const med of medications) {
    if (med.patientId !== patientId || med.status !== 'active' || med.asNeeded) continue;
    if (dateStr < med.startDate) continue;
    if (med.endDate && dateStr > med.endDate) continue;

    for (const timeStr of med.scheduledTimes) {
      const log = doseLogs.find(
        (l) =>
          l.patientId === patientId &&
          l.medicationId === med.id &&
          l.scheduledDate === dateStr &&
          l.scheduledTime === timeStr,
      );

      let state: DoseState = 'scheduled';
      if (log) {
        state = log.status === 'taken' ? 'taken' : 'skipped';
      } else if (dateStr < todayStr) {
        state = 'overdue';
      } else if (dateStr === todayStr) {
        if (timeStr <= nowHhMm) {
          // If more than 2 hours past scheduled time, mark overdue/unconfirmed; otherwise due
          const [sh, sm] = timeStr.split(':').map(Number);
          const [nh, nm] = nowHhMm.split(':').map(Number);
          const diffMins = nh * 60 + nm - (sh * 60 + sm);
          state = diffMins > 120 ? 'overdue' : 'due';
        } else {
          state = 'scheduled';
        }
      } else {
        state = 'scheduled';
      }

      slots.push({
        slotKey: `${med.id}__${dateStr}__${timeStr}`,
        patientId,
        medication: med,
        scheduledDate: dateStr,
        scheduledTime: timeStr,
        state,
        log,
      });
    }
  }

  return slots.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
}

/**
 * Recorded adherence = confirmed taken doses / scheduled doses due in the selected period.
 * Excludes future doses and as-needed medicines.
 * Distinguishes confirmed skipped doses from missing/unconfirmed logs.
 */
export function computeAdherenceMetrics(
  patientId: string,
  periodDays: number,
  medications: Medication[],
  doseLogs: DoseLog[],
  now: Date = new Date(),
): AdherenceMetrics {
  const todayStr = getTodayIso(now);
  const nowHhMm = getCurrentHhMm(now);

  let scheduledDueCount = 0;
  let takenCount = 0;
  let skippedCount = 0;
  let unconfirmedCount = 0;
  const dailySeries: AdherenceMetrics['dailySeries'] = [];

  for (let offset = periodDays - 1; offset >= 0; offset--) {
    const dateStr = addDaysIso(todayStr, -offset);
    const slots = buildDoseSlotsForDate(patientId, dateStr, medications, doseLogs, now);

    // Exclude future doses on today (state === 'scheduled' when scheduledTime > nowHhMm)
    const dueSlots = slots.filter((s) => {
      if (dateStr < todayStr) return true;
      if (dateStr === todayStr) {
        return s.log !== undefined || s.scheduledTime <= nowHhMm;
      }
      return false;
    });

    const dayTaken = dueSlots.filter((s) => s.state === 'taken').length;
    const daySkipped = dueSlots.filter((s) => s.state === 'skipped').length;
    const dayUnconfirmed = dueSlots.filter((s) => s.state === 'overdue' || s.state === 'due').length;

    scheduledDueCount += dueSlots.length;
    takenCount += dayTaken;
    skippedCount += daySkipped;
    unconfirmedCount += dayUnconfirmed;

    const dObj = new Date(`${dateStr}T00:00:00`);
    const label = dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dayPct = dueSlots.length > 0 ? Math.round((dayTaken / dueSlots.length) * 100) : 100;

    dailySeries.push({
      date: dateStr,
      label,
      taken: dayTaken,
      skipped: daySkipped,
      unconfirmed: dayUnconfirmed,
      due: dueSlots.length,
      adherencePct: dayPct,
    });
  }

  const adherencePct =
    scheduledDueCount > 0 ? Math.round((takenCount / scheduledDueCount) * 100) : null;

  return {
    periodDays,
    scheduledDueCount,
    takenCount,
    skippedCount,
    unconfirmedCount,
    adherencePct,
    dailySeries,
  };
}

export function computeRefillForecasts(
  patientId: string,
  medications: Medication[],
  now: Date = new Date(),
): RefillForecast[] {
  const todayStr = getTodayIso(now);

  return medications
    .filter((m) => m.patientId === patientId && m.status === 'active')
    .map((m) => {
      const dailyUsage = m.asNeeded ? 0 : m.scheduledTimes.length;
      const qty = typeof m.remainingQuantity === 'number' ? m.remainingQuantity : null;
      const daysRemaining =
        qty !== null && dailyUsage > 0 ? Math.floor(qty / dailyUsage) : null;
      const estimatedRefillDate =
        daysRemaining !== null ? addDaysIso(todayStr, daysRemaining) : null;
      const needsRefill =
        daysRemaining !== null ? daysRemaining <= m.refillThresholdDays : false;

      return {
        medicationId: m.id,
        medicationName: m.name,
        strength: m.strength,
        remainingQuantity: qty,
        unitLabel: m.unitLabel,
        dailyUsage,
        daysRemaining,
        estimatedRefillDate,
        needsRefill,
      };
    });
}

export function buildExplainableAttentionItems(
  patientId: string,
  medications: Medication[],
  doseLogs: DoseLog[],
  prescriptions: Prescription[],
  alerts: CareAlert[],
  now: Date = new Date(),
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const metrics7d = computeAdherenceMetrics(patientId, 7, medications, doseLogs, now);
  const refills = computeRefillForecasts(patientId, medications, now);

  // 1. Repeated unconfirmed dose events
  if (metrics7d.unconfirmedCount >= 2) {
    items.push({
      id: `att-unconf-${patientId}`,
      patientId,
      label: 'Review required',
      severity: metrics7d.unconfirmedCount >= 4 ? 'red' : 'amber',
      title: `${metrics7d.unconfirmedCount} unconfirmed scheduled doses`,
      trigger: `${metrics7d.unconfirmedCount} due medication slots have no taken or skipped confirmation recorded.`,
      timePeriod: 'Last 7 days',
      supportingRecords: [
        `${metrics7d.takenCount} confirmed taken of ${metrics7d.scheduledDueCount} due doses`,
      ],
      nextActionLabel: 'Review schedule & log doses',
      nextActionRoute: '/medications',
    });
  }

  // 2. Recorded skipped doses
  if (metrics7d.skippedCount >= 1) {
    const todayStr = getTodayIso(now);
    const start7 = addDaysIso(todayStr, -6);
    const recentSkips = doseLogs.filter(
      (l) =>
        l.patientId === patientId &&
        l.status === 'skipped' &&
        l.scheduledDate >= start7 &&
        l.scheduledDate <= todayStr,
    );
    items.push({
      id: `att-skip-${patientId}`,
      patientId,
      label: 'Review required',
      severity: 'amber',
      title: `${metrics7d.skippedCount} recorded skipped dose${metrics7d.skippedCount > 1 ? 's' : ''}`,
      trigger: 'Patient or caregiver explicitly logged a skipped dose.',
      timePeriod: 'Last 7 days',
      supportingRecords: recentSkips.slice(0, 3).map((s) => {
        const med = medications.find((m) => m.id === s.medicationId);
        return `${med?.name ?? 'Medication'} on ${formatShortDate(s.scheduledDate)}${s.skipReason ? ` (${s.skipReason})` : ''}`;
      }),
      nextActionLabel: 'Inspect history',
      nextActionRoute: '/history',
    });
  }

  // 3. Stock approaching refill threshold
  for (const r of refills) {
    if (r.needsRefill && r.daysRemaining !== null) {
      items.push({
        id: `att-refill-${r.medicationId}`,
        patientId,
        label: 'Refill needed',
        severity: r.daysRemaining <= 4 ? 'red' : 'amber',
        title: `${r.medicationName} ${r.strength} approaching refill threshold`,
        trigger: `${r.remainingQuantity} ${r.unitLabel} remaining (~${r.daysRemaining} days at ${r.dailyUsage}/day).`,
        timePeriod: `Estimated runout: ${r.estimatedRefillDate ? formatShortDate(r.estimatedRefillDate) : 'Soon'}`,
        supportingRecords: [`Active schedule: ${r.dailyUsage} dose(s) daily`],
        nextActionLabel: 'Simulate refill delay',
        nextActionRoute: '/digital-twin',
      });
    }
  }

  // 4. Possible duplicate medication entries requiring review
  const activeMeds = medications.filter((m) => m.patientId === patientId && m.status === 'active');
  for (let i = 0; i < activeMeds.length; i++) {
    for (let j = i + 1; j < activeMeds.length; j++) {
      const a = activeMeds[i].name.toLowerCase().split(' ')[0];
      const b = activeMeds[j].name.toLowerCase().split(' ')[0];
      if (a && b && (a === b || activeMeds[i].name.toLowerCase().includes(b) || activeMeds[j].name.toLowerCase().includes(a))) {
        items.push({
          id: `att-dup-${activeMeds[i].id}-${activeMeds[j].id}`,
          patientId,
          label: 'Review required',
          severity: 'red',
          title: `Possible duplicate entry: ${activeMeds[i].name} & ${activeMeds[j].name}`,
          trigger: 'Two active medication schedules share the same base medicine name.',
          timePeriod: 'Current active plan',
          supportingRecords: [
            `${activeMeds[i].name} ${activeMeds[i].strength} (${activeMeds[i].scheduledTimes.join(', ')})`,
            `${activeMeds[j].name} ${activeMeds[j].strength} (${activeMeds[j].scheduledTimes.join(', ')})`,
          ],
          nextActionLabel: 'Review medications',
          nextActionRoute: '/medications',
        });
      }
    }
  }

  // 5. Incomplete prescription information
  const pendingRx = prescriptions.filter(
    (p) =>
      p.patientId === patientId &&
      (p.status === 'pending-review' || p.items.some((it) => it.unclearFields.length > 0)),
  );
  for (const rx of pendingRx) {
    items.push({
      id: `att-rx-${rx.id}`,
      patientId,
      label: 'Missing details',
      severity: 'amber',
      title: `Prescription review incomplete (${rx.fileName})`,
      trigger: 'Extracted prescription has unconfirmed or unclear fields requiring confirmation.',
      timePeriod: `Uploaded ${formatShortDate(rx.createdAt)}`,
      supportingRecords: rx.items
        .filter((it) => it.unclearFields.length > 0)
        .map((it) => `${it.medicineName || 'Unnamed item'}: ${it.unclearFields.join(', ')}`),
      nextActionLabel: 'Review & confirm Rx',
      nextActionRoute: '/prescriptions',
    });
  }

  // 6. Unacknowledged caregiver alerts
  const unackAlerts = alerts.filter(
    (a) => a.patientId === patientId && a.deliveryState !== 'acknowledged',
  );
  if (unackAlerts.length > 0) {
    items.push({
      id: `att-alerts-${patientId}`,
      patientId,
      label: 'Caregiver follow-up',
      severity: unackAlerts.some((a) => a.severity === 'urgent') ? 'red' : 'amber',
      title: `${unackAlerts.length} unacknowledged caregiver alert${unackAlerts.length > 1 ? 's' : ''}`,
      trigger: 'Care Circle notification has not yet been acknowledged by a caregiver.',
      timePeriod: 'Active alerts',
      supportingRecords: unackAlerts.slice(0, 2).map((a) => `${a.title} (${a.deliveryState})`),
      nextActionLabel: 'Open Care Circle',
      nextActionRoute: '/caregivers',
    });
  }

  return items;
}
