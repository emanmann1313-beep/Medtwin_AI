import React from 'react';
import { Check, Clock, RotateCcw, UserX } from 'lucide-react';
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

  const isAwaitingPatientApproval =
    consent.status === 'invited' &&
    perspective === 'caregiver' &&
    consent.requested_by === 'caregiver';

  const canAcceptInvite =
    consent.status === 'invited' &&
    Boolean(onAcceptInvite) &&
    !isAwaitingPatientApproval;

  const statusTone =
    consent.status === 'accepted'
      ? 'text-[#24A99B] dark:text-[#2DD4BF]'
      : consent.status === 'invited'
        ? 'text-amber-700 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  const statusLabel = isAwaitingPatientApproval
    ? 'Pending patient approval'
    : consent.status === 'invited' && consent.requested_by === 'caregiver'
      ? 'Caregiver request'
      : consent.status;

  return (
    <div className="rounded-[20px] border border-[#E6E0D8] bg-[#FFFFFF] p-5 shadow-[0_4px_18px_rgba(32,36,58,0.04)] space-y-4 dark:border-[#2B314D] dark:bg-[#171B2E] dark:shadow-none">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold text-[#20243A] dark:text-[#F7F5F0]">{primaryTitle}</h4>
            <span className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">
              · {consent.relationship} · {consent.contact_priority} contact
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C627D] dark:text-[#A3A9C2]">
            <span>
              {consent.requested_by === 'caregiver' ? 'Requested' : 'Invited'}{' '}
              {formatShortDate(consent.invited_at)}
            </span>
            {consent.responded_at && (
              <>
                <span aria-hidden="true">·</span>
                <span>Updated {formatShortDate(consent.responded_at)}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className={cn('font-semibold capitalize', statusTone)}>
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isAwaitingPatientApproval && (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300">
              <Clock className="h-3.5 w-3.5" />
              <span>Awaiting patient approval</span>
            </span>
          )}
          {canAcceptInvite && (
            <Button
              type="button"
              size="sm"
              onClick={() => onAcceptInvite?.(consent.id)}
            >
              <Check className="h-3.5 w-3.5" />
              <span>
                {perspective === 'patient' ? 'Approve access' : 'Accept invite'}
              </span>
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
              <span>
                {isAwaitingPatientApproval
                  ? 'Cancel request'
                  : consent.status === 'invited' && perspective === 'caregiver'
                    ? 'Decline'
                    : 'Revoke'}
              </span>
            </Button>
          )}
          {consent.status === 'revoked' && onRestore && !(perspective === 'caregiver' && consent.requested_by === 'caregiver') && (
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
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#5C627D] dark:text-[#A3A9C2]">
          Consent scopes ({consent.scopes.length} of {CONSENT_SCOPE_LIST.length} granted)
        </span>
        <ScopeBadges scopes={consent.scopes} showInactive />
      </div>

      {/* Inline granular permission switches (when editable on patient Care Circle view) */}
      {editable && consent.status !== 'revoked' && (
        <div className="space-y-3 border-t border-[#E6E0D8] pt-3 dark:border-[#2B314D]">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {CONSENT_SCOPE_LIST.map((meta) => {
              const checked = Boolean(permissions[meta.permissionKey]);
              return (
                <label
                  key={meta.scope}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#E6E0D8] bg-[#FAF8F5] px-3 py-2 text-xs font-medium text-[#20243A] cursor-pointer dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]"
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
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5C627D] dark:text-[#A3A9C2] pt-1">
              <label className="flex items-center gap-2">
                <span>Repeated missed-dose alert threshold:</span>
                <select
                  value={consent.alert_threshold}
                  onChange={(e) => onUpdateThreshold(consent.id, Number(e.target.value))}
                  className="rounded-lg border border-[#E6E0D8] bg-[#FFFFFF] px-2.5 py-1 text-xs font-medium text-[#20243A] dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]"
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
