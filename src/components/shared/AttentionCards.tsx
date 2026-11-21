import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Info } from 'lucide-react';
import { AttentionItem } from '@/src/types/medtwin';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';

export function AttentionCards({ items }: { items: AttentionItem[] }) {
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 dark:border-[#334155] dark:bg-[#172033]">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#0D9488] dark:text-[#14B8A6]" />
        <div>
          <p className="text-sm font-semibold text-[#172554] dark:text-[#F8FAFC]">
            No active attention items
          </p>
          <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
            Schedules, refill quantities, and caregiver alerts are up to date.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isUrgent = item.severity === 'red';
        return (
          <div
            key={item.id}
            className={cn(
              'rounded-2xl border bg-[#FFFFFF] p-4 transition-colors dark:bg-[#172033]',
              isUrgent
                ? 'border-red-200 dark:border-red-500/35'
                : 'border-amber-200 dark:border-amber-500/35',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                {isUrgent ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                ) : (
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={cn(
                        'font-semibold',
                        isUrgent
                          ? 'text-red-700 dark:text-red-400'
                          : 'text-amber-700 dark:text-amber-400',
                      )}
                    >
                      {item.label}
                    </span>
                    <span aria-hidden="true" className="text-[#E2E8F0] dark:text-[#334155]">
                      ·
                    </span>
                    <span className="text-[#64748B] dark:text-[#94A3B8]">{item.timePeriod}</span>
                  </div>
                  <h4 className="mt-1 text-sm font-semibold text-[#172554] dark:text-[#F8FAFC]">
                    {item.title}
                  </h4>
                </div>
              </div>
            </div>

            <p className="mt-2 text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
              {item.trigger}
            </p>

            {item.supportingRecords.length > 0 && (
              <ul className="mt-2.5 space-y-1 border-t border-[#E2E8F0] pt-2.5 text-xs text-[#64748B] dark:border-[#334155] dark:text-[#94A3B8]">
                {item.supportingRecords.map((rec, idx) => (
                  <li key={idx} className="truncate">
                    {rec}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate(item.nextActionRoute)}
              >
                <span>{item.nextActionLabel}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
