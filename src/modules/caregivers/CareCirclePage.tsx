import React, { useMemo, useState } from 'react';
import { BellRing, ShieldCheck, Stethoscope, UserPlus, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
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
    isRealAccountMode,
    hasPatients,
    activeRole,
    activePatient,
    doctorAuthorizations,
    directory,
    inviteCaregiver,
    respondCaregiverInvite,
    updateCaregiverPermissions,
    authorizeDoctorByEmail,
    respondDoctorAuthorization,
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

  const [doctorEmail, setDoctorEmail] = useState('');
  const [doctorSubmitting, setDoctorSubmitting] = useState(false);

  const [fmhRel, setFmhRel] = useState<RelationshipLabel>('Parent');
  const [fmhCond, setFmhCond] = useState('');
  const [fmhSource, setFmhSource] = useState('Patient intake self-report');

  const isPatientPerspective = activeRole === 'patient';

  const connections = useMemo(() => {
    if (!hasPatients || !activePatient.id) return [];
    return state.connections.filter((c) => c.patientId === activePatient.id);
  }, [activePatient.id, hasPatients, state.connections]);

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
    () =>
      hasPatients && activePatient.id
        ? state.familyMedicalHistory.filter((f) => f.patientId === activePatient.id)
        : [],
    [activePatient.id, hasPatients, state.familyMedicalHistory],
  );

  const patientAlerts = useMemo(
    () =>
      hasPatients && activePatient.id
        ? state.alerts
            .filter((a) => a.patientId === activePatient.id)
            .map((a) => mapAlertToContractRecord(a, state.patients))
        : [],
    [activePatient.id, hasPatients, state.alerts, state.patients],
  );

  const registeredDoctors = useMemo(
    () => directory.filter((d) => d.role === 'doctor'),
    [directory],
  );

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient.id || !inviteName.trim() || !inviteEmail.trim()) return;
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

  const handleAuthorizeDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorEmail.trim()) return;
    setDoctorSubmitting(true);
    try {
      await authorizeDoctorByEmail(doctorEmail.trim());
      setDoctorEmail('');
    } catch {
      // Toast handled in context
    } finally {
      setDoctorSubmitting(false);
    }
  };

  const handleAddFamilyHistory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient.id || !fmhCond.trim() || !fmhSource.trim()) return;
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

  if (!hasPatients || !activePatient.id) {
    return (
      <Card>
        <CardContent className="py-12 px-6 text-center space-y-3">
          <Users className="mx-auto h-9 w-9 text-[#7956C8] dark:text-[#A58AE8]" />
          <h3 className="font-display text-lg font-semibold text-[#20243A] dark:text-[#F7F5F0]">
            No approved patient Care Circle yet
          </h3>
          <p className="mx-auto max-w-md text-xs text-[#5C627D] dark:text-[#A3A9C2]">
            Send a connection request from the Caregiver Hub or ask your family member to invite you from their Care Circle.
          </p>
          <div>
            <Link to="/caregiver">
              <Button variant="outline" size="sm">
                Go to Caregiver Hub
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#24A99B] dark:text-[#2DD4BF]">
              <ShieldCheck className="h-4 w-4" />
              <span>Explicit Consent-Based Access · 4 Scopes</span>
              {!isRealAccountMode && USE_MOCKS && (
                <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300">
                  Interactive Demo · Simulated Alerts
                </span>
              )}
            </div>
            <h2 className="font-display text-2xl font-bold text-[#20243A] dark:text-[#F7F5F0]">
              Care Circle — {activePatient.name}
            </h2>
            <p className="text-sm text-[#5C627D] dark:text-[#A3A9C2]">
              Family relationships never grant automatic access. Toggle the 4 consent scopes or revoke caregiver and doctor access at any time.
            </p>
          </div>
          {!isRealAccountMode && (
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
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Caregiver Connections & Doctor Access */}
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#20243A] dark:text-[#F7F5F0]">
                Caregiver connections &amp; consent ({consentRecords.length})
              </CardTitle>
              <CardDescription>
                Approve pending family requests, manage contact priority, 4 consent scopes, and missed-dose alert thresholds.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConsentList
                consents={consentRecords}
                connectionsById={connectionsById}
                perspective={isPatientPerspective ? 'patient' : 'caregiver'}
                editable={isPatientPerspective}
                emptyMessage="No Care Circle contacts invited or connected yet."
                onAcceptInvite={(id) => respondCaregiverInvite(id, 'accepted')}
                onRevokeConsent={(id) => respondCaregiverInvite(id, 'revoked')}
                onRestoreConsent={(id) => respondCaregiverInvite(id, 'accepted')}
                onToggleScope={(id, scope) => handleToggleScope(id, scope)}
                onUpdateThreshold={handleUpdateThreshold}
              />
            </CardContent>
          </Card>

          {/* Authorized Doctors Card (Real Patient Accounts) */}
          {isRealAccountMode && isPatientPerspective && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#20243A] dark:text-[#F7F5F0]">
                  <Stethoscope className="h-4 w-4 text-[#7956C8] dark:text-[#A58AE8]" />
                  <span>Authorized doctors ({doctorAuthorizations.filter((d) => d.status === 'authorized').length})</span>
                </CardTitle>
                <CardDescription>
                  Doctors only view your medications, adherence, and reports when you explicitly authorize them.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleAuthorizeDoctor} className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    type="email"
                    list="medtwin-registered-doctors"
                    value={doctorEmail}
                    onChange={(e) => setDoctorEmail(e.target.value)}
                    placeholder="Enter doctor's registered email..."
                    aria-label="Doctor email to authorize"
                    required
                  />
                  <datalist id="medtwin-registered-doctors">
                    {registeredDoctors.map((doc) => (
                      <option key={doc.id} value={doc.email}>
                        {doc.fullName} {doc.specialty ? `(${doc.specialty})` : ''}
                      </option>
                    ))}
                  </datalist>
                  <Button type="submit" disabled={doctorSubmitting} className="shrink-0 whitespace-nowrap">
                    {doctorSubmitting ? 'Authorizing...' : 'Authorize doctor'}
                  </Button>
                </form>

                {doctorAuthorizations.length === 0 ? (
                  <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">
                    No clinicians have been authorized yet.
                  </p>
                ) : (
                  <div className="divide-y divide-[#E6E0D8] dark:divide-[#2B314D]">
                    {doctorAuthorizations.map((auth) => (
                      <div
                        key={auth.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-1 last:pb-1 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-[#20243A] dark:text-[#F7F5F0]">
                            {auth.doctorName}
                            {auth.doctorSpecialty ? ` · ${auth.doctorSpecialty}` : ''}
                          </p>
                          <p className="text-[#5C627D] dark:text-[#A3A9C2] capitalize">
                            Status: {auth.status} · Updated {formatTimestamp(auth.updatedAt)}
                          </p>
                        </div>
                        {auth.status === 'authorized' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void respondDoctorAuthorization(auth.id, 'revoked')}
                          >
                            Revoke access
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void respondDoctorAuthorization(auth.id, 'authorized')}
                          >
                            Re-authorize
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Alert History for Patient */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[#20243A] dark:text-[#F7F5F0]">Care Circle alerts</CardTitle>
              <CardDescription>
                Visibility of alert delivery states and caregiver follow-up acknowledgements
              </CardDescription>
            </CardHeader>
            <CardContent>
              {patientAlerts.length === 0 ? (
                <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">No Care Circle alerts recorded yet.</p>
              ) : (
                <div className="divide-y divide-[#E6E0D8] dark:divide-[#2B314D]">
                  {patientAlerts.map((a) => (
                    <div key={a.id} className="py-3 first:pt-0 last:pb-0 text-xs space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-[#20243A] dark:text-[#F7F5F0]">{a.title}</span>
                        <span className="font-medium capitalize text-[#24A99B] dark:text-[#2DD4BF]">
                          {a.delivery_status}
                        </span>
                      </div>
                      <p className="text-[#5C627D] dark:text-[#A3A9C2]">{a.reason}</p>
                      <p className="text-[11px] text-[#5C627D] dark:text-[#A3A9C2]">
                        {a.channel} · {formatTimestamp(a.created_at)}
                      </p>
                      {a.follow_up_note && (
                        <p className="rounded-lg bg-[#24A99B]/10 px-2.5 py-1.5 text-[#197B70] dark:bg-[#2DD4BF]/15 dark:text-[#2DD4BF]">
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
          {isPatientPerspective && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#20243A] dark:text-[#F7F5F0]">
                  <UserPlus className="h-4 w-4 text-[#24A99B] dark:text-[#2DD4BF]" />
                  <span>Invite to Care Circle</span>
                </CardTitle>
                <CardDescription>
                  Choose relationship label, priority, and initial consent scopes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleInviteSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[#20243A] dark:text-[#F7F5F0] mb-1">Full name</label>
                    <Input
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="e.g., Priya Patel"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#20243A] dark:text-[#F7F5F0] mb-1">Email</label>
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="caregiver@example.com"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#20243A] dark:text-[#F7F5F0] mb-1">
                        Relationship
                      </label>
                      <select
                        value={relationship}
                        onChange={(e) => setRelationship(e.target.value as RelationshipLabel)}
                        className="w-full h-10 rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] px-3 text-xs text-[#20243A] dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]"
                      >
                        {RELATIONSHIPS.map((rel) => (
                          <option key={rel} value={rel}>
                            {rel}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#20243A] dark:text-[#F7F5F0] mb-1">
                        Contact priority
                      </label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as 'primary' | 'secondary')}
                        className="w-full h-10 rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] px-3 text-xs text-[#20243A] dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]"
                      >
                        <option value="primary">Primary</option>
                        <option value="secondary">Secondary</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-2xl border border-[#E6E0D8] bg-[#FAF8F5] p-3.5 text-xs text-[#20243A] dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]">
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#5C627D] dark:text-[#A3A9C2]">
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
                            className="accent-[#7956C8] dark:accent-[#A58AE8] mt-0.5"
                          />
                          <span>
                            <strong className="font-medium text-[#20243A] dark:text-[#F7F5F0]">{scopeMeta.label}</strong>
                            <span className="block text-[11px] text-[#5C627D] dark:text-[#A3A9C2]">{scopeMeta.description}</span>
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
          )}

          {/* Optional Family Medical History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[#20243A] dark:text-[#F7F5F0]">Family medical history (optional)</CardTitle>
              <CardDescription>
                Separated from Care Circle permissions. Records reported family context without inferring hereditary diagnoses.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {familyHistory.length > 0 && (
                <div className="divide-y divide-[#E6E0D8] dark:divide-[#2B314D]">
                  {familyHistory.map((item) => (
                    <div key={item.id} className="py-2 first:pt-0 last:pb-0 text-xs">
                      <p className="font-semibold text-[#20243A] dark:text-[#F7F5F0]">
                        {item.relationship}: {item.reportedCondition}
                      </p>
                      <p className="text-[#5C627D] dark:text-[#A3A9C2]">
                        Source: {item.informationSource} · {formatShortDate(item.recordedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddFamilyHistory} className="space-y-2.5 border-t border-[#E6E0D8] pt-3 dark:border-[#2B314D]">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    aria-label="Family relationship"
                    value={fmhRel}
                    onChange={(e) => setFmhRel(e.target.value as RelationshipLabel)}
                    className="h-9 rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] px-2.5 text-xs text-[#20243A] dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]"
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
