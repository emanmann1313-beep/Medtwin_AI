import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Check,
  Clock,
  FileScan,
  HeartHandshake,
  Pill,
  RotateCcw,
  SkipForward,
  Users,
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
  buildDoseSlotsForDate,
  buildExplainableAttentionItems,
  computeAdherenceMetrics,
  computeRefillForecasts,
  getTodayIso,
} from '@/src/services/adherenceEngine';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { AttentionCards } from '@/src/components/shared/AttentionCards';
import { cn, formatShortDate, formatTime12h, formatTimestamp } from '@/src/lib/utils';

export function PatientDashboardPage() {
  const {
    state,
    isLoading,
    activePatient,
    setActivePatientId,
    logDose,
    undoDose,
  } = useMedTwin();
  const navigate = useNavigate();

  const [adherenceWindow, setAdherenceWindow] = useState<7 | 30>(7);
  const [skipModalSlot, setSkipModalSlot] = useState<{
    medicationId: string;
    medicationName: string;
    scheduledDate: string;
    scheduledTime: string;
  } | null>(null);
  const [skipReason, setSkipReason] = useState('');

  const todayStr = getTodayIso();

  const todaySlots = useMemo(
    () =>
      buildDoseSlotsForDate(
        activePatient.id,
        todayStr,
        state.medications,
        state.doseLogs,
      ),
    [activePatient.id, state.doseLogs, state.medications, todayStr],
  );

  const metrics7 = useMemo(
    () => computeAdherenceMetrics(activePatient.id, 7, state.medications, state.doseLogs),
    [activePatient.id, state.doseLogs, state.medications],
  );

  const metrics30 = useMemo(
    () => computeAdherenceMetrics(activePatient.id, 30, state.medications, state.doseLogs),
    [activePatient.id, state.doseLogs, state.medications],
  );

  const activeMetrics = adherenceWindow === 7 ? metrics7 : metrics30;

  const refillForecasts = useMemo(
    () => computeRefillForecasts(activePatient.id, state.medications),
    [activePatient.id, state.medications],
  );

  const attentionItems = useMemo(
    () =>
      buildExplainableAttentionItems(
        activePatient.id,
        state.medications,
        state.doseLogs,
        state.prescriptions,
        state.alerts,
      ),
    [activePatient.id, state.alerts, state.doseLogs, state.medications, state.prescriptions],
  );

  const patientConnections = useMemo(
    () =>
      state.connections.filter(
        (c) => c.patientId === activePatient.id && c.status !== 'revoked',
      ),
    [activePatient.id, state.connections],
  );

  const recentHistory = useMemo(
    () =>
      state.history
        .filter((h) => h.patientId === activePatient.id && !h.restrictedToClinician)
        .slice(0, 6),
    [activePatient.id, state.history],
  );

  const confirmedToday = todaySlots.filter((s) => s.state === 'taken').length;
  const skippedToday = todaySlots.filter((s) => s.state === 'skipped').length;
  const unconfirmedDueToday = todaySlots.filter(
    (s) => s.state === 'overdue' || s.state === 'due',
  ).length;
  const approachingRefillCount = refillForecasts.filter((r) => r.needsRefill).length;

  const nextScheduledSlot = useMemo(
    () =>
      todaySlots.find((s) => s.state === 'due' || s.state === 'scheduled') ??
      todaySlots.find((s) => s.state === 'overdue'),
    [todaySlots],
  );

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="h-24 rounded-2xl bg-slate-200/70 animate-pulse" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-200/70 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 h-80 rounded-2xl bg-slate-200/70 animate-pulse" />
          <div className="h-80 rounded-2xl bg-slate-200/70 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Patient Welcome & Primary Actions */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-mono text-slate-700">{activePatient.mrn}</span>
            <span aria-hidden="true">·</span>
            <span>Age {activePatient.age}</span>
            <span aria-hidden="true">·</span>
            <span>{activePatient.conditions.join(', ')}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl font-bold text-slate-900">
              Welcome back, {activePatient.name}
            </h2>
            <select
              aria-label="Select patient profile"
              value={activePatient.id}
              onChange={(e) => setActivePatientId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
            >
              {state.patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.mrn})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button type="button" onClick={() => navigate('/prescriptions')}>
            <FileScan className="h-4 w-4" />
            <span>Scan prescription</span>
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/medications')}>
            <Pill className="h-4 w-4" />
            <span>View medicines</span>
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/digital-twin')}>
            <Activity className="h-4 w-4" />
            <span>Open digital twin</span>
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/caregivers')}>
            <Users className="h-4 w-4" />
            <span>Manage care circle</span>
          </Button>
        </div>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Confirmed doses today</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {confirmedToday} / {todaySlots.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">
              Scheduled active doses for {formatShortDate(todayStr)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unconfirmed or skipped today</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {unconfirmedDueToday + skippedToday}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500 tabular-nums">
              {unconfirmedDueToday} unconfirmed due · {skippedToday} skipped
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recorded adherence (7d / 30d)</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums text-[#0D9488]">
              {metrics7.adherencePct !== null ? `${metrics7.adherencePct}%` : '—'}
              <span className="ml-2 text-base font-medium text-slate-400">
                / {metrics30.adherencePct !== null ? `${metrics30.adherencePct}%` : '—'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500 tabular-nums">
              {metrics7.takenCount} taken of {metrics7.scheduledDueCount} due in 7d
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Medicines approaching refill</CardDescription>
            <CardTitle
              className={cn(
                'text-3xl font-bold tabular-nums',
                approachingRefillCount > 0 ? 'text-amber-600' : 'text-slate-900',
              )}
            >
              {approachingRefillCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">
              Within configured refill threshold
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Today's Medication Timeline (Left 2 cols) + Next Dose & Care Attention (Right 1 col) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <CardTitle>Today’s medication timeline</CardTitle>
              <CardDescription>
                Log taken or skipped doses once; undo is available for accidental entries.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => navigate('/dadi-nani')}>
              <HeartHandshake className="h-4 w-4 text-amber-600" />
              <span>Share in Dadi-Nani Mode</span>
            </Button>
          </CardHeader>
          <CardContent className="pt-4">
            {todaySlots.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No scheduled doses for today.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Scan a prescription or review as-needed medicines to get started.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {todaySlots.map((slot) => {
                  const stateLabelMap = {
                    taken: { text: 'Taken', cls: 'text-[#0D9488]' },
                    skipped: { text: 'Skipped', cls: 'text-amber-700' },
                    overdue: { text: 'Overdue / Unconfirmed', cls: 'text-red-600' },
                    due: { text: 'Due now', cls: 'text-[#2563EB]' },
                    scheduled: { text: 'Scheduled', cls: 'text-slate-500' },
                  } as const;
                  const meta = stateLabelMap[slot.state];

                  return (
                    <div
                      key={slot.slotKey}
                      className="flex flex-col gap-3 py-4 first:pt-1 last:pb-1 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="w-20 shrink-0 pt-0.5 font-mono text-sm font-semibold text-slate-800 tabular-nums">
                          {formatTime12h(slot.scheduledTime)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">
                              {slot.medication.name} {slot.medication.strength}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span className={cn('text-xs font-semibold', meta.cls)}>
                              {meta.text}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {slot.medication.doseAndRoute} — {slot.medication.instructions}
                          </p>
                          {slot.log?.skipReason && (
                            <p className="mt-1 text-xs text-amber-700">
                              Skip reason: {slot.log.skipReason}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 sm:ml-4">
                        {!slot.log ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() =>
                                logDose({
                                  patientId: activePatient.id,
                                  medicationId: slot.medication.id,
                                  scheduledDate: slot.scheduledDate,
                                  scheduledTime: slot.scheduledTime,
                                  status: 'taken',
                                })
                              }
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Mark taken</span>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSkipReason('');
                                setSkipModalSlot({
                                  medicationId: slot.medication.id,
                                  medicationName: `${slot.medication.name} ${slot.medication.strength}`,
                                  scheduledDate: slot.scheduledDate,
                                  scheduledTime: slot.scheduledTime,
                                });
                              }}
                            >
                              <SkipForward className="h-3.5 w-3.5" />
                              <span>Skip</span>
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => undoDose(slot.log!.id)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Undo</span>
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

        {/* Side Column: Next Scheduled Dose + Care Attention */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Next scheduled dose</CardDescription>
              {nextScheduledSlot ? (
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5 text-[#2563EB]" />
                  <span className="tabular-nums">
                    {formatTime12h(nextScheduledSlot.scheduledTime)}
                  </span>
                </CardTitle>
              ) : (
                <CardTitle className="text-lg text-[#0D9488]">All doses logged today</CardTitle>
              )}
            </CardHeader>
            <CardContent>
              {nextScheduledSlot ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {nextScheduledSlot.medication.name} {nextScheduledSlot.medication.strength}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {nextScheduledSlot.medication.instructions}
                    </p>
                  </div>
                  {!nextScheduledSlot.log && (
                    <Button
                      type="button"
                      size="sm"
                      className="w-full"
                      onClick={() =>
                        logDose({
                          patientId: activePatient.id,
                          medicationId: nextScheduledSlot.medication.id,
                          scheduledDate: nextScheduledSlot.scheduledDate,
                          scheduledTime: nextScheduledSlot.scheduledTime,
                          status: 'taken',
                        })
                      }
                    >
                      <Check className="h-4 w-4" />
                      <span>Confirm next dose taken</span>
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  No remaining unlogged doses for today’s schedule.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Care attention ({attentionItems.length})
              </h3>
              <span className="text-xs text-slate-500">Explainable triggers</span>
            </div>
            <AttentionCards items={attentionItems.slice(0, 3)} />
          </div>
        </div>
      </div>

      {/* Bottom Row: Adherence Chart + Refill Forecast + Caregiver Connections & History */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Recorded adherence trend</CardTitle>
              <CardDescription>
                Confirmed taken doses divided by scheduled due doses. Missing logs remain distinct from skipped doses.
              </CardDescription>
            </div>
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setAdherenceWindow(7)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                  adherenceWindow === 7
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setAdherenceWindow(30)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                  adherenceWindow === 30
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                30 Days
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-slate-600 tabular-nums">
              <span>
                Taken: <strong className="text-[#0D9488]">{activeMetrics.takenCount}</strong>
              </span>
              <span>
                Skipped: <strong className="text-amber-700">{activeMetrics.skippedCount}</strong>
              </span>
              <span>
                Unconfirmed missing logs:{' '}
                <strong className="text-red-600">{activeMetrics.unconfirmedCount}</strong>
              </span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeMetrics.dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip />
                  <Bar dataKey="taken" stackId="a" fill="#0D9488" name="Taken" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="skipped" stackId="a" fill="#D97706" name="Skipped" />
                  <Bar
                    dataKey="unconfirmed"
                    stackId="a"
                    fill="#DC2626"
                    name="Unconfirmed"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Refill forecast</CardTitle>
              <CardDescription>Based on recorded stock and daily doses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {refillForecasts.map((r) => (
                <div
                  key={r.medicationId}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {r.medicationName} {r.strength}
                    </p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {r.remainingQuantity !== null
                        ? `${r.remainingQuantity} ${r.unitLabel} left`
                        : 'Quantity not recorded'}
                      {r.estimatedRefillDate ? ` · Est. ${formatShortDate(r.estimatedRefillDate)}` : ''}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'text-xs font-semibold whitespace-nowrap tabular-nums',
                      r.needsRefill ? 'text-amber-700' : 'text-slate-600',
                    )}
                  >
                    {r.daysRemaining !== null ? `${r.daysRemaining}d left` : 'PRN'}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Care Circle</CardTitle>
                <CardDescription>{patientConnections.length} connected contact(s)</CardDescription>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/caregivers')}>
                Manage
              </Button>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {patientConnections.length === 0 ? (
                <p className="text-xs text-slate-500">No caregiver connections yet.</p>
              ) : (
                patientConnections.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-xs border-b border-slate-100 pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{c.caregiverName}</p>
                      <p className="text-slate-500">
                        {c.relationship} · {c.contactPriority}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'font-medium capitalize',
                        c.status === 'accepted' ? 'text-[#0D9488]' : 'text-amber-700',
                      )}
                    >
                      {c.status}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Care Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent care activity</CardTitle>
            <CardDescription>Latest logged doses, refills, alerts, and shared notes</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/history')}>
            Full care history
          </Button>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-slate-100">
            {recentHistory.map((ev) => (
              <div
                key={ev.id}
                className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{ev.title}</p>
                  <p className="text-xs text-slate-500">{ev.details}</p>
                </div>
                <div className="text-xs text-slate-400 font-mono tabular-nums shrink-0">
                  {formatTimestamp(ev.timestamp)} · {ev.actorName}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Skip Reason Modal */}
      <Dialog open={Boolean(skipModalSlot)} onOpenChange={(open) => !open && setSkipModalSlot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record skipped dose</DialogTitle>
            <DialogDescription>
              {skipModalSlot?.medicationName} at{' '}
              {skipModalSlot ? formatTime12h(skipModalSlot.scheduledTime) : ''}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!skipModalSlot) return;
              logDose({
                patientId: activePatient.id,
                medicationId: skipModalSlot.medicationId,
                scheduledDate: skipModalSlot.scheduledDate,
                scheduledTime: skipModalSlot.scheduledTime,
                status: 'skipped',
                skipReason,
              });
              setSkipModalSlot(null);
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="skip-reason-input" className="block text-xs font-medium text-slate-700 mb-1.5">
                Optional reason (helps your doctor and Care Circle understand)
              </label>
              <Input
                id="skip-reason-input"
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder="e.g., Mild nausea, out of stock, fasting..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSkipModalSlot(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="amber">
                Confirm skipped dose
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
