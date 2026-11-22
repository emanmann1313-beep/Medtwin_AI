import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Check,
  Clock,
  FileScan,
  HeartHandshake,
  Loader2,
  Pill,
  RotateCcw,
  SkipForward,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { useMedTwin } from '@/src/context/MedTwinContext';
import {
  buildDoseSlotsForDate,
  buildExplainableAttentionItems,
  computeAdherenceMetrics,
  computeRefillForecasts,
  getTodayIso,
} from '@/src/services/adherenceEngine';
import { sendAiChatMessage } from '@/src/services/aiService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { ProgressRing } from '@/src/components/ui/ProgressRing';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { AttentionCards } from '@/src/components/shared/AttentionCards';
import { CaregiverContactsSection } from '@/src/modules/caregivers/components/CaregiverContactsSection';
import { AlertHistoryPanel } from '@/src/modules/caregivers/components/AlertHistoryPanel';
import { cn, formatShortDate, formatTime12h, formatTimestamp } from '@/src/lib/utils';

export function PatientDashboardPage() {
  const { user, isDemoMode } = useAuth();
  const {
    state,
    isLoading,
    hasPatients,
    isRealAccountMode,
    activePatient,
    setActivePatientId,
    setAssistantOpen,
    logDose,
    undoDose,
  } = useMedTwin();
  const navigate = useNavigate();

  const [skipModalSlot, setSkipModalSlot] = useState<{
    medicationId: string;
    medicationName: string;
    scheduledDate: string;
    scheduledTime: string;
  } | null>(null);
  const [skipReason, setSkipReason] = useState('');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiInsightLoading, setAiInsightLoading] = useState(false);

  const todayStr = getTodayIso();

  const patientMeds = useMemo(
    () =>
      hasPatients
        ? state.medications.filter(
            (m) => m.patientId === activePatient.id && m.status === 'active',
          )
        : [],
    [activePatient.id, hasPatients, state.medications],
  );

  const todaySlots = useMemo(
    () =>
      hasPatients
        ? buildDoseSlotsForDate(
            activePatient.id,
            todayStr,
            state.medications,
            state.doseLogs,
          )
        : [],
    [activePatient.id, hasPatients, state.doseLogs, state.medications, todayStr],
  );

  const metrics7 = useMemo(
    () =>
      hasPatients
        ? computeAdherenceMetrics(activePatient.id, 7, state.medications, state.doseLogs)
        : { adherencePct: null, takenCount: 0, scheduledDueCount: 0, skippedCount: 0, unconfirmedCount: 0, dailySeries: [] },
    [activePatient.id, hasPatients, state.doseLogs, state.medications],
  );

  const metrics30 = useMemo(
    () =>
      hasPatients
        ? computeAdherenceMetrics(activePatient.id, 30, state.medications, state.doseLogs)
        : { adherencePct: null, takenCount: 0, scheduledDueCount: 0, skippedCount: 0, unconfirmedCount: 0, dailySeries: [] },
    [activePatient.id, hasPatients, state.doseLogs, state.medications],
  );

  const refillForecasts = useMemo(
    () =>
      hasPatients ? computeRefillForecasts(activePatient.id, state.medications) : [],
    [activePatient.id, hasPatients, state.medications],
  );

  const attentionItems = useMemo(
    () =>
      hasPatients
        ? buildExplainableAttentionItems(
            activePatient.id,
            state.medications,
            state.doseLogs,
            state.prescriptions,
            state.alerts,
          )
        : [],
    [activePatient.id, hasPatients, state.alerts, state.doseLogs, state.medications, state.prescriptions],
  );

  const patientConnections = useMemo(
    () =>
      hasPatients
        ? state.connections.filter(
            (c) => c.patientId === activePatient.id && c.status !== 'revoked',
          )
        : [],
    [activePatient.id, hasPatients, state.connections],
  );

  const recentHistory = useMemo(
    () =>
      hasPatients
        ? state.history
            .filter((h) => h.patientId === activePatient.id && !h.restrictedToClinician)
            .slice(0, 6)
        : [],
    [activePatient.id, hasPatients, state.history],
  );

  const patientRawAlerts = useMemo(
    () =>
      hasPatients
        ? state.alerts.filter((a) => a.patientId === activePatient.id)
        : [],
    [activePatient.id, hasPatients, state.alerts],
  );

  const confirmedToday = todaySlots.filter((s) => s.state === 'taken').length;
  const todayCompletionPct =
    todaySlots.length > 0 ? Math.round((confirmedToday / todaySlots.length) * 100) : null;

  const nextScheduledSlot = useMemo(
    () =>
      todaySlots.find((s) => s.state === 'due' || s.state === 'scheduled') ??
      todaySlots.find((s) => s.state === 'overdue'),
    [todaySlots],
  );

  const displayName = isRealAccountMode && user ? user.fullName : activePatient.name;

  const soonestRefill = useMemo(() => {
    const withDays = refillForecasts.filter((r) => r.daysRemaining !== null);
    withDays.sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999));
    return withDays[0] ?? null;
  }, [refillForecasts]);

  const handleGenerateAiInsight = async () => {
    setAiInsightLoading(true);
    try {
      const res = await sendAiChatMessage({
        message:
          'Give me a concise 2-sentence overview of today’s medication schedule, refill status, and one helpful adherence tip based strictly on my saved medications.',
        history: [],
        patientContext: {
          patientName: displayName,
          today: todayStr,
          medications: patientMeds.map((m) => ({
            name: m.name,
            strength: m.strength,
            remainingQuantity: m.remainingQuantity,
          })),
          todaySlots: todaySlots.map((s) => ({
            medicine: `${s.medication.name} ${s.medication.strength}`,
            time: formatTime12h(s.scheduledTime),
            status: s.state,
          })),
          adherence7dPct: metrics7.adherencePct,
          adherence30dPct: metrics30.adherencePct,
        },
        role: 'patient',
      });
      setAiInsight(res);
    } catch (err) {
      setAiInsight(
        err instanceof Error
          ? err.message
          : 'Unable to fetch AI medication insight right now.',
      );
    } finally {
      setAiInsightLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="h-24 rounded-2xl bg-[#1A2740] border border-[#334155] animate-pulse" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-[#1A2740] border border-[#334155] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting & Quick Actions */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#8B5CF6]/35 bg-gradient-to-br from-[#1A2740] via-[#1A2740] to-[#223451] p-6 shadow-[0_0_28px_rgba(139,92,246,0.14)] lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#A8B8CC]">
            {hasPatients && (
              <span className="font-mono font-semibold text-[#2DD4BF]">
                {activePatient.mrn}
              </span>
            )}
            {activePatient.conditions.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>{activePatient.conditions.join(', ')}</span>
              </>
            )}
            {isDemoMode && !isRealAccountMode && (
              <>
                <span aria-hidden="true">·</span>
                <span>Synthetic Demo Profile</span>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl font-bold text-[#F8FAFC]">
              Welcome back, {displayName}
            </h2>
            {isDemoMode && !isRealAccountMode && state.patients.length > 1 && (
              <select
                aria-label="Select demo patient profile"
                value={activePatient.id}
                onChange={(e) => setActivePatientId(e.target.value)}
                className="rounded-xl border border-[#334155] bg-[#0B1220] px-3 py-1.5 text-xs font-medium text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
              >
                {state.patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.mrn})
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="text-sm text-[#A8B8CC]">
            {patientMeds.length === 0
              ? 'Scan your first prescription to activate your daily medication schedule and Digital Twin.'
              : `Tracking ${patientMeds.length} active medication(s) for ${formatShortDate(todayStr)}.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button type="button" onClick={() => navigate('/prescriptions')}>
            <FileScan className="h-4 w-4" />
            <span>Quick Scan Prescription</span>
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/digital-twin')}>
            <Activity className="h-4 w-4" />
            <span>Digital Twin</span>
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/dadi-nani')}>
            <HeartHandshake className="h-4 w-4" />
            <span>Dadi-Nani Mode</span>
          </Button>
        </div>
      </div>

      {/* 3 Animated Adherence Progress Rings + Next Scheduled Medicine */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7 border-[#2DD4BF]/30 shadow-[0_0_26px_rgba(45,212,191,0.10)]">
          <CardHeader className="pb-2">
            <CardTitle>Adherence Progress Overview</CardTitle>
            <CardDescription>
              Daily completion, 7-day rolling adherence, and 30-day routine consistency
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <ProgressRing
                value={todayCompletionPct}
                tone="teal"
                size={132}
                label="Today’s Completion"
                sublabel={
                  todaySlots.length > 0
                    ? `${confirmedToday} of ${todaySlots.length} doses`
                    : 'No doses scheduled'
                }
              />
              <ProgressRing
                value={metrics7.adherencePct}
                tone="violet"
                size={132}
                label="Weekly Adherence"
                sublabel={
                  metrics7.scheduledDueCount > 0
                    ? `${metrics7.takenCount} of ${metrics7.scheduledDueCount} due`
                    : 'No 7d logs yet'
                }
              />
              <ProgressRing
                value={metrics30.adherencePct}
                tone="navy"
                size={132}
                label="Monthly Adherence"
                sublabel={
                  metrics30.scheduledDueCount > 0
                    ? `${metrics30.takenCount} of ${metrics30.scheduledDueCount} due`
                    : 'No 30d logs yet'
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Next Scheduled Medicine + Caregiver & Refill Snapshot */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="bg-[#223451] border-[#8B5CF6]/30 shadow-[0_0_22px_rgba(139,92,246,0.12)]">
            <CardHeader className="pb-2">
              <CardDescription>Next scheduled medicine</CardDescription>
              {nextScheduledSlot ? (
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Clock className="h-5 w-5 text-[#8B5CF6]" />
                  <span className="tabular-nums">
                    {formatTime12h(nextScheduledSlot.scheduledTime)}
                  </span>
                </CardTitle>
              ) : (
                <CardTitle className="text-lg text-[#34D399]">
                  {todaySlots.length === 0 ? 'No doses scheduled yet' : 'All doses logged for today'}
                </CardTitle>
              )}
            </CardHeader>
            <CardContent>
              {nextScheduledSlot ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-bold text-[#F8FAFC]">
                      {nextScheduledSlot.medication.name} {nextScheduledSlot.medication.strength}
                    </p>
                    <p className="mt-0.5 text-xs text-[#A8B8CC]">
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
                      <span>Mark as Taken</span>
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#A8B8CC]">
                  {todaySlots.length === 0
                    ? 'Scan a prescription or add a medicine to begin tracking.'
                    : 'Every scheduled slot for today has been logged.'}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-[#223451]">
              <CardHeader className="pb-2">
                <CardDescription>Refill countdown</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums text-[#F8FAFC]">
                  {soonestRefill && soonestRefill.daysRemaining !== null
                    ? `${soonestRefill.daysRemaining}d`
                    : '—'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-[#A8B8CC] truncate">
                  {soonestRefill
                    ? `${soonestRefill.medicationName} remaining`
                    : 'Add stock count on Rx'}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#223451]">
              <CardHeader className="pb-2">
                <CardDescription>Caregiver circle</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums text-[#2DD4BF]">
                  {patientConnections.filter((c) => c.status === 'accepted').length}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <button
                  type="button"
                  onClick={() => navigate('/caregivers')}
                  className="text-xs font-semibold text-[#8B5CF6] hover:text-[#A78BFA] hover:underline cursor-pointer"
                >
                  {patientConnections.some((c) => c.status === 'invited')
                    ? `${patientConnections.filter((c) => c.status === 'invited').length} pending approval`
                    : 'Manage Care Circle'}
                </button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Today's Medication Cards + AI Medication Insights */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#334155] pb-4">
            <div>
              <CardTitle>Today’s Medicine Cards &amp; Timeline</CardTitle>
              <CardDescription>
                Review dosage, timing, remaining quantity, and confirm each dose with one tap.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => navigate('/medications')}>
              <Pill className="h-4 w-4" />
              <span>All Medicines</span>
            </Button>
          </CardHeader>
          <CardContent className="pt-5">
            {todaySlots.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#334155] bg-[#223451]/60 py-12 px-6 text-center space-y-3">
                <Pill className="mx-auto h-9 w-9 text-[#8B5CF6]" />
                <p className="text-sm font-semibold text-[#F8FAFC]">
                  No scheduled medicines yet for today
                </p>
                <p className="text-xs text-[#A8B8CC] max-w-md mx-auto">
                  Upload or photograph a prescription to build your daily medication cards automatically.
                </p>
                <Button type="button" onClick={() => navigate('/prescriptions')}>
                  <FileScan className="h-4 w-4" />
                  <span>Scan Prescription</span>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {todaySlots.map((slot) => {
                  const statusMeta =
                    slot.state === 'taken'
                      ? { label: 'Taken', cls: 'text-[#34D399]' }
                      : slot.state === 'overdue'
                        ? { label: 'Missed / Overdue', cls: 'text-[#FB7185]' }
                        : slot.state === 'skipped'
                          ? { label: 'Skipped', cls: 'text-[#FBBF24]' }
                          : { label: 'Pending', cls: 'text-[#8B5CF6]' };

                  return (
                    <div
                      key={slot.slotKey}
                      className="flex flex-col justify-between rounded-2xl border border-[#334155] bg-[#223451] p-4 space-y-3 shadow-[0_8px_20px_rgba(3,7,18,0.28)]"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono font-bold text-[#F8FAFC] tabular-nums">
                            {formatTime12h(slot.scheduledTime)}
                          </span>
                          <span className={cn('font-semibold', statusMeta.cls)}>
                            {statusMeta.label}
                          </span>
                        </div>
                        <p className="font-display text-base font-bold text-[#F8FAFC]">
                          {slot.medication.name} {slot.medication.strength}
                        </p>
                        <p className="text-xs text-[#A8B8CC]">
                          {slot.medication.doseAndRoute} · {slot.medication.instructions}
                        </p>
                        <p className="font-mono text-[11px] text-[#A8B8CC] tabular-nums">
                          {typeof slot.medication.remainingQuantity === 'number'
                            ? `${slot.medication.remainingQuantity} ${slot.medication.unitLabel} remaining`
                            : 'Remaining qty not set'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#334155]">
                        {!slot.log ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              className="flex-1"
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
                              <span>Mark as Taken</span>
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
                            className="w-full"
                            onClick={() => undoDose(slot.log!.id)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Undo Log</span>
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

        {/* AI Medication Insights + Attention Cards */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-[#8B5CF6]/40 bg-gradient-to-br from-[#1A2740] to-[#223451] shadow-[0_0_26px_rgba(139,92,246,0.16)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-[#8B5CF6]" />
                <span>AI Medication Insights</span>
              </CardTitle>
              <CardDescription>
                Non-diagnostic summary grounded in your active prescriptions and routine
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {aiInsight ? (
                <p className="rounded-xl border border-[#334155] bg-[#0B1220]/70 p-3.5 text-xs leading-relaxed text-[#F8FAFC]">
                  {aiInsight}
                </p>
              ) : (
                <p className="text-xs text-[#A8B8CC]">
                  Generate an instant overview of today’s schedule, upcoming refills, or ask a question in the assistant drawer.
                </p>
              )}

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleGenerateAiInsight}
                  disabled={aiInsightLoading}
                >
                  {aiInsightLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Analyzing schedule...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{aiInsight ? 'Refresh AI insight' : 'Generate AI insight'}</span>
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAssistantOpen(true)}
                >
                  <span>Open AI Chat Assistant</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-display text-sm font-semibold text-[#F8FAFC]">
                Care Attention ({attentionItems.length})
              </h3>
              <button
                type="button"
                onClick={() => navigate('/caregivers')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#2DD4BF] hover:underline cursor-pointer"
              >
                <Users className="h-3.5 w-3.5" />
                <span>Care Circle</span>
              </button>
            </div>
            <AttentionCards items={attentionItems.slice(0, 3)} />
          </div>
        </div>
      </div>

      {/* Refill Countdown List & Recent Care Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Refill Countdown</CardTitle>
            <CardDescription>Supply estimates based on remaining units and daily frequency</CardDescription>
          </CardHeader>
          <CardContent>
            {refillForecasts.length === 0 ? (
              <p className="text-xs text-[#A8B8CC]">
                No active medications tracked yet.
              </p>
            ) : (
              <div className="divide-y divide-[#334155]">
                {refillForecasts.map((r) => (
                  <div key={r.medicationId} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#F8FAFC] truncate">
                        {r.medicationName} {r.strength}
                      </p>
                      <p className="text-xs text-[#A8B8CC] tabular-nums">
                        {r.remainingQuantity !== null
                          ? `${r.remainingQuantity} ${r.unitLabel} left`
                          : 'Quantity not recorded'}
                        {r.estimatedRefillDate ? ` · Est. ${formatShortDate(r.estimatedRefillDate)}` : ''}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'font-mono text-xs font-semibold tabular-nums whitespace-nowrap',
                        r.needsRefill
                          ? 'text-[#FBBF24]'
                          : 'text-[#34D399]',
                      )}
                    >
                      {r.daysRemaining !== null ? `${r.daysRemaining}d left` : 'PRN'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Care Activity</CardTitle>
              <CardDescription>Logged doses, prescriptions, and shared updates</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => navigate('/history')}>
              Full History
            </Button>
          </CardHeader>
          <CardContent>
            {recentHistory.length === 0 ? (
              <p className="text-xs text-[#A8B8CC]">
                No recorded activity yet.
              </p>
            ) : (
              <div className="divide-y divide-[#334155]">
                {recentHistory.map((ev) => (
                  <div key={ev.id} className="py-2.5 first:pt-0 last:pb-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#F8FAFC]">
                        {ev.title}
                      </span>
                      <span className="font-mono text-[11px] text-[#A8B8CC] tabular-nums shrink-0">
                        {formatTimestamp(ev.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-[#A8B8CC]">{ev.details}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Caregiver Contacts & Alert History */}
      {hasPatients && (
        <Tabs defaultValue="contacts">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="contacts">
                Caregiver Contacts ({patientConnections.length})
              </TabsTrigger>
              <TabsTrigger value="alert-history">
                Alert History ({patientRawAlerts.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="contacts">
            <CaregiverContactsSection patient={activePatient} canManageContacts />
          </TabsContent>

          <TabsContent value="alert-history">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#F8FAFC]">
                  Caregiver Alert History
                </CardTitle>
                <CardDescription>
                  Track WhatsApp, SMS, and Care Circle alerts with honest provider-confirmed delivery states
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AlertHistoryPanel alerts={patientRawAlerts} patients={state.patients} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

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
              <label htmlFor="skip-reason-input" className="block text-xs font-semibold mb-1.5">
                Optional reason
              </label>
              <Input
                id="skip-reason-input"
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder="e.g., Mild nausea, out of stock..."
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
