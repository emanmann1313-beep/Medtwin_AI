import React, { useMemo, useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { CaregiverConnection, CaregiverPermissions } from '@/src/types/medtwin';
import { CaregiverConsentRecord, ConsentScope } from '@/src/types/caregiverContracts';
import { ConsentRow } from '@/src/modules/caregivers/components/ConsentRow';
import { RevokeDialog } from '@/src/modules/caregivers/components/RevokeDialog';
import { Input } from '@/src/components/ui/input';
import { cn } from '@/src/lib/utils';

type StatusFilter = 'all' | 'accepted' | 'invited' | 'revoked';

interface ConsentListProps {
  consents: CaregiverConsentRecord[];
  connectionsById: Record<string, CaregiverConnection>;
  perspective: 'patient' | 'caregiver';
  editable?: boolean;
  emptyMessage?: string;
  onAcceptInvite?: (consentId: string) => void;
  onRevokeConsent: (consentId: string, reason?: string) => void;
  onRestoreConsent?: (consentId: string) => void;
  onToggleScope?: (consentId: string, scope: ConsentScope, currentPerms: CaregiverPermissions) => void;
  onUpdateThreshold?: (consentId: string, threshold: number) => void;
}

export function ConsentList({
  consents,
  connectionsById,
  perspective,
  editable = false,
  emptyMessage = 'No matching Care Circle consent links.',
  onAcceptInvite,
  onRevokeConsent,
  onRestoreConsent,
  onToggleScope,
  onUpdateThreshold,
}: ConsentListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [revokeTarget, setRevokeTarget] = useState<CaregiverConsentRecord | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return consents.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.caregiver_name.toLowerCase().includes(q) ||
        c.patient_name.toLowerCase().includes(q) ||
        c.relationship.toLowerCase().includes(q)
      );
    });
  }, [consents, search, statusFilter]);

  const counts = useMemo(
    () => ({
      all: consents.length,
      accepted: consents.filter((c) => c.status === 'accepted').length,
      invited: consents.filter((c) => c.status === 'invited').length,
      revoked: consents.filter((c) => c.status === 'revoked').length,
    }),
    [consents],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter consents by status">
          {(['all', 'accepted', 'invited', 'revoked'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={cn(
                'rounded-xl px-3 py-1.5 text-xs font-medium capitalize transition-colors cursor-pointer',
                statusFilter === tab
                  ? 'bg-[#0D9488] text-white dark:bg-[#14B8A6] dark:text-[#0B1220]'
                  : 'border border-[#E2E8F0] bg-[#FFFFFF] text-[#64748B] hover:bg-[#F8FAFC] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#94A3B8] dark:hover:bg-[#1E293B]',
              )}
            >
              {tab} ({counts[tab]})
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B] dark:text-[#94A3B8]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name or relation..."
            className="h-9 pl-8 text-xs"
            aria-label="Filter consents"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-[#E2E8F0] bg-[#F8FAFC] py-10 px-4 text-center dark:border-[#334155] dark:bg-[#0B1220]">
          <ShieldCheck className="h-8 w-8 text-[#CBD5E1] dark:text-[#475569] mb-2" />
          <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((consent) => {
            const rawConn = connectionsById[consent.id];
            if (!rawConn) return null;
            return (
              <ConsentRow
                key={consent.id}
                consent={consent}
                permissions={rawConn.permissions}
                perspective={perspective}
                editable={editable}
                onAcceptInvite={onAcceptInvite}
                onRequestRevoke={(target) => setRevokeTarget(target)}
                onRestore={onRestoreConsent}
                onToggleScope={(id, scope) =>
                  onToggleScope?.(id, scope, rawConn.permissions)
                }
                onUpdateThreshold={onUpdateThreshold}
              />
            );
          })}
        </div>
      )}

      <RevokeDialog
        open={Boolean(revokeTarget)}
        consent={revokeTarget}
        subjectLabel={
          revokeTarget
            ? perspective === 'patient'
              ? revokeTarget.caregiver_name
              : revokeTarget.patient_name
            : ''
        }
        onClose={() => setRevokeTarget(null)}
        onConfirmRevoke={(id, reason) => onRevokeConsent(id, reason)}
      />
    </div>
  );
}
