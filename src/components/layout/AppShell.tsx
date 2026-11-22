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
    <div className="flex h-full flex-col border-r border-[#E6E0D8] bg-[#FFFFFF] text-[#20243A] dark:border-[#2B314D] dark:bg-[#171B2E] dark:text-[#F7F5F0] transition-colors duration-200">
      <div className="flex items-center justify-between px-4 py-5 border-b border-[#E6E0D8] dark:border-[#2B314D]">
        {!collapsed ? (
          <Link to="/" className="min-w-0 rounded-md">
            <MedTwinLogo />
            <p className="mt-1 text-[11px] text-[#5C627D] dark:text-[#A3A9C2] truncate">
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
          className="hidden lg:inline-flex rounded-lg p-1.5 text-[#5C627D] hover:bg-[#F5E5EC]/70 hover:text-[#20243A] dark:text-[#A3A9C2] dark:hover:bg-[#2B314D]/60 dark:hover:text-[#F7F5F0] cursor-pointer"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden rounded-lg p-1.5 text-[#5C627D] hover:bg-[#F5E5EC]/70 dark:text-[#A3A9C2]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Real User Identity Badge OR Isolated Demo Switcher */}
      {!collapsed && isRealAccountMode && user && (
        <div className="px-4 py-4 border-b border-[#E6E0D8] dark:border-[#2B314D] space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#7956C8] dark:text-[#A58AE8]">
              {user.role.replace('_', ' ')}
            </span>
            {(user.role === 'doctor' || user.role === 'hospital_admin') && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-semibold',
                  user.verificationStatus === 'verified'
                    ? 'text-[#24A99B] dark:text-[#2DD4BF]'
                    : 'text-amber-700 dark:text-amber-400',
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
          <p className="text-sm font-bold text-[#20243A] dark:text-[#F7F5F0] truncate">
            {user.fullName}
          </p>
          <p className="text-[11px] text-[#5C627D] dark:text-[#A3A9C2] truncate">{user.email}</p>
        </div>
      )}

      {!collapsed && isDemoMode && !isRealAccountMode && (
        <div className="px-4 py-4 border-b border-[#E6E0D8] dark:border-[#2B314D]">
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="demo-role-switcher"
              className="text-[11px] font-semibold tracking-wide text-[#24A99B] dark:text-[#2DD4BF]"
            >
              Interactive demo
            </label>
            <span className="text-[10px] text-[#5C627D] dark:text-[#A3A9C2]">Synthetic data</span>
          </div>
          <select
            id="demo-role-switcher"
            value={activeDemoAccount.id}
            onChange={(e) => handleRoleSwitch(e.target.value)}
            className="w-full rounded-xl border border-[#E6E0D8] bg-[#FAF8F5] px-3 py-2 text-xs font-medium text-[#20243A] focus:outline-none focus:ring-2 focus:ring-[#7956C8] dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]"
          >
            {DEMO_ACCOUNTS.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-[#5C627D] dark:text-[#A3A9C2] leading-snug">
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
                    ? 'bg-[#D8C5E8]/45 text-[#7956C8] font-semibold dark:bg-[#7956C8]/25 dark:text-[#F7F5F0]'
                    : 'text-[#5C627D] hover:bg-[#FAF8F5] hover:text-[#20243A] dark:text-[#A3A9C2] dark:hover:bg-[#101322] dark:hover:text-[#F7F5F0]',
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

      <div className="border-t border-[#E6E0D8] p-3 space-y-2 dark:border-[#2B314D]">
        {isDemoMode && !isRealAccountMode && (
          <button
            type="button"
            onClick={resetDemo}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-xl border border-[#E6E0D8] bg-[#FAF8F5] px-3 py-2 text-xs font-medium text-[#20243A] hover:bg-[#F5E5EC]/60 transition-colors cursor-pointer dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0] dark:hover:bg-[#2B314D]/60',
              collapsed && 'justify-center px-2',
            )}
            title="Reset synthetic demo data"
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span>Reset demo</span>}
          </button>
        )}

        <button
          type="button"
          onClick={handleSignOut}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] px-3 py-2 text-xs font-semibold text-[#20243A] hover:bg-[#F5E5EC]/60 transition-colors cursor-pointer dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0] dark:hover:bg-[#2B314D]/60',
            collapsed && 'justify-center px-2',
          )}
          title={isRealAccountMode ? 'Sign Out' : 'Exit Demo'}
        >
          <LogOut className="h-3.5 w-3.5 shrink-0 text-[#7956C8] dark:text-[#A58AE8]" />
          {!collapsed && <span>{isRealAccountMode ? 'Sign Out' : 'Exit Demo'}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        'min-h-screen flex bg-[#FAF8F5] text-[#20243A] dark:bg-[#101322] dark:text-[#F7F5F0] transition-colors duration-200',
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
            className="fixed inset-0 bg-[#101322]/60"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col pb-20">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[#E6E0D8] bg-[#FFFFFF]/95 backdrop-blur px-4 py-3.5 sm:px-6 lg:px-8 dark:border-[#2B314D] dark:bg-[#171B2E]/95 transition-colors duration-200">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] p-2 text-[#20243A] dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl font-bold tracking-tight text-[#20243A] dark:text-[#F7F5F0] truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2] truncate">{subtitle}</p>
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
                    ? 'border-[#7956C8] bg-[#D8C5E8]/40 text-[#7956C8] dark:border-[#A58AE8] dark:bg-[#7956C8]/25 dark:text-[#F7F5F0]'
                    : 'border-[#E6E0D8] bg-[#FFFFFF] text-[#20243A] hover:bg-[#FAF8F5] dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]',
                )}
              >
                <HeartHandshake className="h-4 w-4 text-[#7956C8] dark:text-[#A58AE8]" />
                <span>Dadi-Nani Mode{dadiNaniMode ? ' · On' : ''}</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={theme === 'dark'}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] px-3 py-2 text-xs font-semibold text-[#20243A] hover:bg-[#FAF8F5] transition-colors whitespace-nowrap shrink-0 cursor-pointer dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-4 w-4 text-[#2DD4BF]" />
                  <span className="hidden sm:inline">Light mode</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-[#7956C8]" />
                  <span className="hidden sm:inline">Dark mode</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Active Context Banner */}
        <div className="border-b border-[#E6E0D8] bg-[#FFFFFF]/75 px-4 py-2 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-2 text-xs text-[#5C627D] dark:border-[#2B314D] dark:bg-[#171B2E]/60 dark:text-[#A3A9C2]">
          {isDemoMode && !isRealAccountMode ? (
            <span>
              Interactive Demo Mode (synthetic data) —{' '}
              <Link
                to="/get-started"
                className="font-semibold text-[#7956C8] hover:underline dark:text-[#A58AE8]"
              >
                Create a real account
              </Link>
            </span>
          ) : (
            <span>Medication care, unified.</span>
          )}
          <span className="font-mono text-[11px] tabular-nums">
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
