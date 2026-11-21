import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellPlus,
  CheckCircle2,
  Info,
  SlidersHorizontal,
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
import { computeAdherenceMetrics, computeRefillForecasts } from '@/src/services/adherenceEngine';
import { runDigitalTwinSimulation } from '@/src/services/digitalTwinEngine';
import { DigitalTwinScenario } from '@/src/types/medtwin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { cn, formatShortDate } from '@/src/lib/utils';

export function DigitalTwinPage() {
  const { state, activePatient, createSimulatedAlert } = useMedTwin();

  const patientMeds = useMemo(
    () =>
      state.medications.filter(
        (m) => m.patientId === activePatient.id && m.status === 'active' && !m.asNeeded,
      ),
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
    () => computeRefillForecasts(activePatient.id, state.medications),
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

  const simResult = useMemo(
    () => runDigitalTwinSimulation(patientMeds, scenario),
    [patientMeds, scenario],
  );

  const totalCurrentStock = refills.reduce((acc, r) => acc + (r.remainingQuantity ?? 0), 0);

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

  return (
    <div className="space-y-6">
      {/* Header Banner — Medication-Management Simulation Framing */}
      <Card>
        <CardContent className="pt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#0D9488]">
              <span>Medication-management simulation</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-500">Read-only on live prescription &amp; dose records</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              Medication Digital Twin — {activePatient.name}
            </h2>
            <p className="text-sm text-slate-600 max-w-2xl">
              Compare your baseline confirmed schedule against hypothetical dose omissions, refill delays,
              or supply replenishment dates before gaps happen.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-center shrink-0">
            <div>
              <span className="block text-[11px] text-slate-500">Active Meds</span>
              <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                {patientMeds.length}
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-slate-500">30d Adherence</span>
              <span className="font-mono text-lg font-bold text-[#0D9488] tabular-nums">
                {recordedAdherence30.adherencePct !== null ? `${recordedAdherence30.adherencePct}%` : '—'}
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-slate-500">Recorded Stock</span>
              <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                {totalCurrentStock}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Controls + Comparison Metrics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Scenario Controls */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-[#0D9488]" />
              <span>Scenario parameters</span>
            </CardTitle>
            <CardDescription>
              Adjust assumptions below; actual history is never modified.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Simulation mode
              </label>
              <div className="grid grid-cols-1 gap-1.5">
                {(
                  [
                    { id: 'baseline-all-taken', label: 'Baseline: All scheduled doses taken' },
                    { id: 'refill-delay', label: 'Refill delayed by N days' },
                    { id: 'omitted-doses', label: 'Selected doses omitted' },
                    { id: 'replenish-supply', label: 'Supply replenished on date' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setScenario((prev) => ({ ...prev, mode: m.id }))}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors cursor-pointer',
                      scenario.mode === m.id
                        ? 'border-[#0D9488] bg-[#0D9488]/10 text-[#0F766E]'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="dt-med-select" className="block text-xs font-medium text-slate-700 mb-1.5">
                Target medication
              </label>
              <select
                id="dt-med-select"
                value={scenario.selectedMedicationId}
                onChange={(e) =>
                  setScenario((prev) => ({ ...prev, selectedMedicationId: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              >
                <option value="all">All active scheduled medicines ({patientMeds.length})</option>
                {patientMeds.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.strength} ({m.remainingQuantity ?? '?'} left)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Projection window
              </label>
              <div className="inline-flex w-full rounded-xl bg-slate-100 p-1">
                {([7, 14, 30] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setScenario((prev) => ({ ...prev, horizonDays: days }))}
                    className={cn(
                      'flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer',
                      scenario.horizonDays === days
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900',
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
                  <label htmlFor="dt-delay-days" className="font-medium text-slate-700">
                    Refill delay duration
                  </label>
                  <span className="font-mono font-semibold text-amber-700 tabular-nums">
                    {scenario.refillDelayDays} day(s)
                  </span>
                </div>
                <input
                  id="dt-delay-days"
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
                  className="w-full accent-[#0D9488]"
                />
              </div>
            )}

            {scenario.mode === 'omitted-doses' && (
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <label htmlFor="dt-omit-days" className="font-medium text-slate-700">
                    Days with omitted doses
                  </label>
                  <span className="font-mono font-semibold text-amber-700 tabular-nums">
                    {scenario.omittedDatesCount} day(s)
                  </span>
                </div>
                <input
                  id="dt-omit-days"
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
                  className="w-full accent-[#0D9488]"
                />
              </div>
            )}

            {scenario.mode === 'replenish-supply' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Add units
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

            <div>
              <label htmlFor="dt-alert-thresh" className="block text-xs font-medium text-slate-700 mb-1">
                Caregiver alert threshold (consecutive missed doses)
              </label>
              <Input
                id="dt-alert-thresh"
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
              />
            </div>
          </CardContent>
        </Card>

        {/* Output Summary & Charts */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Doses covered (Scenario / Base)</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums">
                  {simResult.scenarioCoveredDoses}
                  <span className="ml-1.5 text-sm font-medium text-slate-400">
                    / {simResult.baselineCoveredDoses}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 tabular-nums">
                  Out of {simResult.projectedScheduledDoses} scheduled
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Simulated adherence</CardDescription>
                <CardTitle
                  className={cn(
                    'text-2xl font-bold tabular-nums',
                    simResult.scenarioAdherencePct < 85 ? 'text-amber-600' : 'text-[#0D9488]',
                  )}
                >
                  {simResult.scenarioAdherencePct}%
                  <span className="ml-1.5 text-sm font-medium text-slate-400">
                    vs {simResult.baselineAdherencePct}%
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500">Scenario vs baseline</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Projected end stock</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums">
                  {simResult.scenarioProjectedStockEnd}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 tabular-nums">
                  Baseline end stock: {simResult.baselineProjectedStockEnd}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Potential supply-gap days</CardDescription>
                <CardTitle
                  className={cn(
                    'text-2xl font-bold tabular-nums',
                    simResult.supplyGapDates.length > 0 ? 'text-red-600' : 'text-slate-900',
                  )}
                >
                  {simResult.supplyGapDates.length}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 truncate">
                  {simResult.supplyGapDates.length > 0
                    ? `Starts ${formatShortDate(simResult.supplyGapDates[0])}`
                    : 'No gap projected'}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Projected adherence: Baseline vs Scenario (%)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={simResult.timeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="dayLabel" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="baselineAdherencePct"
                        stroke="#2563EB"
                        strokeWidth={2}
                        dot={false}
                        name="Baseline %"
                      />
                      <Line
                        type="monotone"
                        dataKey="scenarioAdherencePct"
                        stroke="#0D9488"
                        strokeWidth={2.5}
                        dot={false}
                        name="Scenario %"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Projected stock remaining (units)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={simResult.timeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="dayLabel" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="baselineStock"
                        stroke="#2563EB"
                        fill="#2563EB"
                        fillOpacity={0.08}
                        name="Baseline stock"
                      />
                      <Area
                        type="monotone"
                        dataKey="scenarioStock"
                        stroke="#D97706"
                        fill="#D97706"
                        fillOpacity={0.14}
                        name="Scenario stock"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Caregiver Alert Simulation + Assumptions + Missing Data Warnings */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Caregiver alerts triggered by scenario</CardTitle>
              <CardDescription>
                Consented Care Circle contacts: {acceptedCaregivers.length}
              </CardDescription>
            </div>
            <Button type="button" size="sm" variant="amber" onClick={handleDispatchSimulatedAlert}>
              <BellPlus className="h-4 w-4" />
              <span>Send simulated alert</span>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {simResult.triggeredAlertEvents.length === 0 ? (
              <div className="flex items-center gap-2.5 text-sm text-slate-600 py-3">
                <CheckCircle2 className="h-4 w-4 text-[#0D9488]" />
                <span>No caregiver alerts would be triggered under this scenario.</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {simResult.triggeredAlertEvents.map((ev, idx) => (
                  <div key={idx} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-amber-800">{ev.medicationName}</span>
                      <span className="font-mono text-slate-500 tabular-nums">
                        {formatShortDate(ev.date)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600">{ev.reason}</p>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-slate-400">
              Demo alerts are clearly labeled Simulated and require patient-approved Care Circle consent.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Calculation assumptions &amp; data notes</CardTitle>
            <CardDescription>
              Transparency notes — no disease predictions, organ estimates, or dosing advice
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1.5 text-xs text-slate-600">
              {simResult.assumptions.map((a, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2563EB]" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>

            {simResult.missingDataWarnings.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  <span>Missing stock data notices</span>
                </p>
                {simResult.missingDataWarnings.map((w, idx) => (
                  <p key={idx} className="text-xs text-amber-800">
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
