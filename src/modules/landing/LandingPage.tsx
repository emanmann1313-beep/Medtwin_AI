import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Building2,
  Check,
  FileScan,
  HeartHandshake,
  Menu,
  Moon,
  Pill,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useToast } from '@/src/components/ui/toast';
import { MedTwinLogo } from '@/src/components/shared/MedTwinLogo';
import { InteractiveCursor } from '@/src/components/landing/InteractiveCursor';
import { ProgressRing } from '@/src/components/ui/ProgressRing';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { cn } from '@/src/lib/utils';

const NAV_LINKS = [
  { href: '#overview', label: 'Overview' },
  { href: '#solutions', label: 'Solutions' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#about', label: 'About' },
  { href: '#contact', label: 'Contact' },
];

const TRUST_BENEFITS = [
  {
    icon: Pill,
    title: 'Smarter Medication Tracking',
    description:
      'Clear daily timelines, remaining supply counts, and effortless taken or skipped confirmations.',
  },
  {
    icon: FileScan,
    title: 'AI Prescription Assistance',
    description:
      'Scan paper or PDF prescriptions, verify unclear fields safely, and build structured schedules in seconds.',
  },
  {
    icon: Activity,
    title: 'Digital Twin Insights',
    description:
      'Simulate missed-dose and refill-delay scenarios to understand routine resilience before gaps happen.',
  },
  {
    icon: Users,
    title: 'Connected Care',
    description:
      'Consent-governed access for families, verified doctors, and clinics with instant revocation control.',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Create your account.',
    detail: 'Choose Patient, Doctor, Family / Caregiver, or Hospital to set up your tailored workspace.',
  },
  {
    step: '02',
    title: 'Add or scan prescriptions.',
    detail: 'Upload or photograph a prescription, verify extracted medicines, and confirm your schedule.',
  },
  {
    step: '03',
    title: 'Track your medication routine.',
    detail: 'Confirm doses with one tap, use voice-first Dadi-Nani Mode, and explore Digital Twin scenarios.',
  },
  {
    step: '04',
    title: 'Connect with authorized caregivers or healthcare professionals.',
    detail: 'Grant granular, revocable access to loved ones and verified doctors on your terms.',
  },
];

interface SolutionCardData {
  id: 'patient' | 'doctor' | 'caregiver' | 'hospital';
  title: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  registerRoute: string;
  registerLabel: string;
  learnMoreSummary: string;
  capabilities: string[];
  accentBg: string;
}

const SOLUTIONS: SolutionCardData[] = [
  {
    id: 'patient',
    title: 'For Patients',
    tagline: 'Simple daily clarity, refill alerts, and elder-friendly voice support.',
    icon: Sparkles,
    registerRoute: '/register/patient',
    registerLabel: 'Register as Patient',
    learnMoreSummary:
      'Designed around calm daily routines so patients stay confident with complex medication schedules.',
    capabilities: [
      'AI-assisted prescription scanning with verification before saving',
      'Today, weekly, and monthly adherence progress rings',
      'Interactive Digital Twin simulator & refill countdowns',
      'Voice-first Dadi-Nani Mode in English, Hindi, and Punjabi',
    ],
    accentBg: 'bg-[#D8C5E8]/40 text-[#7956C8] dark:bg-[#7956C8]/20 dark:text-[#A58AE8]',
  },
  {
    id: 'doctor',
    title: 'For Doctors',
    tagline: 'Authorized patient panels, verified adherence logs, and AI visit summaries.',
    icon: Stethoscope,
    registerRoute: '/register/doctor',
    registerLabel: 'Register as Doctor',
    learnMoreSummary:
      'Clinicians view only patients who explicitly authorize access, backed by credential verification.',
    capabilities: [
      'Explicitly authorized patient panel with adherence & refill metrics',
      'Citation-backed AI pre-visit preparation summaries',
      'Prescription & Digital Twin continuity review',
      'Server-enforced verification status before clinical note signing',
    ],
    accentBg: 'bg-[#24A99B]/15 text-[#24A99B] dark:bg-[#24A99B]/20 dark:text-[#2DD4BF]',
  },
  {
    id: 'caregiver',
    title: 'For Families & Caregivers',
    tagline: 'Peace of mind for loved ones without compromising patient privacy.',
    icon: HeartHandshake,
    registerRoute: '/register/caregiver',
    registerLabel: 'Register as Caregiver',
    learnMoreSummary:
      'Send connection requests to patients and monitor approved schedules, refill alerts, and missed doses.',
    capabilities: [
      'Patient-approved connection workflow before any health data is shared',
      'Configurable missed-dose alerts and refill countdowns',
      '4-scope consent governance respecting patient autonomy',
      'Shared Dadi-Nani elder wellness updates',
    ],
    accentBg: 'bg-[#F5E5EC] text-[#20243A] dark:bg-[#F5E5EC]/15 dark:text-[#F5E5EC]',
  },
  {
    id: 'hospital',
    title: 'For Hospitals',
    tagline: 'Coordinate care teams, follow-up queues, and authorized patient directories.',
    icon: Building2,
    registerRoute: '/register/hospital',
    registerLabel: 'Register Hospital',
    learnMoreSummary:
      'Structured organizational oversight with verification-gated enrollment and role boundaries.',
    capabilities: [
      'Authorized patient directory and doctor workload visibility',
      'Follow-up coordination and refill attention tracking',
      'Role-scoped clinical vs. operational privacy separation',
      'Team and department access management',
    ],
    accentBg: 'bg-[#20243A]/8 text-[#20243A] dark:bg-[#F7F5F0]/12 dark:text-[#F7F5F0]',
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const { enterDemoMode, isAuthenticated, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pushToast } = useToast();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedSolution, setSelectedSolution] = useState<SolutionCardData | null>(null);
  const [previewDelayDays, setPreviewDelayDays] = useState<0 | 3>(0);

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactError, setContactError] = useState('');
  const [contactSent, setContactSent] = useState(false);

  const handleNavClick = (href: string) => {
    setMobileMenuOpen(false);
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim());
    if (!contactName.trim() || !emailValid || !contactMessage.trim()) {
      setContactError('Please enter your name, a valid email address, and a brief message.');
      return;
    }
    setContactError('');
    setContactSent(true);
    setContactName('');
    setContactEmail('');
    setContactMessage('');
    pushToast({
      title: 'Message received',
      description: 'Thank you for reaching out to the MedTwin AI team.',
      variant: 'success',
    });
  };

  const handleOpenDemo = () => {
    enterDemoMode();
    navigate('/dashboard');
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#FAF8F5] text-[#20243A] dark:bg-[#101322] dark:text-[#F7F5F0] transition-colors duration-200">
      <InteractiveCursor />

      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-[#E6E0D8]/90 bg-[#FAF8F5]/90 backdrop-blur-md dark:border-[#2B314D] dark:bg-[#101322]/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <a
            href="#overview"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('#overview');
            }}
            className="whitespace-nowrap shrink-0"
          >
            <MedTwinLogo />
          </a>

          <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-7">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(link.href);
                }}
                className="text-sm font-medium text-[#5C627D] hover:text-[#20243A] dark:text-[#A3A9C2] dark:hover:text-[#F7F5F0] transition-colors whitespace-nowrap shrink-0"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] text-[#20243A] hover:border-[#7956C8] transition-colors cursor-pointer dark:border-[#2B314D] dark:bg-[#171B2E] dark:text-[#F7F5F0]"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {isAuthenticated && user ? (
              <Button
                type="button"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="hidden sm:inline-flex"
              >
                Open Workspace
              </Button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden sm:inline-flex items-center rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] px-4 py-2 text-sm font-semibold text-[#20243A] hover:bg-[#F5E5EC]/40 transition-colors whitespace-nowrap shrink-0 dark:border-[#2B314D] dark:bg-[#171B2E] dark:text-[#F7F5F0] dark:hover:bg-[#2B314D]/50"
                >
                  Sign In
                </Link>
                <Link
                  to="/get-started"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-[#7956C8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6644B4] transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Get Started</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] text-[#20243A] dark:border-[#2B314D] dark:bg-[#171B2E] dark:text-[#F7F5F0]"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#E6E0D8] bg-[#FFFFFF] px-6 py-4 space-y-3 dark:border-[#2B314D] dark:bg-[#171B2E]">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(link.href);
                }}
                className="block py-1.5 text-sm font-medium text-[#20243A] dark:text-[#F7F5F0]"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex justify-center rounded-xl border border-[#E6E0D8] px-4 py-2.5 text-sm font-semibold dark:border-[#2B314D]"
              >
                Sign In
              </Link>
              <Link
                to="/get-started"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex justify-center items-center gap-2 rounded-xl bg-[#7956C8] px-4 py-2.5 text-sm font-semibold text-white"
              >
                <span>Get Started</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section id="overview" className="mx-auto max-w-7xl px-5 pt-14 pb-20 sm:px-8 sm:pt-20 sm:pb-24">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-6 space-y-6">
              <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-[#7956C8] dark:text-[#A58AE8]">
                <ShieldCheck className="h-4 w-4 text-[#24A99B] dark:text-[#2DD4BF]" />
                <span>Connected Medication Intelligence</span>
              </p>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#20243A] dark:text-[#F7F5F0] leading-[1.06] text-balance">
                Medication care, unified.
              </h1>

              <p className="max-w-xl text-base sm:text-lg leading-relaxed text-[#5C627D] dark:text-[#A3A9C2]">
                One intelligent platform connecting patients, families, and healthcare professionals through smarter medication management.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  type="button"
                  size="lg"
                  onClick={() => navigate('/get-started')}
                  className="bg-[#7956C8] hover:bg-[#6644B4] text-white"
                >
                  <span>Get Started</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={() => handleNavClick('#solutions')}
                >
                  Explore Features
                </Button>
                <button
                  type="button"
                  onClick={handleOpenDemo}
                  className="px-3 py-2 text-sm font-semibold text-[#24A99B] hover:underline cursor-pointer dark:text-[#2DD4BF] whitespace-nowrap"
                >
                  Try Interactive Demo
                </button>
              </div>
            </div>

            {/* Clearly Identified Interface Preview */}
            <div className="lg:col-span-6">
              <div className="rounded-3xl border border-[#D8C5E8] bg-[#FFFFFF] p-6 shadow-xl dark:border-[#2B314D] dark:bg-[#171B2E]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6E0D8] pb-4 dark:border-[#2B314D]">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7956C8] dark:text-[#A58AE8]">
                      Product Interface Preview
                    </p>
                    <h2 className="font-display text-base font-bold text-[#20243A] dark:text-[#F7F5F0]">
                      Daily Adherence &amp; Digital Twin Continuity
                    </h2>
                  </div>
                  <div className="inline-flex rounded-xl border border-[#E6E0D8] bg-[#FAF8F5] p-1 text-xs dark:border-[#2B314D] dark:bg-[#101322]">
                    <button
                      type="button"
                      onClick={() => setPreviewDelayDays(0)}
                      className={cn(
                        'rounded-lg px-2.5 py-1 font-medium transition-colors cursor-pointer',
                        previewDelayDays === 0
                          ? 'bg-[#FFFFFF] text-[#20243A] shadow-xs dark:bg-[#171B2E] dark:text-[#F7F5F0]'
                          : 'text-[#5C627D] dark:text-[#A3A9C2]',
                      )}
                    >
                      On-Time Plan
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDelayDays(3)}
                      className={cn(
                        'rounded-lg px-2.5 py-1 font-medium transition-colors cursor-pointer',
                        previewDelayDays === 3
                          ? 'bg-[#FFFFFF] text-[#20243A] shadow-xs dark:bg-[#171B2E] dark:text-[#F7F5F0]'
                          : 'text-[#5C627D] dark:text-[#A3A9C2]',
                      )}
                    >
                      3-Day Refill Delay
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-4">
                  <ProgressRing
                    value={100}
                    size={104}
                    strokeWidth={9}
                    tone="teal"
                    label="Today"
                    sublabel="3 of 3 doses"
                  />
                  <ProgressRing
                    value={previewDelayDays === 0 ? 95 : 79}
                    size={104}
                    strokeWidth={9}
                    tone="violet"
                    label="14d Twin"
                    sublabel={previewDelayDays === 0 ? 'Baseline routine' : 'What-if impact'}
                  />
                  <ProgressRing
                    value={92}
                    size={104}
                    strokeWidth={9}
                    tone="navy"
                    label="Monthly"
                    sublabel="Consistent log"
                  />
                </div>

                <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#E6E0D8] bg-[#FAF8F5] p-3.5 dark:border-[#2B314D] dark:bg-[#101322]">
                    <p className="text-[11px] font-semibold text-[#24A99B] dark:text-[#2DD4BF]">
                      Next Scheduled Medicine
                    </p>
                    <p className="mt-1 text-sm font-bold text-[#20243A] dark:text-[#F7F5F0]">
                      08:00 PM · Metformin 500 mg
                    </p>
                    <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">
                      With evening meal · 18 tablets left
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#E6E0D8] bg-[#F5E5EC]/45 p-3.5 dark:border-[#2B314D] dark:bg-[#7956C8]/10">
                    <p className="text-[11px] font-semibold text-[#7956C8] dark:text-[#A58AE8]">
                      Care Circle &amp; Doctor Sync
                    </p>
                    <p className="mt-1 text-sm font-bold text-[#20243A] dark:text-[#F7F5F0]">
                      Consent-Scoped Active
                    </p>
                    <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">
                      Revocable anytime by patient
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust and Value Section */}
        <section className="border-t border-[#E6E0D8] bg-[#FFFFFF] py-16 sm:py-20 dark:border-[#2B314D] dark:bg-[#171B2E]">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#24A99B] dark:text-[#2DD4BF]">
                Built for Real-World Medication Continuity
              </p>
              <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-[#20243A] dark:text-[#F7F5F0]">
                Clarity for every daily dose, refill, and follow-up.
              </h2>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {TRUST_BENEFITS.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    data-cursor="interactive"
                    className="rounded-2xl border border-[#E6E0D8] bg-[#FAF8F5] p-6 transition-transform duration-150 hover:-translate-y-0.5 dark:border-[#2B314D] dark:bg-[#101322]"
                  >
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#D8C5E8]/45 text-[#7956C8] dark:bg-[#7956C8]/20 dark:text-[#A58AE8]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 font-display text-base font-bold text-[#20243A] dark:text-[#F7F5F0]">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#5C627D] dark:text-[#A3A9C2]">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section
          id="how-it-works"
          className="border-t border-[#E6E0D8] py-20 sm:py-24 dark:border-[#2B314D]"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#7956C8] dark:text-[#A58AE8]">
                How It Works
              </p>
              <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-[#20243A] dark:text-[#F7F5F0]">
                From prescription to connected daily care in four steps.
              </h2>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {HOW_IT_WORKS.map((item) => (
                <div
                  key={item.step}
                  className="rounded-2xl border border-[#E6E0D8] bg-[#FFFFFF] p-6 dark:border-[#2B314D] dark:bg-[#171B2E]"
                >
                  <span className="font-mono text-sm font-bold text-[#24A99B] dark:text-[#2DD4BF] tabular-nums">
                    {item.step}
                  </span>
                  <h3 className="mt-3 font-display text-base font-bold text-[#20243A] dark:text-[#F7F5F0]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5C627D] dark:text-[#A3A9C2]">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Solutions Section */}
        <section
          id="solutions"
          className="border-t border-[#E6E0D8] bg-[#FFFFFF] py-20 sm:py-24 dark:border-[#2B314D] dark:bg-[#171B2E]"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#7956C8] dark:text-[#A58AE8]">
                  Solutions
                </p>
                <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-[#20243A] dark:text-[#F7F5F0]">
                  Designed for every member of the care ecosystem.
                </h2>
              </div>
              <Button type="button" onClick={() => navigate('/get-started')}>
                <span>Choose Your Role</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
              {SOLUTIONS.map((sol) => {
                const Icon = sol.icon;
                return (
                  <div
                    key={sol.id}
                    className="flex flex-col justify-between rounded-2xl border border-[#E6E0D8] bg-[#FAF8F5] p-7 dark:border-[#2B314D] dark:bg-[#101322]"
                  >
                    <div>
                      <div
                        className={cn(
                          'inline-flex h-11 w-11 items-center justify-center rounded-xl',
                          sol.accentBg,
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 font-display text-xl font-bold text-[#20243A] dark:text-[#F7F5F0]">
                        {sol.title}
                      </h3>
                      <p className="mt-2 text-sm text-[#5C627D] dark:text-[#A3A9C2]">
                        {sol.tagline}
                      </p>
                      <ul className="mt-5 space-y-2 text-xs text-[#5C627D] dark:text-[#A3A9C2]">
                        {sol.capabilities.map((cap) => (
                          <li key={cap} className="flex items-start gap-2">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#24A99B] dark:text-[#2DD4BF]" />
                            <span>{cap}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-6 pt-5 border-t border-[#E6E0D8] flex flex-wrap items-center gap-3 dark:border-[#2B314D]">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSolution(sol)}
                      >
                        Learn More
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => navigate(sol.registerRoute)}
                      >
                        <span>{sol.registerLabel}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* About Section */}
        <section
          id="about"
          className="border-t border-[#E6E0D8] py-20 dark:border-[#2B314D]"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-8 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#24A99B] dark:text-[#2DD4BF]">
                About MedTwin AI
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#20243A] dark:text-[#F7F5F0]">
                Privacy-first medication adherence built for intergenerational families and clinicians.
              </h2>
              <p className="text-sm leading-relaxed text-[#5C627D] dark:text-[#A3A9C2]">
                Medication continuity fails silently between appointments—missed evening tablets, delayed refills, or prescriptions that elders struggle to read. MedTwin AI bridges that gap with verified OCR prescription intake, deterministic Digital Twin simulations, elder-friendly multilingual voice care in Dadi-Nani Mode, and strict consent-governed sharing.
              </p>
            </div>
            <div className="lg:col-span-5 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[#E6E0D8] bg-[#FFFFFF] p-5 dark:border-[#2B314D] dark:bg-[#171B2E]">
                <p className="font-display text-2xl font-bold text-[#7956C8] dark:text-[#A58AE8]">
                  Consent-First
                </p>
                <p className="mt-1 text-xs text-[#5C627D] dark:text-[#A3A9C2]">
                  Patients approve every doctor and caregiver link explicitly
                </p>
              </div>
              <div className="rounded-2xl border border-[#E6E0D8] bg-[#FFFFFF] p-5 dark:border-[#2B314D] dark:bg-[#171B2E]">
                <p className="font-display text-2xl font-bold text-[#24A99B] dark:text-[#2DD4BF]">
                  Multilingual
                </p>
                <p className="mt-1 text-xs text-[#5C627D] dark:text-[#A3A9C2]">
                  Voice-first elder support in English, Hindi, and Punjabi
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-[#E6E0D8] bg-linear-to-br from-[#20243A] via-[#2B254A] to-[#20243A] py-16 sm:py-20 text-white dark:border-[#2B314D]">
          <div className="mx-auto max-w-4xl px-5 text-center space-y-6">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
              Better medication routines begin here.
            </h2>
            <p className="mx-auto max-w-xl text-sm sm:text-base text-white/80">
              Create your personalized patient, caregiver, doctor, or hospital workspace—or sign in to continue your routine.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                type="button"
                size="lg"
                onClick={() => navigate('/get-started')}
                className="bg-[#24A99B] hover:bg-[#1D8C80] text-white"
              >
                <span>Create Account</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={() => navigate('/login')}
                className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              >
                Sign In
              </Button>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section
          id="contact"
          className="border-t border-[#E6E0D8] bg-[#FFFFFF] py-20 dark:border-[#2B314D] dark:bg-[#171B2E]"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-8 grid grid-cols-1 gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#7956C8] dark:text-[#A58AE8]">
                Contact
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#20243A] dark:text-[#F7F5F0]">
                Start a conversation.
              </h2>
              <p className="text-sm text-[#5C627D] dark:text-[#A3A9C2] max-w-sm">
                Hospital onboarding, clinician verification inquiries, or patient support.
              </p>
              <p className="font-mono text-xs text-[#20243A] dark:text-[#F7F5F0]">
                care@medtwin.ai
              </p>
            </div>

            <div className="lg:col-span-7">
              <form
                onSubmit={handleContactSubmit}
                className="rounded-2xl border border-[#E6E0D8] bg-[#FAF8F5] p-6 sm:p-8 space-y-4 dark:border-[#2B314D] dark:bg-[#101322]"
                noValidate
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="contact-name"
                      className="block text-xs font-semibold text-[#20243A] dark:text-[#F7F5F0] mb-1.5"
                    >
                      Name
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      value={contactName}
                      onChange={(e) => {
                        setContactName(e.target.value);
                        if (contactSent) setContactSent(false);
                      }}
                      placeholder="Your name"
                      className="h-10 w-full rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] px-3 text-sm text-[#20243A] focus:outline-none focus:ring-2 focus:ring-[#7956C8] dark:border-[#2B314D] dark:bg-[#171B2E] dark:text-[#F7F5F0]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="contact-email"
                      className="block text-xs font-semibold text-[#20243A] dark:text-[#F7F5F0] mb-1.5"
                    >
                      Email
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => {
                        setContactEmail(e.target.value);
                        if (contactSent) setContactSent(false);
                      }}
                      placeholder="name@clinic.org"
                      className="h-10 w-full rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] px-3 text-sm text-[#20243A] focus:outline-none focus:ring-2 focus:ring-[#7956C8] dark:border-[#2B314D] dark:bg-[#171B2E] dark:text-[#F7F5F0]"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="contact-message"
                    className="block text-xs font-semibold text-[#20243A] dark:text-[#F7F5F0] mb-1.5"
                  >
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    rows={3}
                    value={contactMessage}
                    onChange={(e) => {
                      setContactMessage(e.target.value);
                      if (contactSent) setContactSent(false);
                    }}
                    placeholder="How can we help?"
                    className="w-full rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] px-3 py-2.5 text-sm text-[#20243A] focus:outline-none focus:ring-2 focus:ring-[#7956C8] dark:border-[#2B314D] dark:bg-[#171B2E] dark:text-[#F7F5F0]"
                  />
                </div>
                {contactError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{contactError}</p>
                )}
                {contactSent && (
                  <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#24A99B] dark:text-[#2DD4BF]">
                    <Check className="h-3.5 w-3.5" />
                    Message received.
                  </p>
                )}
                <div className="flex justify-end">
                  <Button type="submit">Send message</Button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E6E0D8] bg-[#FAF8F5] dark:border-[#2B314D] dark:bg-[#101322]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-3 text-xs text-[#5C627D] dark:text-[#A3A9C2]">
            <MedTwinLogo size={20} />
            <span aria-hidden="true">·</span>
            <span>Medication care, unified.</span>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs text-[#5C627D] dark:text-[#A3A9C2]">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(link.href);
                }}
                className="hover:text-[#20243A] dark:hover:text-[#F7F5F0] whitespace-nowrap"
              >
                {link.label}
              </a>
            ))}
            <Link to="/login" className="font-semibold text-[#7956C8] dark:text-[#A58AE8]">
              Sign In
            </Link>
            <Link to="/get-started" className="font-semibold text-[#24A99B] dark:text-[#2DD4BF]">
              Get Started
            </Link>
          </div>
        </div>
      </footer>

      {/* Learn More Solution Modal */}
      <Dialog
        open={Boolean(selectedSolution)}
        onOpenChange={(open) => !open && setSelectedSolution(null)}
      >
        <DialogContent>
          {selectedSolution && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedSolution.title}</DialogTitle>
                <DialogDescription>{selectedSolution.learnMoreSummary}</DialogDescription>
              </DialogHeader>
              <ul className="space-y-2.5 text-sm text-[#20243A] dark:text-[#F7F5F0]">
                {selectedSolution.capabilities.map((cap) => (
                  <li key={cap} className="flex items-start gap-2.5">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[#24A99B] dark:text-[#2DD4BF]" />
                    <span>{cap}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end gap-2 pt-3">
                <Button type="button" variant="outline" onClick={() => setSelectedSolution(null)}>
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const route = selectedSolution.registerRoute;
                    setSelectedSolution(null);
                    navigate(route);
                  }}
                >
                  <span>{selectedSolution.registerLabel}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
