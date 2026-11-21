import React, { useMemo, useState } from 'react';
import { BellRing, ShieldCheck, UserPlus, UserX } from 'lucide-react';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { RelationshipLabel } from '@/src/types/medtwin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Switch } from '@/src/components/ui/switch';
import { cn, formatShortDate } from '@/src/lib/utils';

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

  const familyHistory = useMemo(
    () => state.familyMedicalHistory.filter((f) => f.patientId === activePatient.id),
    [activePatient.id, state.familyMedicalHistory],
  );

  const patientAlerts = useMemo(
    () => state.alerts.filter((a) => a.patientId === activePatient.id),
    [activePatient.id, state.alerts],
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

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#0D9488]">
              <ShieldCheck className="h-4 w-4" />
              <span>Explicit Consent-Based Access</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              Care Circle — {activePatient.name}
            </h2>
            <p className="text-sm text-slate-600">
              Family relationships never grant automatic access. Every permission and alert preference is controlled per caregiver below.
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
        {/* Connected Caregivers & Granular Permissions */}
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Caregiver connections ({connections.length})</CardTitle>
              <CardDescription>
                Manage primary/secondary contacts, invitation status, and granular permissions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {connections.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  No Care Circle contacts invited yet.
                </p>
              ) : (
                connections.map((conn) => (
                  <div
                    key={conn.id}
                    className="rounded-2xl border border-slate-200 p-4 space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-semibold text-slate-900">
                            {conn.caregiverName}
                          </h4>
                          <span className="text-xs text-slate-500">
                            · {conn.relationship} · {conn.contactPriority} contact
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Invited {formatShortDate(conn.invitedAt)} · Status:{' '}
                          <span
                            className={cn(
                              'font-semibold capitalize',
                              conn.status === 'accepted'
                                ? 'text-[#0D9488]'
                                : conn.status === 'invited'
                                  ? 'text-amber-700'
                                  : 'text-red-600',
                            )}
                          >
                            {conn.status}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {conn.status === 'invited' && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => respondCaregiverInvite(conn.id, 'accepted')}
                          >
                            Simulate accept
                          </Button>
                        )}
                        {conn.status !== 'revoked' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => respondCaregiverInvite(conn.id, 'revoked')}
                          >
                            <UserX className="h-3.5 w-3.5" />
                            <span>Revoke</span>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => respondCaregiverInvite(conn.id, 'accepted')}
                          >
                            Restore
                          </Button>
                        )}
                      </div>
                    </div>

                    {conn.status !== 'revoked' && (
                      <div className="space-y-3 border-t border-slate-100 pt-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {(
                            [
                              { key: 'viewSchedules', label: 'View medication schedules' },
                              { key: 'receiveDoseAlerts', label: 'Receive dose alerts' },
                              { key: 'viewHistoryAndReports', label: 'View history & reports' },
                              { key: 'viewClinicianNotes', label: 'View clinician notes' },
                            ] as const
                          ).map((perm) => (
                            <label
                              key={perm.key}
                              className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs font-medium text-slate-700 cursor-pointer"
                            >
                              <span>{perm.label}</span>
                              <Switch
                                checked={conn.permissions[perm.key]}
                                onCheckedChange={(checked) =>
                                  updateCaregiverPermissions(conn.id, {
                                    ...conn.permissions,
                                    [perm.key]: checked,
                                  })
                                }
                              />
                            </label>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 pt-1">
                          <label className="flex items-center gap-2">
                            <span>Alert threshold (repeated unconfirmed doses):</span>
                            <select
                              value={conn.alertPreferences.repeatedMissedThreshold}
                              onChange={(e) =>
                                updateCaregiverPermissions(conn.id, conn.permissions, {
                                  ...conn.alertPreferences,
                                  repeatedMissedThreshold: Number(e.target.value),
                                })
                              }
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                            >
                              {[1, 2, 3, 4, 5].map((n) => (
                                <option key={n} value={n}>
                                  {n} missed
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Alert History for Patient */}
          <Card>
            <CardHeader>
              <CardTitle>Simulated Care Circle alerts</CardTitle>
              <CardDescription>
                Visibility of simulated delivery states and caregiver acknowledgements
              </CardDescription>
            </CardHeader>
            <CardContent>
              {patientAlerts.length === 0 ? (
                <p className="text-xs text-slate-500">No simulated alerts recorded for this patient.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {patientAlerts.map((a) => (
                    <div key={a.id} className="py-2.5 first:pt-0 last:pb-0 text-xs space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{a.title}</span>
                        <span className="font-medium capitalize text-[#0D9488]">
                          Simulated · {a.deliveryState}
                        </span>
                      </div>
                      <p className="text-slate-600">{a.reason}</p>
                      {a.followUpNote && (
                        <p className="text-[#0F766E]">
                          Follow-up ({a.acknowledgedBy}): {a.followUpNote}
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
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-[#0D9488]" />
                <span>Invite to Care Circle</span>
              </CardTitle>
              <CardDescription>
                Choose relationship label, priority, and initial consent permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInviteSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full name</label>
                  <Input
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="e.g., Priya Patel"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
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
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Relationship
                    </label>
                    <select
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value as RelationshipLabel)}
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800"
                    >
                      {RELATIONSHIPS.map((rel) => (
                        <option key={rel} value={rel}>
                          {rel}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Contact priority
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as 'primary' | 'secondary')}
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800"
                    >
                      <option value="primary">Primary</option>
                      <option value="secondary">Secondary</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permSchedule}
                      onChange={(e) => setPermSchedule(e.target.checked)}
                      className="accent-[#0D9488]"
                    />
                    <span>View medication schedules</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permAlerts}
                      onChange={(e) => setPermAlerts(e.target.checked)}
                      className="accent-[#0D9488]"
                    />
                    <span>Receive simulated dose alerts</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permHistory}
                      onChange={(e) => setPermHistory(e.target.checked)}
                      className="accent-[#0D9488]"
                    />
                    <span>View care history &amp; reports</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permNotes}
                      onChange={(e) => setPermNotes(e.target.checked)}
                      className="accent-[#0D9488]"
                    />
                    <span>View clinician notes</span>
                  </label>
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
              <CardTitle>Family medical history (optional)</CardTitle>
              <CardDescription>
                Separated from Care Circle permissions. Records reported family context without inferring hereditary diagnoses.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {familyHistory.length > 0 && (
                <div className="divide-y divide-slate-100">
                  {familyHistory.map((item) => (
                    <div key={item.id} className="py-2 first:pt-0 last:pb-0 text-xs">
                      <p className="font-semibold text-slate-900">
                        {item.relationship}: {item.reportedCondition}
                      </p>
                      <p className="text-slate-500">
                        Source: {item.informationSource} · {formatShortDate(item.recordedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddFamilyHistory} className="space-y-2.5 border-t border-slate-100 pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    aria-label="Family relationship"
                    value={fmhRel}
                    onChange={(e) => setFmhRel(e.target.value as RelationshipLabel)}
                    className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs"
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
