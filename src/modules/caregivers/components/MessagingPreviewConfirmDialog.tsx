import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Lock,
  MessageCircle,
  MessageSquare,
  Send,
  ShieldAlert,
} from 'lucide-react';
import {
  CareAlertType,
  CaregiverConnection,
  CaregiverLanguage,
  CaregiverProfile,
  MessagingProviderStatus,
} from '@/src/types/medtwin';
import {
  ALERT_RULE_DEFINITIONS,
  CAREGIVER_LANGUAGE_OPTIONS,
  buildCaregiverAlertMessage,
  buildSmsUrl,
  buildWhatsAppUrl,
  resolveContactPhones,
} from '@/src/services/caregiverMessaging';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Textarea } from '@/src/components/ui/input';
import { cn } from '@/src/lib/utils';

export interface MessagingTarget {
  connection?: CaregiverConnection;
  profile?: CaregiverProfile;
  draftContact?: {
    caregiverName: string;
    phoneCountryCode: string;
    phoneNumber: string;
    whatsappSameAsPhone: boolean;
    whatsappNumber: string;
    preferredLanguage: CaregiverLanguage;
    status: 'invited' | 'accepted' | 'revoked';
  };
  initialChannel: 'whatsapp' | 'sms';
  initialAlertType: CareAlertType;
  mode: 'preview' | 'confirm_send';
  medicationName?: string;
  refillDetail?: string;
}

interface MessagingPreviewConfirmDialogProps {
  open: boolean;
  target: MessagingTarget | null;
  patientName: string;
  isDemoMode: boolean;
  providerStatus: MessagingProviderStatus;
  onClose: () => void;
  onLogEvent: (params: {
    connection?: CaregiverConnection;
    caregiverName: string;
    recipientPhone: string;
    channel: 'whatsapp' | 'sms';
    alertType: CareAlertType;
    title: string;
    reason: string;
    messageBody: string;
    deliveryMode: 'draft' | 'opened_messaging_app' | 'automated';
  }) => Promise<void> | void;
}

export function MessagingPreviewConfirmDialog({
  open,
  target,
  patientName,
  isDemoMode,
  providerStatus,
  onClose,
  onLogEvent,
}: MessagingPreviewConfirmDialogProps) {
  const [channel, setChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [alertType, setAlertType] = useState<CareAlertType>('repeated_missed_doses');
  const [language, setLanguage] = useState<CaregiverLanguage>('en');
  const [messageText, setMessageText] = useState('');
  const [confirmedCheck, setConfirmedCheck] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submittingAuto, setSubmittingAuto] = useState(false);
  const [autoFeedback, setAutoFeedback] = useState<string | null>(null);

  const contactInfo = useMemo(() => {
    if (!target) {
      return {
        caregiverName: '',
        fullPhone: '',
        fullWhatsapp: '',
        status: 'invited' as const,
        preferredLanguage: 'en' as CaregiverLanguage,
      };
    }
    if (target.connection) {
      const resolved = resolveContactPhones(target.connection, target.profile);
      return {
        caregiverName: target.connection.caregiverName,
        fullPhone: resolved.fullPhone,
        fullWhatsapp: resolved.fullWhatsapp,
        status: target.connection.status,
        preferredLanguage: target.connection.preferredLanguage || resolved.preferredLanguage,
      };
    }
    const dc = target.draftContact;
    return {
      caregiverName: dc?.caregiverName || 'Caregiver',
      fullPhone: dc ? `${dc.phoneCountryCode} ${dc.phoneNumber}`.trim() : '',
      fullWhatsapp: dc
        ? `${dc.phoneCountryCode} ${dc.whatsappSameAsPhone ? dc.phoneNumber : dc.whatsappNumber}`.trim()
        : '',
      status: dc?.status || ('invited' as const),
      preferredLanguage: dc?.preferredLanguage || ('en' as CaregiverLanguage),
    };
  }, [target]);

  useEffect(() => {
    if (!open || !target) return;
    setChannel(target.initialChannel);
    setAlertType(target.initialAlertType);
    const initialLang = contactInfo.preferredLanguage || 'en';
    setLanguage(initialLang);
    setConfirmedCheck(false);
    setCopied(false);
    setAutoFeedback(null);

    const built = buildCaregiverAlertMessage({
      alertType: target.initialAlertType,
      caregiverName: contactInfo.caregiverName,
      patientName,
      language: initialLang,
      consentStatus: contactInfo.status,
      medicationName: target.medicationName,
      refillDetail: target.refillDetail,
      simulated: isDemoMode,
    });
    setMessageText(built.message);
  }, [
    contactInfo.caregiverName,
    contactInfo.preferredLanguage,
    contactInfo.status,
    isDemoMode,
    open,
    patientName,
    target,
  ]);

  const regenerateMessage = (nextType: CareAlertType, nextLang: CaregiverLanguage) => {
    const built = buildCaregiverAlertMessage({
      alertType: nextType,
      caregiverName: contactInfo.caregiverName,
      patientName,
      language: nextLang,
      consentStatus: contactInfo.status,
      medicationName: target?.medicationName,
      refillDetail: target?.refillDetail,
      simulated: isDemoMode,
    });
    setMessageText(built.message);
  };

  if (!target) return null;

  const recipientPhone =
    channel === 'whatsapp'
      ? contactInfo.fullWhatsapp || contactInfo.fullPhone
      : contactInfo.fullPhone || contactInfo.fullWhatsapp;

  const hasValidPhone = recipientPhone.replace(/\D/g, '').length >= 8;
  const isPrivacyRedacted =
    contactInfo.status !== 'accepted' && alertType !== 'caregiver_invitation';

  const launchHref =
    hasValidPhone
      ? channel === 'whatsapp'
        ? buildWhatsAppUrl(recipientPhone, messageText)
        : buildSmsUrl(recipientPhone, messageText)
      : '#';

  const currentRuleMeta = ALERT_RULE_DEFINITIONS.find((r) => r.alertType === alertType);
  const titleText = `${currentRuleMeta?.label || 'Medication alert'} · ${contactInfo.caregiverName}`;
  const reasonText = isPrivacyRedacted
    ? 'Consent pending: medication details redacted until caregiver invitation is accepted.'
    : currentRuleMeta?.description || 'Caregiver notification prepared from MedTwin AI Pro.';

  const automatedAvailable =
    channel === 'whatsapp'
      ? providerStatus.whatsappProviderConfigured
      : providerStatus.smsProviderConfigured;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked in restricted iframe
    }
  };

  const handleSaveDraft = async () => {
    await onLogEvent({
      connection: target.connection,
      caregiverName: contactInfo.caregiverName,
      recipientPhone: recipientPhone || 'No phone on file',
      channel,
      alertType,
      title: titleText,
      reason: reasonText,
      messageBody: messageText,
      deliveryMode: 'draft',
    });
    onClose();
  };

  const handleLaunchClick = () => {
    void onLogEvent({
      connection: target.connection,
      caregiverName: contactInfo.caregiverName,
      recipientPhone,
      channel,
      alertType,
      title: titleText,
      reason: reasonText,
      messageBody: messageText,
      deliveryMode: 'opened_messaging_app',
    });
    onClose();
  };

  const handleAttemptAutomated = async () => {
    setSubmittingAuto(true);
    setAutoFeedback(null);
    try {
      await onLogEvent({
        connection: target.connection,
        caregiverName: contactInfo.caregiverName,
        recipientPhone,
        channel,
        alertType,
        title: titleText,
        reason: reasonText,
        messageBody: messageText,
        deliveryMode: 'automated',
      });
      if (!automatedAvailable) {
        setAutoFeedback(
          `Automated ${channel === 'whatsapp' ? 'WhatsApp Business' : 'SMS'} API delivery is unavailable because credentials are not configured. Confirm and open your device app below instead.`,
        );
      } else {
        onClose();
      }
    } finally {
      setSubmittingAuto(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#F8FAFC]">
            {channel === 'whatsapp' ? (
              <MessageCircle className="h-5 w-5 text-[#2DD4BF]" />
            ) : (
              <MessageSquare className="h-5 w-5 text-[#8B5CF6]" />
            )}
            <span>
              {target.mode === 'preview'
                ? `Preview ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} Message`
                : `Confirm & Send ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} Message`}
            </span>
          </DialogTitle>
          <DialogDescription>
            Recipient: <strong>{contactInfo.caregiverName}</strong>{' '}
            {recipientPhone ? (
              <span className="font-mono text-[#F8FAFC]">({recipientPhone})</span>
            ) : (
              '(no phone number recorded yet)'
            )}
            {isDemoMode && ' · Demo simulation — never auto-sent to real numbers.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Consent Redaction Guard Banner */}
          {isPrivacyRedacted && (
            <div className="flex items-start gap-2.5 rounded-xl border border-[#FBBF24]/40 bg-[#FBBF24]/10 p-3 text-xs text-[#F8FAFC]">
              <Lock className="h-4 w-4 shrink-0 mt-0.5 text-[#FBBF24]" />
              <div className="space-y-0.5">
                <p className="font-semibold text-[#FBBF24]">Patient consent privacy active</p>
                <p className="text-[#A8B8CC]">
                  {contactInfo.caregiverName} has status <strong className="capitalize text-[#F8FAFC]">{contactInfo.status}</strong>. Unapproved contacts do not receive medication names or sensitive health details—only an invitation or privacy-protected check-in prompt is allowed.
                </p>
              </div>
            </div>
          )}

          {/* Channel / Alert Type / Language Controls */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#A8B8CC] mb-1">
                Channel
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setChannel('whatsapp')}
                  className={cn(
                    'h-9 rounded-lg border text-xs font-semibold cursor-pointer transition-colors',
                    channel === 'whatsapp'
                      ? 'border-[#2DD4BF] bg-[#2DD4BF]/15 text-[#2DD4BF]'
                      : 'border-[#334155] bg-[#0B1220] text-[#A8B8CC] hover:text-[#F8FAFC]',
                  )}
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setChannel('sms')}
                  className={cn(
                    'h-9 rounded-lg border text-xs font-semibold cursor-pointer transition-colors',
                    channel === 'sms'
                      ? 'border-[#8B5CF6] bg-[#8B5CF6]/20 text-[#F8FAFC]'
                      : 'border-[#334155] bg-[#0B1220] text-[#A8B8CC] hover:text-[#F8FAFC]',
                  )}
                >
                  SMS
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="msg-alert-type"
                className="block text-[11px] font-semibold text-[#A8B8CC] mb-1"
              >
                Alert type
              </label>
              <select
                id="msg-alert-type"
                value={alertType}
                onChange={(e) => {
                  const nextType = e.target.value as CareAlertType;
                  setAlertType(nextType);
                  regenerateMessage(nextType, language);
                }}
                className="h-9 w-full rounded-lg border border-[#334155] bg-[#0B1220] px-2.5 text-xs text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
              >
                {ALERT_RULE_DEFINITIONS.map((r) => (
                  <option key={r.alertType} value={r.alertType}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="msg-language"
                className="block text-[11px] font-semibold text-[#A8B8CC] mb-1"
              >
                Message language
              </label>
              <select
                id="msg-language"
                value={language}
                onChange={(e) => {
                  const nextLang = e.target.value as CaregiverLanguage;
                  setLanguage(nextLang);
                  regenerateMessage(alertType, nextLang);
                }}
                className="h-9 w-full rounded-lg border border-[#334155] bg-[#0B1220] px-2.5 text-xs text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
              >
                {CAREGIVER_LANGUAGE_OPTIONS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label} ({l.nativeLabel})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Editable message preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="msg-body-textarea"
                className="text-xs font-semibold text-[#F8FAFC]"
              >
                Prefilled message preview
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#2DD4BF] hover:underline cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied' : 'Copy text'}</span>
              </button>
            </div>
            <Textarea
              id="msg-body-textarea"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={4}
              readOnly={isPrivacyRedacted}
            />
          </div>

          {/* Encoded wa.me / sms: link preview */}
          <div className="rounded-xl border border-[#334155] bg-[#223451] p-3 space-y-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#A8B8CC]">
              Encoded {channel === 'whatsapp' ? 'WhatsApp (wa.me)' : 'Device SMS (sms:)'} link
            </span>
            <p className="font-mono text-[11px] break-all text-[#F8FAFC] max-h-16 overflow-y-auto">
              {hasValidPhone ? launchHref : 'Add a valid country-coded phone number to generate link.'}
            </p>
          </div>

          {/* Automated Provider Availability Status */}
          <div className="rounded-xl border border-[#334155] bg-[#223451] p-3 text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-[#F8FAFC]">
                Automated Messaging API Status
              </span>
              <span
                className={cn(
                  'font-medium',
                  automatedAvailable
                    ? 'text-[#34D399]'
                    : 'text-[#A8B8CC]',
                )}
              >
                {automatedAvailable
                  ? channel === 'whatsapp'
                    ? providerStatus.whatsappProviderLabel
                    : providerStatus.smsProviderLabel
                  : 'Automated delivery unavailable (API not configured)'}
              </span>
            </div>
            {autoFeedback && (
              <div className="flex items-start gap-2 rounded-lg border border-[#FBBF24]/40 bg-[#FBBF24]/10 p-2 text-[11px] text-[#FBBF24]">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{autoFeedback}</span>
              </div>
            )}
          </div>

          {/* Explicit confirmation before launching external app */}
          <label className="flex items-start gap-2.5 rounded-xl border border-[#334155] bg-[#223451] p-3 text-xs text-[#F8FAFC] cursor-pointer">
            <input
              type="checkbox"
              checked={confirmedCheck}
              onChange={(e) => setConfirmedCheck(e.target.checked)}
              className="accent-[#8B5CF6] mt-0.5 h-4 w-4"
            />
            <span>
              I confirm I want to prepare and open this {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} message to{' '}
              <strong>{contactInfo.caregiverName}</strong>
              {isDemoMode ? ' (Demo preview/simulation).' : '.'}
            </span>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={handleSaveDraft}>
              Save Draft
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              {automatedAvailable && !isDemoMode && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!confirmedCheck || !hasValidPhone || submittingAuto}
                  onClick={handleAttemptAutomated}
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{submittingAuto ? 'Sending...' : 'Send Automated'}</span>
                </Button>
              )}

              {confirmedCheck && hasValidPhone ? (
                <a
                  href={launchHref}
                  target={channel === 'whatsapp' ? '_blank' : undefined}
                  rel={channel === 'whatsapp' ? 'noopener noreferrer' : undefined}
                  onClick={handleLaunchClick}
                  className={cn(
                    'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-semibold transition-all whitespace-nowrap shrink-0',
                    channel === 'whatsapp'
                      ? 'bg-[#2DD4BF] text-[#0B1220] hover:bg-[#5EEAD4] shadow-[0_0_16px_rgba(45,212,191,0.28)]'
                      : 'bg-[#8B5CF6] text-[#F8FAFC] hover:bg-[#7C3AED] shadow-[0_0_18px_rgba(139,92,246,0.35)]',
                  )}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>
                    {channel === 'whatsapp' ? 'Open WhatsApp Message' : 'Open SMS App'}
                  </span>
                </a>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled
                  title="Check the confirmation box above to unlock launch link"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>
                    {channel === 'whatsapp' ? 'Open WhatsApp Message' : 'Open SMS App'}
                  </span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
