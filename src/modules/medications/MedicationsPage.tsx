import React, { useMemo, useState } from 'react';
import {
  Check,
  FileScan,
  PackagePlus,
  Pill,
  RotateCcw,
  SkipForward,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMedTwin } from '@/src/context/MedTwinContext';
import {
  buildDoseSlotsForDate,
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
import { addDaysIso, cn, formatShortDate, formatTime12h } from '@/src/lib/utils';

type ScheduleHorizon = 'daily' | 'weekly' | 'monthly';

export function MedicationsPage() {
  const {
    state,
    hasPatients,
    activeRole,
    activePatient,
    logDose,
    undoDose,
    updateMedicationStatus,
    replenishMedicationStock,
  } = useMedTwin();

  const [horizon, setHorizon] = useState<ScheduleHorizon>('daily');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'stopped'>('all');
  const [skipTarget, setSkipTarget] = useState<{
    medicationId: string;
    medicationName: string;
    scheduledDate: string;
    scheduledTime: string;
  } | null>(null);
  const [skipReason, setSkipReason] = useState('');

  const todayStr = getTodayIso();

  const patientMeds = useMemo(() => {
    if (!hasPatients || !activePatient.id) return [];
    return state.medications.filter(
      (m) =>
        m.patientId === activePatient.id &&
        (statusFilter === 'all' || m.status === statusFilter),
    );
  }, [activePatient.id, hasPatients, state.medications, statusFilter]);

  const refillMap = useMemo(() => {
    if (!hasPatients || !activePatient.id) return new Map();
    const forecasts = computeRefillForecasts(activePatient.id, state.medications);
    return new Map(forecasts.map((f) => [f.medicationId, f]));
  }, [activePatient.id, hasPatients, state.medications]);

  const scheduleDates = useMemo(() => {
    if (horizon === 'daily') return [todayStr];
    if (horizon === 'weekly') {
      return Array.from({ length: 7 }, (_, i) => addDaysIso(todayStr, -i));
    }
    return Array.from({ length: 30 }, (_, i) => addDaysIso(todayStr, -i));
  }, [horizon, todayStr]);

  if (!hasPatients || !activePatient.id) {
    return (
      <Card>
        <CardContent className="py-12 px-6 text-center space-y-3">
          <Pill className="mx-auto h-9 w-9 text-[#7956C8] dark:text-[#A58AE8]" />
          <h3 className="font-display text-lg font-semibold text-[#20243A] dark:text-[#F7F5F0]">
            No patient schedules available yet
          </h3>
          <p className="mx-auto max-w-md text-xs text-[#5C627D] dark:text-[#A3A9C2]">
            {activeRole === 'caregiver'
              ? 'Medication schedules appear here once a patient approves your Care Circle request with schedule permissions.'
              : 'Add or scan a prescription to build your active medication schedule.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Medicine Cards Grid */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Medications for {activePatient.name}</CardTitle>
            <CardDescription>
              Confirmed schedules, start/end dates, recorded remaining supply, and refill forecasts
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeRole === 'patient' && (
              <Link to="/prescriptions">
                <Button type="button" size="sm" variant="outline">
                  <FileScan className="h-3.5 w-3.5" />
                  <span>Scan prescription</span>
                </Button>
              </Link>
            )}
            <div className="inline-flex rounded-xl border border-[#E6E0D8] bg-[#FAF8F5] p-1 dark:border-[#2B314D] dark:bg-[#101322]">
              {(['all', 'active', 'completed', 'stopped'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors cursor-pointer',
                    statusFilter === st
                      ? 'bg-[#FFFFFF] text-[#20243A] shadow-xs dark:bg-[#171B2E] dark:text-[#F7F5F0]'
                      : 'text-[#5C627D] hover:text-[#20243A] dark:text-[#A3A9C2] dark:hover:text-[#F7F5F0]',
                  )}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {patientMeds.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm text-[#5C627D] dark:text-[#A3A9C2]">
                No medications recorded matching this filter.
              </p>
              {activeRole === 'patient' && (
                <Link to="/prescriptions">
                  <Button type="button" size="sm">
                    <FileScan className="h-4 w-4" />
                    <span>Add or scan your first prescription</span>
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {patientMeds.map((med) => {
                const forecast = refillMap.get(med.id);
                return (
                  <div
                    key={med.id}
                    className="flex flex-col justify-between rounded-2xl border border-[#E6E0D8] bg-[#FFFFFF] p-5 space-y-4 dark:border-[#2B314D] dark:bg-[#101322]/70"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-display text-base font-semibold text-[#20243A] dark:text-[#F7F5F0]">
                            {med.name} {med.strength}
                          </h3>
                          <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">
                            {med.doseAndRoute} · Prescriber: {med.prescriberName ?? 'On file'}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'text-xs font-semibold capitalize',
                            med.status === 'active' && 'text-[#24A99B] dark:text-[#2DD4BF]',
                            med.status === 'completed' && 'text-[#7956C8] dark:text-[#A58AE8]',
                            med.status === 'stopped' && 'text-[#5C627D] dark:text-[#A3A9C2]',
                          )}
                        >
                          {med.status}
                        </span>
                      </div>

                      <p className="text-sm text-[#20243A]/85 dark:text-[#F7F5F0]/85">{med.instructions}</p>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E6E0D8] dark:border-[#2B314D] text-xs">
                        <div>
                          <span className="text-[#5C627D] dark:text-[#A3A9C2] block">Scheduled times</span>
                          <span className="font-mono text-[#20243A] dark:text-[#F7F5F0] tabular-nums">
                            {med.asNeeded
                              ? 'As needed (PRN)'
                              : med.scheduledTimes.map(formatTime12h).join(', ')}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#5C627D] dark:text-[#A3A9C2] block">Start / End dates</span>
                          <span className="text-[#20243A] dark:text-[#F7F5F0] tabular-nums">
                            {formatShortDate(med.startDate)} –{' '}
                            {med.endDate ? formatShortDate(med.endDate) : 'Ongoing'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#5C627D] dark:text-[#A3A9C2] block">Remaining quantity</span>
                          <span
                            className={cn(
                              'font-mono font-semibold tabular-nums',
                              forecast?.needsRefill
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-[#20243A] dark:text-[#F7F5F0]',
                            )}
                          >
                            {typeof med.remainingQuantity === 'number'
                              ? `${med.remainingQuantity} ${med.unitLabel}`
                              : 'Not recorded'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#5C627D] dark:text-[#A3A9C2] block">Estimated refill date</span>
                          <span className="text-[#20243A] dark:text-[#F7F5F0] tabular-nums">
                            {forecast?.estimatedRefillDate
                              ? formatShortDate(forecast.estimatedRefillDate)
                              : 'Not calculable'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#E6E0D8] dark:border-[#2B314D]">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => replenishMedicationStock(med.id, 30)}
                      >
                        <PackagePlus className="h-3.5 w-3.5" />
                        <span>Add refill (+30)</span>
                      </Button>

                      <div className="flex items-center gap-1.5">
                        {med.status === 'active' ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => updateMedicationStatus(med.id, 'completed')}
                            >
                              Mark completed
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => updateMedicationStatus(med.id, 'stopped')}
                            >
                              Stop
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => updateMedicationStatus(med.id, 'active')}
                          >
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily / Weekly / Monthly Dose Schedule Views */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Dose schedule &amp; confirmation log</CardTitle>
            <CardDescription>
              Daily, weekly, and monthly records distinguishing taken, skipped, due, scheduled, and overdue/unconfirmed doses
            </CardDescription>
          </div>
          <div className="inline-flex rounded-xl border border-[#E6E0D8] bg-[#FAF8F5] p-1 dark:border-[#2B314D] dark:bg-[#101322]">
            {(
              [
                { id: 'daily', label: 'Daily' },
                { id: 'weekly', label: 'Weekly (7d)' },
                { id: 'monthly', label: 'Monthly (30d)' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setHorizon(tab.id)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                  horizon === tab.id
                    ? 'bg-[#FFFFFF] text-[#20243A] shadow-xs dark:bg-[#171B2E] dark:text-[#F7F5F0]'
                    : 'text-[#5C627D] hover:text-[#20243A] dark:text-[#A3A9C2] dark:hover:text-[#F7F5F0]',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {scheduleDates.every(
            (dateStr) =>
              buildDoseSlotsForDate(activePatient.id, dateStr, state.medications, state.doseLogs)
                .length === 0,
          ) ? (
            <p className="py-6 text-center text-xs text-[#5C627D] dark:text-[#A3A9C2]">
              No scheduled dose slots during this period.
            </p>
          ) : (
            scheduleDates.map((dateStr) => {
              const slots = buildDoseSlotsForDate(
                activePatient.id,
                dateStr,
                state.medications,
                state.doseLogs,
              );
              if (slots.length === 0) return null;

              return (
                <div key={dateStr} className="space-y-2 border-b border-[#E6E0D8] dark:border-[#2B314D] pb-4 last:border-0 last:pb-0">
                  <h4 className="font-display text-xs font-semibold text-[#5C627D] dark:text-[#A3A9C2]">
                    {dateStr === todayStr ? `Today · ${formatShortDate(dateStr)}` : formatShortDate(dateStr)}
                  </h4>
                  <div className="divide-y divide-[#E6E0D8] dark:divide-[#2B314D]">
                    {slots.map((slot) => {
                      const stateText =
                        slot.state === 'taken'
                          ? 'Taken'
                          : slot.state === 'skipped'
                            ? 'Skipped'
                            : slot.state === 'overdue'
                              ? 'Overdue / Unconfirmed'
                              : slot.state === 'due'
                                ? 'Due'
                                : 'Scheduled';
                      const stateClass =
                        slot.state === 'taken'
                          ? 'text-[#24A99B] dark:text-[#2DD4BF]'
                          : slot.state === 'skipped'
                            ? 'text-amber-700 dark:text-amber-400'
                            : slot.state === 'overdue'
                              ? 'text-red-600 dark:text-red-400'
                              : slot.state === 'due'
                                ? 'text-[#7956C8] dark:text-[#A58AE8]'
                                : 'text-[#5C627D] dark:text-[#A3A9C2]';

                      return (
                        <div
                          key={slot.slotKey}
                          className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-20 shrink-0 font-mono text-xs font-semibold text-[#20243A] dark:text-[#F7F5F0] tabular-nums">
                              {formatTime12h(slot.scheduledTime)}
                            </span>
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-[#20243A] dark:text-[#F7F5F0]">
                                {slot.medication.name} {slot.medication.strength}
                              </span>
                              <span aria-hidden="true" className="mx-2 text-[#E6E0D8] dark:text-[#2B314D]">
                                ·
                              </span>
                              <span className={cn('text-xs font-semibold', stateClass)}>
                                {stateText}
                              </span>
                              {slot.log?.skipReason && (
                                <span className="ml-2 text-xs text-[#5C627D] dark:text-[#A3A9C2]">
                                  ({slot.log.skipReason})
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
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
                                  <span>Taken</span>
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSkipReason('');
                                    setSkipTarget({
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
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(skipTarget)} onOpenChange={(open) => !open && setSkipTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record skipped dose</DialogTitle>
            <DialogDescription>
              {skipTarget?.medicationName} · {skipTarget ? formatShortDate(skipTarget.scheduledDate) : ''} at{' '}
              {skipTarget ? formatTime12h(skipTarget.scheduledTime) : ''}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!skipTarget) return;
              logDose({
                patientId: activePatient.id,
                medicationId: skipTarget.medicationId,
                scheduledDate: skipTarget.scheduledDate,
                scheduledTime: skipTarget.scheduledTime,
                status: 'skipped',
                skipReason,
              });
              setSkipTarget(null);
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="med-skip-reason" className="block text-xs font-medium text-[#20243A] dark:text-[#F7F5F0] mb-1.5">
                Optional reason
              </label>
              <Input
                id="med-skip-reason"
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder="e.g., Missed meal, side effect, away from home"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSkipTarget(null)}>
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
