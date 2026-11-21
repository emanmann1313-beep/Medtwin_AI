import React, { useMemo, useState } from 'react';
import { Building2, Search, ShieldCheck, UserPlus } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { computeRefillForecasts } from '@/src/services/adherenceEngine';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { formatShortDate } from '@/src/lib/utils';

export function HospitalDashboardPage() {
  const { state, assignPatientDoctor, enrollPatient } = useMedTwin();
  const [searchQuery, setSearchQuery] = useState('');

  const [enrollName, setEnrollName] = useState('');
  const [enrollAge, setEnrollAge] = useState('62');
  const [enrollGender, setEnrollGender] = useState('Female');
  const [enrollDoctorId, setEnrollDoctorId] = useState(state.doctors[0]?.id ?? 'doc-1');
  const [enrollConditions, setEnrollConditions] = useState('');

  const hospitalPatients = useMemo(
    () => state.patients.filter((p) => p.hospitalId === state.hospital.id),
    [state.hospital.id, state.patients],
  );

  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return hospitalPatients;
    const q = searchQuery.toLowerCase();
    return hospitalPatients.filter(
      (p) => p.name.toLowerCase().includes(q) || p.mrn.toLowerCase().includes(q),
    );
  }, [hospitalPatients, searchQuery]);

  const refillAttentionCount = useMemo(() => {
    let total = 0;
    for (const p of hospitalPatients) {
      const refills = computeRefillForecasts(p.id, state.medications);
      if (refills.some((r) => r.needsRefill)) total += 1;
    }
    return total;
  }, [hospitalPatients, state.medications]);

  const doctorWorkload = useMemo(() => {
    return state.doctors.map((doc) => {
      const assigned = hospitalPatients.filter((p) => p.assignedDoctorId === doc.id);
      const pendingFollowUps = assigned.filter((p) => Boolean(p.nextFollowUpDate)).length;
      return {
        name: doc.name.replace(', MD', ''),
        assignedPatients: assigned.length,
        pendingFollowUps,
      };
    });
  }, [hospitalPatients, state.doctors]);

  const outstandingAlertsCount = state.alerts.filter(
    (a) => a.deliveryState !== 'acknowledged',
  ).length;
  const pendingFollowUpsCount = hospitalPatients.filter((p) =>
    Boolean(p.nextFollowUpDate),
  ).length;

  const handleEnroll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollName.trim()) return;
    enrollPatient({
      name: enrollName.trim(),
      age: Number(enrollAge) || 55,
      gender: enrollGender,
      assignedDoctorId: enrollDoctorId,
      conditions: enrollConditions
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    });
    setEnrollName('');
    setEnrollConditions('');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#2563EB]">
              <Building2 className="h-4 w-4" />
              <span>Organization: {state.hospital.code} · {state.hospital.city}</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              {state.hospital.name} — Operations
            </h2>
            <p className="text-sm text-slate-500">
              Role-scoped operational overview. Clinical notes and full patient histories are restricted to authorized care clinicians.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-700">
            <ShieldCheck className="h-4 w-4 text-[#0D9488]" />
            <span>Organization boundary enforced</span>
          </div>
        </CardContent>
      </Card>

      {/* Operational Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Registered patients</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {hospitalPatients.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">Scoped to {state.hospital.code}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Assigned care teams</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums text-[#0D9488]">
              {state.doctors.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">Active physicians on panel</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending follow-ups &amp; alerts</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {pendingFollowUpsCount}
              <span className="ml-2 text-base font-medium text-amber-600">
                / {outstandingAlertsCount} alerts
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">Operational coordination queue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Patients with refill attention</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums text-amber-600">
              {refillAttentionCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">Approaching supply threshold</p>
          </CardContent>
        </Card>
      </div>

      {/* Doctor Workload Chart + Patient Enrollment */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Doctor workload overview</CardTitle>
            <CardDescription>Assigned patients and scheduled follow-ups per physician</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={doctorWorkload}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip />
                  <Bar dataKey="assignedPatients" fill="#0D9488" name="Assigned patients" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pendingFollowUps" fill="#2563EB" name="Pending follow-ups" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-[#0D9488]" />
              <span>Enroll patient</span>
            </CardTitle>
            <CardDescription>Register a new patient and assign an authorized doctor</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEnroll} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Patient name</label>
                <Input
                  value={enrollName}
                  onChange={(e) => setEnrollName(e.target.value)}
                  placeholder="Full name"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Age</label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={enrollAge}
                    onChange={(e) => setEnrollAge(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
                  <select
                    value={enrollGender}
                    onChange={(e) => setEnrollGender(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Non-binary">Non-binary</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Assign doctor</label>
                <select
                  value={enrollDoctorId}
                  onChange={(e) => setEnrollDoctorId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs"
                >
                  {state.doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.specialty})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Operational intake tags (optional)
                </label>
                <Input
                  value={enrollConditions}
                  onChange={(e) => setEnrollConditions(e.target.value)}
                  placeholder="e.g., Chronic Care Intake"
                />
              </div>
              <Button type="submit" className="w-full">
                Enroll &amp; assign
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Operational Patient Roster & Doctor Reassignment */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Patient roster &amp; doctor assignment</CardTitle>
            <CardDescription>
              Operational fields only — full clinical notes remain hidden from admin role
            </CardDescription>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient or MRN..."
              className="pl-9"
            />
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 pr-3 font-medium">Patient</th>
                  <th className="py-2.5 px-3 font-medium">MRN</th>
                  <th className="py-2.5 px-3 font-medium">Refill status</th>
                  <th className="py-2.5 px-3 font-medium">Next follow-up</th>
                  <th className="py-2.5 pl-3 font-medium">Assigned doctor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPatients.map((p) => {
                  const needsRefill = computeRefillForecasts(p.id, state.medications).some(
                    (r) => r.needsRefill,
                  );
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-3 pr-3 font-semibold text-slate-900 whitespace-nowrap">
                        {p.name}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                        {p.mrn}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={needsRefill ? 'font-semibold text-amber-700' : 'text-slate-600'}>
                          {needsRefill ? 'Refill attention' : 'Nominal'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                        {p.nextFollowUpDate ? formatShortDate(p.nextFollowUpDate) : 'Unscheduled'}
                      </td>
                      <td className="py-3 pl-3">
                        <select
                          aria-label={`Assign doctor for ${p.name}`}
                          value={p.assignedDoctorId}
                          onChange={(e) => assignPatientDoctor(p.id, e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                        >
                          {state.doctors.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
