import React from 'react';
import { Bell, CalendarClock, FileText, Lock, ShieldCheck, Stethoscope } from 'lucide-react';
import { CONSENT_SCOPE_LIST, ConsentScope } from '@/src/types/caregiverContracts';
import { cn } from '@/src/lib/utils';

const SCOPE_ICONS: Record<ConsentScope, React.ComponentType<{ className?: string }>> = {
  view_schedules: CalendarClock,
  receive_dose_alerts: Bell,
  view_history_reports: FileText,
  view_clinician_notes: Stethoscope,
};

interface ScopeBadgesProps {
  scopes: ConsentScope[];
  interactive?: boolean;
  onToggle?: (scope: ConsentScope) => void;
  showInactive?: boolean;
  compact?: boolean;
}

export function ScopeBadges({
  scopes,
  interactive = false,
  onToggle,
  showInactive = true,
  compact = false,
}: ScopeBadgesProps) {
  const activeSet = new Set(scopes);
  const items = showInactive
    ? CONSENT_SCOPE_LIST
    : CONSENT_SCOPE_LIST.filter((m) => activeSet.has(m.scope));

  if (items.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[#A8B8CC]">
        <Lock className="h-3.5 w-3.5 text-[#A8B8CC]" />
        <span>Minimal contact only (no health record scopes granted)</span>
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((meta) => {
        const granted = activeSet.has(meta.scope);
        const Icon = SCOPE_ICONS[meta.scope];
        const baseClasses = cn(
          'inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-medium transition-colors',
          granted
            ? 'border-[#2DD4BF]/40 bg-[#2DD4BF]/15 text-[#2DD4BF]'
            : 'border-[#334155] bg-[#0B1220]/80 text-[#A8B8CC]',
          compact && 'px-2 py-0.5 text-[11px]',
        );

        if (interactive && onToggle) {
          return (
            <button
              key={meta.scope}
              type="button"
              onClick={() => onToggle(meta.scope)}
              aria-pressed={granted}
              title={meta.description}
              className={cn(
                baseClasses,
                'cursor-pointer hover:border-[#2DD4BF]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF]',
              )}
            >
              {granted ? (
                <ShieldCheck className="h-3.5 w-3.5 text-[#2DD4BF] shrink-0" />
              ) : (
                <Icon className="h-3.5 w-3.5 text-[#A8B8CC] shrink-0" />
              )}
              <span>{meta.shortLabel}</span>
            </button>
          );
        }

        return (
          <span key={meta.scope} className={baseClasses} title={meta.description}>
            {granted ? (
              <Icon className="h-3.5 w-3.5 text-[#2DD4BF] shrink-0" />
            ) : (
              <Lock className="h-3 w-3 text-[#A8B8CC] shrink-0" />
            )}
            <span>{meta.shortLabel}</span>
          </span>
        );
      })}
    </div>
  );
}
