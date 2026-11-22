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
      <div className="flex items-start gap-3 rounded-2xl border border-[#334155] bg-[#1A2740] p-5 shadow-[0_12px_30px_rgba(2,6,23,0.45)]">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#34D399]" />
        <div>
          <p className="text-sm font-semibold text-[#F8FAFC]">
            No active attention items
          </p>
          <p className="mt-0.5 text-xs text-[#A8B8CC]">
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
              'rounded-2xl border bg-[#1A2740] p-4 transition-colors shadow-[0_10px_28px_rgba(2,6,23,0.4)]',
              isUrgent
                ? 'border-[#FB7185]/45 shadow-[0_0_24px_rgba(251,113,133,0.12)]'
                : 'border-[#FBBF24]/40 shadow-[0_0_24px_rgba(251,191,36,0.08)]',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                {isUrgent ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FB7185]" />
                ) : (
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#FBBF24]" />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={cn(
                        'font-semibold',
                        isUrgent ? 'text-[#FB7185]' : 'text-[#FBBF24]',
                      )}
                    >
                      {item.label}
                    </span>
                    <span aria-hidden="true" className="text-[#334155]">
                      ·
                    </span>
                    <span className="text-[#A8B8CC]">{item.timePeriod}</span>
                  </div>
                  <h4 className="mt-1 text-sm font-semibold text-[#F8FAFC]">
                    {item.title}
                  </h4>
                </div>
              </div>
            </div>

            <p className="mt-2 text-xs text-[#A8B8CC] leading-relaxed">
              {item.trigger}
            </p>

            {item.supportingRecords.length > 0 && (
              <ul className="mt-2.5 space-y-1 border-t border-[#334155] pt-2.5 text-xs text-[#A8B8CC]">
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
