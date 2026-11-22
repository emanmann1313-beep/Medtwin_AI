import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  HeartHandshake,
  Moon,
  Sparkles,
  Stethoscope,
  Sun,
  User,
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { MedTwinLogo } from '@/src/components/shared/MedTwinLogo';
import { Button } from '@/src/components/ui/button';

const ROLES = [
  {
    id: 'patient',
    title: 'Patient',
    subtitle: 'Manage daily medicines, prescriptions & Digital Twin insights',
    highlights: [
      'Scan prescriptions & build schedules',
      'Track taken, pending, and missed doses',
      'Explore Digital Twin & Dadi-Nani Mode',
    ],
    icon: User,
    accentClass:
      'border-[#7956C8]/30 bg-[#D8C5E8]/25 text-[#7956C8] dark:border-[#A58AE8]/30 dark:bg-[#7956C8]/20 dark:text-[#A58AE8]',
    route: '/register/patient',
  },
  {
    id: 'doctor',
    title: 'Doctor',
    subtitle: 'Review authorized patients, adherence trends & visit summaries',
    highlights: [
      'Access explicitly authorized patient records',
      'Review adherence metrics & prescription history',
      'Credential verification status tracking',
    ],
    icon: Stethoscope,
    accentClass:
      'border-[#24A99B]/30 bg-[#24A99B]/12 text-[#24A99B] dark:border-[#2DD4BF]/30 dark:bg-[#24A99B]/20 dark:text-[#2DD4BF]',
    route: '/register/doctor',
  },
  {
    id: 'caregiver',
    title: 'Family / Caregiver',
    subtitle: 'Stay connected with loved ones under explicit patient consent',
    highlights: [
      'Send connection requests to patients',
      'Monitor approved schedules & refill alerts',
      'Customize missed-dose notification preferences',
    ],
    icon: HeartHandshake,
    accentClass:
      'border-[#7956C8]/25 bg-[#F5E5EC]/70 text-[#20243A] dark:border-[#A58AE8]/30 dark:bg-[#F5E5EC]/10 dark:text-[#F5E5EC]',
    route: '/register/caregiver',
  },
  {
    id: 'hospital',
    title: 'Hospital / Clinic',
    subtitle: 'Coordinate authorized patients, doctors & operational follow-ups',
    highlights: [
      'Manage authorized patient directory',
      'Organize clinical staff & teams',
      'Verification-gated organizational access',
    ],
    icon: Building2,
    accentClass:
      'border-[#20243A]/20 bg-[#20243A]/5 text-[#20243A] dark:border-[#F7F5F0]/20 dark:bg-[#F7F5F0]/10 dark:text-[#F7F5F0]',
    route: '/register/hospital',
  },
] as const;

export function RoleSelectionPage() {
  const navigate = useNavigate();
  const { enterDemoMode } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleOpenDemo = () => {
    enterDemoMode();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#20243A] dark:bg-[#101322] dark:text-[#F7F5F0] transition-colors">
      <header className="border-b border-[#E6E0D8] bg-[#FFFFFF]/90 backdrop-blur-md dark:border-[#2B314D] dark:bg-[#171B2E]/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="whitespace-nowrap shrink-0">
            <MedTwinLogo />
          </Link>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] text-[#20243A] hover:border-[#7956C8] cursor-pointer dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              to="/login"
              className="rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] px-4 py-2 text-sm font-semibold text-[#20243A] hover:bg-[#FAF8F5] whitespace-nowrap shrink-0 dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#20243A] dark:text-[#F7F5F0]">
            How would you like to use MedTwin AI?
          </h1>
          <p className="mt-3 text-base text-[#5C627D] dark:text-[#A3A9C2]">
            Choose your role to create a personalized healthcare experience.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          {ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <div
                key={role.id}
                className="group flex flex-col justify-between rounded-2xl border border-[#E6E0D8] bg-[#FFFFFF] p-7 shadow-xs transition-all hover:-translate-y-0.5 hover:border-[#7956C8]/60 hover:shadow-md dark:border-[#2B314D] dark:bg-[#171B2E] dark:hover:border-[#A58AE8]/60"
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border ${role.accentClass}`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>
                  <h2 className="mt-5 font-display text-xl font-bold text-[#20243A] dark:text-[#F7F5F0]">
                    {role.title}
                  </h2>
                  <p className="mt-1.5 text-sm text-[#5C627D] dark:text-[#A3A9C2]">
                    {role.subtitle}
                  </p>
                  <ul className="mt-5 space-y-2 text-xs text-[#5C627D] dark:text-[#A3A9C2]">
                    {role.highlights.map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#24A99B] dark:bg-[#2DD4BF] shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-7 pt-5 border-t border-[#E6E0D8] dark:border-[#2B314D]">
                  <Button
                    type="button"
                    onClick={() => navigate(role.route)}
                    className="w-full justify-between"
                  >
                    <span>Continue as {role.title}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 rounded-2xl border border-[#D8C5E8] bg-[#FFFFFF] p-6 sm:p-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#2B314D] dark:bg-[#171B2E]">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F5E5EC] text-[#7956C8] dark:bg-[#7956C8]/20 dark:text-[#A58AE8]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-[#20243A] dark:text-[#F7F5F0]">
                Want to explore first with synthetic sample data?
              </h3>
              <p className="mt-0.5 text-xs text-[#5C627D] dark:text-[#A3A9C2]">
                Try our isolated interactive demo sandbox without creating an account. Sample data never mixes with real user accounts.
              </p>
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={handleOpenDemo} className="shrink-0">
            Explore Interactive Demo
          </Button>
        </div>

        <p className="mt-8 text-center text-sm text-[#5C627D] dark:text-[#A3A9C2]">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-[#7956C8] hover:underline dark:text-[#A58AE8]">
            Sign in to your account
          </Link>
        </p>
      </main>
    </div>
  );
}
