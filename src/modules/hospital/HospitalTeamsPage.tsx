import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Switch } from '@/src/components/ui/switch';

export function HospitalTeamsPage() {
  const { state, toggleManagedUserActive } = useMedTwin();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#0D9488]" />
            <span>Care teams, roles &amp; organization boundary</span>
          </CardTitle>
          <CardDescription>
            {state.hospital.name} ({state.hospital.code}) · Active departments:{' '}
            {state.hospital.activeDepartments.join(', ')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 pr-3 font-medium">Name</th>
                  <th className="py-2.5 px-3 font-medium">Role</th>
                  <th className="py-2.5 px-3 font-medium">Organization</th>
                  <th className="py-2.5 px-3 font-medium">Email</th>
                  <th className="py-2.5 pl-3 font-medium text-right">Access status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.managedUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3 pr-3 font-semibold text-slate-900">{u.name}</td>
                    <td className="py-3 px-3 capitalize text-slate-700">
                      {u.role.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500">{state.hospital.code}</td>
                    <td className="py-3 px-3 text-slate-500">{u.email}</td>
                    <td className="py-3 pl-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <span className={u.active ? 'text-[#0D9488] font-medium' : 'text-slate-400'}>
                          {u.active ? 'Active' : 'Suspended'}
                        </span>
                        <Switch
                          checked={u.active}
                          onCheckedChange={() => toggleManagedUserActive(u.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
