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
        <Card className="border-[#FBBF24]/45 bg-[#FBBF24]/10">
          <CardContent className="pt-5 pb-5 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-[#FBBF24] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[#F8FAFC]">
                Verification pending — Team controls read-only
              </h3>
              <p className="text-xs text-[#A8B8CC]">
                Hospital credential verification must complete before provisioning or suspending affiliated clinician accounts.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#2DD4BF]" />
            <span>Care teams, roles &amp; organization boundary</span>
          </CardTitle>
          <CardDescription>
            {state.hospital.name} ({state.hospital.code}) · Active departments:{' '}
            {state.hospital.activeDepartments.join(', ')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state.managedUsers.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#A8B8CC]">
              No staff accounts linked to this organization yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#334155] text-[#A8B8CC]">
                    <th className="py-2.5 pr-3 font-medium">Name</th>
                    <th className="py-2.5 px-3 font-medium">Role</th>
                    <th className="py-2.5 px-3 font-medium">Organization</th>
                    <th className="py-2.5 px-3 font-medium">Email</th>
                    <th className="py-2.5 pl-3 font-medium text-right">Access status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334155]">
                  {state.managedUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-[#223451] transition-colors">
                      <td className="py-3 pr-3 font-semibold text-[#F8FAFC]">{u.name}</td>
                      <td className="py-3 px-3 capitalize text-[#A8B8CC]">
                        {u.role.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-3 font-mono text-[#A8B8CC]">{state.hospital.code}</td>
                      <td className="py-3 px-3 text-[#A8B8CC]">{u.email}</td>
                      <td className="py-3 pl-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <span className={u.active ? 'text-[#34D399] font-medium' : 'text-[#A8B8CC]'}>
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
