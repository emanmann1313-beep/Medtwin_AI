import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Activity,
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
  Moon,
  Pill,
  RotateCcw,
  ShieldCheck,
  Stethoscope,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { DEMO_ACCOUNTS } from '@/src/data/seedData';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { useTheme } from '@/src/context/ThemeContext';
import { WorkspaceRole } from '@/src/types/medtwin';
import { MedTwinLogo } from '@/src/components/shared/MedTwinLogo';
import { cn } from '@/src/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_BY_ROLE: Record<WorkspaceRole, NavItem[]> = {
  patient: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
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
  patient: '/dashboard',
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
    switchDemoAccount,
    resetDemo,
  } = useMedTwin();
  const { theme, toggleTheme } = useTheme();

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
    <div className="flex h-full flex-col border-r border-[#E2E8F0] bg-[#FFFFFF] text-[#172554] dark:border-[#334155] dark:bg-[#172033] dark:text-[#F8FAFC] transition-colors duration-200">
      <div className="flex items-center justify-between px-4 py-5 border-b border-[#E2E8F0] dark:border-[#334155]">
        {!collapsed ? (
          <Link to="/" className="min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded-md">
            <MedTwinLogo />
            <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
              Connected medication care
            </p>
          </Link>
        ) : (
          <Link to="/" aria-label="MedTwin AI Home" className="mx-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded-md">
            <MedTwinLogo showWordmark={false} size={24} />
          </Link>
        )}

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden lg:inline-flex rounded-lg p-1.5 text-[#64748B] hover:bg-[#CCFBF1]/50 hover:text-[#172554] dark:text-[#94A3B8] dark:hover:bg-[#334155]/60 dark:hover:text-[#F8FAFC] cursor-pointer"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden rounded-lg p-1.5 text-[#64748B] hover:bg-[#CCFBF1]/50 hover:text-[#172554] dark:text-[#94A3B8] dark:hover:bg-[#334155]/60 dark:hover:text-[#F8FAFC]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Explore Demo Switcher — explicitly separate from real auth */}
      {!collapsed && (
        <div className="px-4 py-4 border-b border-[#E2E8F0] dark:border-[#334155]">
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="demo-role-switcher"
              className="text-[11px] font-semibold tracking-wide text-[#0D9488] dark:text-[#14B8A6]"
            >
              Explore demo
            </label>
            <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">Synthetic data</span>
          </div>
          <select
            id="demo-role-switcher"
            value={activeDemoAccount.id}
            onChange={(e) => handleRoleSwitch(e.target.value)}
            className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs font-medium text-[#172554] focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC] dark:focus:ring-[#14B8A6]"
          >
            {DEMO_ACCOUNTS.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8] leading-snug">
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
              end={
                item.to === '/dashboard' ||
                item.to === '/caregiver' ||
                item.to === '/doctor' ||
                item.to === '/hospital'
              }
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-[#CCFBF1] text-[#0D9488] font-semibold dark:bg-[#14B8A6]/20 dark:text-[#14B8A6]'
                    : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#172554] dark:text-[#94A3B8] dark:hover:bg-[#0B1220]/60 dark:hover:text-[#F8FAFC]',
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

      <div className="border-t border-[#E2E8F0] p-3 space-y-2 dark:border-[#334155]">
        {!collapsed && (
          <div className="px-2 py-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
            Active account:{' '}
            <span className="text-[#172554] dark:text-[#F8FAFC] font-medium">
              {activeDemoAccount.actorName}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={resetDemo}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2 text-xs font-medium text-[#172554] hover:bg-[#CCFBF1]/45 transition-colors cursor-pointer dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC] dark:hover:bg-[#334155]/60',
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
        'min-h-screen flex bg-[#F8FAFC] text-[#172554] dark:bg-[#0B1220] dark:text-[#F8FAFC] transition-colors duration-200',
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
            className="fixed inset-0 bg-[#0B1220]/55"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[#E2E8F0] bg-[#FFFFFF]/95 backdrop-blur px-4 py-3.5 sm:px-6 lg:px-8 dark:border-[#334155] dark:bg-[#172033]/95 transition-colors duration-200">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-2 text-[#172554] hover:bg-[#CCFBF1]/45 dark:border-[#334155] dark:bg-[#172033] dark:text-[#F8FAFC] dark:hover:bg-[#334155]/60"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl font-bold tracking-tight text-[#172554] dark:text-[#F8FAFC] truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] truncate">
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
                    ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200'
                    : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#172554] hover:bg-[#CCFBF1]/45 dark:border-[#334155] dark:bg-[#172033] dark:text-[#F8FAFC] dark:hover:bg-[#334155]/60',
                )}
              >
                <HeartHandshake className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span>Dadi-Nani Mode{dadiNaniMode ? ' · On' : ''}</span>
              </button>
            )}

            {/* Light Mode / Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={theme === 'dark'}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2 text-xs font-semibold text-[#172554] hover:bg-[#CCFBF1]/55 transition-colors whitespace-nowrap shrink-0 cursor-pointer dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC] dark:hover:bg-[#334155]/60"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-4 w-4 text-[#14B8A6]" />
                  <span className="hidden sm:inline">Light mode</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-[#0D9488]" />
                  <span className="hidden sm:inline">Dark mode</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Subtle Tagline / Active Context Strip */}
        <div className="border-b border-[#E2E8F0] bg-[#FFFFFF]/70 px-4 py-2 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B] dark:border-[#334155] dark:bg-[#172033]/50 dark:text-[#94A3B8]">
          <span>Your medicines. Your care team. One connected view.</span>
          <span className="font-mono text-[11px] text-[#64748B] dark:text-[#94A3B8] tabular-nums">
            Demo context:{' '}
            {activeRole === 'doctor' || activeRole === 'hospital_admin'
              ? activeDemoAccount.actorName
              : `${activePatient.name} (${activePatient.mrn})`}
          </span>
        </div>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
