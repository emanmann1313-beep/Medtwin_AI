import {
  DigitalTwinDayPoint,
  DigitalTwinResult,
  DigitalTwinScenario,
  Medication,
} from '@/src/types/medtwin';
import { addDaysIso, formatShortDate } from '@/src/lib/utils';
import { getTodayIso } from '@/src/services/adherenceEngine';

export function runDigitalTwinSimulation(
  medications: Medication[],
  scenario: DigitalTwinScenario,
  now: Date = new Date(),
): DigitalTwinResult {
  const todayStr = getTodayIso(now);

  const candidateMeds = medications.filter(
    (m) =>
      m.status === 'active' &&
      !m.asNeeded &&
      m.scheduledTimes.length > 0 &&
      (scenario.selectedMedicationId === 'all' || m.id === scenario.selectedMedicationId),
  );

  const missingDataWarnings: string[] = [];
  for (const med of candidateMeds) {
    if (typeof med.remainingQuantity !== 'number') {
      missingDataWarnings.push(
        `${med.name} ${med.strength} has no recorded remaining quantity; assumed 0 tablets in stock for gap modeling.`,
      );
    }
  }

  const assumptions: string[] = [
    `Medication-management simulation over ${scenario.horizonDays} days starting ${formatShortDate(todayStr)}.`,
    'Baseline assumes all scheduled doses are taken on time and supply is refilled promptly when stock hits 0.',
    `Caregiver alert simulation triggers when consecutive missed/gap doses reach ${scenario.alertMissThreshold} or supply runs out.`,
    'As-needed (PRN) medicines are excluded from scheduled dose adherence denominators.',
  ];

  if (scenario.mode === 'refill-delay') {
    assumptions.push(
      `Scenario models a refill delay of ${scenario.refillDelayDays} day(s) after recorded stock reaches 0 before replenishment arrives.`,
    );
  } else if (scenario.mode === 'omitted-doses') {
    assumptions.push(
      `Scenario models ${scenario.omittedDatesCount} omitted dose day(s) starting from Day 2 of the window.`,
    );
  } else if (scenario.mode === 'replenish-supply') {
    assumptions.push(
      `Scenario models replenishing +${scenario.replenishQuantity} units on Day ${scenario.replenishOnDayOffset + 1} (${formatShortDate(addDaysIso(todayStr, scenario.replenishOnDayOffset))}).`,
    );
  }

  // Track per-med stock independently for baseline vs scenario
  const baselineStockByMed = new Map<string, number>();
  const scenarioStockByMed = new Map<string, number>();
  const delayRemainingByMed = new Map<string, number>();

  for (const med of candidateMeds) {
    const startQty = typeof med.remainingQuantity === 'number' ? med.remainingQuantity : 0;
    baselineStockByMed.set(med.id, startQty);
    scenarioStockByMed.set(med.id, startQty);
    delayRemainingByMed.set(med.id, 0);
  }

  let projectedScheduledDoses = 0;
  let baselineCoveredDoses = 0;
  let scenarioCoveredDoses = 0;
  let consecutiveMissedScenario = 0;

  const supplyGapDates: string[] = [];
  const triggeredAlertEvents: DigitalTwinResult['triggeredAlertEvents'] = [];
  const timeline: DigitalTwinDayPoint[] = [];

  for (let dayOffset = 0; dayOffset < scenario.horizonDays; dayOffset++) {
    const dateStr = addDaysIso(todayStr, dayOffset);
    const dObj = new Date(`${dateStr}T00:00:00`);
    const dayLabel = dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    let dayScheduled = 0;
    let dayBaselineCovered = 0;
    let dayScenarioCovered = 0;
    let dayGap = false;
    let dayTriggeredAlert = false;

    for (const med of candidateMeds) {
      if (med.endDate && dateStr > med.endDate) continue;
      const dosesPerDay = med.scheduledTimes.length;
      dayScheduled += dosesPerDay;

      // Baseline: auto-refills +30 when empty so baseline shows 100% covered target
      let bStock = baselineStockByMed.get(med.id) ?? 0;
      if (bStock < dosesPerDay) {
        bStock += 30;
      }
      bStock = Math.max(0, bStock - dosesPerDay);
      baselineStockByMed.set(med.id, bStock);
      dayBaselineCovered += dosesPerDay;

      // Scenario stock calculation
      let sStock = scenarioStockByMed.get(med.id) ?? 0;

      if (scenario.mode === 'replenish-supply' && dayOffset === scenario.replenishOnDayOffset) {
        sStock += scenario.replenishQuantity;
      }

      if (scenario.mode === 'omitted-doses' && dayOffset >= 1 && dayOffset < 1 + scenario.omittedDatesCount) {
        // Patient omits doses on these days; stock is not consumed, adherence drops
        consecutiveMissedScenario += dosesPerDay;
        if (consecutiveMissedScenario >= scenario.alertMissThreshold) {
          dayTriggeredAlert = true;
          triggeredAlertEvents.push({
            date: dateStr,
            medicationName: med.name,
            reason: `Simulated ${consecutiveMissedScenario} consecutive missed/omitted doses reached Care Circle threshold (${scenario.alertMissThreshold}).`,
          });
        }
      } else if (scenario.mode === 'baseline-all-taken') {
        if (sStock < dosesPerDay) {
          sStock += 30;
        }
        sStock = Math.max(0, sStock - dosesPerDay);
        dayScenarioCovered += dosesPerDay;
        consecutiveMissedScenario = 0;
      } else if (scenario.mode === 'replenish-supply') {
        if (sStock >= dosesPerDay) {
          sStock -= dosesPerDay;
          dayScenarioCovered += dosesPerDay;
          consecutiveMissedScenario = 0;
        } else {
          // Partial or zero stock before replenishment arrives
          const covered = Math.min(sStock, dosesPerDay);
          sStock = 0;
          dayScenarioCovered += covered;
          if (covered < dosesPerDay) {
            dayGap = true;
            consecutiveMissedScenario += dosesPerDay - covered;
            if (!supplyGapDates.includes(dateStr)) supplyGapDates.push(dateStr);
          }
        }
      } else if (scenario.mode === 'refill-delay') {
        let waitDays = delayRemainingByMed.get(med.id) ?? 0;
        if (sStock >= dosesPerDay) {
          sStock -= dosesPerDay;
          dayScenarioCovered += dosesPerDay;
          consecutiveMissedScenario = 0;
        } else {
          const covered = Math.min(sStock, dosesPerDay);
          sStock = 0;
          dayScenarioCovered += covered;
          if (covered < dosesPerDay) {
            dayGap = true;
            if (!supplyGapDates.includes(dateStr)) supplyGapDates.push(dateStr);
            consecutiveMissedScenario += dosesPerDay - covered;

            if (waitDays === 0) {
              waitDays = scenario.refillDelayDays;
              dayTriggeredAlert = true;
              triggeredAlertEvents.push({
                date: dateStr,
                medicationName: med.name,
                reason: `Stock depleted with a ${scenario.refillDelayDays}-day refill delay modeled.`,
              });
            }
            waitDays = Math.max(0, waitDays - 1);
            if (waitDays === 0 && scenario.refillDelayDays > 0) {
              // Refill arrives at end of delay window
              sStock += 30;
            }
            delayRemainingByMed.set(med.id, waitDays);
          }
        }
      }

      if (dayGap && consecutiveMissedScenario >= scenario.alertMissThreshold && !dayTriggeredAlert) {
        dayTriggeredAlert = true;
        triggeredAlertEvents.push({
          date: dateStr,
          medicationName: med.name,
          reason: `Supply gap caused ${consecutiveMissedScenario} missed dose(s), triggering caregiver alert.`,
        });
      }

      scenarioStockByMed.set(med.id, sStock);
    }

    projectedScheduledDoses += dayScheduled;
    baselineCoveredDoses += dayBaselineCovered;
    scenarioCoveredDoses += dayScenarioCovered;

    const totalBStock = Array.from(baselineStockByMed.values()).reduce((acc, v) => acc + v, 0);
    const totalSStock = Array.from(scenarioStockByMed.values()).reduce((acc, v) => acc + v, 0);

    timeline.push({
      dayLabel,
      date: dateStr,
      baselineAdherencePct:
        projectedScheduledDoses > 0
          ? Math.round((baselineCoveredDoses / projectedScheduledDoses) * 100)
          : 100,
      scenarioAdherencePct:
        projectedScheduledDoses > 0
          ? Math.round((scenarioCoveredDoses / projectedScheduledDoses) * 100)
          : 100,
      baselineStock: totalBStock,
      scenarioStock: totalSStock,
      isSupplyGap: dayGap,
      triggersAlert: dayTriggeredAlert,
    });
  }

  return {
    projectedScheduledDoses,
    baselineCoveredDoses,
    scenarioCoveredDoses,
    baselineProjectedStockEnd: Array.from(baselineStockByMed.values()).reduce((a, b) => a + b, 0),
    scenarioProjectedStockEnd: Array.from(scenarioStockByMed.values()).reduce((a, b) => a + b, 0),
    supplyGapDates,
    baselineAdherencePct:
      projectedScheduledDoses > 0
        ? Math.round((baselineCoveredDoses / projectedScheduledDoses) * 100)
        : 100,
    scenarioAdherencePct:
      projectedScheduledDoses > 0
        ? Math.round((scenarioCoveredDoses / projectedScheduledDoses) * 100)
        : 100,
    triggeredAlertEvents,
    assumptions,
    missingDataWarnings,
    timeline,
  };
}
