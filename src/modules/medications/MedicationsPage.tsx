import React, { useMemo, useState } from 'react';
import {
  Check,
  PackagePlus,
  RotateCcw,
  SkipForward,
} from 'lucide-react';
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

  const patientMeds = useMemo(
    () =>
      state.medications.filter(
        (m) =>
          m.patientId === activePatient.id &&
          (statusFilter === 'all' || m.status === statusFilter),
      ),
    [activePatient.id, state.medications, statusFilter],
  );

  const refillMap = useMemo(() => {
    const forecasts = computeRefillForecasts(activePatient.id, state.medications);
    return new Map(forecasts.map((f) => [f.medicationId, f]));
  }, [activePatient.id, state.medications]);

  const scheduleDates = useMemo(() => {
    if (horizon === 'daily') return [todayStr];
    if (horizon === 'weekly') {
      return Array.from({ length: 7 }, (_, i) => addDaysIso(todayStr, -i));
    }
    return Array.from({ length: 30 }, (_, i) => addDaysIso(todayStr, -i));
  }, [horizon, todayStr]);

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
          <div className="inline-flex rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1 dark:border-[#334155] dark:bg-[#0B1220]">
            {(['all', 'active', 'completed', 'stopped'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors cursor-pointer',
                  statusFilter === st
                    ? 'bg-[#FFFFFF] text-[#172554] shadow-xs dark:bg-[#172033] dark:text-[#F8FAFC]'
                    : 'text-[#64748B] hover:text-[#172554] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]',
                )}
              >
                {st}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {patientMeds.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">
              No medications match this status filter.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {patientMeds.map((med) => {
                const forecast = refillMap.get(med.id);
                return (
                  <div
                    key={med.id}
                    className="flex flex-col justify-between rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-4 dark:border-[#334155] dark:bg-[#0B1220]/70"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-display text-base font-semibold text-[#172554] dark:text-[#F8FAFC]">
                            {med.name} {med.strength}
                          </h3>
                          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                            {med.doseAndRoute} · Prescriber: {med.prescriberName ?? 'On file'}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'text-xs font-semibold capitalize',
                            med.status === 'active' && 'text-[#0D9488] dark:text-[#14B8A6]',
                            med.status === 'completed' && 'text-[#3B82F6] dark:text-[#60A5FA]',
                            med.status === 'stopped' && 'text-[#64748B] dark:text-[#94A3B8]',
                          )}
                        >
                          {med.status}
                        </span>
                      </div>

                      <p className="text-sm text-[#172554]/85 dark:text-[#F8FAFC]/85">{med.instructions}</p>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E2E8F0] dark:border-[#334155] text-xs">
                        <div>
                          <span className="text-[#64748B] dark:text-[#94A3B8] block">Scheduled times</span>
                          <span className="font-mono text-[#172554] dark:text-[#F8FAFC] tabular-nums">
                            {med.asNeeded
                              ? 'As needed (PRN)'
                              : med.scheduledTimes.map(formatTime12h).join(', ')}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#64748B] dark:text-[#94A3B8] block">Start / End dates</span>
                          <span className="text-[#172554] dark:text-[#F8FAFC] tabular-nums">
                            {formatShortDate(med.startDate)} –{' '}
                            {med.endDate ? formatShortDate(med.endDate) : 'Ongoing'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#64748B] dark:text-[#94A3B8] block">Remaining quantity</span>
                          <span
                            className={cn(
                              'font-mono font-semibold tabular-nums',
                              forecast?.needsRefill
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-[#172554] dark:text-[#F8FAFC]',
                            )}
                          >
                            {typeof med.remainingQuantity === 'number'
                              ? `${med.remainingQuantity} ${med.unitLabel}`
                              : 'Not recorded'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#64748B] dark:text-[#94A3B8] block">Estimated refill date</span>
                          <span className="text-[#172554] dark:text-[#F8FAFC] tabular-nums">
                            {forecast?.estimatedRefillDate
                              ? formatShortDate(forecast.estimatedRefillDate)
                              : 'Not calculable'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#E2E8F0] dark:border-[#334155]">
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
          <div className="inline-flex rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1 dark:border-[#334155] dark:bg-[#0B1220]">
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
                    ? 'bg-[#FFFFFF] text-[#172554] shadow-xs dark:bg-[#172033] dark:text-[#F8FAFC]'
                    : 'text-[#64748B] hover:text-[#172554] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {scheduleDates.map((dateStr) => {
            const slots = buildDoseSlotsForDate(
              activePatient.id,
              dateStr,
              state.medications,
              state.doseLogs,
            );
            if (slots.length === 0) return null;

            return (
              <div key={dateStr} className="space-y-2 border-b border-[#E2E8F0] dark:border-[#334155] pb-4 last:border-0 last:pb-0">
                <h4 className="font-display text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                  {dateStr === todayStr ? `Today · ${formatShortDate(dateStr)}` : formatShortDate(dateStr)}
                </h4>
                <div className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
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
                        ? 'text-[#0D9488] dark:text-[#14B8A6]'
                        : slot.state === 'skipped'
                          ? 'text-amber-700 dark:text-amber-400'
                          : slot.state === 'overdue'
                            ? 'text-red-600 dark:text-red-400'
                            : slot.state === 'due'
                              ? 'text-[#3B82F6] dark:text-[#60A5FA]'
                              : 'text-[#64748B] dark:text-[#94A3B8]';

                    return (
                      <div
                        key={slot.slotKey}
                        className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-20 shrink-0 font-mono text-xs font-semibold text-[#172554] dark:text-[#F8FAFC] tabular-nums">
                            {formatTime12h(slot.scheduledTime)}
                          </span>
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-[#172554] dark:text-[#F8FAFC]">
                              {slot.medication.name} {slot.medication.strength}
                            </span>
                            <span aria-hidden="true" className="mx-2 text-[#E2E8F0] dark:text-[#334155]">
                              ·
                            </span>
                            <span className={cn('text-xs font-semibold', stateClass)}>
                              {stateText}
                            </span>
                            {slot.log?.skipReason && (
                              <span className="ml-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
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
          })}
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
              <label htmlFor="med-skip-reason" className="block text-xs font-medium text-[#172554] dark:text-[#F8FAFC] mb-1.5">
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
