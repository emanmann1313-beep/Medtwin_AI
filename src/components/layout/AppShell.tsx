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
  LogOut,
  Menu,
  Moon,
  Pill,
  RotateCcw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Sun,
  UserCircle2,
  Users,
  X,
} from 'lucide-react';
import { DEMO_ACCOUNTS } from '@/src/data/seedData';
import { DEFAULT_ROUTE_FOR_ROLE, useAuth } from '@/src/context/AuthContext';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { useTheme } from '@/src/context/ThemeContext';
import { WorkspaceRole } from '@/src/types/medtwin';
import { MedTwinLogo } from '@/src/components/shared/MedTwinLogo';
import { FloatingAiAssistant } from '@/src/components/ai/FloatingAiAssistant';
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
    { to: '/profile', label: 'Profile & Access', icon: UserCircle2 },
    { to: '/settings', label: 'Settings', icon: Settings },
  ],
  caregiver: [
    { to: '/caregiver', label: 'Caregiver Hub', icon: LayoutDashboard },
    { to: '/caregivers', label: 'Care Circle & Alerts', icon: Users },
    { to: '/medications', label: 'Permitted Schedules', icon: CalendarClock },
    { to: '/history', label: 'Care History', icon: History },
    { to: '/dadi-nani', label: 'Dadi-Nani Mode', icon: HeartHandshake },
    { to: '/profile', label: 'Profile', icon: UserCircle2 },
    { to: '/settings', label: 'Settings', icon: Settings },
  ],
  doctor: [
    { to: '/doctor', label: 'Doctor Dashboard', icon: Stethoscope },
    { to: '/prescriptions', label: 'Prescription Review', icon: ClipboardList },
    { to: '/digital-twin', label: 'Digital Twin Review', icon: Activity },
    { to: '/profile', label: 'Profile & Credentials', icon: UserCircle2 },
    { to: '/settings', label: 'Settings', icon: Settings },
  ],
  hospital_admin: [
    { to: '/hospital', label: 'Hospital Dashboard', icon: Building2 },
    { to: '/hospital/teams', label: 'Care Teams & Access', icon: ShieldCheck },
    { to: '/profile', label: 'Profile & Verification', icon: UserCircle2 },
    { to: '/settings', label: 'Settings', icon: Settings },
  ],
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
  const { user, isDemoMode, logout, exitDemoMode } = useAuth();
  const {
    isRealAccountMode,
    hasPatients,
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

  const handleSignOut = async () => {
    if (isRealAccountMode) {
      await logout();
      navigate('/login');
    } else {
      exitDemoMode();
      navigate('/');
    }
  };

  const sidebarContent = (
    <div className="flex h-full flex-col border-r border-[#334155] bg-[#101B30] text-[#F8FAFC] transition-colors duration-200">
      <div className="flex items-center justify-between px-4 py-5 border-b border-[#334155]">
        {!collapsed ? (
          <Link to="/" className="min-w-0 rounded-md">
            <MedTwinLogo />
            <p className="mt-1 text-[11px] text-[#A8B8CC] truncate">
              Medication care, unified
            </p>
          </Link>
        ) : (
          <Link to="/" aria-label="MedTwin AI Home" className="mx-auto rounded-md">
            <MedTwinLogo showWordmark={false} size={24} />
          </Link>
        )}

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden lg:inline-flex rounded-lg p-1.5 text-[#A8B8CC] hover:bg-[#223451] hover:text-[#F8FAFC] cursor-pointer"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden rounded-lg p-1.5 text-[#A8B8CC] hover:bg-[#223451] hover:text-[#F8FAFC]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Real User Identity Badge OR Isolated Demo Switcher */}
      {!collapsed && isRealAccountMode && user && (
        <div className="px-4 py-4 border-b border-[#334155] space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8B5CF6]">
              {user.role.replace('_', ' ')}
            </span>
            {(user.role === 'doctor' || user.role === 'hospital_admin') && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-semibold',
                  user.verificationStatus === 'verified'
                    ? 'text-[#34D399]'
                    : 'text-[#FBBF24]',
                )}
              >
                {user.verificationStatus === 'verified' ? (
                  <ShieldCheck className="h-3 w-3" />
                ) : (
                  <ShieldAlert className="h-3 w-3" />
                )}
                <span>{user.verificationStatus === 'verified' ? 'Verified' : 'Pending'}</span>
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-[#F8FAFC] truncate">
            {user.fullName}
          </p>
          <p className="text-[11px] text-[#A8B8CC] truncate">{user.email}</p>
        </div>
      )}

      {!collapsed && isDemoMode && !isRealAccountMode && (
        <div className="px-4 py-4 border-b border-[#334155]">
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="demo-role-switcher"
              className="text-[11px] font-semibold tracking-wide text-[#2DD4BF]"
            >
              Interactive demo
            </label>
            <span className="text-[10px] text-[#A8B8CC]">Synthetic data</span>
          </div>
          <select
            id="demo-role-switcher"
            value={activeDemoAccount.id}
            onChange={(e) => handleRoleSwitch(e.target.value)}
            className="w-full rounded-xl border border-[#334155] bg-[#1A2740] px-3 py-2 text-xs font-medium text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
          >
            {DEMO_ACCOUNTS.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-[#A8B8CC] leading-snug">
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
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all whitespace-nowrap border',
                  isActive
                    ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/45 text-[#F8FAFC] font-semibold shadow-[0_0_18px_rgba(139,92,246,0.22)]'
                    : 'border-transparent text-[#A8B8CC] hover:bg-[#1A2740] hover:text-[#F8FAFC]',
                  collapsed && 'justify-center px-2',
                )
              }
              title={collapsed ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-[#2DD4BF]' : 'text-[#A8B8CC]')} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-[#334155] p-3 space-y-2">
        {isDemoMode && !isRealAccountMode && (
          <button
            type="button"
            onClick={resetDemo}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-xl border border-[#334155] bg-[#1A2740] px-3 py-2 text-xs font-medium text-[#F8FAFC] hover:bg-[#223451] transition-colors cursor-pointer',
              collapsed && 'justify-center px-2',
            )}
            title="Reset synthetic demo data"
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0 text-[#2DD4BF]" />
            {!collapsed && <span>Reset demo</span>}
          </button>
        )}

        <button
          type="button"
          onClick={handleSignOut}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl border border-[#334155] bg-[#1A2740] px-3 py-2 text-xs font-semibold text-[#F8FAFC] hover:bg-[#223451] transition-colors cursor-pointer',
            collapsed && 'justify-center px-2',
          )}
          title={isRealAccountMode ? 'Sign Out' : 'Exit Demo'}
        >
          <LogOut className="h-3.5 w-3.5 shrink-0 text-[#8B5CF6]" />
          {!collapsed && <span>{isRealAccountMode ? 'Sign Out' : 'Exit Demo'}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        'min-h-screen flex bg-[#0B1220] bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.12),transparent_48%),radial-gradient(ellipse_at_bottom_left,rgba(45,212,191,0.08),transparent_45%)] text-[#F8FAFC] transition-colors duration-200',
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
            className="fixed inset-0 bg-[#0B1220]/75 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col pb-20">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[#334155] bg-[#101B30]/95 backdrop-blur px-4 py-3.5 sm:px-6 lg:px-8 transition-colors duration-200">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden rounded-xl border border-[#334155] bg-[#1A2740] p-2 text-[#F8FAFC] hover:bg-[#223451]"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl font-bold tracking-tight text-[#F8FAFC] truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-[#A8B8CC] truncate">{subtitle}</p>
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
                  'hidden sm:inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer',
                  dadiNaniMode
                    ? 'border-[#8B5CF6]/60 bg-[#8B5CF6]/20 text-[#F8FAFC] shadow-[0_0_16px_rgba(139,92,246,0.22)]'
                    : 'border-[#334155] bg-[#1A2740] text-[#F8FAFC] hover:bg-[#223451]',
                )}
              >
                <HeartHandshake className="h-4 w-4 text-[#8B5CF6]" />
                <span>Dadi-Nani Mode{dadiNaniMode ? ' · On' : ''}</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={theme === 'dark'}
              className="inline-flex items-center gap-2 rounded-xl border border-[#334155] bg-[#1A2740] px-3 py-2 text-xs font-semibold text-[#F8FAFC] hover:bg-[#223451] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-4 w-4 text-[#2DD4BF]" />
                  <span className="hidden sm:inline">Light mode</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-[#8B5CF6]" />
                  <span className="hidden sm:inline">Dark mode</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Active Context Banner */}
        <div className="border-b border-[#334155] bg-[#101B30]/75 px-4 py-2 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-2 text-xs text-[#A8B8CC]">
          {isDemoMode && !isRealAccountMode ? (
            <span>
              Interactive Demo Mode (synthetic data) —{' '}
              <Link
                to="/get-started"
                className="font-semibold text-[#2DD4BF] hover:underline"
              >
                Create a real account
              </Link>
            </span>
          ) : (
            <span>Medication care, unified.</span>
          )}
          <span className="font-mono text-[11px] tabular-nums text-[#A8B8CC]">
            {isRealAccountMode && user
              ? `${user.fullName} · ${
                  hasPatients && activeRole !== 'doctor' && activeRole !== 'hospital_admin'
                    ? `${activePatient.name} (${activePatient.mrn})`
                    : user.role.replace('_', ' ')
                }`
              : `Demo context: ${
                  activeRole === 'doctor' || activeRole === 'hospital_admin'
                    ? activeDemoAccount.actorName
                    : `${activePatient.name} (${activePatient.mrn})`
                }`}
          </span>
        </div>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Sticky Bottom-Right Floating AI Chat Assistant */}
      <FloatingAiAssistant />
    </div>
  );
}
