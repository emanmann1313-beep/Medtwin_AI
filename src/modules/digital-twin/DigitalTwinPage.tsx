import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  FileScan,
  Info,
  Package,
  Play,
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
import { runDigitalTwinSimulation } from '@/src/services/digitalTwinEngine';
import { computeRefillForecasts } from '@/src/services/adherenceEngine';
import { DigitalTwinScenario } from '@/src/types/medtwin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { ProgressRing } from '@/src/components/ui/ProgressRing';
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
    hasPatients,
    activePatient,
    setActivePatientId,
    replenishMedicationStock,
    createSimulatedAlert,
  } = useMedTwin();
  const navigate = useNavigate();

  const [draftScenario, setDraftScenario] = useState<DigitalTwinScenario>(DEFAULT_SCENARIO);
  const [appliedScenario, setAppliedScenario] = useState<DigitalTwinScenario>(DEFAULT_SCENARIO);

  const patientMeds = useMemo(
    () =>
      hasPatients
        ? state.medications.filter(
            (m) => m.patientId === activePatient.id && m.status === 'active',
          )
        : [],
    [activePatient.id, hasPatients, state.medications],
  );

  const scheduledMeds = useMemo(
    () => patientMeds.filter((m) => !m.asNeeded && m.scheduledTimes.length > 0),
    [patientMeds],
  );

  const effectiveScenario = useMemo<DigitalTwinScenario>(() => {
    const validSelected =
      appliedScenario.selectedMedicationId === 'all' ||
      scheduledMeds.some((m) => m.id === appliedScenario.selectedMedicationId);
    return validSelected ? appliedScenario : { ...appliedScenario, selectedMedicationId: 'all' };
  }, [appliedScenario, scheduledMeds]);

  const result = useMemo(
    () => runDigitalTwinSimulation(patientMeds, effectiveScenario),
    [patientMeds, effectiveScenario],
  );

  const refillForecasts = useMemo(
    () => (hasPatients ? computeRefillForecasts(activePatient.id, state.medications) : []),
    [activePatient.id, hasPatients, state.medications],
  );

  const adherenceDelta = result.scenarioAdherencePct - result.baselineAdherencePct;
  const estimatedMissedDoses = Math.max(
    0,
    result.projectedScheduledDoses - result.scenarioCoveredDoses,
  );
  const refillShortageEstimate = result.supplyGapDates.length;

  const handleRunSimulation = () => {
    setAppliedScenario(draftScenario);
  };

  const handleReset = () => {
    setDraftScenario(DEFAULT_SCENARIO);
    setAppliedScenario(DEFAULT_SCENARIO);
  };

  return (
    <div className="space-y-6">
      {/* Header & Patient Selector */}
      <Card>
        <CardContent className="pt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#8B5CF6]">
              <Activity className="h-4 w-4 text-[#2DD4BF]" />
              <span>Medication Routine Simulation</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-2xl font-bold text-[#F8FAFC]">
                Your Medication Digital Twin
              </h2>
              {state.patients.length > 0 && (
                <select
                  aria-label="Select patient for digital twin simulation"
                  value={activePatient.id}
                  onChange={(e) => setActivePatientId(e.target.value)}
                  className="rounded-xl border border-[#334155] bg-[#0B1220] px-3 py-1.5 text-xs font-medium text-[#F8FAFC]"
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
              Explore how changes in your medication routine could affect adherence and refill planning.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button type="button" variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
              <span>Reset</span>
            </Button>
            <Button type="button" onClick={handleRunSimulation}>
              <Play className="h-4 w-4" />
              <span>Run Simulation</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {scheduledMeds.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Activity className="mx-auto h-10 w-10 text-[#8B5CF6]" />
            <h3 className="font-display text-lg font-bold text-[#F8FAFC]">No active scheduled medications to simulate</h3>
            <p className="text-xs text-[#A8B8CC] max-w-md mx-auto">
              Add or scan a prescription first so your Digital Twin can model daily adherence and refill timing.
            </p>
            <Button type="button" onClick={() => navigate('/prescriptions')}>
              <FileScan className="h-4 w-4" />
              <span>Scan Prescription</span>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Scenario Controls + Two Circular Progress Rings */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Simulation Controls</CardTitle>
                <CardDescription>
                  Select medication, period, and what-if scenario, then click Run Simulation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#F8FAFC]">Simulation period</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([7, 14, 30] as const).map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setDraftScenario((s) => ({ ...s, horizonDays: days }))}
                        className={cn(
                          'rounded-xl border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer',
                          draftScenario.horizonDays === days
                            ? 'border-[#8B5CF6] bg-[#8B5CF6]/20 text-[#F8FAFC]'
                            : 'border-[#334155] bg-[#223451] text-[#A8B8CC] hover:text-[#F8FAFC]',
                        )}
                      >
                        {days} days
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="twin-med-select" className="text-xs font-semibold text-[#F8FAFC]">
                    Select medication
                  </label>
                  <select
                    id="twin-med-select"
                    value={draftScenario.selectedMedicationId}
                    onChange={(e) =>
                      setDraftScenario((s) => ({ ...s, selectedMedicationId: e.target.value }))
                    }
                    className="h-10 w-full rounded-xl border border-[#334155] bg-[#0B1220] px-3 text-xs font-medium text-[#F8FAFC]"
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
                  <label htmlFor="twin-mode-select" className="text-xs font-semibold text-[#F8FAFC]">
                    What-if scenario
                  </label>
                  <select
                    id="twin-mode-select"
                    value={draftScenario.mode}
                    onChange={(e) =>
                      setDraftScenario((s) => ({
                        ...s,
                        mode: e.target.value as DigitalTwinScenario['mode'],
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-[#334155] bg-[#0B1220] px-3 text-xs font-medium text-[#F8FAFC]"
                  >
                    <option value="refill-delay">Refill-delay scenario</option>
                    <option value="omitted-doses">Missed-dose scenario</option>
                    <option value="replenish-supply">Planned refill scenario</option>
                    <option value="baseline-all-taken">On-time baseline</option>
                  </select>
                </div>

                {draftScenario.mode === 'refill-delay' && (
                  <div className="space-y-1.5">
                    <label htmlFor="twin-delay-days" className="text-xs font-semibold">
                      Refill delay after supply reaches 0 (days)
                    </label>
                    <Input
                      id="twin-delay-days"
                      type="number"
                      min={0}
                      max={14}
                      value={draftScenario.refillDelayDays}
                      onChange={(e) =>
                        setDraftScenario((s) => ({
                          ...s,
                          refillDelayDays: Math.max(0, Math.min(14, Number(e.target.value) || 0)),
                        }))
                      }
                      className="tabular-nums"
                    />
                  </div>
                )}

                {draftScenario.mode === 'omitted-doses' && (
                  <div className="space-y-1.5">
                    <label htmlFor="twin-omitted-days" className="text-xs font-semibold">
                      Missed-dose days in window
                    </label>
                    <Input
                      id="twin-omitted-days"
                      type="number"
                      min={1}
                      max={14}
                      value={draftScenario.omittedDatesCount}
                      onChange={(e) =>
                        setDraftScenario((s) => ({
                          ...s,
                          omittedDatesCount: Math.max(1, Math.min(14, Number(e.target.value) || 1)),
                        }))
                      }
                      className="tabular-nums"
                    />
                  </div>
                )}

                {draftScenario.mode === 'replenish-supply' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label htmlFor="twin-replenish-day" className="text-xs font-semibold">
                        Refill on day #
                      </label>
                      <Input
                        id="twin-replenish-day"
                        type="number"
                        min={1}
                        max={draftScenario.horizonDays}
                        value={draftScenario.replenishOnDayOffset + 1}
                        onChange={(e) =>
                          setDraftScenario((s) => ({
                            ...s,
                            replenishOnDayOffset: Math.max(
                              0,
                              Math.min(draftScenario.horizonDays - 1, (Number(e.target.value) || 1) - 1),
                            ),
                          }))
                        }
                        className="tabular-nums"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="twin-replenish-qty" className="text-xs font-semibold">
                        Units added
                      </label>
                      <Input
                        id="twin-replenish-qty"
                        type="number"
                        min={1}
                        max={180}
                        value={draftScenario.replenishQuantity}
                        onChange={(e) =>
                          setDraftScenario((s) => ({
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
                  <label htmlFor="twin-alert-threshold" className="text-xs font-semibold">
                    Caregiver alert condition (missed doses)
                  </label>
                  <Input
                    id="twin-alert-threshold"
                    type="number"
                    min={1}
                    max={10}
                    value={draftScenario.alertMissThreshold}
                    onChange={(e) =>
                      setDraftScenario((s) => ({
                        ...s,
                        alertMissThreshold: Math.max(1, Math.min(10, Number(e.target.value) || 2)),
                      }))
                    }
                    className="tabular-nums"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="button" className="flex-1" onClick={handleRunSimulation}>
                    <Play className="h-3.5 w-3.5" />
                    <span>Run Simulation</span>
                  </Button>
                  <Button type="button" variant="outline" onClick={handleReset}>
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Right 8 cols: 2 Circular Progress Rings + Key Metrics */}
            <div className="lg:col-span-8 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Current Routine vs. What-If Scenario ({effectiveScenario.horizonDays} Days)</CardTitle>
                  <CardDescription>
                    Plain-language comparison of your current medication schedule against the selected routine change. Non-diagnostic.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 py-2">
                    <div className="rounded-2xl border border-[#2DD4BF]/30 bg-[#223451] p-6 flex justify-center shadow-[0_0_24px_rgba(45,212,191,0.12)]">
                      <ProgressRing
                        value={result.baselineAdherencePct}
                        size={154}
                        strokeWidth={12}
                        tone="teal"
                        label="Current Routine"
                        sublabel={`${result.baselineCoveredDoses} of ${result.projectedScheduledDoses} doses covered`}
                      />
                    </div>
                    <div className="rounded-2xl border border-[#8B5CF6]/35 bg-[#223451] p-6 flex justify-center shadow-[0_0_24px_rgba(139,92,246,0.16)]">
                      <ProgressRing
                        value={result.scenarioAdherencePct}
                        size={154}
                        strokeWidth={12}
                        tone={result.scenarioAdherencePct < 85 ? 'amber' : 'violet'}
                        label="What-If Scenario"
                        sublabel={`${result.scenarioCoveredDoses} of ${result.projectedScheduledDoses} doses covered`}
                      />
                    </div>
                  </div>

                  {/* 4 Required Metrics Below */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-[#334155] bg-[#223451] p-3.5">
                      <span className="text-[11px] text-[#A8B8CC] block">
                        Estimated missed doses
                      </span>
                      <span className="mt-1 font-display text-xl font-bold text-[#F8FAFC] tabular-nums block">
                        {estimatedMissedDoses}
                      </span>
                    </div>

                    <div className="rounded-xl border border-[#334155] bg-[#223451] p-3.5">
                      <span className="text-[11px] text-[#A8B8CC] block">
                        Refill shortage estimate
                      </span>
                      <span className="mt-1 font-display text-xl font-bold text-[#FBBF24] tabular-nums block">
                        {refillShortageEstimate} day(s)
                      </span>
                    </div>

                    <div className="rounded-xl border border-[#334155] bg-[#223451] p-3.5">
                      <span className="text-[11px] text-[#A8B8CC] block">
                        Adherence difference
                      </span>
                      <span
                        className={cn(
                          'mt-1 font-display text-xl font-bold tabular-nums block',
                          adherenceDelta < 0
                            ? 'text-[#FBBF24]'
                            : 'text-[#34D399]',
                        )}
                      >
                        {adherenceDelta >= 0 ? `+${adherenceDelta}%` : `${adherenceDelta}%`}
                      </span>
                    </div>

                    <div className="rounded-xl border border-[#334155] bg-[#223451] p-3.5">
                      <span className="text-[11px] text-[#A8B8CC] block">
                        Caregiver alert conditions
                      </span>
                      <span className="mt-1 font-display text-xl font-bold text-[#8B5CF6] tabular-nums block">
                        {result.triggeredAlertEvents.length} trigger(s)
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Continuity Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Adherence Trajectory ({effectiveScenario.horizonDays} Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={result.timeline}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#334155"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="dayLabel"
                          tick={{ fontSize: 11, fill: '#A8B8CC' }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 11, fill: '#A8B8CC' }}
                          unit="%"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#223451',
                            borderColor: '#334155',
                            color: '#F8FAFC',
                            borderRadius: '12px',
                            fontSize: '12px',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="baselineAdherencePct"
                          name="Current Routine %"
                          stroke="#2DD4BF"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="scenarioAdherencePct"
                          name="What-If Scenario %"
                          stroke="#8B5CF6"
                          strokeWidth={2.5}
                          dot={{ r: 2.5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Stock Chart + Alert Triggers */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Projected Medicine Supply Remaining</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={result.timeline}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#334155"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="dayLabel"
                        tick={{ fontSize: 11, fill: '#A8B8CC' }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: '#A8B8CC' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#223451',
                          borderColor: '#334155',
                          color: '#F8FAFC',
                          borderRadius: '12px',
                          fontSize: '12px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="baselineStock"
                        name="Current routine supply"
                        stroke="#2DD4BF"
                        fill="rgba(45, 212, 191, 0.16)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="scenarioStock"
                        name="What-if supply"
                        stroke="#8B5CF6"
                        fill="rgba(139, 92, 246, 0.22)"
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
                  <CardTitle>Caregiver Alert Conditions &amp; Refill Plan</CardTitle>
                  <CardDescription>
                    Plain-language trigger explanation (threshold: {effectiveScenario.alertMissThreshold} consecutive missed doses)
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
                        title: `Digital Twin alert (${result.triggeredAlertEvents[0].medicationName})`,
                        reason: result.triggeredAlertEvents[0].reason,
                        severity: 'attention',
                      })
                    }
                  >
                    <BellRing className="h-3.5 w-3.5" />
                    <span>Notify rule check</span>
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {result.triggeredAlertEvents.length === 0 ? (
                  <div className="flex items-center gap-2.5 rounded-xl border border-[#334155] bg-[#223451] p-4 text-xs text-[#F8FAFC]">
                    <CheckCircle2 className="h-4 w-4 text-[#34D399] shrink-0" />
                    <span>
                      No caregiver alert conditions would be triggered over this {effectiveScenario.horizonDays}-day simulation.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {result.triggeredAlertEvents.map((ev, idx) => (
                      <div
                        key={`${ev.date}-${ev.medicationName}-${idx}`}
                        className="flex items-start gap-2.5 rounded-xl border border-[#FBBF24]/35 bg-[#FBBF24]/10 p-3 text-xs"
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FBBF24]" />
                        <div>
                          <p className="font-semibold text-[#F8FAFC]">
                            {ev.medicationName} · {formatShortDate(ev.date)}
                          </p>
                          <p className="text-[#A8B8CC]">{ev.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {refillForecasts.some((r) => r.needsRefill) && (
                  <div className="space-y-2 border-t border-[#334155] pt-3">
                    <p className="text-xs font-semibold flex items-center gap-1.5 text-[#F8FAFC]">
                      <Package className="h-3.5 w-3.5 text-[#2DD4BF]" />
                      <span>Medicines needing refill soon</span>
                    </p>
                    {refillForecasts
                      .filter((r) => r.needsRefill)
                      .map((r) => (
                        <div key={r.medicationId} className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-[#A8B8CC]">
                            <strong className="text-[#F8FAFC]">
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
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4 text-[#2DD4BF]" />
                <span>Plain-Language Assumptions (Non-Diagnostic)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-[#A8B8CC]">
              <ul className="list-disc pl-5 space-y-1">
                {result.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
