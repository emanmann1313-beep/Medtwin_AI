import React, { useMemo, useState } from 'react';
import { BellRing, ShieldCheck, UserPlus } from 'lucide-react';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { CaregiverConnection, RelationshipLabel } from '@/src/types/medtwin';
import {
  CONSENT_SCOPE_LIST,
  CaregiverConsentRecord,
  ConsentScope,
} from '@/src/types/caregiverContracts';
import {
  USE_MOCKS,
  mapAlertToContractRecord,
  mapConnectionToConsentRecord,
  toggleScopeInPermissions,
} from '@/src/services/caregiverAdapter';
import { ConsentList } from '@/src/modules/caregivers/components/ConsentList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { formatShortDate, formatTimestamp } from '@/src/lib/utils';

const RELATIONSHIPS: RelationshipLabel[] = [
  'Parent',
  'Child',
  'Sibling',
  'Spouse / Partner',
  'Guardian',
  'Friend',
  'Other',
];

export function CareCirclePage() {
  const {
    state,
    activePatient,
    inviteCaregiver,
    respondCaregiverInvite,
    updateCaregiverPermissions,
    addFamilyMedicalHistory,
    createSimulatedAlert,
  } = useMedTwin();

  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [relationship, setRelationship] = useState<RelationshipLabel>('Child');
  const [priority, setPriority] = useState<'primary' | 'secondary'>('secondary');
  const [permSchedule, setPermSchedule] = useState(true);
  const [permAlerts, setPermAlerts] = useState(true);
  const [permHistory, setPermHistory] = useState(false);
  const [permNotes, setPermNotes] = useState(false);

  const [fmhRel, setFmhRel] = useState<RelationshipLabel>('Parent');
  const [fmhCond, setFmhCond] = useState('');
  const [fmhSource, setFmhSource] = useState('Patient intake self-report');

  const connections = useMemo(
    () => state.connections.filter((c) => c.patientId === activePatient.id),
    [activePatient.id, state.connections],
  );

  const connectionsById = useMemo(() => {
    const map: Record<string, CaregiverConnection> = {};
    for (const c of connections) {
      map[c.id] = c;
    }
    return map;
  }, [connections]);

  const consentRecords: CaregiverConsentRecord[] = useMemo(
    () => connections.map((c) => mapConnectionToConsentRecord(c, state.patients)),
    [connections, state.patients],
  );

  const familyHistory = useMemo(
    () => state.familyMedicalHistory.filter((f) => f.patientId === activePatient.id),
    [activePatient.id, state.familyMedicalHistory],
  );

  const patientAlerts = useMemo(
    () =>
      state.alerts
        .filter((a) => a.patientId === activePatient.id)
        .map((a) => mapAlertToContractRecord(a, state.patients)),
    [activePatient.id, state.alerts, state.patients],
  );

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    inviteCaregiver({
      patientId: activePatient.id,
      caregiverName: inviteName.trim(),
      caregiverEmail: inviteEmail.trim(),
      relationship,
      contactPriority: priority,
      permissions: {
        viewSchedules: permSchedule,
        receiveDoseAlerts: permAlerts,
        viewHistoryAndReports: permHistory,
        viewClinicianNotes: permNotes,
      },
    });
    setInviteName('');
    setInviteEmail('');
  };

  const handleAddFamilyHistory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fmhCond.trim() || !fmhSource.trim()) return;
    addFamilyMedicalHistory({
      patientId: activePatient.id,
      relationship: fmhRel,
      reportedCondition: fmhCond.trim(),
      informationSource: fmhSource.trim(),
    });
    setFmhCond('');
  };

  const handleToggleScope = (consentId: string, scope: ConsentScope) => {
    const conn = connectionsById[consentId];
    if (!conn) return;
    updateCaregiverPermissions(
      consentId,
      toggleScopeInPermissions(conn.permissions, scope),
      conn.alertPreferences,
    );
  };

  const handleUpdateThreshold = (consentId: string, threshold: number) => {
    const conn = connectionsById[consentId];
    if (!conn) return;
    updateCaregiverPermissions(consentId, conn.permissions, {
      ...conn.alertPreferences,
      repeatedMissedThreshold: threshold,
    });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-[#FFFFFF] border-[#E2E8F0] dark:bg-[#172033] dark:border-[#334155]">
        <CardContent className="pt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#0D9488] dark:text-[#14B8A6]">
              <ShieldCheck className="h-4 w-4" />
              <span>Explicit Consent-Based Access · 4 Scopes</span>
              {USE_MOCKS && (
                <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300">
                  USE_MOCKS=true · Simulated Alert Dispatch
                </span>
              )}
            </div>
            <h2 className="font-display text-2xl font-bold text-[#172554] dark:text-[#F8FAFC]">
              Care Circle — {activePatient.name}
            </h2>
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
              Family relationships never grant automatic access. Toggle the 4 consent scopes or revoke caregiver access at any time.
            </p>
          </div>
          <Button
            type="button"
            variant="amber"
            onClick={() =>
              createSimulatedAlert({
                patientId: activePatient.id,
                title: `Manual Care Circle check-in alert for ${activePatient.name}`,
                reason: 'Patient-triggered simulated check-in notification to consented caregivers.',
                severity: 'attention',
              })
            }
          >
            <BellRing className="h-4 w-4" />
            <span>Send simulated test alert</span>
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Connected Caregivers & Granular Consent Scopes */}
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#172554] dark:text-[#F8FAFC]">
                Caregiver connections &amp; consent ({consentRecords.length})
              </CardTitle>
              <CardDescription>
                Manage primary/secondary contacts, invitation state, 4 consent scopes, and missed-dose alert thresholds.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConsentList
                consents={consentRecords}
                connectionsById={connectionsById}
                perspective="patient"
                editable
                emptyMessage="No Care Circle contacts invited yet for this patient."
                onAcceptInvite={(id) => respondCaregiverInvite(id, 'accepted')}
                onRevokeConsent={(id) => respondCaregiverInvite(id, 'revoked')}
                onRestoreConsent={(id) => respondCaregiverInvite(id, 'accepted')}
                onToggleScope={(id, scope) => handleToggleScope(id, scope)}
                onUpdateThreshold={handleUpdateThreshold}
              />
            </CardContent>
          </Card>

          {/* Alert History for Patient */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[#172554] dark:text-[#F8FAFC]">Simulated Care Circle alerts</CardTitle>
              <CardDescription>
                Visibility of simulated delivery states and caregiver follow-up acknowledgements
              </CardDescription>
            </CardHeader>
            <CardContent>
              {patientAlerts.length === 0 ? (
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">No simulated alerts recorded for this patient.</p>
              ) : (
                <div className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
                  {patientAlerts.map((a) => (
                    <div key={a.id} className="py-3 first:pt-0 last:pb-0 text-xs space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-[#172554] dark:text-[#F8FAFC]">{a.title}</span>
                        <span className="font-medium capitalize text-[#0D9488] dark:text-[#14B8A6]">
                          {a.simulated ? 'Simulated' : 'Alert'} · {a.delivery_status}
                        </span>
                      </div>
                      <p className="text-[#64748B] dark:text-[#94A3B8]">{a.reason}</p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        {a.channel} · {formatTimestamp(a.created_at)}
                      </p>
                      {a.follow_up_note && (
                        <p className="rounded-lg bg-[#CCFBF1]/60 px-2.5 py-1.5 text-[#0F766E] dark:bg-[#14B8A6]/15 dark:text-[#14B8A6]">
                          Follow-up ({a.acknowledged_by}): {a.follow_up_note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Invite Caregiver + Separate Family Medical History */}
        <div className="lg:col-span-5 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#172554] dark:text-[#F8FAFC]">
                <UserPlus className="h-4 w-4 text-[#0D9488] dark:text-[#14B8A6]" />
                <span>Invite to Care Circle</span>
              </CardTitle>
              <CardDescription>
                Choose relationship label, priority, and initial consent scopes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInviteSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#172554] dark:text-[#F8FAFC] mb-1">Full name</label>
                  <Input
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="e.g., Priya Patel"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#172554] dark:text-[#F8FAFC] mb-1">Email</label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="name@family-care.example"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#172554] dark:text-[#F8FAFC] mb-1">
                      Relationship
                    </label>
                    <select
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value as RelationshipLabel)}
                      className="w-full h-10 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-3 text-xs text-[#172554] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC]"
                    >
                      {RELATIONSHIPS.map((rel) => (
                        <option key={rel} value={rel}>
                          {rel}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#172554] dark:text-[#F8FAFC] mb-1">
                      Contact priority
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as 'primary' | 'secondary')}
                      className="w-full h-10 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-3 text-xs text-[#172554] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC]"
                    >
                      <option value="primary">Primary</option>
                      <option value="secondary">Secondary</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs text-[#172554] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC]">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
                    Initial Consent Scopes
                  </span>
                  {CONSENT_SCOPE_LIST.map((scopeMeta) => {
                    const checked =
                      scopeMeta.scope === 'view_schedules'
                        ? permSchedule
                        : scopeMeta.scope === 'receive_dose_alerts'
                          ? permAlerts
                          : scopeMeta.scope === 'view_history_reports'
                            ? permHistory
                            : permNotes;
                    const toggle =
                      scopeMeta.scope === 'view_schedules'
                        ? setPermSchedule
                        : scopeMeta.scope === 'receive_dose_alerts'
                          ? setPermAlerts
                          : scopeMeta.scope === 'view_history_reports'
                            ? setPermHistory
                            : setPermNotes;
                    return (
                      <label key={scopeMeta.scope} className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggle(e.target.checked)}
                          className="accent-[#0D9488] dark:accent-[#14B8A6] mt-0.5"
                        />
                        <span>
                          <strong className="font-medium text-[#172554] dark:text-[#F8FAFC]">{scopeMeta.label}</strong>
                          <span className="block text-[11px] text-[#64748B] dark:text-[#94A3B8]">{scopeMeta.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                <Button type="submit" className="w-full">
                  Send Care Circle invite
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Optional Family Medical History — Explicitly separate from access permissions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[#172554] dark:text-[#F8FAFC]">Family medical history (optional)</CardTitle>
              <CardDescription>
                Separated from Care Circle permissions. Records reported family context without inferring hereditary diagnoses.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {familyHistory.length > 0 && (
                <div className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
                  {familyHistory.map((item) => (
                    <div key={item.id} className="py-2 first:pt-0 last:pb-0 text-xs">
                      <p className="font-semibold text-[#172554] dark:text-[#F8FAFC]">
                        {item.relationship}: {item.reportedCondition}
                      </p>
                      <p className="text-[#64748B] dark:text-[#94A3B8]">
                        Source: {item.informationSource} · {formatShortDate(item.recordedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddFamilyHistory} className="space-y-2.5 border-t border-[#E2E8F0] pt-3 dark:border-[#334155]">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    aria-label="Family relationship"
                    value={fmhRel}
                    onChange={(e) => setFmhRel(e.target.value as RelationshipLabel)}
                    className="h-9 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 text-xs text-[#172554] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC]"
                  >
                    {RELATIONSHIPS.map((rel) => (
                      <option key={rel} value={rel}>
                        {rel}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={fmhSource}
                    onChange={(e) => setFmhSource(e.target.value)}
                    placeholder="Information source"
                    className="h-9 text-xs"
                  />
                </div>
                <Input
                  value={fmhCond}
                  onChange={(e) => setFmhCond(e.target.value)}
                  placeholder="Reported condition (e.g., Hypertension)"
                  className="h-9 text-xs"
                />
                <Button type="submit" variant="outline" size="sm" className="w-full">
                  Record family history note
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
