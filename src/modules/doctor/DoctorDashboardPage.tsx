import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Search,
  AlertTriangle,
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
import { useMedTwin } from '@/src/context/MedTwinContext';
import {
  buildExplainableAttentionItems,
  computeAdherenceMetrics,
  computeRefillForecasts,
} from '@/src/services/adherenceEngine';
import { runDigitalTwinSimulation } from '@/src/services/digitalTwinEngine';
import { generateVisitSummaryWithAi, VisitSummaryApiResult } from '@/src/services/aiService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input, Textarea } from '@/src/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { cn, formatShortDate, formatTimestamp } from '@/src/lib/utils';

type SortKey = 'name' | 'age' | 'adherence' | 'lastReview';

export function DoctorDashboardPage() {
  const { state, setActivePatientId, addClinicianNote } = useMedTwin();
  const activeDoctor =
    state.doctors.find((d) => d.id === state.activeDoctorId) ?? state.doctors[0];

  const [panelScope, setPanelScope] = useState<'assigned' | 'all'>('assigned');
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
          daysSinceReview,
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

  const selectedPatient =
    state.patients.find((p) => p.id === selectedPatientId) ??
    filteredRows[0]?.patient ??
    state.patients[0];

  const selectedPatientMeds = useMemo(
    () => state.medications.filter((m) => m.patientId === selectedPatient.id),
    [selectedPatient.id, state.medications],
  );

  const selectedMetrics30 = useMemo(
    () =>
      computeAdherenceMetrics(
        selectedPatient.id,
        30,
        state.medications,
        state.doseLogs,
      ),
    [selectedPatient.id, state.doseLogs, state.medications],
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
    if (!visitSummary) return;
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

  const patientNotes = state.clinicianNotes.filter((n) => n.patientId === selectedPatient.id);
  const patientCaregivers = state.connections.filter(
    (c) => c.patientId === selectedPatient.id && c.status === 'accepted',
  );
  const patientRx = state.prescriptions.filter((r) => r.patientId === selectedPatient.id);
  const patientReports = state.reports.filter((r) => r.patientId === selectedPatient.id);
  const patientDadiNani = state.dadiNaniEntries.filter(
    (d) => d.patientId === selectedPatient.id && d.sharedWithDoctor,
  );
  const assignedDoc =
    state.doctors.find((d) => d.id === selectedPatient.assignedDoctorId) ?? activeDoctor;

  return (
    <div className="space-y-6">
      {/* Top KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Panel patients</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {enrichedPatients.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">{activeDoctor.specialty}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unreviewed Care Circle alerts</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums text-amber-600">
              {unreviewedAlertsCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">Simulated caregiver alert queue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recent prescription updates</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums text-[#2563EB]">
              {recentRxCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">Confirmed digital schedules</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Upcoming follow-up tasks</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {upcomingFollowUpsCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">Scheduled clinic reviews</p>
          </CardContent>
        </Card>
      </div>

      {/* Patient Panel Table */}
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Assigned patient panel — {activeDoctor.name}</CardTitle>
              <CardDescription>
                Select any patient row to inspect medications, adherence, Care Circle contacts, and record notes
              </CardDescription>
            </div>

            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setPanelScope('assigned')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer',
                  panelScope === 'assigned'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600',
                )}
              >
                My patients
              </button>
              <button
                type="button"
                onClick={() => setPanelScope('all')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer',
                  panelScope === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600',
                )}
              >
                All hospital ({state.patients.length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name or ID..."
                className="pl-9"
              />
            </div>

            <select
              aria-label="Filter by care attention"
              value={attentionFilter}
              onChange={(e) =>
                setAttentionFilter(e.target.value as 'all' | 'needs_attention' | 'nominal')
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700"
            >
              <option value="all">Attention: All</option>
              <option value="needs_attention">Needs attention</option>
              <option value="nominal">Nominal</option>
            </select>

            <select
              aria-label="Filter by refill status"
              value={refillFilter}
              onChange={(e) => setRefillFilter(e.target.value as 'all' | 'refill_needed')}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700"
            >
              <option value="all">Refill: All</option>
              <option value="refill_needed">Refill needed</option>
            </select>

            <select
              aria-label="Filter by last review"
              value={reviewFilter}
              onChange={(e) => setReviewFilter(e.target.value as 'all' | 'overdue_14d')}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700"
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
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 pr-3 font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort('name')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                    >
                      <span>Patient</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 font-medium">ID</th>
                  <th className="py-2.5 px-3 font-medium text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('age')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                    >
                      <span>Age</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 font-medium text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('adherence')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
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
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                    >
                      <span>Last review</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2.5 pl-3 font-medium">Next follow-up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
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
                        'cursor-pointer transition-colors hover:bg-slate-50',
                        isSelected && 'bg-[#0D9488]/5',
                      )}
                    >
                      <td className="py-3 pr-3 font-semibold text-slate-900 whitespace-nowrap">
                        {row.patient.name}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                        {row.patient.mrn}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        {row.patient.age}
                      </td>
                      <td
                        className={cn(
                          'py-3 px-3 text-right font-mono font-semibold tabular-nums',
                          row.adherencePct < 80 ? 'text-amber-700' : 'text-[#0D9488]',
                        )}
                      >
                        {row.adherencePct}%
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={cn(
                            'font-medium',
                            row.needsRefill ? 'text-amber-700' : 'text-slate-600',
                          )}
                        >
                          {row.needsRefill ? `Refill needed (${row.refillCount})` : 'Nominal'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-[240px] truncate">
                        {row.primaryReason}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                        {formatShortDate(row.patient.lastReviewDate)}
                      </td>
                      <td className="py-3 pl-3 font-mono text-slate-600 tabular-nums whitespace-nowrap">
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
        <CardHeader className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono text-slate-700">{selectedPatient.mrn}</span>
              <span aria-hidden="true">·</span>
              <span>{selectedPatient.gender}, {selectedPatient.age} yrs</span>
              <span aria-hidden="true">·</span>
              <span>Blood group: {selectedPatient.bloodGroup ?? 'Unknown'}</span>
              <span aria-hidden="true">·</span>
              <span>Care team: {assignedDoc.name}</span>
            </div>
            <CardTitle className="mt-1 text-xl">{selectedPatient.name} — Clinical Review</CardTitle>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={handleGenerateVisitSummary}
            disabled={summaryLoading}
          >
            <Bot className="h-4 w-4" />
            <span>{summaryLoading ? 'Drafting visit summary...' : 'Draft AI visit summary'}</span>
          </Button>
        </CardHeader>

        <CardContent className="pt-5 space-y-6">
          {summaryError && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold">AI Visit Summary unavailable</p>
                <p>{summaryError}</p>
              </div>
            </div>
          )}

          {visitSummary && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#2563EB]">
                  <ClipboardCheck className="h-4 w-4" />
                  <span>AI-Generated Visit Summary — Requires Clinician Review</span>
                </div>
                <Button type="button" size="sm" onClick={approveSummaryToNote}>
                  Approve &amp; save to clinician notes
                </Button>
              </div>
              <p className="text-sm text-slate-800 leading-relaxed">
                {visitSummary.summary.summaryParagraph}
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-xs">
                <div>
                  <p className="font-semibold text-slate-700 mb-1">Adherence observations</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                    {visitSummary.summary.adherenceObservations.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-slate-700 mb-1">Cited record sources</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                    {visitSummary.summary.citedSources.map((s) => (
                      <li key={s.id}>
                        {s.label} <span className="font-mono text-slate-400">({s.id})</span>
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
                <div className="rounded-xl border border-slate-200 p-4 text-xs space-y-1">
                  <p className="font-semibold text-slate-900">Recorded conditions</p>
                  <p className="text-slate-600">{selectedPatient.conditions.join(', ')}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4 text-xs space-y-1">
                  <p className="font-semibold text-slate-900">Recorded allergies</p>
                  <p className="text-slate-600">{selectedPatient.allergies.join(', ')}</p>
                </div>
              </div>

              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
                {selectedPatientMeds.map((m) => (
                  <div key={m.id} className="py-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {m.name} {m.strength} · <span className="capitalize text-[#0D9488]">{m.status}</span>
                      </p>
                      <p className="text-xs text-slate-600">{m.instructions}</p>
                    </div>
                    <span className="font-mono text-xs text-slate-500 tabular-nums">
                      {typeof m.remainingQuantity === 'number'
                        ? `${m.remainingQuantity} ${m.unitLabel} left`
                        : 'Qty unrecorded'}
                    </span>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-700 mb-2">Prescription history</h4>
                {patientRx.length === 0 ? (
                  <p className="text-xs text-slate-500">No scanned prescriptions on file.</p>
                ) : (
                  patientRx.map((rx) => (
                    <p key={rx.id} className="text-xs text-slate-600">
                      {rx.fileName} · Confirmed {formatTimestamp(rx.confirmedAt ?? rx.createdAt)}
                    </p>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="adherence" className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">
                    30-day dose adherence ({selectedMetrics30.adherencePct ?? '—'}%)
                  </h4>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={selectedMetrics30.dailySeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748B' }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                        <Tooltip />
                        <Bar dataKey="taken" stackId="a" fill="#0D9488" name="Taken" />
                        <Bar dataKey="skipped" stackId="a" fill="#D97706" name="Skipped" />
                        <Bar dataKey="unconfirmed" stackId="a" fill="#DC2626" name="Unconfirmed" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-slate-900">
                    Digital Twin 14-day refill-delay preview (3-day delay)
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block">Simulated adherence</span>
                      <span className="font-mono text-lg font-bold text-[#0D9488] tabular-nums">
                        {selectedTwin.scenarioAdherencePct}%
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Projected supply-gap days</span>
                      <span className="font-mono text-lg font-bold text-amber-700 tabular-nums">
                        {selectedTwin.supplyGapDates.length}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Medication-management simulation comparing baseline coverage ({selectedTwin.baselineCoveredDoses} doses) vs 3-day refill delay ({selectedTwin.scenarioCoveredDoses} doses).
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-900">Record clinician note</h4>
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

                  <div className="space-y-3 pt-2">
                    {patientNotes.map((n) => (
                      <div key={n.id} className="rounded-xl border border-slate-200 p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-900">{n.title}</span>
                          <span className="font-mono text-slate-400 tabular-nums">
                            {formatTimestamp(n.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 whitespace-pre-wrap">{n.content}</p>
                        <p className="text-[11px] text-slate-400">
                          Audit: {n.auditTrail.map((a) => `${a.action} by ${a.actor}`).join(' · ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-900">Uploaded reports &amp; Dadi-Nani patient shares</h4>
                  {patientReports.map((r) => (
                    <div key={r.id} className="rounded-xl border border-slate-200 p-3.5 text-xs space-y-1">
                      <p className="font-semibold text-slate-900">
                        {r.title} ({r.reportType})
                      </p>
                      <p className="text-slate-600">{r.summaryNote}</p>
                    </div>
                  ))}
                  {patientDadiNani.map((d) => (
                    <div key={d.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 text-xs space-y-1">
                      <p className="font-semibold text-amber-900">
                        Patient Dadi-Nani share · {formatTimestamp(d.createdAt)}
                      </p>
                      <p className="text-slate-700">{d.feelingSummary}</p>
                      {d.homeComfortNote && (
                        <p className="text-[#0F766E]">Home comfort: {d.homeComfortNote}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="team" className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-slate-900">Authorized caregiver contacts</h4>
                  {patientCaregivers.length === 0 ? (
                    <p className="text-xs text-slate-500">No accepted caregivers.</p>
                  ) : (
                    patientCaregivers.map((c) => (
                      <div key={c.id} className="text-xs text-slate-600 flex justify-between">
                        <span>
                          <strong>{c.caregiverName}</strong> ({c.relationship} · {c.contactPriority})
                        </span>
                        <span className="text-[#0D9488] inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Consented
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-slate-900">Follow-up timeline</h4>
                  <p className="text-xs text-slate-600">
                    Next follow-up:{' '}
                    {selectedPatient.nextFollowUpDate
                      ? formatShortDate(selectedPatient.nextFollowUpDate)
                      : 'Not scheduled'}
                  </p>
                  <p className="text-xs text-slate-600">
                    Last clinician review: {formatShortDate(selectedPatient.lastReviewDate)}
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
