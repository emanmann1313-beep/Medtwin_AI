import React, { useMemo, useState } from 'react';
import { Building2, Search, ShieldAlert, ShieldCheck, UserPlus } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/src/context/AuthContext';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { useTheme } from '@/src/context/ThemeContext';
import { computeRefillForecasts } from '@/src/services/adherenceEngine';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { formatShortDate } from '@/src/lib/utils';

export function HospitalDashboardPage() {
  const { user } = useAuth();
  const { state, isRealAccountMode, assignPatientDoctor, enrollPatient } = useMedTwin();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');

  const [enrollName, setEnrollName] = useState('');
  const [enrollAge, setEnrollAge] = useState('62');
  const [enrollGender, setEnrollGender] = useState('Female');
  const [enrollDoctorId, setEnrollDoctorId] = useState(state.doctors[0]?.id ?? '');
  const [enrollConditions, setEnrollConditions] = useState('');

  const isHospitalVerified = !isRealAccountMode || user?.verificationStatus === 'verified';

  const hospitalPatients = useMemo(
    () =>
      isRealAccountMode
        ? state.patients
        : state.patients.filter((p) => p.hospitalId === state.hospital.id),
    [isRealAccountMode, state.hospital.id, state.patients],
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
    if (!isHospitalVerified) return;
    if (!enrollName.trim()) return;
    enrollPatient({
      name: enrollName.trim(),
      age: Number(enrollAge) || 55,
      gender: enrollGender,
      assignedDoctorId: enrollDoctorId || state.doctors[0]?.id || '',
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
      {isRealAccountMode && !isHospitalVerified && (
        <Card className="border-amber-200 bg-amber-50/70 dark:border-amber-700/50 dark:bg-amber-950/30">
          <CardContent className="pt-5 pb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-200">
                  Organization verification pending ({user?.verificationStatus.replace('_', ' ')})
                </h3>
                <p className="text-xs text-amber-900/90 dark:text-amber-200/85 max-w-2xl">
                  Hospital administrative actions—including direct patient enrollment and cross-team record provisioning—remain restricted until institutional verification is completed.
                </p>
              </div>
            </div>
            <span className="shrink-0 font-mono text-xs font-semibold text-amber-800 dark:text-amber-300">
              Reg: {user?.registrationDetails || 'Submitted'}
            </span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#7956C8] dark:text-[#A58AE8]">
              <Building2 className="h-4 w-4" />
              <span>
                Organization: {state.hospital.code}
                {state.hospital.city ? ` · ${state.hospital.city}` : ''}
              </span>
            </div>
            <h2 className="font-display text-2xl font-bold text-[#20243A] dark:text-[#F7F5F0]">
              {state.hospital.name} — Operations
            </h2>
            <p className="text-sm text-[#5C627D] dark:text-[#A3A9C2]">
              Role-scoped operational overview. Full clinician notes remain hidden to protect patient privacy.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-[#E6E0D8] bg-[#FAF8F5] px-3.5 py-2 text-xs text-[#20243A] dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]">
            <ShieldCheck className="h-4 w-4 text-[#24A99B] dark:text-[#2DD4BF]" />
            <span>Organization boundary enforced</span>
          </div>
        </CardContent>
      </Card>

      {/* Operational Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Authorized patients</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums text-[#20243A] dark:text-[#F7F5F0]">
              {hospitalPatients.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">Scoped to {state.hospital.code}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Registered clinicians</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums text-[#24A99B] dark:text-[#2DD4BF]">
              {state.doctors.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">Doctors in directory</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending follow-ups &amp; alerts</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums text-[#20243A] dark:text-[#F7F5F0]">
              {pendingFollowUpsCount}
              <span className="ml-2 text-base font-medium text-amber-600 dark:text-amber-400">
                / {outstandingAlertsCount} alerts
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">Operational coordination queue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Refill attention needed</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {refillAttentionCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">Patients approaching supply threshold</p>
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
            {doctorWorkload.length === 0 ? (
              <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-[#E6E0D8] text-xs text-[#5C627D] dark:border-[#2B314D] dark:text-[#A3A9C2]">
                No doctors affiliated with this organization yet.
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={doctorWorkload}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#2B314D' : '#E6E0D8'} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: isDark ? '#A3A9C2' : '#5C627D' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: isDark ? '#A3A9C2' : '#5C627D' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#171B2E' : '#FFFFFF',
                        borderColor: isDark ? '#2B314D' : '#E6E0D8',
                        color: isDark ? '#F7F5F0' : '#20243A',
                        borderRadius: '12px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="assignedPatients" fill={isDark ? '#2DD4BF' : '#24A99B'} name="Assigned patients" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pendingFollowUps" fill="#7956C8" name="Pending follow-ups" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-[#24A99B] dark:text-[#2DD4BF]" />
              <span>Enroll patient</span>
            </CardTitle>
            <CardDescription>
              {isHospitalVerified
                ? 'Register a patient and assign an authorized doctor'
                : 'Disabled until organization verification is approved'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEnroll} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#20243A] dark:text-[#F7F5F0] mb-1">Patient name</label>
                <Input
                  value={enrollName}
                  onChange={(e) => setEnrollName(e.target.value)}
                  placeholder="Full name"
                  required
                  disabled={!isHospitalVerified}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#20243A] dark:text-[#F7F5F0] mb-1">Age</label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={enrollAge}
                    onChange={(e) => setEnrollAge(e.target.value)}
                    disabled={!isHospitalVerified}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#20243A] dark:text-[#F7F5F0] mb-1">Gender</label>
                  <select
                    value={enrollGender}
                    onChange={(e) => setEnrollGender(e.target.value)}
                    disabled={!isHospitalVerified}
                    className="h-10 w-full rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] px-3 text-xs text-[#20243A] dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Non-binary">Non-binary</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#20243A] dark:text-[#F7F5F0] mb-1">Assign doctor</label>
                <select
                  value={enrollDoctorId}
                  onChange={(e) => setEnrollDoctorId(e.target.value)}
                  disabled={!isHospitalVerified || state.doctors.length === 0}
                  className="h-10 w-full rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] px-3 text-xs text-[#20243A] dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]"
                >
                  {state.doctors.length === 0 ? (
                    <option value="">No affiliated doctors registered yet</option>
                  ) : (
                    state.doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.specialty})
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#20243A] dark:text-[#F7F5F0] mb-1">
                  Operational intake tags (optional)
                </label>
                <Input
                  value={enrollConditions}
                  onChange={(e) => setEnrollConditions(e.target.value)}
                  placeholder="e.g., Chronic Care Intake"
                  disabled={!isHospitalVerified}
                />
              </div>
              <Button type="submit" className="w-full" disabled={!isHospitalVerified}>
                {isHospitalVerified ? 'Enroll & assign' : 'Pending organization verification'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Operational Patient Roster & Doctor Reassignment */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Authorized patient directory</CardTitle>
            <CardDescription>
              Operational fields only — full clinical notes remain restricted to treating clinicians
            </CardDescription>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5C627D] dark:text-[#A3A9C2]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient or MRN..."
              className="pl-9"
            />
          </div>
        </CardHeader>

        <CardContent>
          {filteredPatients.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#5C627D] dark:text-[#A3A9C2]">
              No patients enrolled or authorized for this hospital workspace yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E6E0D8] text-[#5C627D] dark:border-[#2B314D] dark:text-[#A3A9C2]">
                    <th className="py-2.5 pr-3 font-medium">Patient</th>
                    <th className="py-2.5 px-3 font-medium">MRN</th>
                    <th className="py-2.5 px-3 font-medium">Refill status</th>
                    <th className="py-2.5 px-3 font-medium">Next follow-up</th>
                    <th className="py-2.5 pl-3 font-medium">Assigned doctor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E0D8] dark:divide-[#2B314D]">
                  {filteredPatients.map((p) => {
                    const needsRefill = computeRefillForecasts(p.id, state.medications).some(
                      (r) => r.needsRefill,
                    );
                    return (
                      <tr key={p.id} className="hover:bg-[#FAF8F5] dark:hover:bg-[#1E243D]">
                        <td className="py-3 pr-3 font-semibold text-[#20243A] dark:text-[#F7F5F0] whitespace-nowrap">
                          {p.name}
                        </td>
                        <td className="py-3 px-3 font-mono text-[#5C627D] dark:text-[#A3A9C2] tabular-nums whitespace-nowrap">
                          {p.mrn}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={needsRefill ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-[#5C627D] dark:text-[#A3A9C2]'}>
                            {needsRefill ? 'Refill attention' : 'Nominal'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[#5C627D] dark:text-[#A3A9C2] tabular-nums whitespace-nowrap">
                          {p.nextFollowUpDate ? formatShortDate(p.nextFollowUpDate) : 'Unscheduled'}
                        </td>
                        <td className="py-3 pl-3">
                          {isRealAccountMode ? (
                            <span className="text-[#5C627D] dark:text-[#A3A9C2]">
                              {state.doctors.find((d) => d.id === p.assignedDoctorId)?.name ?? 'Patient-managed'}
                            </span>
                          ) : (
                            <select
                              aria-label={`Assign doctor for ${p.name}`}
                              value={p.assignedDoctorId}
                              onChange={(e) => assignPatientDoctor(p.id, e.target.value)}
                              className="rounded-lg border border-[#E6E0D8] bg-[#FFFFFF] px-2.5 py-1.5 text-xs text-[#20243A] dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]"
                            >
                              {state.doctors.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
