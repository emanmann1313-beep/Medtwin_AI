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
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#0D9488]" />
        <div>
          <p className="text-sm font-semibold text-slate-900">No active attention items</p>
          <p className="mt-0.5 text-xs text-slate-500">
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
              'rounded-2xl border bg-white p-4 transition-colors',
              isUrgent ? 'border-red-200' : 'border-amber-200',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                {isUrgent ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                ) : (
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={cn(
                        'font-semibold',
                        isUrgent ? 'text-red-700' : 'text-amber-700',
                      )}
                    >
                      {item.label}
                    </span>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span className="text-slate-500">{item.timePeriod}</span>
                  </div>
                  <h4 className="mt-1 text-sm font-semibold text-slate-900">{item.title}</h4>
                </div>
              </div>
            </div>

            <p className="mt-2 text-xs text-slate-600 leading-relaxed">{item.trigger}</p>

            {item.supportingRecords.length > 0 && (
              <ul className="mt-2.5 space-y-1 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
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
