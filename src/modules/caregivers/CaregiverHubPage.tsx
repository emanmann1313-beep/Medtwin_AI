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
  Send,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
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
import { CaregiverContactsSection } from '@/src/modules/caregivers/components/CaregiverContactsSection';
import { AlertHistoryPanel } from '@/src/modules/caregivers/components/AlertHistoryPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { Input, Textarea } from '@/src/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { cn, formatShortDate, formatTimestamp } from '@/src/lib/utils';
import { CaregiverConnection, RelationshipLabel } from '@/src/types/medtwin';

type AlertFilterStatus = 'all' | 'unacknowledged' | 'acknowledged';
type AlertFilterType = 'all' | 'missed_dose' | 'refill_countdown' | 'checkin';

const DELIVERY_STAGE_STEPS = ['created', 'queued', 'sent', 'delivered', 'acknowledged'] as const;

const RELATIONSHIPS: RelationshipLabel[] = [
  'Child',
  'Parent',
  'Spouse / Partner',
  'Sibling',
  'Guardian',
  'Friend',
  'Other',
];

export function CaregiverHubPage() {
  const { user } = useAuth();
  const {
    state,
    isRealAccountMode,
    setActivePatientId,
    acknowledgeAlert,
    respondCaregiverInvite,
    requestPatientConnectionAsCaregiver,
    createSimulatedAlert,
  } = useMedTwin();
  const navigate = useNavigate();

  const activeCaregiver = useMemo(() => {
    const found =
      state.caregivers.find((c) => c.id === state.activeCaregiverId) ?? state.caregivers[0];
    if (found) return found;
    return {
      id: user?.id ?? 'cg-pending',
      name: user?.fullName ?? 'Caregiver',
      email: user?.email ?? '',
      phoneLabel: user?.phone ?? 'Connected Caregiver',
    };
  }, [state.activeCaregiverId, state.caregivers, user]);

  const caregiverConnections = useMemo(
    () =>
      state.connections.filter(
        (c) =>
          c.caregiverId === activeCaregiver.id ||
          (isRealAccountMode && user && c.caregiverId === user.id),
      ),
    [activeCaregiver.id, isRealAccountMode, state.connections, user],
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

  // Send connection request form (real mode)
  const [requestQuery, setRequestQuery] = useState('');
  const [requestRelationship, setRequestRelationship] = useState<RelationshipLabel>(
    user?.relationship || 'Child',
  );
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  const handleSendConnectionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestQuery.trim()) return;
    setRequestSubmitting(true);
    try {
      await requestPatientConnectionAsCaregiver(requestQuery.trim(), requestRelationship);
      setRequestQuery('');
    } catch {
      // Toast shown by context
    } finally {
      setRequestSubmitting(false);
    }
  };

  // Backend-owned adherence, refill countdowns, and redacted Digital Twin insights
  const [insights, setInsights] = useState<CaregiverInsightsResponse | null>(null);
  const [insightsLoading, setInsightsLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    setInsightsLoading(true);
    fetchBackendCaregiverInsights({
      caregiverId: activeCaregiver.id,
      patients: state.patients,
      connections: caregiverConnections,
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
  }, [activeCaregiver.id, caregiverConnections, state.doseLogs, state.medications, state.patients]);

  // Permitted alerts filtered by consent scope `receive_dose_alerts`
  const permittedRawAlerts = useMemo(
    () =>
      state.alerts.filter((a) =>
        acceptedConnections.some(
          (conn) =>
            conn.patientId === a.patientId &&
            conn.permissions.receiveDoseAlerts &&
            (!a.caregiverId || a.caregiverId === activeCaregiver.id),
        ),
      ),
    [acceptedConnections, activeCaregiver.id, state.alerts],
  );

  const myAlertRecords: CaregiverAlertRecord[] = useMemo(
    () => permittedRawAlerts.map((a) => mapAlertToContractRecord(a, state.patients)),
    [permittedRawAlerts, state.patients],
  );

  const connectedPatients = useMemo(() => {
    const ids = new Set(acceptedConnections.map((c) => c.patientId));
    return state.patients.filter((p) => ids.has(p.id));
  }, [acceptedConnections, state.patients]);

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
    if (isRealAccountMode) return;
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
      {/* Top Caregiver Workspace Header */}
      <Card className="border-[#2DD4BF]/35 shadow-[0_0_26px_rgba(45,212,191,0.12)]">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#2DD4BF]">
                <ShieldCheck className="h-4 w-4" />
                <span>Caregiver Workspace · Consent-Governed Oversight</span>
                {!isRealAccountMode && USE_MOCKS && (
                  <span className="rounded-lg border border-[#FBBF24]/40 bg-[#FBBF24]/12 px-2 py-0.5 text-[11px] font-medium text-[#FBBF24]">
                    Interactive Demo · Simulated Alerts
                  </span>
                )}
              </div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-[#F8FAFC]">
                {activeCaregiver.name}’s Caregiver Dashboard
              </h2>
              <p className="text-sm text-[#A8B8CC] max-w-2xl">
                Monitor connected patients’ medication schedules, refill countdowns, shared history, and configured alerts—strictly governed by explicit patient approval.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {!isRealAccountMode && (
                <Button
                  type="button"
                  variant="amber"
                  onClick={handleTriggerSimulatedMissedDoseAlert}
                >
                  <BellRing className="h-4 w-4" />
                  <span>Trigger simulated alert</span>
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => navigate('/caregivers')}>
                <Users className="h-4 w-4" />
                <span>Care Circle &amp; Alerts</span>
              </Button>
            </div>
          </div>

          {/* 4-column summary strip */}
          <div className="grid grid-cols-2 gap-3 pt-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#334155] bg-[#223451] p-4">
              <span className="text-xs font-medium text-[#A8B8CC]">Connected Patients</span>
              <div className="mt-1 font-display text-2xl font-bold text-[#F8FAFC] tabular-nums">
                {acceptedConnections.length}
              </div>
              <span className="text-[11px] text-[#A8B8CC]">
                {pendingInvites.length} pending request{pendingInvites.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="rounded-2xl border border-[#334155] bg-[#223451] p-4">
              <span className="text-xs font-medium text-[#A8B8CC]">Open Alerts</span>
              <div
                className={cn(
                  'mt-1 font-display text-2xl font-bold tabular-nums',
                  openAlertsCount > 0 ? 'text-[#FBBF24]' : 'text-[#34D399]',
                )}
              >
                {openAlertsCount}
              </div>
              <span className="text-[11px] text-[#A8B8CC]">
                {myAlertRecords.length} total permitted alerts
              </span>
            </div>

            <div className="rounded-2xl border border-[#334155] bg-[#223451] p-4">
              <span className="text-xs font-medium text-[#A8B8CC]">Refill Countdowns</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className={cn(
                    'font-display text-2xl font-bold tabular-nums',
                    urgentRefillStats.critical > 0
                      ? 'text-[#FB7185]'
                      : urgentRefillStats.warning > 0
                        ? 'text-[#FBBF24]'
                        : 'text-[#34D399]',
                  )}
                >
                  {urgentRefillStats.critical + urgentRefillStats.warning}
                </span>
                <span className="text-xs text-[#A8B8CC]">
                  ({urgentRefillStats.critical} critical · {urgentRefillStats.warning} warn)
                </span>
              </div>
              <span className="text-[11px] text-[#A8B8CC]">Supply thresholds</span>
            </div>

            <div className="rounded-2xl border border-[#334155] bg-[#223451] p-4">
              <span className="text-xs font-medium text-[#A8B8CC]">Calculation Source</span>
              <div className="mt-1 text-sm font-semibold text-[#F8FAFC] flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-[#8B5CF6]" />
                <span>
                  {insights?.calculatedBy === 'backend-api'
                    ? 'Express Backend API'
                    : insightsLoading
                      ? 'Calculating...'
                      : 'Local Summary'}
                </span>
              </div>
              <span className="text-[11px] text-[#A8B8CC]">
                Consent scopes enforced server-side
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            Oversight &amp; Action Queue
          </TabsTrigger>
          <TabsTrigger value="contacts">
            Caregiver Contacts ({connectedPatients.length})
          </TabsTrigger>
          <TabsTrigger value="alert-history">
            Alert History ({permittedRawAlerts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="space-y-6">
          {connectedPatients.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-xs text-[#A8B8CC]">
                No approved patient connections yet. Accept a caregiver invitation to view consented Caregiver Contacts.
              </CardContent>
            </Card>
          ) : (
            connectedPatients.map((pat) => (
              <CaregiverContactsSection
                key={pat.id}
                patient={pat}
                canManageContacts={false}
                acceptedOnly
                compact
                title={`${pat.name} — Caregiver Contacts`}
                description="Approved family caregivers for this patient. Preview or confirm WhatsApp and SMS updates."
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="alert-history">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#F8FAFC]">
                Alert History
              </CardTitle>
              <CardDescription>
                WhatsApp, SMS, and Care Circle notification audit log for your approved patient connections
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertHistoryPanel
                alerts={permittedRawAlerts}
                patients={state.patients}
                emptyMessage="No caregiver alerts or messaging events permitted for your Care Circle connections yet."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          {/* Send Connection Request Card (Authenticated Caregivers) */}
          {isRealAccountMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4 text-[#8B5CF6]" />
              <span>Send connection request to a patient</span>
            </CardTitle>
            <CardDescription>
              Enter the patient’s registered email address or medical record number (MRN). Health details remain hidden until the patient approves your request.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSendConnectionRequest} className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <div className="sm:col-span-6">
                <Input
                  value={requestQuery}
                  onChange={(e) => setRequestQuery(e.target.value)}
                  placeholder="Patient email (e.g., patient@example.com) or MRN"
                  aria-label="Patient email or MRN"
                  required
                />
              </div>
              <div className="sm:col-span-3">
                <select
                  aria-label="Relationship to patient"
                  value={requestRelationship}
                  onChange={(e) => setRequestRelationship(e.target.value as RelationshipLabel)}
                  className="h-10 w-full rounded-xl border border-[#334155] bg-[#0B1220] px-3 text-xs text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                >
                  {RELATIONSHIPS.map((rel) => (
                    <option key={rel} value={rel}>
                      {rel}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <Button type="submit" className="w-full" disabled={requestSubmitting}>
                  {requestSubmitting ? 'Sending...' : 'Send request'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Linked Patients Oversight Cards */}
      <section aria-label="Connected patients overview" className="space-y-4">
        <div>
          <h3 className="font-display text-lg font-bold text-[#F8FAFC]">
            Connected patients ({acceptedConnections.length})
          </h3>
          <p className="text-xs text-[#A8B8CC]">
            Adherence metrics, refill countdowns, and Digital Twin insights automatically respect each patient’s 4 consent scopes.
          </p>
        </div>

        {acceptedConnections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-2">
              <Users className="mx-auto h-8 w-8 text-[#334155]" />
              <p className="text-sm font-medium text-[#F8FAFC]">
                No approved patient connections yet
              </p>
              <p className="mx-auto max-w-md text-xs text-[#A8B8CC]">
                Send a connection request above using a patient’s email or MRN, or accept an invitation sent by your family member below.
              </p>
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
                <Card key={conn.id} className="overflow-hidden border-[#334155] bg-[#1A2740]">
                  <CardHeader className="border-b border-[#334155] pb-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg text-[#F8FAFC]">{patient.name}</CardTitle>
                        <CardDescription>
                          {conn.relationship} · {conn.contactPriority} contact · MRN {patient.mrn}
                        </CardDescription>
                      </div>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold',
                          patientOpenAlerts.length > 0
                            ? 'bg-[#FBBF24]/15 text-[#FBBF24] border border-[#FBBF24]/30'
                            : 'bg-[#2DD4BF]/15 text-[#2DD4BF] border border-[#2DD4BF]/30',
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
                    {/* Adherence Summary */}
                    {conn.permissions.viewSchedules && adherence?.access_granted ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-2xl bg-[#223451] p-3 border border-[#334155]">
                          <span className="text-[11px] text-[#A8B8CC] block">Today’s doses</span>
                          <span className="font-mono text-base font-bold text-[#F8FAFC] tabular-nums">
                            {adherence.today_taken} / {adherence.today_total}
                          </span>
                        </div>
                        <div className="rounded-2xl bg-[#223451] p-3 border border-[#334155]">
                          <span className="text-[11px] text-[#A8B8CC] block">7-day adherence</span>
                          <span className="font-mono text-base font-bold text-[#2DD4BF] tabular-nums">
                            {adherence.adherence_7d_pct !== null
                              ? `${adherence.adherence_7d_pct}%`
                              : '—'}
                          </span>
                        </div>
                        <div className="rounded-2xl bg-[#223451] p-3 border border-[#334155]">
                          <span className="text-[11px] text-[#A8B8CC] block">30-day adherence</span>
                          <span className="font-mono text-base font-bold text-[#F8FAFC] tabular-nums">
                            {adherence.adherence_30d_pct !== null
                              ? `${adherence.adherence_30d_pct}%`
                              : '—'}
                          </span>
                        </div>
                        <div className="rounded-2xl bg-[#223451] p-3 border border-[#334155]">
                          <span className="text-[11px] text-[#A8B8CC] block">Unconfirmed (7d)</span>
                          <span
                            className={cn(
                              'font-mono text-base font-bold tabular-nums',
                              adherence.unconfirmed_7d > 0
                                ? 'text-[#FBBF24]'
                                : 'text-[#34D399]',
                            )}
                          >
                            {adherence.unconfirmed_7d}
                          </span>
                          <span className="block text-[10px] text-[#A8B8CC]">
                            {adherence.skipped_7d} skipped
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2.5 rounded-2xl border border-[#334155] bg-[#223451] p-3.5 text-xs text-[#A8B8CC]">
                        <Lock className="h-4 w-4 text-[#A8B8CC] shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-[#F8FAFC] block">
                            Schedule &amp; adherence redacted
                          </span>
                          <span>
                            The <code className="font-mono text-[#2DD4BF]">view_schedules</code> consent scope is turned off for this link.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Refill Countdowns */}
                    {conn.permissions.viewSchedules && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#F8FAFC] flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5 text-[#2DD4BF]" />
                            <span>Refill countdowns</span>
                          </span>
                          <span className="text-[11px] text-[#A8B8CC]">
                            Critical &le;2d · Warning &le;7d
                          </span>
                        </div>

                        {countdowns.length === 0 ? (
                          <p className="text-xs text-[#A8B8CC]">No active tracked supplies.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {countdowns.map((item) => (
                              <div
                                key={item.medication_id}
                                className={cn(
                                  'flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs',
                                  item.urgency === 'critical'
                                    ? 'border-[#FB7185]/40 bg-[#FB7185]/10 text-[#F8FAFC]'
                                    : item.urgency === 'warning'
                                      ? 'border-[#FBBF24]/40 bg-[#FBBF24]/10 text-[#F8FAFC]'
                                      : 'border-[#334155] bg-[#223451] text-[#F8FAFC]',
                                )}
                              >
                                <div className="min-w-0">
                                  <span className="font-semibold truncate block">
                                    {item.medication_name} {item.strength}
                                  </span>
                                  <span className="text-[11px] text-[#A8B8CC]">
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
                                        ? 'text-[#FB7185]'
                                        : item.urgency === 'warning'
                                          ? 'text-[#FBBF24]'
                                          : 'text-[#2DD4BF]',
                                    )}
                                  >
                                    {item.days_remaining !== null
                                      ? `${item.days_remaining}d left`
                                      : 'PRN / N/A'}
                                  </span>
                                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[#A8B8CC]">
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
                          ? 'border-[#2DD4BF]/35 bg-[#2DD4BF]/10 shadow-[0_0_20px_rgba(45,212,191,0.12)]'
                          : 'border-[#334155] bg-[#223451]',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#F8FAFC] flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5 text-[#8B5CF6]" />
                          <span>Digital Twin continuity insight</span>
                        </span>
                        <span className="text-[11px] font-medium capitalize text-[#A8B8CC]">
                          Access: {twin?.access_level.replace('_', ' ') ?? 'evaluating'}
                        </span>
                      </div>

                      {twin ? (
                        <>
                          {twin.access_level === 'full' && twin.projected_adherence_14d_pct !== null && (
                            <div className="flex flex-wrap items-center gap-4 text-xs py-1">
                              <div>
                                <span className="text-[#A8B8CC]">14-day supply coverage: </span>
                                <span className="font-mono font-bold text-[#F8FAFC] tabular-nums">
                                  {twin.projected_adherence_14d_pct}%
                                </span>
                              </div>
                              <div>
                                <span className="text-[#A8B8CC]">Low-supply meds: </span>
                                <span className="font-mono font-bold text-[#F8FAFC] tabular-nums">
                                  {twin.supply_runout_risk_count}
                                </span>
                              </div>
                            </div>
                          )}

                          <p className="text-xs text-[#F8FAFC] leading-relaxed">
                            {twin.continuity_note}
                          </p>
                          {twin.redaction_reason && (
                            <p className="text-[11px] text-[#FBBF24] flex items-center gap-1">
                              <Lock className="h-3 w-3 shrink-0" />
                              <span>{twin.redaction_reason}</span>
                            </p>
                          )}
                          <p className="text-[11px] text-[#A8B8CC]">{twin.disclaimer}</p>
                        </>
                      ) : (
                        <p className="text-xs text-[#A8B8CC]">Loading Digital Twin summary...</p>
                      )}
                    </div>

                    {/* Footer update + permitted shortcuts */}
                    <div className="flex flex-col gap-3 border-t border-[#334155] pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-[#A8B8CC] truncate">
                        <span className="font-medium text-[#F8FAFC]">Last update: </span>
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

      {/* Alerts Queue */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-[#F8FAFC]">
                <Bell className="h-4 w-4 text-[#FBBF24]" />
                <span>Missed-dose alerts &amp; notification history</span>
              </CardTitle>
              <CardDescription>
                Shows delivery lifecycle states and follow-up acknowledgements for authorized Care Circle patients.
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
                        ? 'bg-[#8B5CF6] text-white shadow-[0_0_15px_rgba(139,92,246,0.28)]'
                        : 'border border-[#334155] bg-[#223451] text-[#A8B8CC] hover:bg-[#1A2740] hover:text-[#F8FAFC]',
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
                className="h-8 rounded-xl border border-[#334155] bg-[#0B1220] px-2.5 text-xs text-[#F8FAFC]"
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
            <p className="py-10 text-center text-sm text-[#A8B8CC]">
              No caregiver alerts match your current filter criteria.
            </p>
          ) : (
            <div className="divide-y divide-[#334155]">
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
                        <span className="font-semibold text-[#F8FAFC]">{alert.patient_name}</span>
                        <span aria-hidden="true" className="text-[#A8B8CC]">·</span>
                        <span className="capitalize font-medium text-[#A8B8CC]">
                          {alert.alert_type.replace('_', ' ')}
                        </span>
                        <span aria-hidden="true" className="text-[#A8B8CC]">·</span>
                        <span className="font-mono text-[#A8B8CC] tabular-nums">
                          {formatTimestamp(alert.created_at)}
                        </span>
                      </div>

                      <h4 className="text-sm font-semibold text-[#F8FAFC]">{alert.title}</h4>
                      <p className="text-xs text-[#A8B8CC]">{alert.reason}</p>

                      {/* Delivery lifecycle strip */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                        <span className="text-[#A8B8CC]">{alert.channel}</span>
                        <span aria-hidden="true" className="text-[#A8B8CC]">·</span>
                        {isFailed ? (
                          <span className="font-semibold text-[#FB7185]">Delivery status: Failed</span>
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
                                          ? 'font-semibold text-[#34D399]'
                                          : 'font-semibold text-[#F8FAFC]'
                                        : reached
                                          ? 'text-[#A8B8CC]'
                                          : 'text-[#334155]',
                                    )}
                                  >
                                    {stage}
                                  </span>
                                  {idx < DELIVERY_STAGE_STEPS.length - 1 && (
                                    <span className="text-[#334155]">&rarr;</span>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {alert.follow_up_note && (
                        <p className="mt-1 rounded-xl border border-[#2DD4BF]/25 bg-[#2DD4BF]/10 px-3 py-2 text-xs text-[#2DD4BF]">
                          <strong>Follow-up ({alert.acknowledged_by}):</strong> {alert.follow_up_note}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0">
                      {isAck ? (
                        <div className="inline-flex items-center gap-1.5 rounded-xl border border-[#34D399]/30 bg-[#34D399]/15 px-3 py-1.5 text-xs font-semibold text-[#34D399]">
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

      {/* Caregiver Consent Links Directory */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[#F8FAFC]">
            Care Circle consent links ({consentRecords.length})
          </CardTitle>
          <CardDescription>
            Accept patient invitations or track pending connection requests awaiting patient approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConsentList
            consents={consentRecords}
            connectionsById={connectionsById}
            perspective="caregiver"
            editable={false}
            emptyMessage="No Care Circle invitations or connection requests found yet."
            onAcceptInvite={(id) => respondCaregiverInvite(id, 'accepted')}
            onRevokeConsent={(id) => respondCaregiverInvite(id, 'revoked')}
            onRestoreConsent={(id) => respondCaregiverInvite(id, 'accepted')}
          />
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

      {/* Acknowledge Alert Dialog */}
      <Dialog open={Boolean(ackTarget)} onOpenChange={(open) => !open && setAckTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[#F8FAFC]">Acknowledge Care Circle alert</DialogTitle>
            <DialogDescription>
              Confirm you reviewed this alert for <strong>{ackTarget?.patient_name}</strong> and optionally log a follow-up note.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmAcknowledge} className="space-y-4">
            <div>
              <label
                htmlFor="ack-followup"
                className="block text-xs font-medium text-[#F8FAFC] mb-1.5"
              >
                Follow-up note (optional)
              </label>
              <Textarea
                id="ack-followup"
                value={followUpNote}
                onChange={(e) => setFollowUpNote(e.target.value)}
                placeholder="e.g., Called family member; confirmed evening dose taken and pharmacy refill ordered."
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
