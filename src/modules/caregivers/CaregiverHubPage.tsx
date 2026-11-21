import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, Clock, Users } from 'lucide-react';
import { useMedTwin } from '@/src/context/MedTwinContext';
import {
  buildDoseSlotsForDate,
  computeAdherenceMetrics,
  computeRefillForecasts,
  getTodayIso,
} from '@/src/services/adherenceEngine';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { Textarea } from '@/src/components/ui/input';
import { cn, formatTimestamp } from '@/src/lib/utils';

export function CaregiverHubPage() {
  const {
    state,
    setActivePatientId,
    acknowledgeAlert,
    respondCaregiverInvite,
  } = useMedTwin();
  const navigate = useNavigate();

  const activeCaregiver =
    state.caregivers.find((c) => c.id === state.activeCaregiverId) ?? state.caregivers[0];

  const myConnections = useMemo(
    () =>
      state.connections.filter(
        (c) => c.caregiverId === activeCaregiver.id && c.status !== 'revoked',
      ),
    [activeCaregiver.id, state.connections],
  );

  const acceptedConnections = myConnections.filter((c) => c.status === 'accepted');
  const pendingInvites = myConnections.filter((c) => c.status === 'invited');

  const myAlerts = useMemo(
    () =>
      state.alerts.filter((a) =>
        acceptedConnections.some(
          (conn) =>
            conn.patientId === a.patientId &&
            conn.permissions.receiveDoseAlerts &&
            (!a.caregiverId || a.caregiverId === activeCaregiver.id),
        ),
      ),
    [acceptedConnections, activeCaregiver.id, state.alerts],
  );

  const [ackTargetId, setAckTargetId] = useState<string | null>(null);
  const [followUpNote, setFollowUpNote] = useState('');
  const todayStr = getTodayIso();

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <Card>
        <CardContent className="pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-medium text-[#0D9488]">
              Caregiver / Family Workspace · Simulated Alert Channel
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              {activeCaregiver.name}’s Care Circle Hub
            </h2>
            <p className="text-sm text-slate-500">
              Supporting {acceptedConnections.length} permitted patient(s). Access is strictly governed by patient consent.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => navigate('/caregivers')}>
            <Users className="h-4 w-4" />
            <span>Care Circle &amp; Consent Settings</span>
          </Button>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {pendingInvites.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="text-base">Pending Care Circle invitations ({pendingInvites.length})</CardTitle>
            <CardDescription>
              Accepting grants only the specific permissions selected by the patient.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingInvites.map((inv) => {
              const pat = state.patients.find((p) => p.id === inv.patientId);
              return (
                <div
                  key={inv.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {pat?.name ?? 'Patient'} invited you as {inv.relationship} ({inv.contactPriority})
                    </p>
                    <p className="text-xs text-slate-500">
                      Permissions offered:{' '}
                      {[
                        inv.permissions.viewSchedules && 'Schedules',
                        inv.permissions.receiveDoseAlerts && 'Dose alerts',
                        inv.permissions.viewHistoryAndReports && 'History',
                        inv.permissions.viewClinicianNotes && 'Clinician notes',
                      ]
                        .filter(Boolean)
                        .join(', ') || 'Minimal contact'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => respondCaregiverInvite(inv.id, 'accepted')}
                    >
                      Accept invite
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => respondCaregiverInvite(inv.id, 'revoked')}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Cards for Permitted Patients */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {acceptedConnections.map((conn) => {
          const patient = state.patients.find((p) => p.id === conn.patientId);
          if (!patient) return null;

          const todaySlots = conn.permissions.viewSchedules
            ? buildDoseSlotsForDate(patient.id, todayStr, state.medications, state.doseLogs)
            : [];
          const metrics7 = conn.permissions.viewSchedules
            ? computeAdherenceMetrics(patient.id, 7, state.medications, state.doseLogs)
            : null;
          const refills = conn.permissions.viewSchedules
            ? computeRefillForecasts(patient.id, state.medications).filter((r) => r.needsRefill)
            : [];
          const openAlerts = myAlerts.filter(
            (a) => a.patientId === patient.id && a.deliveryState !== 'acknowledged',
          );
          const latestEvent = state.history.find(
            (h) => h.patientId === patient.id && !h.restrictedToClinician,
          );

          const takenToday = todaySlots.filter((s) => s.state === 'taken').length;

          return (
            <Card key={conn.id}>
              <CardHeader className="border-b border-slate-100 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle>{patient.name}</CardTitle>
                    <CardDescription>
                      {conn.relationship} · {conn.contactPriority} contact · {patient.mrn}
                    </CardDescription>
                  </div>
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      openAlerts.length > 0 ? 'text-amber-700' : 'text-[#0D9488]',
                    )}
                  >
                    {openAlerts.length > 0
                      ? `${openAlerts.length} open alert(s)`
                      : 'No open alerts'}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                {conn.permissions.viewSchedules ? (
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block">Today’s status</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {takenToday} / {todaySlots.length} taken
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">7d adherence</span>
                      <span className="font-mono font-semibold text-[#0D9488] tabular-nums">
                        {metrics7?.adherencePct !== null ? `${metrics7?.adherencePct}%` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Refill attention</span>
                      <span
                        className={cn(
                          'font-semibold',
                          refills.length > 0 ? 'text-amber-700' : 'text-slate-700',
                        )}
                      >
                        {refills.length > 0 ? `${refills.length} needed` : 'Nominal'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Schedule viewing permission is disabled for this Care Circle link.
                  </p>
                )}

                <div className="border-t border-slate-100 pt-3 text-xs text-slate-600">
                  <span className="font-medium text-slate-800">Last update: </span>
                  {latestEvent
                    ? `${latestEvent.title} (${formatTimestamp(latestEvent.timestamp)})`
                    : 'No recent activity'}
                </div>

                <div className="flex flex-wrap gap-2">
                  {conn.permissions.viewSchedules && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActivePatientId(patient.id);
                        navigate('/medications');
                      }}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      <span>View permitted schedule</span>
                    </Button>
                  )}
                  {conn.permissions.viewHistoryAndReports && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setActivePatientId(patient.id);
                        navigate('/history');
                      }}
                    >
                      History
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Simulated Alerts & Acknowledgement Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-600" />
            <span>Care Circle alerts (Simulated)</span>
          </CardTitle>
          <CardDescription>
            Demo alerts visibly display delivery state (Created, Queued, Sent, Delivered, Failed, Acknowledged) without real SMS/email dispatch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {myAlerts.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No caregiver alerts for your permitted patients.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {myAlerts.map((alert) => {
                const patient = state.patients.find((p) => p.id === alert.patientId);
                const isAck = alert.deliveryState === 'acknowledged';
                return (
                  <div
                    key={alert.id}
                    className="flex flex-col gap-3 py-4 first:pt-1 last:pb-1 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-900">
                          {patient?.name ?? 'Patient'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-amber-700">Simulated</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={cn(
                            'font-semibold capitalize',
                            isAck ? 'text-[#0D9488]' : 'text-red-600',
                          )}
                        >
                          State: {alert.deliveryState}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-slate-400 tabular-nums">
                          {formatTimestamp(alert.createdAt)}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900">{alert.title}</h4>
                      <p className="text-xs text-slate-600">{alert.reason}</p>
                      <p className="text-[11px] text-slate-400">{alert.channelLabel}</p>
                      {alert.followUpNote && (
                        <p className="mt-1 text-xs text-[#0F766E]">
                          Follow-up note ({alert.acknowledgedBy}): {alert.followUpNote}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0">
                      {isAck ? (
                        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0D9488]">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Acknowledged</span>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setFollowUpNote('');
                            setAckTargetId(alert.id);
                          }}
                        >
                          Acknowledge &amp; add note
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(ackTargetId)} onOpenChange={(open) => !open && setAckTargetId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acknowledge Care Circle alert</DialogTitle>
            <DialogDescription>
              Confirm you saw this simulated alert and optionally record a follow-up note for the care team.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!ackTargetId) return;
              acknowledgeAlert(ackTargetId, followUpNote);
              setAckTargetId(null);
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="ack-followup" className="block text-xs font-medium text-slate-700 mb-1.5">
                Follow-up note (optional)
              </label>
              <Textarea
                id="ack-followup"
                value={followUpNote}
                onChange={(e) => setFollowUpNote(e.target.value)}
                placeholder="e.g., Spoke with Mom by phone; picked up refill from Oakridge pharmacy."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAckTargetId(null)}>
                Cancel
              </Button>
              <Button type="submit">Confirm acknowledgement</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
