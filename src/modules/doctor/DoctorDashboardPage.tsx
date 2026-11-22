import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/src/context/AuthContext';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { useTheme } from '@/src/context/ThemeContext';
import {
  buildExplainableAttentionItems,
  computeAdherenceMetrics,
  computeRefillForecasts,
} from '@/src/services/adherenceEngine';
import { runDigitalTwinSimulation } from '@/src/services/digitalTwinEngine';
import { generateVisitSummaryWithAi, VisitSummaryApiResult } from '@/src/services/aiService';
import { ProgressRing } from '@/src/components/ui/ProgressRing';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input, Textarea } from '@/src/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { cn, formatShortDate, formatTimestamp } from '@/src/lib/utils';

type SortKey = 'name' | 'age' | 'adherence' | 'lastReview';

export function DoctorDashboardPage() {
  const { user } = useAuth();
  const {
    state,
    isRealAccountMode,
    hasPatients,
    setActivePatientId,
    addClinicianNote,
  } = useMedTwin();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const activeDoctor = useMemo(() => {
    const found = state.doctors.find((d) => d.id === state.activeDoctorId) ?? state.doctors[0];
    if (found) return found;
    return {
      id: user?.id ?? 'doc-pending',
      name: user?.fullName ?? 'Clinician',
      specialty: user?.specialty ?? 'General Medicine',
      licenseNumber: user?.licenseNumber ?? 'Pending verification',
      hospitalId: user?.hospitalId ?? '',
      email: user?.email ?? '',
    };
  }, [state.activeDoctorId, state.doctors, user]);

  const isDoctorVerified = !isRealAccountMode || user?.verificationStatus === 'verified';

  const [panelScope, setPanelScope] = useState<'assigned' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [attentionFilter, setAttentionFilter] = useState<'all' | 'needs_attention' | 'nominal'>('all');
  const [refillFilter, setRefillFilter] = useState<'all' | 'refill_needed'>('all');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'overdue_14d'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('adherence');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(state.activePatientId);

  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [visitSummary, setVisitSummary] = useState<VisitSummaryApiResult | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const enrichedPatients = useMemo(() => {
    return state.patients
      .filter((p) => panelScope === 'all' || p.assignedDoctorId === activeDoctor.id)
      .map((p) => {
        const metrics7 = computeAdherenceMetrics(p.id, 7, state.medications, state.doseLogs);
        const refills = computeRefillForecasts(p.id, state.medications);
        const attention = buildExplainableAttentionItems(
          p.id,
          state.medications,
          state.doseLogs,
          state.prescriptions,
          state.alerts,
        );
        const needsRefill = refills.some((r) => r.needsRefill);
        const daysSinceReview = Math.floor(
          (Date.now() - new Date(`${p.lastReviewDate}T00:00:00`).getTime()) / 86400000,
        );
        return {
          patient: p,
          adherencePct: metrics7.adherencePct ?? 100,
          needsRefill,
          refillCount: refills.filter((r) => r.needsRefill).length,
          attention,
          primaryReason: attention[0]?.title ?? 'Nominal schedule',
          daysSinceReview: Number.isFinite(daysSinceReview) ? daysSinceReview : 0,
        };
      });
  }, [
    activeDoctor.id,
    panelScope,
    state.alerts,
    state.doseLogs,
    state.medications,
    state.patients,
    state.prescriptions,
  ]);

  const filteredRows = useMemo(() => {
    return enrichedPatients
      .filter((row) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          if (
            !row.patient.name.toLowerCase().includes(q) &&
            !row.patient.mrn.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        if (attentionFilter === 'needs_attention' && row.attention.length === 0) return false;
        if (attentionFilter === 'nominal' && row.attention.length > 0) return false;
        if (refillFilter === 'refill_needed' && !row.needsRefill) return false;
        if (reviewFilter === 'overdue_14d' && row.daysSinceReview < 14) return false;
        return true;
      })
      .sort((a, b) => {
        const dir = sortAsc ? 1 : -1;
        if (sortKey === 'name') return a.patient.name.localeCompare(b.patient.name) * dir;
        if (sortKey === 'age') return (a.patient.age - b.patient.age) * dir;
        if (sortKey === 'adherence') return (a.adherencePct - b.adherencePct) * dir;
        return a.patient.lastReviewDate.localeCompare(b.patient.lastReviewDate) * dir;
      });
  }, [
    attentionFilter,
    enrichedPatients,
    refillFilter,
    reviewFilter,
    searchQuery,
    sortAsc,
    sortKey,
  ]);

  const selectedPatient = useMemo(
    () =>
      state.patients.find((p) => p.id === selectedPatientId) ??
      filteredRows[0]?.patient ??
      state.patients[0] ??
      null,
    [filteredRows, selectedPatientId, state.patients],
  );

  const selectedPatientMeds = useMemo(
    () => (selectedPatient ? state.medications.filter((m) => m.patientId === selectedPatient.id) : []),
    [selectedPatient, state.medications],
  );

  const selectedMetrics7 = useMemo(
    () =>
      selectedPatient
        ? computeAdherenceMetrics(selectedPatient.id, 7, state.medications, state.doseLogs)
        : null,
    [selectedPatient, state.doseLogs, state.medications],
  );

  const selectedMetrics30 = useMemo(
    () =>
      selectedPatient
        ? computeAdherenceMetrics(selectedPatient.id, 30, state.medications, state.doseLogs)
        : null,
    [selectedPatient, state.doseLogs, state.medications],
  );

  const selectedTwin = useMemo(
    () =>
      runDigitalTwinSimulation(
        selectedPatientMeds.filter((m) => m.status === 'active' && !m.asNeeded),
        {
          horizonDays: 14,
          mode: 'refill-delay',
          omittedDatesCount: 2,
          selectedMedicationId: 'all',
          refillDelayDays: 3,
          replenishOnDayOffset: 3,
          replenishQuantity: 30,
          alertMissThreshold: 2,
        },
      ),
    [selectedPatientMeds],
  );

  const unreviewedAlertsCount = state.alerts.filter(
    (a) => a.deliveryState !== 'acknowledged',
  ).length;
  const recentRxCount = state.prescriptions.length;
  const upcomingFollowUpsCount = state.appointments.filter((a) => a.status === 'upcoming').length;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === 'adherence' || key === 'name');
    }
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !isDoctorVerified) return;
    if (!noteTitle.trim() || !noteContent.trim()) return;
    addClinicianNote({
      patientId: selectedPatient.id,
      title: noteTitle.trim(),
      content: noteContent.trim(),
    });
    setNoteTitle('');
    setNoteContent('');
  };

  const handleGenerateVisitSummary = async () => {
    if (!selectedPatient || !selectedMetrics30) return;
    setSummaryLoading(true);
    setSummaryError(null);
    setVisitSummary(null);

    try {
      const notes = state.clinicianNotes.filter((n) => n.patientId === selectedPatient.id);
      const reports = state.reports.filter((r) => r.patientId === selectedPatient.id);
      const dn = state.dadiNaniEntries.filter(
        (d) => d.patientId === selectedPatient.id && d.sharedWithDoctor,
      );

      const res = await generateVisitSummaryWithAi({
        patient: {
          id: selectedPatient.id,
          mrn: selectedPatient.mrn,
          name: selectedPatient.name,
          age: selectedPatient.age,
          conditions: selectedPatient.conditions,
          allergies: selectedPatient.allergies,
        },
        activeMedications: selectedPatientMeds
          .filter((m) => m.status === 'active')
          .map((m) => ({
            id: m.id,
            name: m.name,
            strength: m.strength,
            remainingQuantity: m.remainingQuantity,
          })),
        adherence30d: {
          pct: selectedMetrics30.adherencePct,
          taken: selectedMetrics30.takenCount,
          due: selectedMetrics30.scheduledDueCount,
          skipped: selectedMetrics30.skippedCount,
          unconfirmed: selectedMetrics30.unconfirmedCount,
        },
        reports: reports.map((r) => ({ id: r.id, title: r.title, summary: r.summaryNote })),
        priorNotes: notes.map((n) => ({ id: n.id, title: n.title, content: n.content })),
        patientSharedNotes: dn.map((d) => ({
          id: d.id,
          feelingSummary: d.feelingSummary,
          homeComfortNote: d.homeComfortNote,
        })),
      });

      setVisitSummary(res);
    } catch (err) {
      setSummaryError(
        err instanceof Error ? err.message : 'Unable to generate AI visit summary.',
      );
    } finally {
      setSummaryLoading(false);
    }
  };

  const approveSummaryToNote = () => {
    if (!visitSummary || !selectedPatient || !isDoctorVerified) return;
    const cites = visitSummary.summary.citedSources
      .map((s) => `${s.label} (${s.id})`)
      .join(', ');
    addClinicianNote({
      patientId: selectedPatient.id,
      title: `Clinician-Reviewed Visit Summary (${formatShortDate(visitSummary.generatedAt)})`,
      content: `${visitSummary.summary.summaryParagraph}\n\nSources reviewed: ${cites}`,
    });
    setVisitSummary(null);
  };

  const patientNotes = selectedPatient
    ? state.clinicianNotes.filter((n) => n.patientId === selectedPatient.id)
    : [];
  const patientCaregivers = selectedPatient
    ? state.connections.filter(
        (c) => c.patientId === selectedPatient.id && c.status === 'accepted',
      )
    : [];
  const patientRx = selectedPatient
    ? state.prescriptions.filter((r) => r.patientId === selectedPatient.id)
    : [];
  const patientReports = selectedPatient
    ? state.reports.filter((r) => r.patientId === selectedPatient.id)
    : [];
  const patientDadiNani = selectedPatient
    ? state.dadiNaniEntries.filter(
        (d) => d.patientId === selectedPatient.id && d.sharedWithDoctor,
      )
    : [];
  const assignedDoc = selectedPatient
    ? state.doctors.find((d) => d.id === selectedPatient.assignedDoctorId) ?? activeDoctor
    : activeDoctor;

  return (
    <div className="space-y-6">
      {/* Credential Verification Banner (Real accounts with pending verification) */}
      {isRealAccountMode && !isDoctorVerified && (
        <Card className="border-amber-200 bg-amber-50/70 dark:border-amber-700/50 dark:bg-amber-950/30">
          <CardContent className="pt-5 pb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-200">
                  Credential verification pending ({user?.verificationStatus.replace('_', ' ')})
                </h3>
                <p className="text-xs text-amber-900/90 dark:text-amber-200/85 max-w-2xl">
                  Entering a medical registration number does not automatically verify clinician privileges. Until credential verification completes, signing clinical notes is restricted. You can still review patients who explicitly authorize your account.
                </p>
              </div>
            </div>
            <span className="shrink-0 font-mono text-xs font-semibold text-amber-800 dark:text-amber-300">
              License: {activeDoctor.licenseNumber}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Top KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Authorized patients</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums text-[#20243A] dark:text-[#F7F5F0]">
              {enrichedPatients.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">{activeDoctor.specialty}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open Care Circle alerts</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {unreviewedAlertsCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">Caregiver escalation queue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Prescription updates</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums text-[#7956C8] dark:text-[#A58AE8]">
              {recentRxCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">Confirmed digital schedules</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Upcoming follow-ups</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums text-[#24A99B] dark:text-[#2DD4BF]">
              {upcomingFollowUpsCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">Scheduled clinic reviews</p>
          </CardContent>
        </Card>
      </div>

      {/* Empty State when no patients have authorized this doctor yet */}
      {!hasPatients || !selectedPatient ? (
        <Card>
          <CardContent className="py-12 px-6 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D8C5E8]/40 text-[#7956C8] dark:bg-[#7956C8]/20 dark:text-[#A58AE8]">
              <UserCheck className="h-6 w-6" />
            </div>
            <div className="space-y-1.5 max-w-lg mx-auto">
              <h3 className="font-display text-lg font-semibold text-[#20243A] dark:text-[#F7F5F0]">
                No authorized patients yet
              </h3>
              <p className="text-sm text-[#5C627D] dark:text-[#A3A9C2]">
                In MedTwin AI, doctors only view patients who have explicitly granted clinician authorization. Ask your patients to authorize{' '}
                <span className="font-mono font-semibold text-[#20243A] dark:text-[#F7F5F0]">
                  {activeDoctor.email || 'your registered email'}
                </span>{' '}
                from their Care Circle or Profile &amp; Access screen.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-[#E6E0D8] bg-[#FAF8F5] px-4 py-2 text-xs text-[#5C627D] dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#A3A9C2]">
              <ShieldCheck className="h-4 w-4 text-[#24A99B] dark:text-[#2DD4BF]" />
              <span>Strict patient-consent boundary enforced server-side</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Patient Panel Table */}
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Authorized patient panel — {activeDoctor.name}</CardTitle>
                  <CardDescription>
                    Select any patient row to inspect medications, adherence, Care Circle contacts, and clinical summaries
                  </CardDescription>
                </div>

                {!isRealAccountMode && (
                  <div className="inline-flex rounded-xl bg-[#FAF8F5] border border-[#E6E0D8] p-1 dark:bg-[#101322] dark:border-[#2B314D]">
                    <button
                      type="button"
                      onClick={() => setPanelScope('assigned')}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer',
                        panelScope === 'assigned'
                          ? 'bg-[#FFFFFF] text-[#20243A] shadow-xs dark:bg-[#171B2E] dark:text-[#F7F5F0]'
                          : 'text-[#5C627D] dark:text-[#A3A9C2]',
                      )}
                    >
                      My patients
                    </button>
                    <button
                      type="button"
                      onClick={() => setPanelScope('all')}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer',
                        panelScope === 'all'
                          ? 'bg-[#FFFFFF] text-[#20243A] shadow-xs dark:bg-[#171B2E] dark:text-[#F7F5F0]'
                          : 'text-[#5C627D] dark:text-[#A3A9C2]',
                      )}
                    >
                      All authorized ({state.patients.length})
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5C627D] dark:text-[#A3A9C2]" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name or MRN..."
                    className="pl-9"
                  />
                </div>

                <select
                  aria-label="Filter by care attention"
                  value={attentionFilter}
                  onChange={(e) =>
                    setAttentionFilter(e.target.value as 'all' | 'needs_attention' | 'nominal')
                  }
                  className="h-10 rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] px-3 text-xs text-[#20243A] dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]"
                >
                  <option value="all">Attention: All</option>
                  <option value="needs_attention">Needs attention</option>
                  <option value="nominal">Nominal</option>
                </select>

                <select
                  aria-label="Filter by refill status"
                  value={refillFilter}
                  onChange={(e) => setRefillFilter(e.target.value as 'all' | 'refill_needed')}
                  className="h-10 rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] px-3 text-xs text-[#20243A] dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]"
                >
                  <option value="all">Refill: All</option>
                  <option value="refill_needed">Refill needed</option>
                </select>

                <select
                  aria-label="Filter by last review"
                  value={reviewFilter}
                  onChange={(e) => setReviewFilter(e.target.value as 'all' | 'overdue_14d')}
                  className="h-10 rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] px-3 text-xs text-[#20243A] dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]"
                >
                  <option value="all">Last review: Any</option>
                  <option value="overdue_14d">14+ days since review</option>
                </select>
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E6E0D8] text-[#5C627D] dark:border-[#2B314D] dark:text-[#A3A9C2]">
                      <th className="py-2.5 pr-3 font-medium">
                        <button
                          type="button"
                          onClick={() => toggleSort('name')}
                          className="inline-flex items-center gap-1 hover:text-[#20243A] dark:hover:text-[#F7F5F0] cursor-pointer"
                        >
                          <span>Patient</span>
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="py-2.5 px-3 font-medium">MRN</th>
                      <th className="py-2.5 px-3 font-medium text-right">
                        <button
                          type="button"
                          onClick={() => toggleSort('age')}
                          className="inline-flex items-center gap-1 hover:text-[#20243A] dark:hover:text-[#F7F5F0] cursor-pointer"
                        >
                          <span>Age</span>
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="py-2.5 px-3 font-medium text-right">
                        <button
                          type="button"
                          onClick={() => toggleSort('adherence')}
                          className="inline-flex items-center gap-1 hover:text-[#20243A] dark:hover:text-[#F7F5F0] cursor-pointer"
                        >
                          <span>7d Adherence</span>
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="py-2.5 px-3 font-medium">Refill</th>
                      <th className="py-2.5 px-3 font-medium">Attention reason</th>
                      <th className="py-2.5 px-3 font-medium">
                        <button
                          type="button"
                          onClick={() => toggleSort('lastReview')}
                          className="inline-flex items-center gap-1 hover:text-[#20243A] dark:hover:text-[#F7F5F0] cursor-pointer"
                        >
                          <span>Last review</span>
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="py-2.5 pl-3 font-medium">Next follow-up</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E0D8] dark:divide-[#2B314D]">
                    {filteredRows.map((row) => {
                      const isSelected = row.patient.id === selectedPatient.id;
                      return (
                        <tr
                          key={row.patient.id}
                          onClick={() => {
                            setSelectedPatientId(row.patient.id);
                            setActivePatientId(row.patient.id);
                            setVisitSummary(null);
                          }}
                          className={cn(
                            'cursor-pointer transition-colors hover:bg-[#FAF8F5] dark:hover:bg-[#1E243D]',
                            isSelected && 'bg-[#D8C5E8]/35 dark:bg-[#7956C8]/20',
                          )}
                        >
                          <td className="py-3 pr-3 font-semibold text-[#20243A] dark:text-[#F7F5F0] whitespace-nowrap">
                            {row.patient.name}
                          </td>
                          <td className="py-3 px-3 font-mono text-[#5C627D] dark:text-[#A3A9C2] tabular-nums whitespace-nowrap">
                            {row.patient.mrn}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-[#20243A] dark:text-[#F7F5F0] tabular-nums">
                            {row.patient.age || '—'}
                          </td>
                          <td
                            className={cn(
                              'py-3 px-3 text-right font-mono font-semibold tabular-nums',
                              row.adherencePct < 80
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-[#24A99B] dark:text-[#2DD4BF]',
                            )}
                          >
                            {row.adherencePct}%
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={cn(
                                'font-medium',
                                row.needsRefill
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : 'text-[#5C627D] dark:text-[#A3A9C2]',
                              )}
                            >
                              {row.needsRefill ? `Refill needed (${row.refillCount})` : 'Nominal'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-[#5C627D] dark:text-[#A3A9C2] max-w-[240px] truncate">
                            {row.primaryReason}
                          </td>
                          <td className="py-3 px-3 font-mono text-[#5C627D] dark:text-[#A3A9C2] tabular-nums whitespace-nowrap">
                            {formatShortDate(row.patient.lastReviewDate)}
                          </td>
                          <td className="py-3 pl-3 font-mono text-[#5C627D] dark:text-[#A3A9C2] tabular-nums whitespace-nowrap">
                            {row.patient.nextFollowUpDate
                              ? formatShortDate(row.patient.nextFollowUpDate)
                              : 'Unscheduled'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Selected Patient Clinical Detail */}
          <Card>
            <CardHeader className="flex flex-col gap-4 border-b border-[#E6E0D8] pb-5 lg:flex-row lg:items-center lg:justify-between dark:border-[#2B314D]">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C627D] dark:text-[#A3A9C2]">
                  <span className="font-mono text-[#20243A] dark:text-[#F7F5F0]">{selectedPatient.mrn}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {selectedPatient.gender}, {selectedPatient.age > 0 ? `${selectedPatient.age} yrs` : 'Age unrecorded'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Blood group: {selectedPatient.bloodGroup ?? 'Unknown'}</span>
                  <span aria-hidden="true">·</span>
                  <span>Care team: {assignedDoc.name}</span>
                </div>
                <CardTitle className="mt-1 text-xl">{selectedPatient.name} — Clinical Review</CardTitle>
              </div>

              <div className="flex flex-wrap items-center gap-5">
                <div className="flex items-center gap-4">
                  <ProgressRing
                    value={selectedMetrics7?.adherencePct ?? 0}
                    size={64}
                    strokeWidth={6}
                    tone="teal"
                    label="7d"
                  />
                  <ProgressRing
                    value={selectedMetrics30?.adherencePct ?? 0}
                    size={64}
                    strokeWidth={6}
                    tone="violet"
                    label="30d"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleGenerateVisitSummary}
                  disabled={summaryLoading}
                  className="whitespace-nowrap shrink-0"
                >
                  <Bot className="h-4 w-4" />
                  <span>{summaryLoading ? 'Drafting visit summary...' : 'Draft AI visit summary'}</span>
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-5 space-y-6">
              {summaryError && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="font-semibold">AI Visit Summary unavailable</p>
                    <p>{summaryError}</p>
                  </div>
                </div>
              )}

              {visitSummary && (
                <div className="rounded-2xl border border-[#7956C8]/30 bg-[#D8C5E8]/20 p-5 space-y-3 dark:border-[#A58AE8]/30 dark:bg-[#7956C8]/15">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#7956C8] dark:text-[#A58AE8]">
                      <ClipboardCheck className="h-4 w-4" />
                      <span>AI-Generated Visit Summary — Requires Clinician Review</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={approveSummaryToNote}
                      disabled={!isDoctorVerified}
                      title={!isDoctorVerified ? 'Verification required to sign notes' : undefined}
                    >
                      Approve &amp; save to clinician notes
                    </Button>
                  </div>
                  <p className="text-sm text-[#20243A] dark:text-[#F7F5F0] leading-relaxed">
                    {visitSummary.summary.summaryParagraph}
                  </p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-xs">
                    <div>
                      <p className="font-semibold text-[#20243A] dark:text-[#F7F5F0] mb-1">Adherence observations</p>
                      <ul className="list-disc pl-4 space-y-0.5 text-[#5C627D] dark:text-[#A3A9C2]">
                        {visitSummary.summary.adherenceObservations.map((o, i) => (
                          <li key={i}>{o}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-[#20243A] dark:text-[#F7F5F0] mb-1">Cited record sources</p>
                      <ul className="list-disc pl-4 space-y-0.5 text-[#5C627D] dark:text-[#A3A9C2]">
                        {visitSummary.summary.citedSources.map((s) => (
                          <li key={s.id}>
                            {s.label} <span className="font-mono">({s.id})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <Tabs defaultValue="meds">
                <TabsList>
                  <TabsTrigger value="meds">Medications &amp; Rx ({selectedPatientMeds.length})</TabsTrigger>
                  <TabsTrigger value="adherence">Dose History &amp; Twin</TabsTrigger>
                  <TabsTrigger value="notes">Notes, Reports &amp; Dadi-Nani</TabsTrigger>
                  <TabsTrigger value="team">Caregivers &amp; Follow-up</TabsTrigger>
                </TabsList>

                <TabsContent value="meds" className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-[#E6E0D8] p-4 text-xs space-y-1 dark:border-[#2B314D]">
                      <p className="font-semibold text-[#20243A] dark:text-[#F7F5F0]">Recorded conditions</p>
                      <p className="text-[#5C627D] dark:text-[#A3A9C2]">
                        {selectedPatient.conditions.length > 0
                          ? selectedPatient.conditions.join(', ')
                          : 'None recorded'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E6E0D8] p-4 text-xs space-y-1 dark:border-[#2B314D]">
                      <p className="font-semibold text-[#20243A] dark:text-[#F7F5F0]">Recorded allergies</p>
                      <p className="text-[#5C627D] dark:text-[#A3A9C2]">
                        {selectedPatient.allergies.length > 0
                          ? selectedPatient.allergies.join(', ')
                          : 'None recorded'}
                      </p>
                    </div>
                  </div>

                  {selectedPatientMeds.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[#E6E0D8] p-6 text-center text-xs text-[#5C627D] dark:border-[#2B314D] dark:text-[#A3A9C2]">
                      No medications recorded yet for {selectedPatient.name}.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#E6E0D8] rounded-xl border border-[#E6E0D8] px-4 dark:divide-[#2B314D] dark:border-[#2B314D]">
                      {selectedPatientMeds.map((m) => (
                        <div key={m.id} className="py-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-[#20243A] dark:text-[#F7F5F0]">
                              {m.name} {m.strength} · <span className="capitalize text-[#24A99B] dark:text-[#2DD4BF]">{m.status}</span>
                            </p>
                            <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">{m.instructions}</p>
                          </div>
                          <span className="font-mono text-xs text-[#5C627D] dark:text-[#A3A9C2] tabular-nums">
                            {typeof m.remainingQuantity === 'number'
                              ? `${m.remainingQuantity} ${m.unitLabel} left`
                              : 'Qty unrecorded'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-semibold text-[#20243A] dark:text-[#F7F5F0] mb-2">Prescription history</h4>
                    {patientRx.length === 0 ? (
                      <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">No scanned prescriptions on file.</p>
                    ) : (
                      patientRx.map((rx) => (
                        <p key={rx.id} className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">
                          {rx.fileName} · Confirmed {formatTimestamp(rx.confirmedAt ?? rx.createdAt)}
                        </p>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="adherence" className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div>
                      <h4 className="text-sm font-semibold text-[#20243A] dark:text-[#F7F5F0] mb-2">
                        30-day dose adherence ({selectedMetrics30?.adherencePct ?? '—'}%)
                      </h4>
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={selectedMetrics30?.dailySeries ?? []}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#2B314D' : '#E6E0D8'} vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: isDark ? '#A3A9C2' : '#5C627D' }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: isDark ? '#A3A9C2' : '#5C627D' }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: isDark ? '#171B2E' : '#FFFFFF',
                                borderColor: isDark ? '#2B314D' : '#E6E0D8',
                                color: isDark ? '#F7F5F0' : '#20243A',
                                borderRadius: '12px',
                                fontSize: '12px',
                              }}
                            />
                            <Bar dataKey="taken" stackId="a" fill={isDark ? '#2DD4BF' : '#24A99B'} name="Taken" />
                            <Bar dataKey="skipped" stackId="a" fill="#D97706" name="Skipped" />
                            <Bar dataKey="unconfirmed" stackId="a" fill="#DC2626" name="Unconfirmed" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#E6E0D8] p-4 space-y-3 dark:border-[#2B314D]">
                      <h4 className="text-sm font-semibold text-[#20243A] dark:text-[#F7F5F0]">
                        Digital Twin 14-day refill-delay preview (3-day delay)
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-[#5C627D] dark:text-[#A3A9C2] block">Simulated adherence</span>
                          <span className="font-mono text-lg font-bold text-[#24A99B] dark:text-[#2DD4BF] tabular-nums">
                            {selectedTwin.scenarioAdherencePct}%
                          </span>
                        </div>
                        <div>
                          <span className="text-[#5C627D] dark:text-[#A3A9C2] block">Projected supply-gap days</span>
                          <span className="font-mono text-lg font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                            {selectedTwin.supplyGapDates.length}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">
                        Medication-management simulation comparing baseline coverage ({selectedTwin.baselineCoveredDoses} doses) vs 3-day refill delay ({selectedTwin.scenarioCoveredDoses} doses).
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="notes" className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-[#20243A] dark:text-[#F7F5F0]">Record clinician note</h4>
                      {!isDoctorVerified ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200">
                          Signing clinical notes is locked until your clinician verification status becomes <strong>Verified</strong>.
                        </div>
                      ) : (
                        <form onSubmit={handleSaveNote} className="space-y-3">
                          <Input
                            value={noteTitle}
                            onChange={(e) => setNoteTitle(e.target.value)}
                            placeholder="Note title (e.g., Medication Plan Review)"
                            required
                          />
                          <Textarea
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            placeholder="Document clinical plan review, patient tolerance, or follow-up instructions..."
                            required
                          />
                          <Button type="submit" size="sm">
                            Save signed note
                          </Button>
                        </form>
                      )}

                      <div className="space-y-3 pt-2">
                        {patientNotes.length === 0 ? (
                          <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">No clinician notes recorded yet.</p>
                        ) : (
                          patientNotes.map((n) => (
                            <div key={n.id} className="rounded-xl border border-[#E6E0D8] p-3.5 space-y-1.5 dark:border-[#2B314D]">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-[#20243A] dark:text-[#F7F5F0]">{n.title}</span>
                                <span className="font-mono text-[#5C627D] dark:text-[#A3A9C2] tabular-nums">
                                  {formatTimestamp(n.createdAt)}
                                </span>
                              </div>
                              <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2] whitespace-pre-wrap">{n.content}</p>
                              <p className="text-[11px] text-[#5C627D] dark:text-[#A3A9C2]">
                                Audit: {n.auditTrail.map((a) => `${a.action} by ${a.actor}`).join(' · ')}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-[#20243A] dark:text-[#F7F5F0]">
                        Uploaded reports &amp; Dadi-Nani patient shares
                      </h4>
                      {patientReports.length === 0 && patientDadiNani.length === 0 && (
                        <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">
                          No reports or shared patient comfort notes yet.
                        </p>
                      )}
                      {patientReports.map((r) => (
                        <div key={r.id} className="rounded-xl border border-[#E6E0D8] p-3.5 text-xs space-y-1 dark:border-[#2B314D]">
                          <p className="font-semibold text-[#20243A] dark:text-[#F7F5F0]">
                            {r.title} ({r.reportType})
                          </p>
                          <p className="text-[#5C627D] dark:text-[#A3A9C2]">{r.summaryNote}</p>
                        </div>
                      ))}
                      {patientDadiNani.map((d) => (
                        <div key={d.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 text-xs space-y-1 dark:border-amber-700/50 dark:bg-amber-950/20">
                          <p className="font-semibold text-amber-900 dark:text-amber-300">
                            Patient Dadi-Nani share · {formatTimestamp(d.createdAt)}
                          </p>
                          <p className="text-[#20243A] dark:text-[#F7F5F0]">{d.feelingSummary}</p>
                          {d.homeComfortNote && (
                            <p className="text-[#24A99B] dark:text-[#2DD4BF]">Home comfort: {d.homeComfortNote}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="team" className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-[#E6E0D8] p-4 space-y-2 dark:border-[#2B314D]">
                      <h4 className="text-sm font-semibold text-[#20243A] dark:text-[#F7F5F0]">Authorized caregiver contacts</h4>
                      {patientCaregivers.length === 0 ? (
                        <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">No accepted caregivers.</p>
                      ) : (
                        patientCaregivers.map((c) => (
                          <div key={c.id} className="text-xs text-[#5C627D] dark:text-[#A3A9C2] flex justify-between">
                            <span>
                              <strong className="text-[#20243A] dark:text-[#F7F5F0]">{c.caregiverName}</strong> ({c.relationship} · {c.contactPriority})
                            </span>
                            <span className="text-[#24A99B] dark:text-[#2DD4BF] inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Consented
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="rounded-xl border border-[#E6E0D8] p-4 space-y-2 dark:border-[#2B314D]">
                      <h4 className="text-sm font-semibold text-[#20243A] dark:text-[#F7F5F0]">Follow-up timeline</h4>
                      <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">
                        Next follow-up:{' '}
                        {selectedPatient.nextFollowUpDate
                          ? formatShortDate(selectedPatient.nextFollowUpDate)
                          : 'Not scheduled'}
                      </p>
                      <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">
                        Last clinician review: {formatShortDate(selectedPatient.lastReviewDate)}
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
