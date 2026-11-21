import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bot,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileScan,
  HeartHandshake,
  History,
  LayoutDashboard,
  Menu,
  Pill,
  RotateCcw,
  ShieldCheck,
  Stethoscope,
  Users,
  X,
} from 'lucide-react';
import { DEMO_ACCOUNTS } from '@/src/data/seedData';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { WorkspaceRole } from '@/src/types/medtwin';
import { cn } from '@/src/lib/utils';
import { CareAssistantDrawer } from '@/src/modules/assistant/CareAssistantDrawer';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_BY_ROLE: Record<WorkspaceRole, NavItem[]> = {
  patient: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/prescriptions', label: 'Scan Prescription', icon: FileScan },
    { to: '/medications', label: 'Medications', icon: Pill },
    { to: '/digital-twin', label: 'Digital Twin', icon: Activity },
    { to: '/history', label: 'Care History', icon: History },
    { to: '/caregivers', label: 'Care Circle', icon: Users },
    { to: '/dadi-nani', label: 'Dadi-Nani Mode', icon: HeartHandshake },
  ],
  caregiver: [
    { to: '/caregiver', label: 'Caregiver Hub', icon: LayoutDashboard },
    { to: '/caregivers', label: 'Care Circle & Alerts', icon: Users },
    { to: '/medications', label: 'Permitted Schedules', icon: CalendarClock },
    { to: '/history', label: 'Care History', icon: History },
    { to: '/dadi-nani', label: 'Dadi-Nani Journal', icon: HeartHandshake },
  ],
  doctor: [
    { to: '/doctor', label: 'Patient Panel', icon: Stethoscope },
    { to: '/prescriptions', label: 'Prescription Review', icon: ClipboardList },
    { to: '/digital-twin', label: 'Digital Twin Review', icon: Activity },
  ],
  hospital_admin: [
    { to: '/hospital', label: 'Hospital Operations', icon: Building2 },
    { to: '/hospital/teams', label: 'Care Teams & Access', icon: ShieldCheck },
  ],
};

const DEFAULT_ROUTE_FOR_ROLE: Record<WorkspaceRole, string> = {
  patient: '/',
  caregiver: '/caregiver',
  doctor: '/doctor',
  hospital_admin: '/hospital',
};

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const {
    activeDemoAccount,
    activeRole,
    activePatient,
    dadiNaniMode,
    setDadiNaniMode,
    setAssistantOpen,
    switchDemoAccount,
    resetDemo,
  } = useMedTwin();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();

  const navItems = NAV_BY_ROLE[activeRole];

  const handleRoleSwitch = (accountId: string) => {
    const nextAcc = DEMO_ACCOUNTS.find((a) => a.id === accountId);
    switchDemoAccount(accountId);
    if (nextAcc) {
      navigate(DEFAULT_ROUTE_FOR_ROLE[nextAcc.role]);
    }
    setMobileNavOpen(false);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#142D4E] text-slate-100">
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
        {!collapsed ? (
          <div className="min-w-0">
            <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap">
              MedTwin AI
            </span>
            <p className="mt-0.5 text-[11px] text-slate-400 truncate">
              Connected medication care
            </p>
          </div>
        ) : (
          <span className="mx-auto font-display text-base font-bold text-white">MT</span>
        )}

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden lg:inline-flex rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Explore Demo Switcher — explicitly separate from real auth */}
      {!collapsed && (
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="demo-role-switcher"
              className="text-[11px] font-semibold tracking-wide text-teal-300"
            >
              Explore demo
            </label>
            <span className="text-[10px] text-slate-400">Synthetic data</span>
          </div>
          <select
            id="demo-role-switcher"
            value={activeDemoAccount.id}
            onChange={(e) => handleRoleSwitch(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-[#1B3B64] px-3 py-2 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-[#14B8A6]"
          >
            {DEMO_ACCOUNTS.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-slate-400 leading-snug">
            {activeDemoAccount.subtitle}
          </p>
        </div>
      )}

      <nav aria-label="Workspace navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/' || item.to === '/caregiver' || item.to === '/doctor' || item.to === '/hospital'}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-[#14B8A6] text-[#142D4E] font-semibold shadow-sm'
                    : 'text-slate-200/90 hover:bg-white/10 hover:text-white',
                  collapsed && 'justify-center px-2',
                )
              }
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3 space-y-2">
        {!collapsed && (
          <div className="px-2 py-1 text-[11px] text-slate-400">
            Active account: <span className="text-slate-200 font-medium">{activeDemoAccount.actorName}</span>
          </div>
        )}
        <button
          type="button"
          onClick={resetDemo}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl border border-white/15 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 transition-colors cursor-pointer',
            collapsed && 'justify-center px-2',
          )}
          title="Reset synthetic demo data"
        >
          <RotateCcw className="h-3.5 w-3.5 shrink-0" />
          {!collapsed && <span>Reset demo</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        'min-h-screen flex bg-[#F8FAFC] bg-[radial-gradient(ellipse_at_top_right,rgba(20,184,166,0.06),transparent_48%),radial-gradient(ellipse_at_bottom_left,rgba(167,139,250,0.06),transparent_45%)] text-[#1E293B]',
        dadiNaniMode && 'text-[16px]',
      )}
    >
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:block shrink-0 transition-all duration-200',
          collapsed ? 'w-[72px]' : 'w-[264px]',
        )}
      >
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200/80 bg-white/95 backdrop-blur px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-slate-500 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {(activeRole === 'patient' || activeRole === 'caregiver') && (
              <button
                type="button"
                onClick={() => {
                  const next = !dadiNaniMode;
                  setDadiNaniMode(next);
                  if (next) navigate('/dadi-nani');
                }}
                className={cn(
                  'hidden sm:inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                  dadiNaniMode
                    ? 'border-amber-300 bg-amber-50 text-amber-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                )}
              >
                <HeartHandshake className="h-4 w-4 text-amber-600" />
                <span>Dadi-Nani Mode{dadiNaniMode ? ' · On' : ''}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#142D4E] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1B3B64] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Bot className="h-4 w-4 text-[#14B8A6]" />
              <span>Voice &amp; Chat Bot</span>
            </button>
          </div>
        </header>

        {/* Subtle Tagline / Active Context Strip on Mobile Role Switch */}
        <div className="border-b border-slate-200/60 bg-white/60 px-4 py-2 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Your medicines. Your care team. One connected view.
          </span>
          <span className="font-mono text-[11px] text-slate-500 tabular-nums">
            Demo context: {activeRole === 'doctor' || activeRole === 'hospital_admin' ? activeDemoAccount.actorName : `${activePatient.name} (${activePatient.mrn})`}
          </span>
        </div>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>

      <CareAssistantDrawer />
    </div>
  );
}
