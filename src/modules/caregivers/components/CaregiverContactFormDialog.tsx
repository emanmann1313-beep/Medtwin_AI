import React, { useEffect, useState } from 'react';
import { Eye, Send, ShieldCheck } from 'lucide-react';
import {
  CaregiverAlertPreferences,
  CaregiverConnection,
  CaregiverLanguage,
  CaregiverProfile,
  RelationshipLabel,
} from '@/src/types/medtwin';
import {
  ALERT_RULE_DEFINITIONS,
  CAREGIVER_LANGUAGE_OPTIONS,
  CAREGIVER_RELATIONSHIP_OPTIONS,
  COUNTRY_CODE_OPTIONS,
  getNormalizedAlertPreferences,
  resolveContactPhones,
  validateCaregiverPhone,
} from '@/src/services/caregiverMessaging';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Switch } from '@/src/components/ui/switch';

export interface CaregiverContactFormPayload {
  connectionId?: string;
  caregiverName: string;
  relationship: RelationshipLabel;
  phoneCountryCode: string;
  phoneNumber: string;
  whatsappSameAsPhone: boolean;
  whatsappNumber: string;
  caregiverEmail?: string;
  preferredLanguage: CaregiverLanguage;
  contactPriority: 'primary' | 'secondary';
  alertPreferences: Required<CaregiverAlertPreferences>;
}

interface CaregiverContactFormDialogProps {
  open: boolean;
  patientName: string;
  editingConnection?: CaregiverConnection | null;
  editingProfile?: CaregiverProfile;
  onClose: () => void;
  onSubmit: (payload: CaregiverContactFormPayload) => void;
  onPreviewInvitation?: (payload: CaregiverContactFormPayload) => void;
}

export function CaregiverContactFormDialog({
  open,
  patientName,
  editingConnection,
  editingProfile,
  onClose,
  onSubmit,
  onPreviewInvitation,
}: CaregiverContactFormDialogProps) {
  const isEditing = Boolean(editingConnection);

  const [fullName, setFullName] = useState('');
  const [relationship, setRelationship] = useState<RelationshipLabel>('Daughter');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+1');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [email, setEmail] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<CaregiverLanguage>('en');
  const [contactPriority, setContactPriority] = useState<'primary' | 'secondary'>('primary');
  const [alertPreferences, setAlertPreferences] = useState<Required<CaregiverAlertPreferences>>(
    () => getNormalizedAlertPreferences(),
  );
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (editingConnection) {
      const resolved = resolveContactPhones(editingConnection, editingProfile);
      setFullName(editingConnection.caregiverName || '');
      setRelationship(
        CAREGIVER_RELATIONSHIP_OPTIONS.includes(editingConnection.relationship)
          ? editingConnection.relationship
          : editingConnection.relationship || 'Other',
      );
      setPhoneCountryCode(resolved.phoneCountryCode);
      setPhoneNumber(resolved.phoneNumber);
      setWhatsappSameAsPhone(editingConnection.whatsappSameAsPhone ?? true);
      setWhatsappNumber(resolved.whatsappNumber);
      setEmail(editingConnection.caregiverEmail || editingProfile?.email || '');
      setPreferredLanguage(editingConnection.preferredLanguage || resolved.preferredLanguage || 'en');
      setContactPriority(editingConnection.contactPriority || 'secondary');
      setAlertPreferences(getNormalizedAlertPreferences(editingConnection.alertPreferences));
    } else {
      setFullName('');
      setRelationship('Daughter');
      setPhoneCountryCode('+1');
      setPhoneNumber('');
      setWhatsappSameAsPhone(true);
      setWhatsappNumber('');
      setEmail('');
      setPreferredLanguage('en');
      setContactPriority('primary');
      setAlertPreferences(getNormalizedAlertPreferences());
    }
  }, [editingConnection, editingProfile, open]);

  const validateAndBuildPayload = (): CaregiverContactFormPayload | null => {
    if (!fullName.trim()) {
      setFormError('Caregiver full name is required.');
      return null;
    }

    const phoneValidation = validateCaregiverPhone(phoneCountryCode, phoneNumber);
    if (!phoneValidation.valid) {
      setFormError(phoneValidation.error || 'Please enter a valid phone number.');
      return null;
    }

    if (!whatsappSameAsPhone) {
      const waValidation = validateCaregiverPhone(phoneCountryCode, whatsappNumber);
      if (!waValidation.valid) {
        setFormError('Enter a valid WhatsApp number or check "Same as phone".');
        return null;
      }
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError('Please enter a valid email address or leave email blank.');
      return null;
    }

    setFormError(null);
    return {
      connectionId: editingConnection?.id,
      caregiverName: fullName.trim(),
      relationship,
      phoneCountryCode,
      phoneNumber: phoneNumber.trim(),
      whatsappSameAsPhone,
      whatsappNumber: whatsappSameAsPhone ? phoneNumber.trim() : whatsappNumber.trim(),
      caregiverEmail: email.trim() || undefined,
      preferredLanguage,
      contactPriority,
      alertPreferences: {
        ...alertPreferences,
        notifyOnRefillNeeded:
          alertPreferences.supplyRunningLow || alertPreferences.upcomingRefillDate,
        notifyOnDadiNaniShare: alertPreferences.patientRequestedAssistance,
      },
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = validateAndBuildPayload();
    if (!payload) return;
    onSubmit(payload);
    onClose();
  };

  const handlePreviewInvitationClick = () => {
    const payload = validateAndBuildPayload();
    if (!payload || !onPreviewInvitation) return;
    onPreviewInvitation(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#F8FAFC]">
            {isEditing ? `Edit Caregiver — ${editingConnection?.caregiverName}` : 'Add Caregiver Contact'}
          </DialogTitle>
          <DialogDescription>
            Connect a trusted caregiver for <strong>{patientName}</strong>. Health details stay protected until explicit patient consent and caregiver acceptance are confirmed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-[#FB7185]/45 bg-[#FB7185]/12 px-3.5 py-2.5 text-xs font-medium text-[#FB7185]"
            >
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label
                htmlFor="cg-fullname"
                className="block text-xs font-semibold text-[#F8FAFC] mb-1"
              >
                Caregiver full name *
              </label>
              <Input
                id="cg-fullname"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g., Priya Sharma"
                required
              />
            </div>

            <div>
              <label
                htmlFor="cg-relationship"
                className="block text-xs font-semibold text-[#F8FAFC] mb-1"
              >
                Relationship *
              </label>
              <select
                id="cg-relationship"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value as RelationshipLabel)}
                className="h-10 w-full rounded-xl border border-[#334155] bg-[#0B1220] px-3 text-xs text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
              >
                {CAREGIVER_RELATIONSHIP_OPTIONS.map((rel) => (
                  <option key={rel} value={rel}>
                    {rel}
                  </option>
                ))}
                {!CAREGIVER_RELATIONSHIP_OPTIONS.includes(relationship) && (
                  <option value={relationship}>{relationship}</option>
                )}
              </select>
            </div>

            <div>
              <label
                htmlFor="cg-language"
                className="block text-xs font-semibold text-[#F8FAFC] mb-1"
              >
                Preferred language *
              </label>
              <select
                id="cg-language"
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value as CaregiverLanguage)}
                className="h-10 w-full rounded-xl border border-[#334155] bg-[#0B1220] px-3 text-xs text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
              >
                {CAREGIVER_LANGUAGE_OPTIONS.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.label} ({lang.nativeLabel})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Phone number with country code */}
          <div className="space-y-2.5 rounded-2xl border border-[#334155] bg-[#223451] p-3.5">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
              <div className="sm:col-span-5">
                <label
                  htmlFor="cg-country-code"
                  className="block text-xs font-semibold text-[#F8FAFC] mb-1"
                >
                  Country code *
                </label>
                <select
                  id="cg-country-code"
                  value={phoneCountryCode}
                  onChange={(e) => setPhoneCountryCode(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[#334155] bg-[#0B1220] px-3 text-xs text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                >
                  {COUNTRY_CODE_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-7">
                <label
                  htmlFor="cg-phone-number"
                  className="block text-xs font-semibold text-[#F8FAFC] mb-1"
                >
                  Phone number *
                </label>
                <Input
                  id="cg-phone-number"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g., 555-019-2834"
                  required
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-[#F8FAFC] cursor-pointer pt-0.5">
              <input
                type="checkbox"
                checked={whatsappSameAsPhone}
                onChange={(e) => setWhatsappSameAsPhone(e.target.checked)}
                className="accent-[#2DD4BF] h-4 w-4"
              />
              <span>WhatsApp number is the same as phone number</span>
            </label>

            {!whatsappSameAsPhone && (
              <div>
                <label
                  htmlFor="cg-whatsapp-number"
                  className="block text-xs font-semibold text-[#F8FAFC] mb-1"
                >
                  WhatsApp number ({phoneCountryCode})
                </label>
                <Input
                  id="cg-whatsapp-number"
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="e.g., 555-019-9900"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="cg-email"
                className="block text-xs font-semibold text-[#F8FAFC] mb-1"
              >
                Email address (optional)
              </label>
              <Input
                id="cg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="priya@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="cg-priority"
                className="block text-xs font-semibold text-[#F8FAFC] mb-1"
              >
                Contact priority
              </label>
              <select
                id="cg-priority"
                value={contactPriority}
                onChange={(e) => setContactPriority(e.target.value as 'primary' | 'secondary')}
                className="h-10 w-full rounded-xl border border-[#334155] bg-[#0B1220] px-3 text-xs text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
              >
                <option value="primary">Primary caregiver</option>
                <option value="secondary">Secondary caregiver</option>
              </select>
            </div>
          </div>

          {/* 5 Configurable Alert Preferences */}
          <div className="space-y-2.5 rounded-2xl border border-[#334155] bg-[#223451] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#F8FAFC]">
                Alert Preferences
              </span>
              <span className="text-[11px] text-[#A8B8CC]">
                Consent required for health details
              </span>
            </div>

            <div className="divide-y divide-[#334155]">
              {ALERT_RULE_DEFINITIONS.map((rule) => {
                const enabled = Boolean(alertPreferences[rule.key]);
                return (
                  <label
                    key={rule.key}
                    className="flex items-center justify-between gap-3 py-2 first:pt-0.5 last:pb-0.5 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <span className="block text-xs font-medium text-[#F8FAFC]">
                        {rule.label}
                      </span>
                      <span className="block text-[11px] text-[#A8B8CC]">
                        {rule.description}
                      </span>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked) =>
                        setAlertPreferences((prev) => ({
                          ...prev,
                          [rule.key]: checked,
                        }))
                      }
                      aria-label={`Toggle ${rule.label}`}
                    />
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-[#334155] pt-2.5 text-xs">
              <label htmlFor="cg-miss-threshold" className="text-[#A8B8CC]">
                Repeated missed-dose threshold:
              </label>
              <select
                id="cg-miss-threshold"
                value={alertPreferences.repeatedMissedThreshold}
                onChange={(e) =>
                  setAlertPreferences((prev) => ({
                    ...prev,
                    repeatedMissedThreshold: Number(e.target.value),
                  }))
                }
                className="h-8 rounded-lg border border-[#334155] bg-[#0B1220] px-2.5 text-xs text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} missed dose{n > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-[#2DD4BF]/35 bg-[#2DD4BF]/12 px-3 py-2 text-[11px] text-[#2DD4BF]">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Unapproved contacts never receive medication names or health details. Caregiver must accept your invitation before medication updates are unlocked.
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {onPreviewInvitation && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePreviewInvitationClick}
                className="whitespace-nowrap shrink-0"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Preview Invitation</span>
              </Button>
            )}
            <Button type="submit" className="whitespace-nowrap shrink-0">
              <Send className="h-3.5 w-3.5" />
              <span>{isEditing ? 'Save Contact' : 'Send Invitation'}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
