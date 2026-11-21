import React, { useMemo, useState } from 'react';
import { Download, Search, ShieldAlert } from 'lucide-react';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { CareHistoryCategory } from '@/src/types/medtwin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { cn, formatShortDate, formatTimestamp } from '@/src/lib/utils';

const CATEGORY_OPTIONS: Array<{ id: CareHistoryCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All events' },
  { id: 'prescription', label: 'Prescriptions' },
  { id: 'dose', label: 'Dose records' },
  { id: 'medication_change', label: 'Med changes' },
  { id: 'refill', label: 'Refills' },
  { id: 'appointment', label: 'Appointments' },
  { id: 'report', label: 'Reports' },
  { id: 'clinician_note', label: 'Clinician notes' },
  { id: 'caregiver_alert', label: 'Caregiver alerts' },
  { id: 'dadi_nani_share', label: 'Dadi-Nani shares' },
];

export function CareHistoryPage() {
  const { state, activePatient, activeRole } = useMedTwin();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CareHistoryCategory | 'all'>('all');

  // Permission enforcement when viewing as Caregiver
  const caregiverConnection = useMemo(() => {
    if (activeRole !== 'caregiver') return null;
    return state.connections.find(
      (c) =>
        c.patientId === activePatient.id &&
        c.caregiverId === state.activeCaregiverId &&
        c.status === 'accepted',
    );
  }, [activePatient.id, activeRole, state.activeCaregiverId, state.connections]);

  const canViewHistoryAndReports =
    activeRole === 'patient' ||
    activeRole === 'doctor' ||
    Boolean(caregiverConnection?.permissions.viewHistoryAndReports);

  const canViewClinicianNotes =
    activeRole === 'doctor' ||
    (activeRole === 'caregiver' && Boolean(caregiverConnection?.permissions.viewClinicianNotes));

  const unifiedTimeline = useMemo(() => {
    if (!canViewHistoryAndReports) return [];

    // Combine base history events with appointments & reports if not already represented
    const apptEvents = state.appointments
      .filter((a) => a.patientId === activePatient.id)
      .map((a) => ({
        id: `appt-ev-${a.id}`,
        patientId: a.patientId,
        category: 'appointment' as const,
        title: `Appointment: ${a.purpose}`,
        details: `${a.doctorName} · Status: ${a.status} · Scheduled for ${formatShortDate(a.scheduledFor)}`,
        actorName: a.doctorName,
        actorRole: 'doctor' as const,
        timestamp: a.scheduledFor.includes('T') ? `${a.scheduledFor}:00.000Z` : a.scheduledFor,
        restrictedToClinician: false,
      }));

    const combined = [...state.history.filter((h) => h.patientId === activePatient.id), ...apptEvents];

    return combined
      .filter((ev) => {
        if (ev.restrictedToClinician && !canViewClinicianNotes) return false;
        if (categoryFilter !== 'all' && ev.category !== categoryFilter) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          ev.title.toLowerCase().includes(q) ||
          ev.details.toLowerCase().includes(q) ||
          ev.actorName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [
    activePatient.id,
    canViewClinicianNotes,
    canViewHistoryAndReports,
    categoryFilter,
    searchQuery,
    state.appointments,
    state.history,
  ]);

  const handleExportCsv = () => {
    const header = ['Timestamp', 'Category', 'Title', 'Details', 'Recorded By'];
    const rows = unifiedTimeline.map((ev) => [
      ev.timestamp,
      ev.category,
      `"${ev.title.replace(/"/g, '""')}"`,
      `"${ev.details.replace(/"/g, '""')}"`,
      `"${ev.actorName.replace(/"/g, '""')}"`,
    ]);
    const csvContent = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activePatient.mrn.toLowerCase()}-care-history.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!canViewHistoryAndReports) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" />
          <h3 className="font-display text-lg font-semibold text-slate-900">
            History &amp; Reports permission required
          </h3>
          <p className="mx-auto max-w-md text-sm text-slate-500">
            Your current Care Circle connection for {activePatient.name} does not include permission to view care history and reports.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Care history timeline — {activePatient.name}</CardTitle>
            <CardDescription>
              Searchable audit trail of prescriptions, doses, refills, appointments, reports, alerts, and Dadi-Nani updates
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCsv}
            disabled={unifiedTimeline.length === 0}
          >
            <Download className="h-4 w-4" />
            <span>Export CSV summary</span>
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search medicines, actors, notes..."
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.filter(
                (opt) => opt.id !== 'clinician_note' || canViewClinicianNotes,
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCategoryFilter(opt.id)}
                  className={cn(
                    'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                    categoryFilter === opt.id
                      ? 'bg-[#0B1220] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {!canViewClinicianNotes && (
            <p className="text-xs text-slate-500">
              Clinician-only notes are hidden based on current workspace permissions.
            </p>
          )}

          {unifiedTimeline.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No care history records match your current search or filter.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {unifiedTimeline.map((ev) => (
                <div
                  key={ev.id}
                  className="flex flex-col gap-1.5 py-3.5 first:pt-1 last:pb-1 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold uppercase tracking-wide text-[#0D9488]">
                        {ev.category.replace('_', ' ')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Recorded by {ev.actorName}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{ev.title}</p>
                    <p className="text-xs text-slate-600">{ev.details}</p>
                  </div>
                  <span className="font-mono text-xs text-slate-400 tabular-nums shrink-0">
                    {formatTimestamp(ev.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
