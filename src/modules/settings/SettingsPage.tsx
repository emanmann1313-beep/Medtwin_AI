import React from 'react';
import {
  Globe,
  HeartHandshake,
  Laptop,
  Moon,
  RotateCcw,
  ShieldCheck,
  Sun,
  UserCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { DEMO_ACCOUNTS } from '@/src/data/seedData';
import { CaregiverContactsSection } from '@/src/modules/caregivers/components/CaregiverContactsSection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Switch } from '@/src/components/ui/switch';
import { cn } from '@/src/lib/utils';

const LANGUAGES = [
  { id: 'en' as const, label: 'English', native: 'English' },
  { id: 'hi' as const, label: 'Hindi', native: 'हिन्दी' },
  { id: 'pa' as const, label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
];

export function SettingsPage() {
  const { isDemoMode, updateProfile } = useAuth();
  const { theme, isSystemDefault, setTheme, resetToSystemTheme } = useTheme();
  const {
    isRealAccountMode,
    activeRole,
    hasPatients,
    activePatient,
    activeDemoAccount,
    switchDemoAccount,
    dadiNaniMode,
    setDadiNaniMode,
    dadiNaniLanguage,
    setDadiNaniLanguage,
    resetDemo,
  } = useMedTwin();

  const handleLanguageChange = (lang: 'en' | 'hi' | 'pa') => {
    setDadiNaniLanguage(lang);
    if (isRealAccountMode) {
      void updateProfile({ preferredLanguage: lang }).catch(() => {
        // Non-blocking preference sync
      });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Appearance & Theme Switcher */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance &amp; color theme</CardTitle>
          <CardDescription>
            Choose Warm Ivory Light, Deep Navy Dark, or follow your device’s system preference for public pages. Dashboards stay in Dark Healthcare Theme.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={cn(
                'flex items-start gap-3 rounded-2xl border p-4 text-left transition-all cursor-pointer',
                !isSystemDefault && theme === 'light'
                  ? 'border-[#8B5CF6] bg-[#8B5CF6]/20 shadow-[0_0_16px_rgba(139,92,246,0.2)]'
                  : 'border-[#334155] bg-[#223451] hover:border-[#8B5CF6]/45',
              )}
            >
              <Sun className="h-5 w-5 text-[#FBBF24] shrink-0 mt-0.5" />
              <div>
                <span className="text-sm font-semibold block text-[#F8FAFC]">
                  Light Theme
                </span>
                <span className="text-xs text-[#A8B8CC]">
                  Warm ivory canvas &amp; crisp white cards
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={cn(
                'flex items-start gap-3 rounded-2xl border p-4 text-left transition-all cursor-pointer',
                !isSystemDefault && theme === 'dark'
                  ? 'border-[#8B5CF6] bg-[#8B5CF6]/20 shadow-[0_0_16px_rgba(139,92,246,0.2)]'
                  : 'border-[#334155] bg-[#223451] hover:border-[#8B5CF6]/45',
              )}
            >
              <Moon className="h-5 w-5 text-[#8B5CF6] shrink-0 mt-0.5" />
              <div>
                <span className="text-sm font-semibold block text-[#F8FAFC]">
                  Dark Theme
                </span>
                <span className="text-xs text-[#A8B8CC]">
                  Deep midnight navy &amp; violet accents
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={resetToSystemTheme}
              className={cn(
                'flex items-start gap-3 rounded-2xl border p-4 text-left transition-all cursor-pointer',
                isSystemDefault
                  ? 'border-[#8B5CF6] bg-[#8B5CF6]/20 shadow-[0_0_16px_rgba(139,92,246,0.2)]'
                  : 'border-[#334155] bg-[#223451] hover:border-[#8B5CF6]/45',
              )}
            >
              <Laptop className="h-5 w-5 text-[#2DD4BF] shrink-0 mt-0.5" />
              <div>
                <span className="text-sm font-semibold block text-[#F8FAFC]">
                  System Default
                </span>
                <span className="text-xs text-[#A8B8CC]">
                  Matches device setting ({theme})
                </span>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Dadi-Nani Accessibility & Language Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-[#2DD4BF]" />
            <span>Dadi-Nani Accessibility Preferences</span>
          </CardTitle>
          <CardDescription>
            Customize elder-friendly large typography and preferred voice language across Dadi-Nani Mode.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#334155] bg-[#223451] p-4">
            <div>
              <p className="text-sm font-semibold text-[#F8FAFC]">
                Large-Print Reading Size
              </p>
              <p className="text-xs text-[#A8B8CC]">
                Increases base typography and spacing across the workspace for easier reading.
              </p>
            </div>
            <Switch
              checked={dadiNaniMode}
              onCheckedChange={setDadiNaniMode}
              aria-label="Toggle large-print reading size"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#F8FAFC]">
              <Globe className="h-4 w-4 text-[#8B5CF6]" />
              <span>Preferred Voice &amp; Display Language</span>
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => handleLanguageChange(lang.id)}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-center transition-colors cursor-pointer',
                    dadiNaniLanguage === lang.id
                      ? 'border-[#8B5CF6] bg-[#8B5CF6]/20 text-[#F8FAFC]'
                      : 'border-[#334155] bg-[#223451] text-[#A8B8CC] hover:text-[#F8FAFC]',
                  )}
                >
                  <span className="text-sm font-semibold block">{lang.native}</span>
                  <span className="text-[11px] opacity-80">{lang.label}</span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patient Caregiver Contacts & Alert Preferences */}
      {activeRole === 'patient' && hasPatients && activePatient.id && (
        <CaregiverContactsSection
          patient={activePatient}
          canManageContacts
          compact
          title="Caregiver Contacts & Alert Preferences"
          description="Add or edit trusted family caregivers, preferred notification language, WhatsApp/SMS links, and automatic alert rules."
        />
      )}

      {/* Account Security Link for Authenticated Users */}
      {isRealAccountMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#2DD4BF]" />
              <span>Account profile &amp; privacy controls</span>
            </CardTitle>
            <CardDescription>
              Manage your personal information, email verification, and authorized care connections.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/profile">
              <Button type="button" variant="outline">
                Open Profile &amp; Access
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Isolated Demo Workspace Switcher (Only visible when explicitly in Interactive Demo Mode) */}
      {isDemoMode && !isRealAccountMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-[#2DD4BF]" />
              <span>Demo workspace profile &amp; data reset</span>
            </CardTitle>
            <CardDescription>
              Synthetic demonstration accounts remain completely separate from production authentication.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((acc) => {
                const active = acc.id === activeDemoAccount.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => switchDemoAccount(acc.id)}
                    className={cn(
                      'flex flex-col items-start rounded-2xl border p-3.5 text-left transition-colors cursor-pointer',
                      active
                        ? 'border-[#2DD4BF] bg-[#2DD4BF]/15 shadow-[0_0_16px_rgba(45,212,191,0.16)]'
                        : 'border-[#334155] bg-[#223451] hover:border-[#8B5CF6]/45',
                    )}
                  >
                    <span className="text-sm font-semibold text-[#F8FAFC]">
                      {acc.label}
                    </span>
                    <span className="text-xs text-[#A8B8CC] mt-0.5">
                      {acc.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 border-t border-[#334155] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-[#A8B8CC]">
                <ShieldCheck className="h-4 w-4 text-[#2DD4BF] shrink-0" />
                <span>Resets synthetic schedules, refills, and Care Circle invitations in browser storage.</span>
              </div>
              <Button type="button" variant="outline" onClick={resetDemo}>
                <RotateCcw className="h-4 w-4" />
                <span>Reset demo data</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
