import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Package,
  PackagePlus,
} from 'lucide-react';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { computeRefillForecasts } from '@/src/services/adherenceEngine';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { cn, formatShortDate } from '@/src/lib/utils';

export function RefillsPage() {
  const { state, activePatient, replenishMedicationStock } = useMedTwin();
  const navigate = useNavigate();
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  const forecasts = useMemo(
    () =>
      computeRefillForecasts(activePatient.id, state.medications).sort((a, b) => {
        const da = a.daysRemaining ?? 999;
        const db = b.daysRemaining ?? 999;
        return da - db;
      }),
    [activePatient.id, state.medications],
  );

  const criticalCount = forecasts.filter(
    (f) => f.daysRemaining !== null && f.daysRemaining <= 2,
  ).length;
  const warningCount = forecasts.filter(
    (f) => f.daysRemaining !== null && f.daysRemaining > 2 && f.daysRemaining <= 7,
  ).length;
  const nominalCount = forecasts.filter(
    (f) => f.daysRemaining === null || f.daysRemaining > 7,
  ).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <Card>
        <CardContent className="pt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#0D9488] dark:text-[#14B8A6]">
              <Package className="h-4 w-4" />
              <span>Smart Refill Countdown · {activePatient.name}</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-[#172554] dark:text-[#F8FAFC]">
              Medication Refills &amp; Supply Readiness
            </h2>
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
              Calculated strictly from recorded remaining stock and daily scheduled doses. Critical threshold &le;2 days, warning &le;7 days.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => navigate('/digital-twin')}>
            <Activity className="h-4 w-4 text-[#0D9488] dark:text-[#14B8A6]" />
            <span>Model refill delay in Digital Twin</span>
          </Button>
        </CardContent>
      </Card>

      {/* Compact Summary Counts */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Critical (&le; 2 days left)</CardDescription>
            <CardTitle
              className={cn(
                'text-3xl font-bold tabular-nums',
                criticalCount > 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-[#172554] dark:text-[#F8FAFC]',
              )}
            >
              {criticalCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Immediate pharmacy pickup recommended
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Warning (&le; 7 days left)</CardDescription>
            <CardTitle
              className={cn(
                'text-3xl font-bold tabular-nums',
                warningCount > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-[#172554] dark:text-[#F8FAFC]',
              )}
            >
              {warningCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Schedule refill order this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Healthy Supply (&gt; 7 days / PRN)</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums text-[#0D9488] dark:text-[#14B8A6]">
              {nominalCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              No near-term depletion expected
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Refill Countdown List */}
      <Card>
        <CardHeader>
          <CardTitle>Active medication supply countdown</CardTitle>
          <CardDescription>
            Log pharmacy pickups to immediately update Digital Twin projections and Care Circle refill alerts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {forecasts.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">
              No active medications recorded for {activePatient.name}.
            </p>
          ) : (
            <div className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
              {forecasts.map((item) => {
                const isCritical = item.daysRemaining !== null && item.daysRemaining <= 2;
                const isWarning =
                  item.daysRemaining !== null &&
                  item.daysRemaining > 2 &&
                  item.daysRemaining <= 7;
                const customVal = customAmounts[item.medicationId] ?? '30';

                return (
                  <div
                    key={item.medicationId}
                    className="flex flex-col gap-4 py-4 first:pt-1 last:pb-1 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-[#172554] dark:text-[#F8FAFC]">
                          {item.medicationName} {item.strength}
                        </h4>
                        <span aria-hidden="true" className="text-[#CBD5E1] dark:text-[#334155]">
                          ·
                        </span>
                        {isCritical ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>Critical ({item.daysRemaining}d left)</span>
                          </span>
                        ) : isWarning ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>Warning ({item.daysRemaining}d left)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D9488] dark:text-[#14B8A6]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>
                              {item.daysRemaining !== null ? `${item.daysRemaining}d left` : 'As needed'}
                            </span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                        {item.remainingQuantity !== null
                          ? `${item.remainingQuantity} ${item.unitLabel} remaining`
                          : 'Remaining stock not recorded'}
                        {item.dailyUsage > 0 ? ` · ${item.dailyUsage} dose(s)/day` : ' · PRN'}
                        {item.estimatedRefillDate
                          ? ` · Est. runout ${formatShortDate(item.estimatedRefillDate)}`
                          : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        aria-label={`Refill quantity for ${item.medicationName}`}
                        value={customVal}
                        onChange={(e) =>
                          setCustomAmounts((prev) => ({
                            ...prev,
                            [item.medicationId]: e.target.value,
                          }))
                        }
                        className="w-20 h-9 text-xs tabular-nums"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const qty = Math.max(1, Number(customVal) || 30);
                          replenishMedicationStock(item.medicationId, qty);
                        }}
                      >
                        <PackagePlus className="h-3.5 w-3.5" />
                        <span>Add refill</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
