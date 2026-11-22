import React from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Switch } from '@/src/components/ui/switch';

export function HospitalTeamsPage() {
  const { user } = useAuth();
  const { state, isRealAccountMode, toggleManagedUserActive } = useMedTwin();
  const isHospitalVerified = !isRealAccountMode || user?.verificationStatus === 'verified';

  return (
    <div className="space-y-6">
      {isRealAccountMode && !isHospitalVerified && (
        <Card className="border-amber-200 bg-amber-50/70 dark:border-amber-700/50 dark:bg-amber-950/30">
          <CardContent className="pt-5 pb-5 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-200">
                Verification pending — Team controls read-only
              </h3>
              <p className="text-xs text-amber-900/90 dark:text-amber-200/85">
                Hospital credential verification must complete before provisioning or suspending affiliated clinician accounts.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#24A99B] dark:text-[#2DD4BF]" />
            <span>Care teams, roles &amp; organization boundary</span>
          </CardTitle>
          <CardDescription>
            {state.hospital.name} ({state.hospital.code}) · Active departments:{' '}
            {state.hospital.activeDepartments.join(', ')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state.managedUsers.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#5C627D] dark:text-[#A3A9C2]">
              No staff accounts linked to this organization yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E6E0D8] text-[#5C627D] dark:border-[#2B314D] dark:text-[#A3A9C2]">
                    <th className="py-2.5 pr-3 font-medium">Name</th>
                    <th className="py-2.5 px-3 font-medium">Role</th>
                    <th className="py-2.5 px-3 font-medium">Organization</th>
                    <th className="py-2.5 px-3 font-medium">Email</th>
                    <th className="py-2.5 pl-3 font-medium text-right">Access status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E0D8] dark:divide-[#2B314D]">
                  {state.managedUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-[#FAF8F5] dark:hover:bg-[#1E243D]">
                      <td className="py-3 pr-3 font-semibold text-[#20243A] dark:text-[#F7F5F0]">{u.name}</td>
                      <td className="py-3 px-3 capitalize text-[#5C627D] dark:text-[#A3A9C2]">
                        {u.role.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-3 font-mono text-[#5C627D] dark:text-[#A3A9C2]">{state.hospital.code}</td>
                      <td className="py-3 px-3 text-[#5C627D] dark:text-[#A3A9C2]">{u.email}</td>
                      <td className="py-3 pl-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <span className={u.active ? 'text-[#24A99B] dark:text-[#2DD4BF] font-medium' : 'text-[#5C627D] dark:text-[#A3A9C2]'}>
                            {u.active ? 'Active' : 'Suspended'}
                          </span>
                          <Switch
                            checked={u.active}
                            disabled={isRealAccountMode}
                            onCheckedChange={() => toggleManagedUserActive(u.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
