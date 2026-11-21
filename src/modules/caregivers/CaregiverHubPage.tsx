import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  Bell,
  BellRing,
  CheckCircle2,
  Clock,
  Lock,
  Package,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useMedTwin } from '@/src/context/MedTwinContext';
import {
  CaregiverAdherenceSummary,
  CaregiverAlertRecord,
  CaregiverConsentRecord,
  CaregiverInsightsResponse,
  DigitalTwinRedactedInsight,
  RefillCountdownItem,
} from '@/src/types/caregiverContracts';
import {
  USE_MOCKS,
  acknowledgeCaregiverAlertApi,
  fetchBackendCaregiverInsights,
  mapAlertToContractRecord,
  mapConnectionToConsentRecord,
} from '@/src/services/caregiverAdapter';
import { ScopeBadges } from '@/src/modules/caregivers/components/ScopeBadges';
import { ConsentList } from '@/src/modules/caregivers/components/ConsentList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { Textarea } from '@/src/components/ui/input';
import { cn, formatShortDate, formatTimestamp } from '@/src/lib/utils';
import { CaregiverConnection } from '@/src/types/medtwin';

type AlertFilterStatus = 'all' | 'unacknowledged' | 'acknowledged';
type AlertFilterType = 'all' | 'missed_dose' | 'refill_countdown' | 'checkin';

const DELIVERY_STAGE_STEPS = ['created', 'queued', 'sent', 'delivered', 'acknowledged'] as const;

export function CaregiverHubPage() {
  const {
    state,
    setActivePatientId,
    acknowledgeAlert,
    respondCaregiverInvite,
    createSimulatedAlert,
  } = useMedTwin();
  const navigate = useNavigate();

  const activeCaregiver =
    state.caregivers.find((c) => c.id === state.activeCaregiverId) ?? state.caregivers[0];

  const caregiverConnections = useMemo(
    () => state.connections.filter((c) => c.caregiverId === activeCaregiver.id),
    [activeCaregiver.id, state.connections],
  );

  const acceptedConnections = useMemo(
    () => caregiverConnections.filter((c) => c.status === 'accepted'),
    [caregiverConnections],
  );

  const pendingInvites = useMemo(
    () => caregiverConnections.filter((c) => c.status === 'invited'),
    [caregiverConnections],
  );

  const connectionsById = useMemo(() => {
    const map: Record<string, CaregiverConnection> = {};
    for (const c of caregiverConnections) {
      map[c.id] = c;
    }
    return map;
  }, [caregiverConnections]);

  const consentRecords: CaregiverConsentRecord[] = useMemo(
    () => caregiverConnections.map((c) => mapConnectionToConsentRecord(c, state.patients)),
    [caregiverConnections, state.patients],
  );

  // Backend-owned adherence, refill countdowns, and redacted Digital Twin insights
  const [insights, setInsights] = useState<CaregiverInsightsResponse | null>(null);
  const [insightsLoading, setInsightsLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    setInsightsLoading(true);
    fetchBackendCaregiverInsights({
      caregiverId: activeCaregiver.id,
      patients: state.patients,
      connections: state.connections,
      medications: state.medications,
      doseLogs: state.doseLogs,
    }).then((res) => {
      if (!active) return;
      setInsights(res);
      setInsightsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [activeCaregiver.id, state.connections, state.doseLogs, state.medications, state.patients]);

  // Permitted alerts filtered by consent scope `receive_dose_alerts`
  const myAlertRecords: CaregiverAlertRecord[] = useMemo(
    () =>
      state.alerts
        .filter((a) =>
          acceptedConnections.some(
            (conn) =>
              conn.patientId === a.patientId &&
              conn.permissions.receiveDoseAlerts &&
              (!a.caregiverId || a.caregiverId === activeCaregiver.id),
          ),
        )
        .map((a) => mapAlertToContractRecord(a, state.patients)),
    [acceptedConnections, activeCaregiver.id, state.alerts, state.patients],
  );

  const [alertStatusFilter, setAlertStatusFilter] = useState<AlertFilterStatus>('all');
  const [alertTypeFilter, setAlertTypeFilter] = useState<AlertFilterType>('all');
  const [ackTarget, setAckTarget] = useState<CaregiverAlertRecord | null>(null);
  const [followUpNote, setFollowUpNote] = useState('');
  const [isAckSubmitting, setIsAckSubmitting] = useState(false);

  const filteredAlerts = useMemo(
    () =>
      myAlertRecords.filter((a) => {
        if (alertStatusFilter === 'unacknowledged' && a.delivery_status === 'acknowledged') {
          return false;
        }
        if (alertStatusFilter === 'acknowledged' && a.delivery_status !== 'acknowledged') {
          return false;
        }
        if (alertTypeFilter !== 'all' && a.alert_type !== alertTypeFilter) {
          return false;
        }
        return true;
      }),
    [alertStatusFilter, alertTypeFilter, myAlertRecords],
  );

  const openAlertsCount = myAlertRecords.filter(
    (a) => a.delivery_status !== 'acknowledged',
  ).length;

  const urgentRefillStats = useMemo(() => {
    let critical = 0;
    let warning = 0;
    if (!insights) return { critical, warning };
    for (const conn of acceptedConnections) {
      const list = insights.refillCountdownsByPatient[conn.patientId] ?? [];
      for (const item of list) {
        if (item.urgency === 'critical') critical += 1;
        else if (item.urgency === 'warning') warning += 1;
      }
    }
    return { critical, warning };
  }, [acceptedConnections, insights]);

  const handleTriggerSimulatedMissedDoseAlert = () => {
    const targetConn = acceptedConnections.find((c) => c.permissions.receiveDoseAlerts);
    if (!targetConn) {
      createSimulatedAlert({
        patientId: acceptedConnections[0]?.patientId ?? state.activePatientId,
        caregiverId: activeCaregiver.id,
        title: 'Simulated missed-dose alert',
        reason: 'No accepted caregiver connection has receive_dose_alerts enabled.',
        severity: 'urgent',
      });
      return;
    }
    const pat = state.patients.find((p) => p.id === targetConn.patientId);
    const med = state.medications.find(
      (m) => m.patientId === targetConn.patientId && m.status === 'active' && !m.asNeeded,
    );
    createSimulatedAlert({
      patientId: targetConn.patientId,
      caregiverId: activeCaregiver.id,
      title: `Repeated missed scheduled dose · ${med?.name ?? 'Daily medication'}`,
      reason: `${pat?.name ?? 'Patient'} crossed the Care Circle threshold (${targetConn.alertPreferences.repeatedMissedThreshold} unconfirmed doses) for ${med ? `${med.name} ${med.strength}` : 'scheduled regimen'}.`,
      severity: 'urgent',
    });
  };

  const handleConfirmAcknowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ackTarget) return;
    setIsAckSubmitting(true);
    try {
      await acknowledgeCaregiverAlertApi({
        alertId: ackTarget.id,
        caregiverName: activeCaregiver.name,
        followUpNote,
      });
      acknowledgeAlert(ackTarget.id, followUpNote);
      setAckTarget(null);
      setFollowUpNote('');
    } finally {
      setIsAckSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Caregiver Workspace Header + Demo Adapter Notice */}
      <Card className="border-slate-200/90 bg-gradient-to-br from-white via-white to-[#14B8A6]/[0.05]">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#0F766E]">
                <ShieldCheck className="h-4 w-4" />
                <span>Caregiver Workspace · Consent-Governed Oversight</span>
                {USE_MOCKS && (
                  <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    USE_MOCKS=true · Synthetic Demo &amp; Simulated Dispatch
                  </span>
                )}
              </div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-[#142D4E]">
                {activeCaregiver.name}’s Caregiver Dashboard
              </h2>
              <p className="text-sm text-slate-600 max-w-2xl">
                Monitor linked patient medication adherence, refill countdowns (warning &le;7d, critical &le;2d),
                permission-redacted Digital Twin supply insights, and missed-dose alerts.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Button
                type="button"
                variant="amber"
                onClick={handleTriggerSimulatedMissedDoseAlert}
              >
                <BellRing className="h-4 w-4" />
                <span>Trigger simulated alert</span>
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/caregivers')}>
                <Users className="h-4 w-4" />
                <span>Manage Care Circle</span>
              </Button>
            </div>
          </div>

          {/* 4-column summary strip */}
          <div className="grid grid-cols-2 gap-3 pt-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-[#F8FAFC] p-4">
              <span className="text-xs font-medium text-slate-500">Linked Patients</span>
              <div className="mt-1 font-display text-2xl font-bold text-[#142D4E] tabular-nums">
                {acceptedConnections.length}
              </div>
              <span className="text-[11px] text-slate-500">
                {pendingInvites.length} pending invite{pendingInvites.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-[#F8FAFC] p-4">
              <span className="text-xs font-medium text-slate-500">Open Alerts</span>
              <div
                className={cn(
                  'mt-1 font-display text-2xl font-bold tabular-nums',
                  openAlertsCount > 0 ? 'text-amber-700' : 'text-[#0F766E]',
                )}
              >
                {openAlertsCount}
              </div>
              <span className="text-[11px] text-slate-500">
                {myAlertRecords.length} total permitted alerts
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-[#F8FAFC] p-4">
              <span className="text-xs font-medium text-slate-500">Refill Countdowns</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className={cn(
                    'font-display text-2xl font-bold tabular-nums',
                    urgentRefillStats.critical > 0
                      ? 'text-red-600'
                      : urgentRefillStats.warning > 0
                        ? 'text-amber-700'
                        : 'text-[#10B981]',
                  )}
                >
                  {urgentRefillStats.critical + urgentRefillStats.warning}
                </span>
                <span className="text-xs text-slate-500">
                  ({urgentRefillStats.critical} critical &le;2d · {urgentRefillStats.warning} warn &le;7d)
                </span>
              </div>
              <span className="text-[11px] text-slate-500">Backend-computed thresholds</span>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-[#F8FAFC] p-4">
              <span className="text-xs font-medium text-slate-500">Calculation Source</span>
              <div className="mt-1 text-sm font-semibold text-[#142D4E] flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-[#14B8A6]" />
                <span>
                  {insights?.calculatedBy === 'backend-api'
                    ? 'Express Backend API'
                    : insightsLoading
                      ? 'Calculating...'
                      : 'Demo Fallback'}
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                Consent scopes enforced server-side
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Linked Patients Oversight Cards */}
      <section aria-label="Linked patients overview" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-[#142D4E]">
              Linked patients ({acceptedConnections.length})
            </h3>
            <p className="text-xs text-slate-500">
              Adherence metrics, refill countdowns, and Digital Twin insights automatically respect each patient’s 4 consent scopes.
            </p>
          </div>
        </div>

        {acceptedConnections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-slate-500">
              No active accepted Care Circle links yet. Accept a pending invitation below or switch demo accounts.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {acceptedConnections.map((conn) => {
              const patient = state.patients.find((p) => p.id === conn.patientId);
              if (!patient) return null;

              const consent = mapConnectionToConsentRecord(conn, state.patients);
              const adherence: CaregiverAdherenceSummary | undefined =
                insights?.adherenceSummaries[patient.id];
              const countdowns: RefillCountdownItem[] =
                insights?.refillCountdownsByPatient[patient.id] ?? [];
              const twin: DigitalTwinRedactedInsight | undefined =
                insights?.digitalTwinInsightsByPatient[patient.id];

              const patientOpenAlerts = myAlertRecords.filter(
                (a) => a.patient_id === patient.id && a.delivery_status !== 'acknowledged',
              );
              const latestEvent = state.history.find(
                (h) => h.patientId === patient.id && !h.restrictedToClinician,
              );

              return (
                <Card key={conn.id} className="overflow-hidden">
                  <CardHeader className="border-b border-slate-100 pb-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg text-[#142D4E]">{patient.name}</CardTitle>
                        <CardDescription>
                          {conn.relationship} · {conn.contactPriority} contact · MRN {patient.mrn}
                        </CardDescription>
                      </div>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold',
                          patientOpenAlerts.length > 0
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-[#10B981]/10 text-[#0F766E] border border-[#10B981]/25',
                        )}
                      >
                        {patientOpenAlerts.length > 0 ? (
                          <>
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span>{patientOpenAlerts.length} open alert(s)</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>No open alerts</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div className="pt-2">
                      <ScopeBadges scopes={consent.scopes} showInactive compact />
                    </div>
                  </CardHeader>

                  <CardContent className="pt-5 space-y-5">
                    {/* Backend-Owned Adherence Summary */}
                    {conn.permissions.viewSchedules && adherence?.access_granted ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-2xl bg-[#F8FAFC] p-3 border border-slate-100">
                          <span className="text-[11px] text-slate-500 block">Today’s doses</span>
                          <span className="font-mono text-base font-bold text-[#142D4E] tabular-nums">
                            {adherence.today_taken} / {adherence.today_total}
                          </span>
                        </div>
                        <div className="rounded-2xl bg-[#F8FAFC] p-3 border border-slate-100">
                          <span className="text-[11px] text-slate-500 block">7-day adherence</span>
                          <span className="font-mono text-base font-bold text-[#0F766E] tabular-nums">
                            {adherence.adherence_7d_pct !== null
                              ? `${adherence.adherence_7d_pct}%`
                              : '—'}
                          </span>
                        </div>
                        <div className="rounded-2xl bg-[#F8FAFC] p-3 border border-slate-100">
                          <span className="text-[11px] text-slate-500 block">30-day adherence</span>
                          <span className="font-mono text-base font-bold text-[#142D4E] tabular-nums">
                            {adherence.adherence_30d_pct !== null
                              ? `${adherence.adherence_30d_pct}%`
                              : '—'}
                          </span>
                        </div>
                        <div className="rounded-2xl bg-[#F8FAFC] p-3 border border-slate-100">
                          <span className="text-[11px] text-slate-500 block">Unconfirmed (7d)</span>
                          <span
                            className={cn(
                              'font-mono text-base font-bold tabular-nums',
                              adherence.unconfirmed_7d > 0 ? 'text-amber-700' : 'text-[#10B981]',
                            )}
                          >
                            {adherence.unconfirmed_7d}
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            {adherence.skipped_7d} skipped
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
                        <Lock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-slate-800 block">
                            Schedule &amp; adherence redacted
                          </span>
                          <span>
                            The <code className="font-mono">view_schedules</code> consent scope is turned off for this link.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Refill Countdowns (Warning <= 7d, Critical <= 2d) */}
                    {conn.permissions.viewSchedules && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#142D4E] flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5 text-[#0F766E]" />
                            <span>Refill countdowns</span>
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Critical &le;2d · Warning &le;7d
                          </span>
                        </div>

                        {countdowns.length === 0 ? (
                          <p className="text-xs text-slate-500">No active tracked supplies.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {countdowns.map((item) => (
                              <div
                                key={item.medication_id}
                                className={cn(
                                  'flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs',
                                  item.urgency === 'critical'
                                    ? 'border-red-200 bg-red-50/75 text-red-900'
                                    : item.urgency === 'warning'
                                      ? 'border-amber-200 bg-amber-50/75 text-amber-900'
                                      : 'border-slate-100 bg-[#F8FAFC] text-slate-700',
                                )}
                              >
                                <div className="min-w-0">
                                  <span className="font-semibold truncate block">
                                    {item.medication_name} {item.strength}
                                  </span>
                                  <span className="text-[11px] opacity-80">
                                    {item.remaining_quantity !== null
                                      ? `${item.remaining_quantity} ${item.unit_label} left`
                                      : 'Stock not recorded'}
                                    {item.estimated_refill_date
                                      ? ` · Refill by ${formatShortDate(item.estimated_refill_date)}`
                                      : ''}
                                  </span>
                                </div>
                                <div className="shrink-0 text-right">
                                  <span
                                    className={cn(
                                      'font-mono font-bold tabular-nums block',
                                      item.urgency === 'critical'
                                        ? 'text-red-700'
                                        : item.urgency === 'warning'
                                          ? 'text-amber-800'
                                          : 'text-[#0F766E]',
                                    )}
                                  >
                                    {item.days_remaining !== null
                                      ? `${item.days_remaining}d left`
                                      : 'PRN / N/A'}
                                  </span>
                                  <span className="text-[10px] uppercase tracking-wider font-semibold">
                                    {item.urgency}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Permission-Redacted Digital Twin Insights */}
                    <div
                      className={cn(
                        'rounded-2xl border p-4 space-y-2',
                        twin?.access_level === 'full'
                          ? 'border-[#A78BFA]/35 bg-gradient-to-br from-[#F8FAFC] to-[#A78BFA]/[0.07]'
                          : 'border-slate-200 bg-slate-50/80',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#142D4E] flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5 text-[#A78BFA]" />
                          <span>Digital Twin continuity insight</span>
                        </span>
                        <span className="text-[11px] font-medium capitalize text-slate-500">
                          Access: {twin?.access_level.replace('_', ' ') ?? 'evaluating'}
                        </span>
                      </div>

                      {twin ? (
                        <>
                          {twin.access_level === 'full' && twin.projected_adherence_14d_pct !== null && (
                            <div className="flex flex-wrap items-center gap-4 text-xs py-1">
                              <div>
                                <span className="text-slate-500">14-day supply coverage: </span>
                                <span className="font-mono font-bold text-[#142D4E] tabular-nums">
                                  {twin.projected_adherence_14d_pct}%
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500">Low-supply meds: </span>
                                <span className="font-mono font-bold text-[#142D4E] tabular-nums">
                                  {twin.supply_runout_risk_count}
                                </span>
                              </div>
                            </div>
                          )}

                          <p className="text-xs text-slate-700 leading-relaxed">
                            {twin.continuity_note}
                          </p>
                          {twin.redaction_reason && (
                            <p className="text-[11px] text-amber-800 flex items-center gap-1">
                              <Lock className="h-3 w-3 shrink-0" />
                              <span>{twin.redaction_reason}</span>
                            </p>
                          )}
                          <p className="text-[11px] text-slate-400">{twin.disclaimer}</p>
                        </>
                      ) : (
                        <p className="text-xs text-slate-500">Loading backend Digital Twin summary...</p>
                      )}
                    </div>

                    {/* Footer update + permitted shortcuts */}
                    <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-slate-500 truncate">
                        <span className="font-medium text-slate-700">Last update: </span>
                        {conn.permissions.viewHistoryAndReports && latestEvent
                          ? `${latestEvent.title} (${formatTimestamp(latestEvent.timestamp)})`
                          : conn.permissions.viewHistoryAndReports
                            ? 'No recent events'
                            : 'History redacted (requires view_history_reports)'}
                      </p>

                      <div className="flex flex-wrap gap-2 shrink-0">
                        {conn.permissions.viewSchedules && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setActivePatientId(patient.id);
                              navigate('/medications');
                            }}
                          >
                            <Clock className="h-3.5 w-3.5" />
                            <span>Schedule</span>
                          </Button>
                        )}
                        {conn.permissions.viewHistoryAndReports && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setActivePatientId(patient.id);
                              navigate('/history');
                            }}
                          >
                            History
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Alerts Queue & Filterable Alert History + Delivery Lifecycle */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-[#142D4E]">
                <Bell className="h-4 w-4 text-[#F59E0B]" />
                <span>Missed-dose alerts &amp; notification history (Simulated)</span>
              </CardTitle>
              <CardDescription>
                Shows delivery lifecycle states (Created &rarr; Queued &rarr; Sent &rarr; Delivered &rarr; Acknowledged / Failed). Alerts here are simulated for demo testing without real SMS/email dispatch.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1" role="group" aria-label="Filter alerts by status">
                {(['all', 'unacknowledged', 'acknowledged'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setAlertStatusFilter(st)}
                    className={cn(
                      'rounded-xl px-3 py-1.5 text-xs font-medium capitalize transition-colors cursor-pointer',
                      alertStatusFilter === st
                        ? 'bg-[#142D4E] text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <select
                aria-label="Filter alerts by category"
                value={alertTypeFilter}
                onChange={(e) => setAlertTypeFilter(e.target.value as AlertFilterType)}
                className="h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-[#142D4E]"
              >
                <option value="all">All alert types</option>
                <option value="missed_dose">Missed dose</option>
                <option value="refill_countdown">Refill countdown</option>
                <option value="checkin">Check-in</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredAlerts.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No caregiver alerts match your current filter criteria.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredAlerts.map((alert) => {
                const isAck = alert.delivery_status === 'acknowledged';
                const isFailed = alert.delivery_status === 'failed';
                const currentIdx = DELIVERY_STAGE_STEPS.indexOf(
                  alert.delivery_status as (typeof DELIVERY_STAGE_STEPS)[number],
                );

                return (
                  <div
                    key={alert.id}
                    className="flex flex-col gap-4 py-4 first:pt-1 last:pb-1 lg:flex-row lg:items-start lg:justify-between"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-[#142D4E]">{alert.patient_name}</span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize font-medium text-slate-600">
                          {alert.alert_type.replace('_', ' ')}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-amber-700">
                          {alert.simulated ? 'Simulated dispatch' : 'Dispatch'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-slate-400 tabular-nums">
                          {formatTimestamp(alert.created_at)}
                        </span>
                      </div>

                      <h4 className="text-sm font-semibold text-slate-900">{alert.title}</h4>
                      <p className="text-xs text-slate-600">{alert.reason}</p>

                      {/* Delivery lifecycle strip */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                        <span className="text-slate-500">{alert.channel}</span>
                        <span aria-hidden="true">·</span>
                        {isFailed ? (
                          <span className="font-semibold text-red-600">Delivery status: Failed</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1">
                            {DELIVERY_STAGE_STEPS.map((stage, idx) => {
                              const reached = currentIdx >= idx;
                              const isCurrent = alert.delivery_status === stage;
                              return (
                                <React.Fragment key={stage}>
                                  <span
                                    className={cn(
                                      'capitalize',
                                      isCurrent
                                        ? isAck
                                          ? 'font-semibold text-[#0F766E]'
                                          : 'font-semibold text-[#142D4E]'
                                        : reached
                                          ? 'text-slate-600'
                                          : 'text-slate-300',
                                    )}
                                  >
                                    {stage}
                                  </span>
                                  {idx < DELIVERY_STAGE_STEPS.length - 1 && (
                                    <span className="text-slate-300">&rarr;</span>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {alert.follow_up_note && (
                        <p className="mt-1 rounded-xl bg-[#14B8A6]/10 px-3 py-2 text-xs text-[#0F766E]">
                          <strong>Follow-up ({alert.acknowledged_by}):</strong> {alert.follow_up_note}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0">
                      {isAck ? (
                        <div className="inline-flex items-center gap-1.5 rounded-xl bg-[#10B981]/10 px-3 py-1.5 text-xs font-semibold text-[#0F766E]">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Acknowledged</span>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setFollowUpNote('');
                            setAckTarget(alert);
                          }}
                        >
                          Acknowledge &amp; add note
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Caregiver Consent Links Directory (with ConsentList, ConsentRow, ScopeBadges, RevokeDialog) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[#142D4E]">
            Care Circle consent links ({consentRecords.length})
          </CardTitle>
          <CardDescription>
            Accept pending family invitations or review/revoke your active caregiver access scopes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConsentList
            consents={consentRecords}
            connectionsById={connectionsById}
            perspective="caregiver"
            editable={false}
            emptyMessage="No Care Circle invitations or connections found for this caregiver account."
            onAcceptInvite={(id) => respondCaregiverInvite(id, 'accepted')}
            onRevokeConsent={(id) => respondCaregiverInvite(id, 'revoked')}
            onRestoreConsent={(id) => respondCaregiverInvite(id, 'accepted')}
          />
        </CardContent>
      </Card>

      {/* Acknowledge Alert Dialog */}
      <Dialog open={Boolean(ackTarget)} onOpenChange={(open) => !open && setAckTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[#142D4E]">Acknowledge Care Circle alert</DialogTitle>
            <DialogDescription>
              Confirm you reviewed this simulated alert for{' '}
              <strong>{ackTarget?.patient_name}</strong> and optionally log a follow-up note for the care team.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmAcknowledge} className="space-y-4">
            <div>
              <label
                htmlFor="ack-followup"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Follow-up note (optional)
              </label>
              <Textarea
                id="ack-followup"
                value={followUpNote}
                onChange={(e) => setFollowUpNote(e.target.value)}
                placeholder="e.g., Called Elena; confirmed evening Metformin taken with dinner and pharmacy refill ordered."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAckTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isAckSubmitting}>
                {isAckSubmitting ? 'Saving...' : 'Confirm acknowledgement'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
