import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Textarea } from '@/src/components/ui/input';
import { CaregiverConsentRecord } from '@/src/types/caregiverContracts';

interface RevokeDialogProps {
  open: boolean;
  consent: CaregiverConsentRecord | null;
  subjectLabel: string;
  onClose: () => void;
  onConfirmRevoke: (consentId: string, reason?: string) => void;
}

export function RevokeDialog({
  open,
  consent,
  subjectLabel,
  onClose,
  onConfirmRevoke,
}: RevokeDialogProps) {
  const [reason, setReason] = useState('');

  if (!consent) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmRevoke(consent.id, reason.trim() || undefined);
    setReason('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#142D4E]">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <span>Revoke Care Circle consent</span>
          </DialogTitle>
          <DialogDescription>
            Removing consent immediately hides medication schedules, Digital Twin supply insights,
            alert notifications, and care history for <strong>{subjectLabel}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 space-y-1">
            <p className="font-semibold">
              Access scopes being revoked ({consent.scopes.length}/4 active):
            </p>
            <p className="text-amber-800">
              {consent.scopes.length > 0
                ? consent.scopes.join(', ')
                : 'Invitation pending or minimal contact link'}
            </p>
          </div>

          <div>
            <label
              htmlFor="revoke-reason-note"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Optional note (for demo care log)
            </label>
            <Textarea
              id="revoke-reason-note"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Caregiver duties transitioned to another family member."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Keep consent active
            </Button>
            <Button type="submit" variant="danger">
              Confirm revoke
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
