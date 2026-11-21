import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Info,
  Package,
  Pill,
  RotateCcw,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { useTheme } from '@/src/context/ThemeContext';
import { runDigitalTwinSimulation } from '@/src/services/digitalTwinEngine';
import { computeRefillForecasts } from '@/src/services/adherenceEngine';
import { DigitalTwinScenario } from '@/src/types/medtwin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { cn, formatShortDate } from '@/src/lib/utils';

const DEFAULT_SCENARIO: DigitalTwinScenario = {
  horizonDays: 14,
  mode: 'refill-delay',
  omittedDatesCount: 2,
  selectedMedicationId: 'all',
  refillDelayDays: 3,
  replenishOnDayOffset: 2,
  replenishQuantity: 30,
  alertMissThreshold: 2,
};

export function DigitalTwinPage() {
  const {
    state,
    activePatient,
    setActivePatientId,
    replenishMedicationStock,
    createSimulatedAlert,
  } = useMedTwin();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();

  const [scenario, setScenario] = useState<DigitalTwinScenario>(DEFAULT_SCENARIO);

  const patientMeds = useMemo(
    () =>
      state.medications.filter(
        (m) => m.patientId === activePatient.id && m.status === 'active',
      ),
    [activePatient.id, state.medications],
  );

  const scheduledMeds = useMemo(
    () => patientMeds.filter((m) => !m.asNeeded && m.scheduledTimes.length > 0),
    [patientMeds],
  );

  const effectiveScenario = useMemo<DigitalTwinScenario>(() => {
    const validSelected =
      scenario.selectedMedicationId === 'all' ||
      scheduledMeds.some((m) => m.id === scenario.selectedMedicationId);
    return validSelected ? scenario : { ...scenario, selectedMedicationId: 'all' };
  }, [scenario, scheduledMeds]);

  const result = useMemo(
    () => runDigitalTwinSimulation(patientMeds, effectiveScenario),
    [patientMeds, effectiveScenario],
  );

  const refillForecasts = useMemo(
    () => computeRefillForecasts(activePatient.id, state.medications),
    [activePatient.id, state.medications],
  );

  const adherenceDelta = result.scenarioAdherencePct - result.baselineAdherencePct;

  return (
    <div className="space-y-6">
      {/* Header & Patient Selector */}
      <Card>
        <CardContent className="pt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#0D9488] dark:text-[#14B8A6]">
              <Activity className="h-4 w-4" />
              <span>Medication Supply &amp; Adherence Digital Twin</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-2xl font-bold text-[#172554] dark:text-[#F8FAFC]">
                {activePatient.name}
              </h2>
              <select
                aria-label="Select patient for digital twin simulation"
                value={activePatient.id}
                onChange={(e) => setActivePatientId(e.target.value)}
                className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-xs font-medium text-[#172554] focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC] dark:focus:ring-[#14B8A6]"
              >
                {state.patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.mrn})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
              Deterministic what-if modeling comparing baseline schedule continuity against refill delays, omitted doses, or planned replenishment. Non-diagnostic.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setScenario(DEFAULT_SCENARIO)}
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset scenario</span>
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/medications')}>
              <Pill className="h-4 w-4" />
              <span>View schedules</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scenario Controls + Summary KPIs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Simulation parameters</CardTitle>
            <CardDescription>
              Adjust scenario horizon, supply events, and caregiver alert threshold
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#172554] dark:text-[#F8FAFC]">
                Simulation horizon
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([7, 14, 30] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setScenario((s) => ({ ...s, horizonDays: days }))}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer',
                      effectiveScenario.horizonDays === days
                        ? 'border-[#0D9488] bg-[#CCFBF1]/60 text-[#0D9488] dark:border-[#14B8A6] dark:bg-[#14B8A6]/20 dark:text-[#14B8A6]'
                        : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#64748B] hover:text-[#172554] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]',
                    )}
                  >
                    {days} days
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="twin-med-select"
                className="text-xs font-medium text-[#172554] dark:text-[#F8FAFC]"
              >
                Medication scope
              </label>
              <select
                id="twin-med-select"
                value={effectiveScenario.selectedMedicationId}
                onChange={(e) =>
                  setScenario((s) => ({ ...s, selectedMedicationId: e.target.value }))
                }
                className="h-10 w-full rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-3 text-xs font-medium text-[#172554] focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC] dark:focus:ring-[#14B8A6]"
              >
                <option value="all">All active scheduled medicines ({scheduledMeds.length})</option>
                {scheduledMeds.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.strength} ({m.remainingQuantity ?? 0} {m.unitLabel} left)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="twin-mode-select"
                className="text-xs font-medium text-[#172554] dark:text-[#F8FAFC]"
              >
                Scenario mode
              </label>
              <select
                id="twin-mode-select"
                value={effectiveScenario.mode}
                onChange={(e) =>
                  setScenario((s) => ({
                    ...s,
                    mode: e.target.value as DigitalTwinScenario['mode'],
                  }))
                }
                className="h-10 w-full rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-3 text-xs font-medium text-[#172554] focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC] dark:focus:ring-[#14B8A6]"
              >
                <option value="refill-delay">Refill delay after depletion</option>
                <option value="omitted-doses">Omitted dose days</option>
                <option value="replenish-supply">Planned supply replenishment</option>
                <option value="baseline-all-taken">Baseline (all taken &amp; refilled)</option>
              </select>
            </div>

            {effectiveScenario.mode === 'refill-delay' && (
              <div className="space-y-1.5">
                <label
                  htmlFor="twin-delay-days"
                  className="text-xs font-medium text-[#172554] dark:text-[#F8FAFC]"
                >
                  Refill delay after stock reaches 0 (days)
                </label>
                <Input
                  id="twin-delay-days"
                  type="number"
                  min={0}
                  max={14}
                  value={effectiveScenario.refillDelayDays}
                  onChange={(e) =>
                    setScenario((s) => ({
                      ...s,
                      refillDelayDays: Math.max(0, Math.min(14, Number(e.target.value) || 0)),
                    }))
                  }
                  className="tabular-nums"
                />
              </div>
            )}

            {effectiveScenario.mode === 'omitted-doses' && (
              <div className="space-y-1.5">
                <label
                  htmlFor="twin-omitted-days"
                  className="text-xs font-medium text-[#172554] dark:text-[#F8FAFC]"
                >
                  Consecutive omitted days (from Day 2)
                </label>
                <Input
                  id="twin-omitted-days"
                  type="number"
                  min={1}
                  max={14}
                  value={effectiveScenario.omittedDatesCount}
                  onChange={(e) =>
                    setScenario((s) => ({
                      ...s,
                      omittedDatesCount: Math.max(1, Math.min(14, Number(e.target.value) || 1)),
                    }))
                  }
                  className="tabular-nums"
                />
              </div>
            )}

            {effectiveScenario.mode === 'replenish-supply' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="twin-replenish-day"
                    className="text-xs font-medium text-[#172554] dark:text-[#F8FAFC]"
                  >
                    Replenish on day #
                  </label>
                  <Input
                    id="twin-replenish-day"
                    type="number"
                    min={1}
                    max={effectiveScenario.horizonDays}
                    value={effectiveScenario.replenishOnDayOffset + 1}
                    onChange={(e) =>
                      setScenario((s) => ({
                        ...s,
                        replenishOnDayOffset: Math.max(
                          0,
                          Math.min(
                            effectiveScenario.horizonDays - 1,
                            (Number(e.target.value) || 1) - 1,
                          ),
                        ),
                      }))
                    }
                    className="tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="twin-replenish-qty"
                    className="text-xs font-medium text-[#172554] dark:text-[#F8FAFC]"
                  >
                    Units added
                  </label>
                  <Input
                    id="twin-replenish-qty"
                    type="number"
                    min={1}
                    max={180}
                    value={effectiveScenario.replenishQuantity}
                    onChange={(e) =>
                      setScenario((s) => ({
                        ...s,
                        replenishQuantity: Math.max(1, Math.min(180, Number(e.target.value) || 30)),
                      }))
                    }
                    className="tabular-nums"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="twin-alert-threshold"
                className="text-xs font-medium text-[#172554] dark:text-[#F8FAFC]"
              >
                Caregiver alert threshold (consecutive missed doses)
              </label>
              <Input
                id="twin-alert-threshold"
                type="number"
                min={1}
                max={10}
                value={effectiveScenario.alertMissThreshold}
                onChange={(e) =>
                  setScenario((s) => ({
                    ...s,
                    alertMissThreshold: Math.max(1, Math.min(10, Number(e.target.value) || 2)),
                  }))
                }
                className="tabular-nums"
              />
            </div>
          </CardContent>
        </Card>

        {/* Right 2 cols: KPI Cards + Continuity Chart */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Projected scenario adherence</CardDescription>
                <CardTitle
                  className={cn(
                    'text-3xl font-bold tabular-nums',
                    result.scenarioAdherencePct < 85
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-[#0D9488] dark:text-[#14B8A6]',
                  )}
                >
                  {result.scenarioAdherencePct}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                  vs {result.baselineAdherencePct}% baseline ({adherenceDelta >= 0 ? `+${adherenceDelta}` : adherenceDelta} pts)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Covered doses ({effectiveScenario.horizonDays}d)</CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums">
                  {result.scenarioCoveredDoses} / {result.projectedScheduledDoses}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                  {result.supplyGapDates.length} supply-gap day(s) detected
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Care Circle alert triggers</CardDescription>
                <CardTitle
                  className={cn(
                    'text-3xl font-bold tabular-nums',
                    result.triggeredAlertEvents.length > 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-[#0D9488] dark:text-[#14B8A6]',
                  )}
                >
                  {result.triggeredAlertEvents.length}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                  End stock: {result.scenarioProjectedStockEnd} units
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Adherence Trajectory Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Baseline vs Scenario Adherence Continuity</CardTitle>
              <CardDescription>
                Cumulative adherence percentage across the {effectiveScenario.horizonDays}-day window
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result.timeline.length === 0 ? (
                <p className="py-10 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">
                  No active scheduled medications available for simulation.
                </p>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={result.timeline}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={isDark ? '#334155' : '#E2E8F0'}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="dayLabel"
                        tick={{ fontSize: 11, fill: isDark ? '#94A3B8' : '#64748B' }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: isDark ? '#94A3B8' : '#64748B' }}
                        unit="%"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#172033' : '#FFFFFF',
                          borderColor: isDark ? '#334155' : '#E2E8F0',
                          color: isDark ? '#F8FAFC' : '#172554',
                          borderRadius: '12px',
                          fontSize: '12px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="baselineAdherencePct"
                        name="Baseline %"
                        stroke={isDark ? '#60A5FA' : '#3B82F6'}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="scenarioAdherencePct"
                        name="Scenario %"
                        stroke={isDark ? '#14B8A6' : '#0D9488'}
                        strokeWidth={2.5}
                        dot={{ r: 2.5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stock Depletion Chart & Triggered Events */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Projected Stock Units Remaining</CardTitle>
            <CardDescription>
              Total remaining units across selected active scheduled medications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.timeline}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? '#334155' : '#E2E8F0'}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="dayLabel"
                    tick={{ fontSize: 11, fill: isDark ? '#94A3B8' : '#64748B' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: isDark ? '#94A3B8' : '#64748B' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#172033' : '#FFFFFF',
                      borderColor: isDark ? '#334155' : '#E2E8F0',
                      color: isDark ? '#F8FAFC' : '#172554',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="baselineStock"
                    name="Baseline stock"
                    stroke={isDark ? '#60A5FA' : '#3B82F6'}
                    fill={isDark ? 'rgba(96, 165, 250, 0.14)' : 'rgba(59, 130, 246, 0.12)'}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="scenarioStock"
                    name="Scenario stock"
                    stroke={isDark ? '#14B8A6' : '#0D9488'}
                    fill={isDark ? 'rgba(20, 184, 166, 0.22)' : 'rgba(13, 148, 136, 0.18)'}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Simulated Care Circle Alerts &amp; Supply Gaps</CardTitle>
              <CardDescription>
                Threshold triggers under the active simulation parameters
              </CardDescription>
            </div>
            {result.triggeredAlertEvents.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  createSimulatedAlert({
                    patientId: activePatient.id,
                    title: `Digital Twin supply/adherence alert (${result.triggeredAlertEvents[0].medicationName})`,
                    reason: result.triggeredAlertEvents[0].reason,
                    severity: 'attention',
                  })
                }
              >
                <BellRing className="h-3.5 w-3.5" />
                <span>Send test alert</span>
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {result.triggeredAlertEvents.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs text-[#64748B] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#94A3B8]">
                <CheckCircle2 className="h-4 w-4 text-[#0D9488] dark:text-[#14B8A6] shrink-0" />
                <span>
                  No Care Circle alert thresholds triggered within this {effectiveScenario.horizonDays}-day simulation.
                </span>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                {result.triggeredAlertEvents.map((ev, idx) => (
                  <div
                    key={`${ev.date}-${ev.medicationName}-${idx}`}
                    className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs dark:border-amber-700/50 dark:bg-amber-950/25"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-semibold text-[#172554] dark:text-[#F8FAFC]">
                        {ev.medicationName} · {formatShortDate(ev.date)}
                      </p>
                      <p className="text-[#64748B] dark:text-[#94A3B8]">{ev.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Refill quick-action summary */}
            {refillForecasts.some((r) => r.needsRefill) && (
              <div className="space-y-2 border-t border-[#E2E8F0] pt-3 dark:border-[#334155]">
                <p className="text-xs font-semibold text-[#172554] dark:text-[#F8FAFC] flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-[#0D9488] dark:text-[#14B8A6]" />
                  <span>Medicines approaching refill</span>
                </p>
                <div className="space-y-2">
                  {refillForecasts
                    .filter((r) => r.needsRefill)
                    .map((r) => (
                      <div
                        key={r.medicationId}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="text-[#64748B] dark:text-[#94A3B8]">
                          <strong className="text-[#172554] dark:text-[#F8FAFC]">
                            {r.medicationName} {r.strength}
                          </strong>{' '}
                          ({r.daysRemaining ?? 0}d left)
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => replenishMedicationStock(r.medicationId, 30)}
                        >
                          +30 refill
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assumptions & Missing Data Warnings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4 text-[#0D9488] dark:text-[#14B8A6]" />
            <span>Model Assumptions &amp; Transparency</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          {result.missingDataWarnings.length > 0 && (
            <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-700/50 dark:bg-amber-950/20">
              {result.missingDataWarnings.map((warn, i) => (
                <p key={i} className="text-amber-800 dark:text-amber-300">
                  {warn}
                </p>
              ))}
            </div>
          )}
          <ul className="list-disc pl-5 space-y-1 text-[#64748B] dark:text-[#94A3B8]">
            {result.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
