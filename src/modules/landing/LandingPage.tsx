import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Menu, Moon, Sun, X } from 'lucide-react';
import { useTheme } from '@/src/context/ThemeContext';
import { useToast } from '@/src/components/ui/toast';
import { MedTwinLogo } from '@/src/components/shared/MedTwinLogo';
import { InteractiveCursor } from '@/src/components/landing/InteractiveCursor';
import { cn } from '@/src/lib/utils';

interface HowStep {
  id: string;
  num: string;
  title: string;
  detail: string;
  previewLabel: string;
  previewMeta: string;
}

const HOW_STEPS: HowStep[] = [
  {
    id: 'workspace',
    num: '01',
    title: 'Choose a workspace',
    detail: 'Open the patient, caregiver, doctor, or hospital view.',
    previewLabel: '4 connected roles',
    previewMeta: 'Patient · Caregiver · Doctor · Hospital',
  },
  {
    id: 'regimen',
    num: '02',
    title: 'Add or confirm doses',
    detail: 'Scan prescriptions and log daily medication check-ins.',
    previewLabel: 'Prescription to schedule',
    previewMeta: 'Verified intake · Daily confirmation',
  },
  {
    id: 'twin',
    num: '03',
    title: 'Track the digital twin',
    detail: 'Monitor refill days remaining, adherence patterns, and care alerts.',
    previewLabel: 'Continuous protection',
    previewMeta: 'Supply forecast · Consent-scoped alerts',
  },
];

const NAV_LINKS = [
  { href: '#overview', label: 'Overview' },
  { href: '#solution', label: 'Solution' },
  { href: '#how-to-use', label: 'How to use' },
  { href: '#contact', label: 'Contact us' },
];

export function LandingPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { pushToast } = useToast();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeStepId, setActiveStepId] = useState<string>(HOW_STEPS[0].id);

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactError, setContactError] = useState('');
  const [contactSent, setContactSent] = useState(false);

  const activeStep = HOW_STEPS.find((s) => s.id === activeStepId) ?? HOW_STEPS[0];

  const handleGetStarted = () => {
    navigate('/dashboard');
  };

  const handleNavClick = (href: string) => {
    setMobileMenuOpen(false);
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const emailTrimmed = contactEmail.trim();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed);

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
      description: 'Thank you for reaching out to MedTwin AI.',
      variant: 'success',
    });
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#F8FAFC] text-[#172554] dark:bg-[#0B1220] dark:text-[#F8FAFC] transition-colors duration-200">
      <InteractiveCursor />

      {/* Subtle architectural hairline backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.035] dark:opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />

      {/* Minimal Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-[#E2E8F0]/80 bg-[#F8FAFC]/85 backdrop-blur-md dark:border-[#334155]/75 dark:bg-[#0B1220]/85 transition-colors duration-200">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-6 lg:px-10">
          {/* Zone 1: Minimal Logo */}
          <a
            href="#overview"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('#overview');
            }}
            className="whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded-md"
          >
            <MedTwinLogo />
          </a>

          {/* Zone 2: Clean Text Nav Links */}
          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(link.href);
                }}
                className="relative text-sm font-medium text-[#64748B] hover:text-[#172554] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] transition-colors whitespace-nowrap shrink-0 after:absolute after:left-0 after:-bottom-1 after:h-px after:w-0 after:bg-[#0D9488] dark:after:bg-[#14B8A6] after:transition-all after:duration-200 hover:after:w-full"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Zone 3: Theme Toggle + Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={theme === 'dark'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] text-[#172554] hover:border-[#0D9488]/50 hover:text-[#0D9488] transition-colors cursor-pointer dark:border-[#334155] dark:bg-[#172033] dark:text-[#F8FAFC] dark:hover:border-[#14B8A6]/60 dark:hover:text-[#14B8A6]"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={handleGetStarted}
              className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0F766E] transition-colors whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#14B8A6] dark:text-[#0B1220] dark:hover:bg-[#2DD4BF]"
            >
              <span>Get Started</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] text-[#172554] dark:border-[#334155] dark:bg-[#172033] dark:text-[#F8FAFC]"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E2E8F0] bg-[#FFFFFF] px-6 py-4 space-y-3 dark:border-[#334155] dark:bg-[#172033]">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(link.href);
                }}
                className="block py-1.5 text-sm font-medium text-[#172554] dark:text-[#F8FAFC]"
              >
                {link.label}
              </a>
            ))}
            <button
              type="button"
              onClick={handleGetStarted}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-white dark:bg-[#14B8A6] dark:text-[#0B1220]"
            >
              <span>Get Started</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </header>

      <main className="relative z-10">
        {/* Hero / Overview Section */}
        <section id="overview" className="mx-auto max-w-6xl px-6 pt-24 pb-20 sm:pt-32 sm:pb-28 lg:px-10">
          <div className="max-w-3xl">
            <h1 className="font-display text-4xl font-bold tracking-tight text-[#172554] dark:text-[#F8FAFC] sm:text-6xl leading-[1.06] text-balance">
              Medication care, unified.
            </h1>

            <p className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
              MedTwin AI connects patients, families, and doctors around one shared digital twin of daily adherence and refill continuity.
            </p>

            <div className="mt-10">
              <button
                type="button"
                onClick={handleGetStarted}
                className="group inline-flex items-center gap-3 rounded-xl bg-[#0D9488] px-6 py-3.5 text-sm font-semibold text-white transition-transform duration-150 hover:-translate-y-0.5 hover:bg-[#0F766E] whitespace-nowrap cursor-pointer dark:bg-[#14B8A6] dark:text-[#0B1220] dark:hover:bg-[#2DD4BF]"
              >
                <span>Get Started</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>

          {/* Quiet 3-metric hairline strip */}
          <div className="mt-20 grid grid-cols-1 gap-8 border-t border-[#E2E8F0] pt-10 sm:grid-cols-3 dark:border-[#334155]">
            <div data-cursor="interactive" className="group transition-colors">
              <p className="font-mono text-2xl font-semibold text-[#172554] dark:text-[#F8FAFC] tabular-nums">
                1 view
              </p>
              <p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">
                Shared across patients and care teams
              </p>
            </div>
            <div data-cursor="interactive" className="group transition-colors">
              <p className="font-mono text-2xl font-semibold text-[#172554] dark:text-[#F8FAFC] tabular-nums">
                4 roles
              </p>
              <p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">
                Patient, caregiver, doctor, and hospital
              </p>
            </div>
            <div data-cursor="interactive" className="group transition-colors">
              <p className="font-mono text-2xl font-semibold text-[#0D9488] dark:text-[#14B8A6] tabular-nums">
                Early alerts
              </p>
              <p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">
                Missed-dose and refill gap detection
              </p>
            </div>
          </div>
        </section>

        {/* Solution / Industry Impact Section */}
        <section
          id="solution"
          className="mx-auto max-w-6xl border-t border-[#E2E8F0] px-6 py-20 sm:py-24 lg:px-10 dark:border-[#334155]"
        >
          <div className="max-w-xl">
            <p className="text-xs font-semibold tracking-wider text-[#0D9488] dark:text-[#14B8A6]">
              Medical industry solution
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-[#172554] dark:text-[#F8FAFC] sm:text-3xl text-balance">
              Closing the gap between prescription and recovery.
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div
              data-cursor="interactive"
              className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 transition-transform duration-200 hover:-translate-y-0.5 dark:border-[#334155] dark:bg-[#172033]"
            >
              <span className="font-mono text-xs font-semibold text-[#0D9488] dark:text-[#14B8A6] tabular-nums">
                01
              </span>
              <h3 className="mt-3 font-display text-base font-semibold text-[#172554] dark:text-[#F8FAFC]">
                Refill continuity
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                Forecasts supply run-out before treatment breaks occur.
              </p>
            </div>

            <div
              data-cursor="interactive"
              className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 transition-transform duration-200 hover:-translate-y-0.5 dark:border-[#334155] dark:bg-[#172033]"
            >
              <span className="font-mono text-xs font-semibold text-[#0D9488] dark:text-[#14B8A6] tabular-nums">
                02
              </span>
              <h3 className="mt-3 font-display text-base font-semibold text-[#172554] dark:text-[#F8FAFC]">
                Consent-first visibility
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                Keeps caregivers notified while keeping clinical privacy intact.
              </p>
            </div>

            <div
              data-cursor="interactive"
              className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 transition-transform duration-200 hover:-translate-y-0.5 dark:border-[#334155] dark:bg-[#172033]"
            >
              <span className="font-mono text-xs font-semibold text-[#0D9488] dark:text-[#14B8A6] tabular-nums">
                03
              </span>
              <h3 className="mt-3 font-display text-base font-semibold text-[#172554] dark:text-[#F8FAFC]">
                Faster clinical review
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                Gives physicians verified adherence history at every visit.
              </p>
            </div>
          </div>
        </section>

        {/* How to Use Section */}
        <section
          id="how-to-use"
          className="mx-auto max-w-6xl border-t border-[#E2E8F0] px-6 py-20 sm:py-24 lg:px-10 dark:border-[#334155]"
        >
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-5">
              <p className="text-xs font-semibold tracking-wider text-[#0D9488] dark:text-[#14B8A6]">
                How to use
              </p>
              <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-[#172554] dark:text-[#F8FAFC] sm:text-3xl text-balance">
                Three steps from setup to daily clarity.
              </h2>
            </div>

            <div className="lg:col-span-7 space-y-3">
              {HOW_STEPS.map((step) => {
                const isActive = step.id === activeStep.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStepId(step.id)}
                    className={cn(
                      'w-full text-left rounded-2xl border p-5 transition-colors duration-150 cursor-pointer',
                      isActive
                        ? 'border-[#0D9488]/60 bg-[#FFFFFF] dark:border-[#14B8A6]/60 dark:bg-[#172033]'
                        : 'border-[#E2E8F0] bg-transparent hover:bg-[#FFFFFF]/60 dark:border-[#334155] dark:hover:bg-[#172033]/50',
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <div className="flex items-baseline gap-4">
                        <span className="font-mono text-xs font-semibold text-[#0D9488] dark:text-[#14B8A6] tabular-nums">
                          {step.num}
                        </span>
                        <span className="font-display text-base font-semibold text-[#172554] dark:text-[#F8FAFC]">
                          {step.title}
                        </span>
                      </div>
                      <span className="hidden sm:inline text-xs text-[#64748B] dark:text-[#94A3B8] whitespace-nowrap">
                        {step.previewLabel}
                      </span>
                    </div>
                    {isActive && (
                      <div className="mt-2.5 pl-8 space-y-1">
                        <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">{step.detail}</p>
                        <p className="text-xs font-mono text-[#0D9488] dark:text-[#14B8A6]">
                          {step.previewMeta}
                        </p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Contact Us Section */}
        <section
          id="contact"
          className="mx-auto max-w-6xl border-t border-[#E2E8F0] px-6 py-20 sm:py-24 lg:px-10 dark:border-[#334155]"
        >
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5 space-y-4">
              <p className="text-xs font-semibold tracking-wider text-[#0D9488] dark:text-[#14B8A6]">
                Contact us
              </p>
              <h2 className="font-display text-2xl font-bold tracking-tight text-[#172554] dark:text-[#F8FAFC] sm:text-3xl text-balance">
                Start a conversation.
              </h2>
              <p className="text-sm leading-relaxed text-[#64748B] dark:text-[#94A3B8] max-w-sm">
                Clinical pilots, care-team onboarding, or general questions.
              </p>
              <p className="pt-2 font-mono text-xs text-[#172554] dark:text-[#F8FAFC]">
                care@medtwin.ai
              </p>
            </div>

            <div className="lg:col-span-7">
              <form
                onSubmit={handleContactSubmit}
                className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 sm:p-8 space-y-4 dark:border-[#334155] dark:bg-[#172033]"
                noValidate
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="contact-name"
                      className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1.5"
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
                      placeholder="Dr. Meera Nair"
                      className="h-10 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm text-[#172554] placeholder:text-[#64748B]/70 focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC] dark:placeholder:text-[#94A3B8]/60 dark:focus:ring-[#14B8A6]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="contact-email"
                      className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1.5"
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
                      className="h-10 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm text-[#172554] placeholder:text-[#64748B]/70 focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC] dark:placeholder:text-[#94A3B8]/60 dark:focus:ring-[#14B8A6]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="contact-message"
                    className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1.5"
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
                    className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#172554] placeholder:text-[#64748B]/70 focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC] dark:placeholder:text-[#94A3B8]/60 dark:focus:ring-[#14B8A6]"
                  />
                </div>

                {contactError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">{contactError}</p>
                )}

                {contactSent && (
                  <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0D9488] dark:text-[#14B8A6]">
                    <Check className="h-3.5 w-3.5" />
                    Message sent.
                  </p>
                )}

                <div className="pt-1 flex items-center justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0F766E] transition-colors whitespace-nowrap cursor-pointer dark:bg-[#14B8A6] dark:text-[#0B1220] dark:hover:bg-[#2DD4BF]"
                  >
                    Send message
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="relative z-10 border-t border-[#E2E8F0] dark:border-[#334155]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <div className="flex items-center gap-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
            <MedTwinLogo size={20} />
            <span aria-hidden="true">·</span>
            <span>Your medicines. Your care team. One connected view.</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-[#64748B] dark:text-[#94A3B8]">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(link.href);
                }}
                className="hover:text-[#172554] dark:hover:text-[#F8FAFC] transition-colors whitespace-nowrap"
              >
                {link.label}
              </a>
            ))}
            <button
              type="button"
              onClick={handleGetStarted}
              className="font-semibold text-[#0D9488] hover:text-[#0F766E] dark:text-[#14B8A6] dark:hover:text-[#2DD4BF] transition-colors whitespace-nowrap cursor-pointer"
            >
              Get Started
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
