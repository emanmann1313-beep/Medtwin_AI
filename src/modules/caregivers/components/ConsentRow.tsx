import React from 'react';
import { Check, RotateCcw, UserX } from 'lucide-react';
import { CaregiverPermissions } from '@/src/types/medtwin';
import { CONSENT_SCOPE_LIST, CaregiverConsentRecord, ConsentScope } from '@/src/types/caregiverContracts';
import { ScopeBadges } from '@/src/modules/caregivers/components/ScopeBadges';
import { Button } from '@/src/components/ui/button';
import { Switch } from '@/src/components/ui/switch';
import { cn, formatShortDate } from '@/src/lib/utils';

interface ConsentRowProps {
  consent: CaregiverConsentRecord;
  permissions: CaregiverPermissions;
  perspective: 'patient' | 'caregiver';
  editable?: boolean;
  onAcceptInvite?: (consentId: string) => void;
  onRequestRevoke?: (consent: CaregiverConsentRecord) => void;
  onRestore?: (consentId: string) => void;
  onToggleScope?: (consentId: string, scope: ConsentScope) => void;
  onUpdateThreshold?: (consentId: string, threshold: number) => void;
}

export function ConsentRow({
  consent,
  permissions,
  perspective,
  editable = false,
  onAcceptInvite,
  onRequestRevoke,
  onRestore,
  onToggleScope,
  onUpdateThreshold,
}: ConsentRowProps) {
  const primaryTitle =
    perspective === 'patient' ? consent.caregiver_name : consent.patient_name;

  const statusTone =
    consent.status === 'accepted'
      ? 'text-[#0D9488] dark:text-[#14B8A6]'
      : consent.status === 'invited'
        ? 'text-amber-700 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  return (
    <div className="rounded-[20px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-[0_4px_18px_rgba(23,37,84,0.04)] space-y-4 dark:border-[#334155] dark:bg-[#172033] dark:shadow-none">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold text-[#172554] dark:text-[#F8FAFC]">{primaryTitle}</h4>
            <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              · {consent.relationship} · {consent.contact_priority} contact
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
            <span>
              Invited {formatShortDate(consent.invited_at)}
            </span>
            {consent.responded_at && (
              <>
                <span aria-hidden="true">·</span>
                <span>Updated {formatShortDate(consent.responded_at)}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className={cn('font-semibold capitalize', statusTone)}>
              {consent.status}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {consent.status === 'invited' && onAcceptInvite && (
            <Button
              type="button"
              size="sm"
              onClick={() => onAcceptInvite(consent.id)}
            >
              <Check className="h-3.5 w-3.5" />
              <span>{perspective === 'patient' ? 'Simulate accept' : 'Accept invite'}</span>
            </Button>
          )}
          {consent.status !== 'revoked' && onRequestRevoke && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onRequestRevoke(consent)}
            >
              <UserX className="h-3.5 w-3.5" />
              <span>{consent.status === 'invited' && perspective === 'caregiver' ? 'Decline' : 'Revoke'}</span>
            </Button>
          )}
          {consent.status === 'revoked' && onRestore && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onRestore(consent.id)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Restore consent</span>
            </Button>
          )}
        </div>
      </div>

      {/* Scope summary badges */}
      <div className="space-y-2">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
          Consent scopes ({consent.scopes.length} of {CONSENT_SCOPE_LIST.length} granted)
        </span>
        <ScopeBadges scopes={consent.scopes} showInactive />
      </div>

      {/* Inline granular permission switches (when editable on patient Care Circle view) */}
      {editable && consent.status !== 'revoked' && (
        <div className="space-y-3 border-t border-[#E2E8F0] pt-3 dark:border-[#334155]">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {CONSENT_SCOPE_LIST.map((meta) => {
              const checked = Boolean(permissions[meta.permissionKey]);
              return (
                <label
                  key={meta.scope}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs font-medium text-[#172554] cursor-pointer dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC]"
                >
                  <span className="truncate" title={meta.description}>
                    {meta.label}
                  </span>
                  <Switch
                    checked={checked}
                    onCheckedChange={() => onToggleScope?.(consent.id, meta.scope)}
                  />
                </label>
              );
            })}
          </div>

          {onUpdateThreshold && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B] dark:text-[#94A3B8] pt-1">
              <label className="flex items-center gap-2">
                <span>Repeated missed-dose alert threshold:</span>
                <select
                  value={consent.alert_threshold}
                  onChange={(e) => onUpdateThreshold(consent.id, Number(e.target.value))}
                  className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1 text-xs font-medium text-[#172554] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC]"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} missed dose{n > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
