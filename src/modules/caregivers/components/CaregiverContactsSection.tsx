import React, { useMemo, useState } from 'react';
import {
  BellRing,
  Check,
  Edit3,
  Eye,
  Globe,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { useMedTwin } from '@/src/context/MedTwinContext';
import {
  CareAlertType,
  CaregiverConnection,
  CaregiverProfile,
  Patient,
} from '@/src/types/medtwin';
import {
  ALERT_RULE_DEFINITIONS,
  CAREGIVER_LANGUAGE_OPTIONS,
  buildCaregiverAlertMessage,
  getNormalizedAlertPreferences,
  resolveContactPhones,
} from '@/src/services/caregiverMessaging';
import {
  CaregiverContactFormDialog,
  CaregiverContactFormPayload,
} from '@/src/modules/caregivers/components/CaregiverContactFormDialog';
import {
  MessagingPreviewConfirmDialog,
  MessagingTarget,
} from '@/src/modules/caregivers/components/MessagingPreviewConfirmDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Switch } from '@/src/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { cn, formatShortDate } from '@/src/lib/utils';

interface CaregiverContactsSectionProps {
  patient: Patient;
  canManageContacts?: boolean;
  acceptedOnly?: boolean;
  compact?: boolean;
  title?: string;
  description?: string;
}

export function CaregiverContactsSection({
  patient,
  canManageContacts = true,
  acceptedOnly = false,
  compact = false,
  title = 'Caregiver Contacts',
  description = 'Manage trusted family caregivers, WhatsApp/SMS notifications, and consent-governed alert rules.',
}: CaregiverContactsSectionProps) {
  const {
    state,
    isRealAccountMode,
    providerStatus,
    inviteCaregiver,
    updateCaregiverContact,
    removeCaregiverContact,
    respondCaregiverInvite,
    dispatchCaregiverAlert,
    createSimulatedAlert,
  } = useMedTwin();

  const [formOpen, setFormOpen] = useState(false);
  const [editingConn, setEditingConn] = useState<CaregiverConnection | null>(null);
  const [messagingTarget, setMessagingTarget] = useState<MessagingTarget | null>(null);
  const [removeTarget, setRemoveTarget] = useState<CaregiverConnection | null>(null);
  const [showAlertRules, setShowAlertRules] = useState(false);

  const connections = useMemo(
    () =>
      state.connections.filter(
        (c) => c.patientId === patient.id && (!acceptedOnly || c.status === 'accepted'),
      ),
    [acceptedOnly, patient.id, state.connections],
  );

  const profileById = useMemo(() => {
    const map: Record<string, CaregiverProfile> = {};
    for (const cg of state.caregivers) map[cg.id] = cg;
    return map;
  }, [state.caregivers]);

  const activeMed = useMemo(
    () => state.medications.find((m) => m.patientId === patient.id && m.status === 'active'),
    [patient.id, state.medications],
  );

  const defaultAlertSummary = useMemo(() => {
    const primary = connections.find((c) => c.status !== 'revoked') ?? connections[0];
    return getNormalizedAlertPreferences(primary?.alertPreferences);
  }, [connections]);

  const handleToggleGlobalAlertRule = (
    ruleKey: keyof Pick<
      ReturnType<typeof getNormalizedAlertPreferences>,
      | 'repeatedMissedDoses'
      | 'supplyRunningLow'
      | 'upcomingRefillDate'
      | 'caregiverInvitation'
      | 'patientRequestedAssistance'
    >,
    checked: boolean,
  ) => {
    if (!canManageContacts) return;
    for (const conn of connections) {
      if (conn.status === 'revoked') continue;
      updateCaregiverContact({
        connectionId: conn.id,
        alertPreferences: {
          ...getNormalizedAlertPreferences(conn.alertPreferences),
          [ruleKey]: checked,
          notifyOnRefillNeeded:
            ruleKey === 'supplyRunningLow' || ruleKey === 'upcomingRefillDate'
              ? checked
              : conn.alertPreferences.notifyOnRefillNeeded,
          notifyOnDadiNaniShare:
            ruleKey === 'patientRequestedAssistance'
              ? checked
              : conn.alertPreferences.notifyOnDadiNaniShare,
        },
      });
    }
  };

  const handleFormSubmit = (payload: CaregiverContactFormPayload) => {
    if (payload.connectionId) {
      updateCaregiverContact({
        connectionId: payload.connectionId,
        caregiverName: payload.caregiverName,
        caregiverEmail: payload.caregiverEmail,
        phoneCountryCode: payload.phoneCountryCode,
        phoneNumber: payload.phoneNumber,
        whatsappSameAsPhone: payload.whatsappSameAsPhone,
        whatsappNumber: payload.whatsappNumber,
        preferredLanguage: payload.preferredLanguage,
        relationship: payload.relationship,
        contactPriority: payload.contactPriority,
        alertPreferences: payload.alertPreferences,
      });
    } else {
      inviteCaregiver({
        patientId: patient.id,
        caregiverName: payload.caregiverName,
        caregiverEmail: payload.caregiverEmail,
        phoneCountryCode: payload.phoneCountryCode,
        phoneNumber: payload.phoneNumber,
        whatsappSameAsPhone: payload.whatsappSameAsPhone,
        whatsappNumber: payload.whatsappNumber,
        preferredLanguage: payload.preferredLanguage,
        relationship: payload.relationship,
        contactPriority: payload.contactPriority,
        permissions: {
          viewSchedules: true,
          receiveDoseAlerts: payload.alertPreferences.repeatedMissedDoses,
          viewHistoryAndReports: false,
          viewClinicianNotes: false,
        },
        alertPreferences: payload.alertPreferences,
      });
    }
  };

  const handleTriggerDemoMissedAlert = () => {
    const recipient =
      connections.find((c) => c.status === 'accepted' && c.permissions.receiveDoseAlerts) ??
      connections.find((c) => c.status === 'accepted');

    if (!recipient) {
      createSimulatedAlert({
        patientId: patient.id,
        title: `No accepted caregiver for ${patient.name}`,
        reason: 'Accept a caregiver invitation first before sending dose alerts.',
        severity: 'urgent',
      });
      return;
    }

    const phones = resolveContactPhones(recipient, profileById[recipient.caregiverId]);
    const medLabel = activeMed ? `${activeMed.name} ${activeMed.strength}` : 'scheduled medicine';
    const built = buildCaregiverAlertMessage({
      alertType: 'repeated_missed_doses',
      caregiverName: recipient.caregiverName,
      patientName: patient.name,
      language: recipient.preferredLanguage || phones.preferredLanguage,
      consentStatus: recipient.status,
      medicationName: medLabel,
      simulated: true,
    });

    createSimulatedAlert({
      patientId: patient.id,
      caregiverId: recipient.caregiverId,
      alertType: 'repeated_missed_doses',
      channel: 'whatsapp',
      recipientPhone: phones.fullWhatsapp || phones.fullPhone,
      messageBody: built.message,
      title: `Demo missed-dose alert · ${medLabel}`,
      reason: `${patient.name} has an unconfirmed/skipped scheduled dose for ${medLabel}.`,
      severity: 'urgent',
    });
  };

  const openMessagingForConnection = (
    conn: CaregiverConnection,
    channel: 'whatsapp' | 'sms',
    mode: 'preview' | 'confirm_send',
    alertType?: CareAlertType,
  ) => {
    const resolvedAlertType: CareAlertType =
      alertType ?? (conn.status !== 'accepted' ? 'caregiver_invitation' : 'repeated_missed_doses');
    setMessagingTarget({
      connection: conn,
      profile: profileById[conn.caregiverId],
      initialChannel: channel,
      initialAlertType: resolvedAlertType,
      mode,
      medicationName: activeMed ? `${activeMed.name} ${activeMed.strength}` : undefined,
      refillDetail:
        activeMed && typeof activeMed.remainingQuantity === 'number'
          ? `has ${activeMed.remainingQuantity} ${activeMed.unitLabel} remaining`
          : undefined,
    });
  };

  const defaultPreviewTarget =
    connections.find((c) => c.status === 'accepted') ?? connections[0] ?? null;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-[#F8FAFC]">
              <Users className="h-5 w-5 text-[#2DD4BF]" />
              <span>
                {title} ({connections.length})
              </span>
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {defaultPreviewTarget && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => openMessagingForConnection(defaultPreviewTarget, 'whatsapp', 'preview')}
                  className="whitespace-nowrap shrink-0"
                >
                  <Eye className="h-3.5 w-3.5 text-[#2DD4BF]" />
                  <span>Preview WhatsApp Alert</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => openMessagingForConnection(defaultPreviewTarget, 'sms', 'preview')}
                  className="whitespace-nowrap shrink-0"
                >
                  <Eye className="h-3.5 w-3.5 text-[#8B5CF6]" />
                  <span>Preview SMS Alert</span>
                </Button>
              </>
            )}
            {!isRealAccountMode && canManageContacts && (
              <Button
                type="button"
                size="sm"
                variant="amber"
                onClick={handleTriggerDemoMissedAlert}
                className="whitespace-nowrap shrink-0"
              >
                <BellRing className="h-3.5 w-3.5" />
                <span>Generate Demo Alert</span>
              </Button>
            )}
            {canManageContacts && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setEditingConn(null);
                  setFormOpen(true);
                }}
                className="whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>+ Add Caregiver</span>
              </Button>
            )}
          </div>
        </div>

        {/* Provider status & automatic rules summary */}
        <div className="flex flex-col gap-2 rounded-xl border border-[#334155] bg-[#223451] px-3.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-[#A8B8CC]">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#2DD4BF]" />
            <span>
              {providerStatus.whatsappProviderConfigured || providerStatus.smsProviderConfigured
                ? 'Automated messaging provider configured. Manual WhatsApp & SMS also ready.'
                : 'Automated WhatsApp/SMS delivery unavailable (API not configured) — manual WhatsApp & SMS app launch ready.'}
            </span>
          </div>
          {canManageContacts && connections.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAlertRules((v) => !v)}
              className="text-left font-semibold text-[#2DD4BF] hover:underline cursor-pointer shrink-0"
            >
              {showAlertRules ? 'Hide alert rules' : 'Configure 5 automatic alert rules'}
            </button>
          )}
        </div>

        {showAlertRules && canManageContacts && (
          <div className="grid grid-cols-1 gap-2 rounded-2xl border border-[#334155] bg-[#101B30] p-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {ALERT_RULE_DEFINITIONS.map((rule) => {
              const checked = Boolean(defaultAlertSummary[rule.key]);
              return (
                <label
                  key={rule.key}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[#334155] bg-[#223451] px-3 py-2 text-xs cursor-pointer"
                >
                  <span className="font-medium text-[#F8FAFC] truncate" title={rule.description}>
                    {rule.label}
                  </span>
                  <Switch
                    checked={checked}
                    onCheckedChange={(val) => handleToggleGlobalAlertRule(rule.key, val)}
                  />
                </label>
              );
            })}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {connections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#334155] bg-[#223451]/60 py-10 px-4 text-center space-y-3">
            <Users className="mx-auto h-8 w-8 text-[#8B5CF6]" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#F8FAFC]">
                No caregiver contacts added yet
              </p>
              <p className="mx-auto max-w-md text-xs text-[#A8B8CC]">
                Add family caregivers with their phone/WhatsApp number and preferred language to prepare consent-protected medication updates.
              </p>
            </div>
            {canManageContacts && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setEditingConn(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                <span>+ Add Caregiver</span>
              </Button>
            )}
          </div>
        ) : (
          <div
            className={cn(
              'grid grid-cols-1 gap-4',
              !compact && 'lg:grid-cols-2',
            )}
          >
            {connections.map((conn) => {
              const profile = profileById[conn.caregiverId];
              const phones = resolveContactPhones(conn, profile);
              const langCode = conn.preferredLanguage || phones.preferredLanguage;
              const langMeta =
                CAREGIVER_LANGUAGE_OPTIONS.find((l) => l.id === langCode) ??
                CAREGIVER_LANGUAGE_OPTIONS[0];
              const emailAddr = conn.caregiverEmail || profile?.email;

              return (
                <div
                  key={conn.id}
                  className="rounded-2xl border border-[#334155] bg-[#223451] p-4 space-y-3.5 shadow-[0_8px_20px_rgba(3,7,18,0.28)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-display text-base font-bold text-[#F8FAFC]">
                          {conn.caregiverName}
                        </h4>
                        <span className="text-xs text-[#A8B8CC]">
                          · {conn.relationship} · {conn.contactPriority}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#A8B8CC] mt-0.5">
                        Invited {formatShortDate(conn.invitedAt)}
                        {conn.respondedAt ? ` · Updated ${formatShortDate(conn.respondedAt)}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          'text-xs font-semibold capitalize',
                          conn.status === 'accepted'
                            ? 'text-[#34D399]'
                            : conn.status === 'invited'
                              ? 'text-[#FBBF24]'
                              : 'text-[#FB7185]',
                        )}
                      >
                        {conn.status === 'accepted'
                          ? 'Accepted'
                          : conn.status === 'invited'
                            ? 'Pending Acceptance'
                            : 'Revoked'}
                      </span>
                    </div>
                  </div>

                  {/* Contact options row */}
                  <div className="grid grid-cols-1 gap-1.5 text-xs text-[#F8FAFC] sm:grid-cols-2">
                    <div className="flex items-center gap-1.5 font-mono">
                      <Phone className="h-3.5 w-3.5 text-[#A8B8CC] shrink-0" />
                      <span className="truncate">{phones.fullPhone || 'No phone on file'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono">
                      <MessageCircle className="h-3.5 w-3.5 text-[#2DD4BF] shrink-0" />
                      <span className="truncate">
                        WA: {phones.fullWhatsapp || phones.fullPhone || 'Not set'}
                      </span>
                    </div>
                    {emailAddr && (
                      <div className="flex items-center gap-1.5 text-[#A8B8CC] truncate">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{emailAddr}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-[#A8B8CC]">
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      <span>Language: {langMeta.label} ({langMeta.nativeLabel})</span>
                    </div>
                  </div>

                  {/* WhatsApp & SMS Actions + Edit/Remove */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#334155] pt-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => openMessagingForConnection(conn, 'whatsapp', 'confirm_send')}
                        className="whitespace-nowrap shrink-0"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>Send WhatsApp Message</span>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openMessagingForConnection(conn, 'sms', 'confirm_send')}
                        className="whitespace-nowrap shrink-0"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Send SMS</span>
                      </Button>

                      {conn.status === 'invited' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            openMessagingForConnection(
                              conn,
                              'whatsapp',
                              'preview',
                              'caregiver_invitation',
                            )
                          }
                          className="whitespace-nowrap shrink-0"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Preview Invite</span>
                        </Button>
                      )}
                    </div>

                    {canManageContacts && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {conn.status === 'invited' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => respondCaregiverInvite(conn.id, 'accepted')}
                            title="Simulate caregiver accepting invitation with consent"
                            className="whitespace-nowrap shrink-0"
                          >
                            <Check className="h-3.5 w-3.5 text-[#34D399]" />
                            <span>Mark Accepted</span>
                          </Button>
                        )}
                        {conn.status === 'revoked' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => respondCaregiverInvite(conn.id, 'accepted')}
                            className="whitespace-nowrap shrink-0"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Restore</span>
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingConn(conn);
                            setFormOpen(true);
                          }}
                          aria-label={`Edit ${conn.caregiverName}`}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setRemoveTarget(conn)}
                          aria-label={`Remove ${conn.caregiverName}`}
                          className="text-[#FB7185] hover:text-[#FDA4AF]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Add / Edit Caregiver Contact Form */}
      <CaregiverContactFormDialog
        open={formOpen}
        patientName={patient.name}
        editingConnection={editingConn}
        editingProfile={editingConn ? profileById[editingConn.caregiverId] : undefined}
        onClose={() => {
          setFormOpen(false);
          setEditingConn(null);
        }}
        onSubmit={handleFormSubmit}
        onPreviewInvitation={(payload) => {
          setMessagingTarget({
            draftContact: {
              caregiverName: payload.caregiverName,
              phoneCountryCode: payload.phoneCountryCode,
              phoneNumber: payload.phoneNumber,
              whatsappSameAsPhone: payload.whatsappSameAsPhone,
              whatsappNumber: payload.whatsappNumber,
              preferredLanguage: payload.preferredLanguage,
              status: editingConn?.status ?? 'invited',
            },
            initialChannel: 'whatsapp',
            initialAlertType: 'caregiver_invitation',
            mode: 'preview',
          });
        }}
      />

      {/* Preview / Confirm WhatsApp & SMS Dialog */}
      <MessagingPreviewConfirmDialog
        open={Boolean(messagingTarget)}
        target={messagingTarget}
        patientName={patient.name}
        isDemoMode={!isRealAccountMode}
        providerStatus={providerStatus}
        onClose={() => setMessagingTarget(null)}
        onLogEvent={async (ev) => {
          await dispatchCaregiverAlert({
            patientId: patient.id,
            connectionId: ev.connection?.id,
            caregiverId: ev.connection?.caregiverId,
            caregiverName: ev.caregiverName,
            alertType: ev.alertType,
            channel: ev.channel,
            recipientPhone: ev.recipientPhone,
            title: ev.title,
            reason: ev.reason,
            messageBody: ev.messageBody,
            severity: ev.alertType === 'repeated_missed_doses' ? 'urgent' : 'attention',
            deliveryMode: ev.deliveryMode,
          });
        }}
      />

      {/* Remove Caregiver Confirmation Dialog (no window.confirm) */}
      <Dialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F8FAFC]">
              Remove Caregiver Contact?
            </DialogTitle>
            <DialogDescription>
              Removing <strong>{removeTarget?.caregiverName}</strong> immediately stops future Care Circle notifications and revokes their access to {patient.name}’s medication details.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                if (removeTarget) removeCaregiverContact(removeTarget.id);
                setRemoveTarget(null);
              }}
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>Remove Caregiver</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
