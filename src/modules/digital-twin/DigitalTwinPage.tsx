import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BellPlus,
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock,
  Info,
  PackagePlus,
  Pill,
  Quote,
  RefreshCw,
  Send,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { computeAdherenceMetrics, computeRefillForecasts } from '@/src/services/adherenceEngine';
import { runDigitalTwinSimulation } from '@/src/services/digitalTwinEngine';
import { AiChatMessage, sendAiChatMessage } from '@/src/services/aiService';
import { DigitalTwinScenario } from '@/src/types/medtwin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { cn, formatShortDate, formatTime12h } from '@/src/lib/utils';

const MOTIVATIONAL_QUOTES = [
  {
    text: 'Small, steady steps every morning and evening build lasting peace of mind for you and your family.',
    context: 'Daily care rhythm',
  },
  {
    text: 'Planning refills a few days ahead turns stressful surprises into calm, predictable routines.',
    context: 'Supply readiness',
  },
  {
    text: 'Every logged dose gives your care team clearer insight and keeps your loved ones reassured.',
    context: 'Connected care',
  },
  {
    text: 'Consistency matters more than perfection. If a dose is missed or delayed, honest tracking helps your doctor guide you safely.',
    context: 'Mindful adherence',
  },
];

function ProgressRing({
  value,
  max = 100,
  size = 116,
  strokeWidth = 10,
  color = '#0D9488',
  label,
  sublabel,
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label: string;
  sublabel: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const dashOffset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            className="stroke-[#E2E8F0] dark:stroke-[#334155]"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-500 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-xl font-bold text-[#172554] dark:text-[#F8FAFC] tabular-nums">
            {label}
          </span>
        </div>
      </div>
      <span className="mt-2.5 text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">{sublabel}</span>
    </div>
  );
}

export function DigitalTwinPage() {
  const {
    state,
    activePatient,
    createSimulatedAlert,
    replenishMedicationStock,
  } = useMedTwin();
  const navigate = useNavigate();

  const patientMeds = useMemo(
    () =>
      state.medications.filter(
        (m) => m.patientId === activePatient.id && m.status === 'active' && !m.asNeeded,
      ),
    [activePatient.id, state.medications],
  );

  const allActiveMeds = useMemo(
    () => state.medications.filter((m) => m.patientId === activePatient.id && m.status === 'active'),
    [activePatient.id, state.medications],
  );

  const acceptedCaregivers = useMemo(
    () =>
      state.connections.filter(
        (c) => c.patientId === activePatient.id && c.status === 'accepted',
      ),
    [activePatient.id, state.connections],
  );

  const recordedAdherence30 = useMemo(
    () => computeAdherenceMetrics(activePatient.id, 30, state.medications, state.doseLogs),
    [activePatient.id, state.doseLogs, state.medications],
  );

  const refills = useMemo(
    () =>
      computeRefillForecasts(activePatient.id, state.medications).sort((a, b) => {
        if (a.daysRemaining === null && b.daysRemaining === null) return 0;
        if (a.daysRemaining === null) return 1;
        if (b.daysRemaining === null) return -1;
        return a.daysRemaining - b.daysRemaining;
      }),
    [activePatient.id, state.medications],
  );

  const defaultThreshold =
    acceptedCaregivers[0]?.alertPreferences.repeatedMissedThreshold ?? 2;

  const [scenario, setScenario] = useState<DigitalTwinScenario>({
    horizonDays: 14,
    mode: 'refill-delay',
    omittedDatesCount: 2,
    selectedMedicationId: 'all',
    refillDelayDays: 4,
    replenishOnDayOffset: 3,
    replenishQuantity: 30,
    alertMissThreshold: defaultThreshold,
  });

  const [selectedTimelineDate, setSelectedTimelineDate] = useState<string | null>(null);
  const [quoteIdx, setQuoteIdx] = useState(0);

  // Inline AI Chat state
  const [chatMessages, setChatMessages] = useState<AiChatMessage[]>([
    {
      role: 'assistant',
      text: `Hi ${activePatient.name.split(' ')[0]}, ask me how this What-If scenario impacts your supply countdown or Care Circle notifications.`,
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const simResult = useMemo(
    () => runDigitalTwinSimulation(patientMeds, scenario),
    [patientMeds, scenario],
  );

  const totalCurrentStock = refills.reduce((acc, r) => acc + (r.remainingQuantity ?? 0), 0);

  const selectedDayDetail = useMemo(() => {
    if (simResult.timeline.length === 0) return null;
    return (
      simResult.timeline.find((d) => d.date === selectedTimelineDate) ??
      simResult.timeline.find((d) => d.isSupplyGap || d.triggersAlert) ??
      simResult.timeline[0]
    );
  }, [selectedTimelineDate, simResult.timeline]);

  const handleDispatchSimulatedAlert = () => {
    const firstTrigger = simResult.triggeredAlertEvents[0];
    createSimulatedAlert({
      patientId: activePatient.id,
      title: firstTrigger
        ? `Refill-delay simulation alert: ${firstTrigger.medicationName}`
        : `Digital Twin scenario attention for ${activePatient.name}`,
      reason: firstTrigger
        ? firstTrigger.reason
        : `Simulated ${scenario.mode} resulted in ${simResult.scenarioAdherencePct}% adherence over ${scenario.horizonDays} days.`,
      severity: simResult.supplyGapDates.length > 0 ? 'urgent' : 'attention',
    });
  };

  const handleInlineAiSend = async (promptOverride?: string) => {
    const text = (promptOverride ?? chatInput).trim();
    if (!text || chatLoading) return;

    setChatError(null);
    const nextHistory = [...chatMessages, { role: 'user' as const, text }];
    setChatMessages(nextHistory);
    setChatInput('');
    setChatLoading(true);

    try {
      const reply = await sendAiChatMessage({
        message: text,
        history: chatMessages,
        role: 'patient',
        patientContext: {
          patientName: activePatient.name,
          activeMedications: allActiveMeds.map((m) => ({
            name: m.name,
            strength: m.strength,
            remainingQuantity: m.remainingQuantity,
            scheduledTimes: m.scheduledTimes,
          })),
          recordedAdherence30dPct: recordedAdherence30.adherencePct,
          digitalTwinScenario: scenario,
          simulationOutcome: {
            scenarioAdherencePct: simResult.scenarioAdherencePct,
            baselineAdherencePct: simResult.baselineAdherencePct,
            supplyGapDays: simResult.supplyGapDates.length,
            firstGapDate: simResult.supplyGapDates[0] ?? null,
            triggeredAlertsCount: simResult.triggeredAlertEvents.length,
          },
        },
      });
      setChatMessages([...nextHistory, { role: 'assistant', text: reply }]);
    } catch (err) {
      setChatError(
        err instanceof Error ? err.message : 'Unable to reach AI assistant right now.',
      );
    } finally {
      setChatLoading(false);
    }
  };

  const activeQuote = MOTIVATIONAL_QUOTES[quoteIdx % MOTIVATIONAL_QUOTES.length];

  return (
    <div className="space-y-6">
      {/* Hero Banner with Exact Heading */}
      <div className="relative overflow-hidden rounded-[20px] border border-[#E2E8F0] bg-[#FFFFFF] p-6 sm:p-8 text-[#172554] shadow-[0_8px_28px_rgba(23,37,84,0.05)] dark:border-[#334155] dark:bg-[#172033] dark:text-[#F8FAFC] dark:shadow-none">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#0D9488] dark:text-[#14B8A6]">
              <span>Medication-management simulation</span>
              <span aria-hidden="true" className="text-[#CBD5E1] dark:text-[#475569]">
                ·
              </span>
              <span className="text-[#64748B] dark:text-[#94A3B8]">Read-only on actual prescription &amp; dose records</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#172554] dark:text-[#F8FAFC]">
              Your medication digital twin
            </h2>
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
              Virtual care profile for <strong className="text-[#172554] dark:text-[#F8FAFC]">{activePatient.name}</strong> ({activePatient.mrn}).
              Explore refill countdowns, daily continuity timelines, and What-If scenarios without altering your real records.
            </p>
          </div>

          {/* Numerical Quick Snapshot */}
          <div className="grid grid-cols-3 gap-4 rounded-[20px] border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4 text-center shrink-0 dark:border-[#334155] dark:bg-[#0B1220]">
            <div>
              <span className="block text-[11px] text-[#64748B] dark:text-[#94A3B8]">Active Meds</span>
              <span className="font-mono text-xl font-bold text-[#172554] dark:text-[#F8FAFC] tabular-nums">
                {allActiveMeds.length}
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-[#64748B] dark:text-[#94A3B8]">30d Adherence</span>
              <span className="font-mono text-xl font-bold text-[#0D9488] dark:text-[#14B8A6] tabular-nums">
                {recordedAdherence30.adherencePct !== null ? `${recordedAdherence30.adherencePct}%` : '—'}
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-[#64748B] dark:text-[#94A3B8]">Recorded Stock</span>
              <span className="font-mono text-xl font-bold text-[#3B82F6] dark:text-[#60A5FA] tabular-nums">
                {totalCurrentStock}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Rings + Numerical Insight Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Progress rings</CardTitle>
            <CardDescription>
              Recorded baseline vs simulated scenario continuity
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-3 pt-2">
            <ProgressRing
              value={recordedAdherence30.adherencePct ?? 0}
              max={100}
              color="#0D9488"
              label={
                recordedAdherence30.adherencePct !== null
                  ? `${recordedAdherence30.adherencePct}%`
                  : '—'
              }
              sublabel="30d Recorded"
            />
            <ProgressRing
              value={simResult.scenarioAdherencePct}
              max={100}
              color={simResult.scenarioAdherencePct < 85 ? '#F59E0B' : '#14B8A6'}
              label={`${simResult.scenarioAdherencePct}%`}
              sublabel="Scenario Rate"
            />
            <ProgressRing
              value={simResult.scenarioCoveredDoses}
              max={Math.max(1, simResult.projectedScheduledDoses)}
              color="#3B82F6"
              label={`${simResult.scenarioCoveredDoses}/${simResult.projectedScheduledDoses}`}
              sublabel="Doses Covered"
            />
          </CardContent>
        </Card>

        <div className="lg:col-span-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Projected doses covered</CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums text-[#172554] dark:text-[#F8FAFC]">
                {simResult.scenarioCoveredDoses}
                <span className="ml-2 text-base font-medium text-[#64748B] dark:text-[#94A3B8]">
                  / {simResult.baselineCoveredDoses} baseline
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                Over a {scenario.horizonDays}-day window ({simResult.projectedScheduledDoses} scheduled doses)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Projected stock at window end</CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums text-[#0D9488] dark:text-[#14B8A6]">
                {simResult.scenarioProjectedStockEnd}
                <span className="ml-2 text-sm font-medium text-[#64748B] dark:text-[#94A3B8]">
                  units left
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                Baseline end stock: {simResult.baselineProjectedStockEnd} units
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Potential supply-gap days</CardDescription>
              <CardTitle
                className={cn(
                  'text-3xl font-bold tabular-nums',
                  simResult.supplyGapDates.length > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-[#0D9488] dark:text-[#14B8A6]',
                )}
              >
                {simResult.supplyGapDates.length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                {simResult.supplyGapDates.length > 0
                  ? `First potential gap on ${formatShortDate(simResult.supplyGapDates[0])}`
                  : 'Zero supply gaps projected'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Caregiver alerts triggered</CardDescription>
              <CardTitle
                className={cn(
                  'text-3xl font-bold tabular-nums',
                  simResult.triggeredAlertEvents.length > 0
                    ? 'text-[#3B82F6] dark:text-[#60A5FA]'
                    : 'text-[#172554] dark:text-[#F8FAFC]',
                )}
              >
                {simResult.triggeredAlertEvents.length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Threshold: {scenario.alertMissThreshold} consecutive missed dose(s)
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* What-If Simulator + Compact Timeline */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-[#0D9488] dark:text-[#14B8A6]" />
              <span>What-If Simulator</span>
            </CardTitle>
            <CardDescription>
              Test refill timing, omitted doses, or supply replenishment without changing real logs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(
                [
                  { id: 'baseline-all-taken', label: 'All doses taken' },
                  { id: 'refill-delay', label: 'Refill delayed' },
                  { id: 'omitted-doses', label: 'Omitted doses' },
                  { id: 'replenish-supply', label: 'Replenish on date' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelectedTimelineDate(null);
                    setScenario((prev) => ({ ...prev, mode: m.id }));
                  }}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-all cursor-pointer',
                    scenario.mode === m.id
                      ? 'border-[#0D9488] bg-[#CCFBF1] text-[#0F766E] dark:border-[#14B8A6] dark:bg-[#14B8A6]/15 dark:text-[#14B8A6]'
                      : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#172554] hover:bg-[#F8FAFC] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC] dark:hover:bg-[#1E293B]',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div>
              <label htmlFor="twin-med-filter" className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1.5">
                Focus medication
              </label>
              <select
                id="twin-med-filter"
                value={scenario.selectedMedicationId}
                onChange={(e) =>
                  setScenario((prev) => ({ ...prev, selectedMedicationId: e.target.value }))
                }
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2 text-xs text-[#172554] focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC] dark:focus:ring-[#14B8A6]"
              >
                <option value="all">All active scheduled medicines ({patientMeds.length})</option>
                {patientMeds.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.strength} ({m.remainingQuantity ?? '?'} {m.unitLabel} left)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1.5">
                Simulation horizon
              </span>
              <div className="inline-flex w-full rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-1 dark:bg-[#0B1220] dark:border-[#334155]">
                {([7, 14, 30] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setScenario((prev) => ({ ...prev, horizonDays: days }))}
                    className={cn(
                      'flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer',
                      scenario.horizonDays === days
                        ? 'bg-[#FFFFFF] text-[#172554] font-semibold shadow-xs dark:bg-[#172033] dark:text-[#F8FAFC]'
                        : 'text-[#64748B] hover:text-[#172554] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]',
                    )}
                  >
                    {days} days
                  </button>
                ))}
              </div>
            </div>

            {scenario.mode === 'refill-delay' && (
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <label htmlFor="twin-delay-slider" className="font-medium text-[#172554] dark:text-[#F8FAFC]">
                    Refill delay duration
                  </label>
                  <span className="font-mono font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                    {scenario.refillDelayDays} day(s)
                  </span>
                </div>
                <input
                  id="twin-delay-slider"
                  type="range"
                  min={1}
                  max={14}
                  value={scenario.refillDelayDays}
                  onChange={(e) =>
                    setScenario((prev) => ({
                      ...prev,
                      refillDelayDays: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-[#0D9488] dark:accent-[#14B8A6]"
                />
              </div>
            )}

            {scenario.mode === 'omitted-doses' && (
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <label htmlFor="twin-omit-slider" className="font-medium text-[#172554] dark:text-[#F8FAFC]">
                    Days with omitted doses
                  </label>
                  <span className="font-mono font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                    {scenario.omittedDatesCount} day(s)
                  </span>
                </div>
                <input
                  id="twin-omit-slider"
                  type="range"
                  min={1}
                  max={7}
                  value={scenario.omittedDatesCount}
                  onChange={(e) =>
                    setScenario((prev) => ({
                      ...prev,
                      omittedDatesCount: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-[#0D9488] dark:accent-[#14B8A6]"
                />
              </div>
            )}

            {scenario.mode === 'replenish-supply' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#172554] dark:text-[#F8FAFC] mb-1">
                    Replenish on Day #
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={scenario.horizonDays - 1}
                    value={scenario.replenishOnDayOffset}
                    onChange={(e) =>
                      setScenario((prev) => ({
                        ...prev,
                        replenishOnDayOffset: Math.max(0, Number(e.target.value)),
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#172554] dark:text-[#F8FAFC] mb-1">
                    Units added
                  </label>
                  <Input
                    type="number"
                    min={5}
                    max={90}
                    value={scenario.replenishQuantity}
                    onChange={(e) =>
                      setScenario((prev) => ({
                        ...prev,
                        replenishQuantity: Math.max(1, Number(e.target.value)),
                      }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              <label htmlFor="twin-alert-thresh" className="text-xs font-medium text-[#172554] dark:text-[#F8FAFC]">
                Alert threshold (missed doses)
              </label>
              <Input
                id="twin-alert-thresh"
                type="number"
                min={1}
                max={6}
                value={scenario.alertMissThreshold}
                onChange={(e) =>
                  setScenario((prev) => ({
                    ...prev,
                    alertMissThreshold: Math.max(1, Number(e.target.value)),
                  }))
                }
                className="w-20 text-center font-mono"
              />
            </div>

            <div className="pt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="amber" onClick={handleDispatchSimulatedAlert}>
                <BellPlus className="h-4 w-4" />
                <span>Send simulated alert</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  void handleInlineAiSend(
                    `Explain how my ${scenario.mode} scenario affects ${
                      scenario.selectedMedicationId === 'all' ? 'my medications' : 'this medication'
                    } over ${scenario.horizonDays} days.`,
                  )
                }
              >
                <Sparkles className="h-3.5 w-3.5 text-[#3B82F6] dark:text-[#14B8A6]" />
                <span>Ask AI about scenario</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Compact Timeline (No traditional chart/graph!) */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-[#0D9488] dark:text-[#14B8A6]" />
              <span>Compact simulation timeline</span>
            </CardTitle>
            <CardDescription>
              Select any day pill below to inspect projected supply, adherence, and Care Circle triggers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
              {simResult.timeline.map((pt) => {
                const isSelected = selectedDayDetail?.date === pt.date;
                return (
                  <button
                    key={pt.date}
                    type="button"
                    onClick={() => setSelectedTimelineDate(pt.date)}
                    className={cn(
                      'flex flex-col items-start rounded-xl border p-2.5 text-left transition-all cursor-pointer',
                      pt.isSupplyGap
                        ? 'border-amber-300 bg-amber-50/70 dark:border-amber-700/60 dark:bg-amber-950/30'
                        : pt.triggersAlert
                          ? 'border-blue-300 bg-blue-50/70 dark:border-blue-700/60 dark:bg-blue-950/30'
                          : 'border-[#E2E8F0] bg-[#FFFFFF] hover:bg-[#F8FAFC] dark:border-[#334155] dark:bg-[#0B1220] dark:hover:bg-[#1E293B]',
                      isSelected && 'ring-2 ring-[#0D9488] dark:ring-[#14B8A6]',
                    )}
                  >
                    <span className="text-[10px] font-medium text-[#64748B] dark:text-[#94A3B8] truncate w-full">
                      {pt.dayLabel}
                    </span>
                    <span
                      className={cn(
                        'mt-1 font-mono text-xs font-bold tabular-nums',
                        pt.isSupplyGap
                          ? 'text-amber-700 dark:text-amber-400'
                          : pt.triggersAlert
                            ? 'text-[#3B82F6] dark:text-[#60A5FA]'
                            : 'text-[#0D9488] dark:text-[#14B8A6]',
                      )}
                    >
                      {pt.scenarioAdherencePct}%
                    </span>
                    <span className="mt-0.5 text-[10px] font-mono text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                      {pt.scenarioStock} left
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Day Inspector */}
            {selectedDayDetail && (
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between dark:border-[#334155] dark:bg-[#0B1220]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-[#172554] dark:text-[#F8FAFC]">
                      {formatShortDate(selectedDayDetail.date)}
                    </span>
                    <span aria-hidden="true" className="text-[#CBD5E1] dark:text-[#334155]">
                      ·
                    </span>
                    <span
                      className={cn(
                        'font-semibold',
                        selectedDayDetail.isSupplyGap
                          ? 'text-amber-700 dark:text-amber-400'
                          : selectedDayDetail.triggersAlert
                            ? 'text-[#3B82F6] dark:text-[#60A5FA]'
                            : 'text-[#0D9488] dark:text-[#14B8A6]',
                      )}
                    >
                      {selectedDayDetail.isSupplyGap
                        ? 'Supply gap projected'
                        : selectedDayDetail.triggersAlert
                          ? 'Alert threshold reached'
                          : 'Schedule covered'}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                    Scenario adherence: <strong className="text-[#172554] dark:text-[#F8FAFC]">{selectedDayDetail.scenarioAdherencePct}%</strong> vs
                    Baseline <strong className="text-[#172554] dark:text-[#F8FAFC]">{selectedDayDetail.baselineAdherencePct}%</strong> · Stock
                    projected: <strong className="text-[#172554] dark:text-[#F8FAFC]">{selectedDayDetail.scenarioStock} units</strong>
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-[#64748B] dark:text-[#94A3B8] shrink-0">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#0D9488] dark:bg-[#14B8A6]" /> Covered
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#F59E0B]" /> Gap
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#3B82F6]" /> Alert
                  </span>
                </div>
              </div>
            )}

            {/* Caregiver Alert Triggers Summary */}
            <div className="border-t border-[#E2E8F0] pt-4 space-y-2 dark:border-[#334155]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#172554] dark:text-[#F8FAFC]">
                  Simulated Care Circle alerts ({simResult.triggeredAlertEvents.length})
                </span>
                <span className="text-[#64748B] dark:text-[#94A3B8]">
                  {acceptedCaregivers.length} consented recipient(s)
                </span>
              </div>
              {simResult.triggeredAlertEvents.length === 0 ? (
                <p className="flex items-center gap-2 text-xs text-[#0D9488] dark:text-[#14B8A6]">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>No caregiver alerts would trigger under this scenario.</span>
                </p>
              ) : (
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {simResult.triggeredAlertEvents.map((ev, idx) => (
                    <div
                      key={`${ev.date}-${ev.medicationName}-${idx}`}
                      className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs dark:border-amber-700/50 dark:bg-amber-950/30"
                    >
                      <div>
                        <span className="font-semibold text-amber-900 dark:text-amber-300">{ev.medicationName}: </span>
                        <span className="text-amber-800 dark:text-amber-200">{ev.reason}</span>
                      </div>
                      <span className="font-mono text-amber-700 dark:text-amber-300 shrink-0 tabular-nums">
                        {formatShortDate(ev.date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Medication Cards + Refill Countdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Pill className="h-4 w-4 text-[#0D9488] dark:text-[#14B8A6]" />
                <span>Interactive medication cards</span>
              </CardTitle>
              <CardDescription>
                Inspect active prescriptions, focus one in the simulator, or record a refill
              </CardDescription>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/medications')}>
              <span>All medicines</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {allActiveMeds.map((med) => {
              const forecast = refills.find((r) => r.medicationId === med.id);
              const isFocused = scenario.selectedMedicationId === med.id;
              const stockPct =
                typeof med.remainingQuantity === 'number'
                  ? Math.min(100, Math.round((med.remainingQuantity / 30) * 100))
                  : 0;

              return (
                <div
                  key={med.id}
                  className={cn(
                    'flex flex-col justify-between rounded-[20px] border p-4 transition-all',
                    isFocused
                      ? 'border-[#0D9488] bg-[#CCFBF1]/45 shadow-sm dark:border-[#14B8A6] dark:bg-[#14B8A6]/12'
                      : 'border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#CBD5E1] dark:border-[#334155] dark:bg-[#0B1220] dark:hover:border-[#475569]',
                  )}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-display text-sm font-semibold text-[#172554] dark:text-[#F8FAFC]">
                          {med.name} {med.strength}
                        </h4>
                        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                          {med.asNeeded
                            ? 'As needed (PRN)'
                            : med.scheduledTimes.map(formatTime12h).join(' · ')}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'font-mono text-xs font-semibold tabular-nums',
                          forecast?.needsRefill
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-[#0D9488] dark:text-[#14B8A6]',
                        )}
                      >
                        {forecast?.daysRemaining !== null && forecast?.daysRemaining !== undefined
                          ? `${forecast.daysRemaining}d left`
                          : 'PRN'}
                      </span>
                    </div>

                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8] line-clamp-2">{med.instructions}</p>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                        <span>Recorded supply</span>
                        <span className="font-mono font-medium text-[#172554] dark:text-[#F8FAFC]">
                          {typeof med.remainingQuantity === 'number'
                            ? `${med.remainingQuantity} ${med.unitLabel}`
                            : 'Not recorded'}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-[#334155]">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-300',
                            forecast?.needsRefill ? 'bg-[#F59E0B]' : 'bg-[#0D9488] dark:bg-[#14B8A6]',
                          )}
                          style={{ width: `${stockPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-[#E2E8F0] dark:border-[#334155]">
                    {!med.asNeeded && (
                      <Button
                        type="button"
                        size="sm"
                        variant={isFocused ? 'default' : 'outline'}
                        onClick={() =>
                          setScenario((prev) => ({
                            ...prev,
                            selectedMedicationId: isFocused ? 'all' : med.id,
                          }))
                        }
                      >
                        {isFocused ? 'Focused' : 'Simulate'}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => replenishMedicationStock(med.id, 30)}
                    >
                      <PackagePlus className="h-3.5 w-3.5" />
                      <span>+30 Refill</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Refill Countdown + Motivational Quotes */}
        <div className="lg:col-span-5 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#F59E0B]" />
                <span>Refill countdown</span>
              </CardTitle>
              <CardDescription>
                Sorted by earliest estimated runout date from recorded stock
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {refills.map((r) => (
                <div
                  key={r.medicationId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 dark:border-[#334155] dark:bg-[#0B1220]"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#172554] dark:text-[#F8FAFC] truncate">
                      {r.medicationName} {r.strength}
                    </p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                      {r.remainingQuantity !== null
                        ? `${r.remainingQuantity} ${r.unitLabel} · ${r.dailyUsage}/day`
                        : 'Stock count not recorded'}
                      {r.estimatedRefillDate ? ` · Est. ${formatShortDate(r.estimatedRefillDate)}` : ''}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'font-mono text-xs font-bold whitespace-nowrap tabular-nums',
                      r.needsRefill
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-[#172554] dark:text-[#F8FAFC]',
                    )}
                  >
                    {r.daysRemaining !== null ? `${r.daysRemaining}d` : 'PRN'}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Motivational Quotes */}
          <Card className="border-[#E2E8F0] bg-[#FFFFFF] dark:border-[#334155] dark:bg-[#172033]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0D9488] dark:text-[#14B8A6]">
                <Quote className="h-4 w-4 text-[#0D9488] dark:text-[#14B8A6]" />
                <span>Daily encouragement · {activeQuote.context}</span>
              </div>
              <button
                type="button"
                onClick={() => setQuoteIdx((i) => i + 1)}
                aria-label="Next motivational quote"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[#64748B] hover:bg-[#CCFBF1] hover:text-[#0D9488] cursor-pointer dark:text-[#94A3B8] dark:hover:bg-[#1E293B] dark:hover:text-[#14B8A6]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Next</span>
              </button>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium leading-relaxed text-[#172554] dark:text-[#F8FAFC]">
                “{activeQuote.text}”
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Inline Digital Twin AI Chat + Calculation Assumptions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-[#0D9488] dark:text-[#14B8A6]" />
                <span>Digital Twin AI Chat</span>
              </CardTitle>
              <CardDescription>
                Ask about your current simulation, supply countdown, or Care Circle alerts
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-56 overflow-y-auto space-y-2.5 pr-1">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-2xl px-4 py-2.5 text-xs leading-relaxed',
                    msg.role === 'user'
                      ? 'ml-8 bg-[#0D9488] text-white dark:bg-[#14B8A6] dark:text-[#0B1220]'
                      : 'mr-8 border border-[#E2E8F0] bg-[#F8FAFC] text-[#172554] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC]',
                  )}
                >
                  {msg.text}
                </div>
              ))}
              {chatLoading && (
                <div className="mr-8 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-xs text-[#64748B] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#94A3B8]">
                  Analyzing your Digital Twin scenario...
                </div>
              )}
            </div>

            {chatError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{chatError}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {[
                'Which medicine runs out first?',
                'What happens if a refill is 4 days late?',
                'Summarize my 30-day adherence simply',
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void handleInlineAiSend(q)}
                  className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1.5 text-xs text-[#172554] hover:bg-[#CCFBF1]/50 cursor-pointer dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC] dark:hover:bg-[#1E293B]"
                >
                  {q}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleInlineAiSend();
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about your Digital Twin schedule or refill plan..."
                aria-label="Digital Twin AI chat input"
              />
              <Button type="submit" size="icon" disabled={chatLoading || !chatInput.trim()} aria-label="Send chat message">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Simulation assumptions &amp; transparency</CardTitle>
            <CardDescription>
              Medication-management simulation only — no diagnoses, drug levels, or dose advice
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
              {simResult.assumptions.map((a, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0D9488] dark:text-[#14B8A6]" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>

            {simResult.missingDataWarnings.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1 dark:border-amber-700/50 dark:bg-amber-950/30">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 text-[#F59E0B]" />
                  <span>Missing stock data notices</span>
                </p>
                {simResult.missingDataWarnings.map((w, idx) => (
                  <p key={idx} className="text-xs text-amber-800 dark:text-amber-200">
                    {w}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
