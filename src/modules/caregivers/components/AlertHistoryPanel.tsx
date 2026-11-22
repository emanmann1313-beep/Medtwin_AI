import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  FileEdit,
  Filter,
  MessageCircle,
  MessageSquare,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { AlertDeliveryState, CareAlert, Patient } from '@/src/types/medtwin';
import {
  getAlertTypeLabel,
  getDeliveryStatusLabel,
} from '@/src/services/caregiverMessaging';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { cn, formatTimestamp } from '@/src/lib/utils';

interface AlertHistoryPanelProps {
  alerts: CareAlert[];
  patients: Patient[];
  emptyMessage?: string;
}

const STATUS_FILTERS: Array<{ id: 'all' | AlertDeliveryState; label: string }> = [
  { id: 'all', label: 'All statuses' },
  { id: 'draft', label: 'Draft' },
  { id: 'opened_messaging_app', label: 'Opened Messaging App' },
  { id: 'sent', label: 'Sent' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'failed', label: 'Failed' },
  { id: 'acknowledged', label: 'Acknowledged' },
];

export function AlertHistoryPanel({
  alerts,
  patients,
  emptyMessage = 'No caregiver alerts or messaging events recorded yet.',
}: AlertHistoryPanelProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | AlertDeliveryState>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | 'whatsapp' | 'sms' | 'in_app'>('all');
  const [detailAlert, setDetailAlert] = useState<CareAlert | null>(null);

  const patientMap = useMemo(() => {
    const map: Record<string, Patient> = {};
    for (const p of patients) map[p.id] = p;
    return map;
  }, [patients]);

  const getChannelKind = (a: CareAlert): 'whatsapp' | 'sms' | 'in_app' => {
    if (a.channel) return a.channel;
    const lower = a.channelLabel.toLowerCase();
    if (lower.includes('whatsapp')) return 'whatsapp';
    if (lower.includes('sms')) return 'sms';
    return 'in_app';
  };

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (statusFilter !== 'all' && a.deliveryState !== statusFilter) return false;
      if (channelFilter !== 'all' && getChannelKind(a) !== channelFilter) return false;
      return true;
    });
  }, [alerts, channelFilter, statusFilter]);

  const statusToneClass = (st: AlertDeliveryState) => {
    switch (st) {
      case 'delivered':
      case 'acknowledged':
        return 'text-[#34D399]';
      case 'sent':
      case 'opened_messaging_app':
        return 'text-[#8B5CF6]';
      case 'failed':
        return 'text-[#FB7185]';
      case 'draft':
      default:
        return 'text-[#FBBF24]';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-[#A8B8CC]">
          <Filter className="h-3.5 w-3.5 text-[#8B5CF6]" />
          <span>
            Showing <strong className="text-[#F8FAFC] tabular-nums">{filteredAlerts.length}</strong> of{' '}
            <strong className="text-[#F8FAFC] tabular-nums">{alerts.length}</strong> alert events
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter alert history by channel"
            value={channelFilter}
            onChange={(e) =>
              setChannelFilter(e.target.value as 'all' | 'whatsapp' | 'sms' | 'in_app')
            }
            className="h-9 rounded-xl border border-[#334155] bg-[#0B1220] px-3 text-xs text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
          >
            <option value="all">All channels</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
            <option value="in_app">In-App</option>
          </select>

          <select
            aria-label="Filter alert history by delivery status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | AlertDeliveryState)}
            className="h-9 rounded-xl border border-[#334155] bg-[#0B1220] px-3 text-xs text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredAlerts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#334155] bg-[#1A2740] py-10 px-4 text-center text-xs text-[#A8B8CC]">
          {emptyMessage}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#334155] bg-[#1A2740]">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#334155] text-[#A8B8CC]">
                <th className="py-3 pl-4 pr-3 font-semibold">Date &amp; time</th>
                <th className="py-3 px-3 font-semibold">Patient</th>
                <th className="py-3 px-3 font-semibold">Caregiver</th>
                <th className="py-3 px-3 font-semibold">Alert type</th>
                <th className="py-3 px-3 font-semibold">Channel</th>
                <th className="py-3 px-3 font-semibold">Delivery status</th>
                <th className="py-3 pl-3 pr-4 font-semibold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]">
              {filteredAlerts.map((alert) => {
                const patName = patientMap[alert.patientId]?.name || 'Patient';
                const cgName = alert.caregiverName || 'Caregiver';
                const chKind = getChannelKind(alert);
                const statusText = getDeliveryStatusLabel(alert.deliveryState);
                return (
                  <tr
                    key={alert.id}
                    className="hover:bg-[#223451] transition-colors"
                  >
                    <td className="py-3 pl-4 pr-3 font-mono text-[11px] text-[#A8B8CC] tabular-nums whitespace-nowrap">
                      {formatTimestamp(alert.createdAt)}
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#F8FAFC] whitespace-nowrap">
                      {patName}
                    </td>
                    <td className="py-3 px-3 text-[#F8FAFC] whitespace-nowrap">
                      {cgName}
                    </td>
                    <td className="py-3 px-3 text-[#A8B8CC] whitespace-nowrap">
                      {getAlertTypeLabel(alert.alertType)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#F8FAFC]">
                        {chKind === 'whatsapp' ? (
                          <MessageCircle className="h-3.5 w-3.5 text-[#2DD4BF]" />
                        ) : chKind === 'sms' ? (
                          <MessageSquare className="h-3.5 w-3.5 text-[#8B5CF6]" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5 text-[#A8B8CC]" />
                        )}
                        <span>
                          {chKind === 'whatsapp'
                            ? 'WhatsApp'
                            : chKind === 'sms'
                              ? 'SMS'
                              : 'In-App'}
                        </span>
                        {alert.simulated && (
                          <span className="text-[11px] text-[#FBBF24]">
                            · Simulated
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={cn('font-semibold', statusToneClass(alert.deliveryState))}>
                        {statusText}
                      </span>
                    </td>
                    <td className="py-3 pl-3 pr-4 text-right whitespace-nowrap">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setDetailAlert(alert)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View Details</span>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Alert Audit Details Modal */}
      <Dialog open={Boolean(detailAlert)} onOpenChange={(open) => !open && setDetailAlert(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#F8FAFC]">
              Alert Delivery Details
            </DialogTitle>
            <DialogDescription>
              {detailAlert ? `${patientMap[detailAlert.patientId]?.name || 'Patient'} · ${formatTimestamp(detailAlert.createdAt)}` : ''}
            </DialogDescription>
          </DialogHeader>

          {detailAlert && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#334155] bg-[#223451] p-3.5">
                <div>
                  <span className="block text-[11px] text-[#A8B8CC]">Caregiver</span>
                  <span className="font-semibold text-[#F8FAFC]">
                    {detailAlert.caregiverName || 'Caregiver'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-[#A8B8CC]">Target phone</span>
                  <span className="font-mono text-[#F8FAFC]">
                    {detailAlert.recipientPhone || 'Not specified'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-[#A8B8CC]">Alert type</span>
                  <span className="font-medium text-[#F8FAFC]">
                    {getAlertTypeLabel(detailAlert.alertType)}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-[#A8B8CC]">Delivery status</span>
                  <span className={cn('font-semibold', statusToneClass(detailAlert.deliveryState))}>
                    {getDeliveryStatusLabel(detailAlert.deliveryState)}
                    {detailAlert.simulated ? ' (Simulated Demo)' : ''}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-[#F8FAFC]">Event summary</span>
                <p className="text-[#F8FAFC] font-medium">{detailAlert.title}</p>
                <p className="text-[#A8B8CC]">{detailAlert.reason}</p>
              </div>

              {detailAlert.messageBody && (
                <div className="space-y-1">
                  <span className="font-semibold text-[#F8FAFC]">Message text</span>
                  <div className="rounded-xl border border-[#334155] bg-[#223451] p-3 text-[#F8FAFC] whitespace-pre-wrap">
                    {detailAlert.messageBody}
                  </div>
                </div>
              )}

              {detailAlert.providerError && (
                <div className="flex items-start gap-2 rounded-xl border border-[#FB7185]/45 bg-[#FB7185]/12 p-3 text-[#FB7185]">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{detailAlert.providerError}</span>
                </div>
              )}

              {detailAlert.followUpNote && (
                <div className="flex items-start gap-2 rounded-xl border border-[#34D399]/35 bg-[#34D399]/12 p-3 text-[#34D399]">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      Acknowledged by {detailAlert.acknowledgedBy || 'Caregiver'}
                    </p>
                    <p className="text-[#F8FAFC]/90">{detailAlert.followUpNote}</p>
                  </div>
                </div>
              )}

              {detailAlert.deliveryState === 'opened_messaging_app' && (
                <div className="flex items-start gap-2 rounded-xl border border-[#334155] bg-[#223451] p-3 text-[#A8B8CC]">
                  <FileEdit className="h-4 w-4 shrink-0 mt-0.5 text-[#2DD4BF]" />
                  <span>
                    User confirmed and launched their device messaging app manually. External app confirmation cannot be tracked without a configured automated messaging API.
                  </span>
                </div>
              )}

              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setDetailAlert(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
