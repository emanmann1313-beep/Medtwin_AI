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
import { useTheme } from '@/src/context/ThemeContext';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { DEMO_ACCOUNTS } from '@/src/data/seedData';
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
  const { theme, isSystemDefault, setTheme, resetToSystemTheme } = useTheme();
  const {
    activeDemoAccount,
    switchDemoAccount,
    dadiNaniMode,
    setDadiNaniMode,
    dadiNaniLanguage,
    setDadiNaniLanguage,
    resetDemo,
  } = useMedTwin();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Appearance & Theme Switcher */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance &amp; color theme</CardTitle>
          <CardDescription>
            Choose Light, Dark, or follow your device’s system preference. Stored locally in your browser.
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
                  ? 'border-[#0D9488] bg-[#CCFBF1]/60 dark:border-[#14B8A6] dark:bg-[#14B8A6]/15'
                  : 'border-[#E2E8F0] hover:bg-[#F8FAFC] dark:border-[#334155] dark:hover:bg-[#1E293B]',
              )}
            >
              <Sun className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-sm font-semibold block text-[#172554] dark:text-[#F8FAFC]">
                  Light Theme
                </span>
                <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Soft white canvas &amp; crisp white cards
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={cn(
                'flex items-start gap-3 rounded-2xl border p-4 text-left transition-all cursor-pointer',
                !isSystemDefault && theme === 'dark'
                  ? 'border-[#0D9488] bg-[#CCFBF1]/60 dark:border-[#14B8A6] dark:bg-[#14B8A6]/15'
                  : 'border-[#E2E8F0] hover:bg-[#F8FAFC] dark:border-[#334155] dark:hover:bg-[#1E293B]',
              )}
            >
              <Moon className="h-5 w-5 text-[#0D9488] dark:text-[#14B8A6] shrink-0 mt-0.5" />
              <div>
                <span className="text-sm font-semibold block text-[#172554] dark:text-[#F8FAFC]">
                  Dark Theme
                </span>
                <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Deep navy surfaces &amp; teal accents
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={resetToSystemTheme}
              className={cn(
                'flex items-start gap-3 rounded-2xl border p-4 text-left transition-all cursor-pointer',
                isSystemDefault
                  ? 'border-[#0D9488] bg-[#CCFBF1]/60 dark:border-[#14B8A6] dark:bg-[#14B8A6]/15'
                  : 'border-[#E2E8F0] hover:bg-[#F8FAFC] dark:border-[#334155] dark:hover:bg-[#1E293B]',
              )}
            >
              <Laptop className="h-5 w-5 text-[#3B82F6] dark:text-[#60A5FA] shrink-0 mt-0.5" />
              <div>
                <span className="text-sm font-semibold block text-[#172554] dark:text-[#F8FAFC]">
                  System Default
                </span>
                <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
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
            <HeartHandshake className="h-5 w-5 text-[#0D9488] dark:text-[#14B8A6]" />
            <span>Dadi-Nani Accessibility Preferences</span>
          </CardTitle>
          <CardDescription>
            Customize elder-friendly large typography and language inside Dadi-Nani Mode.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 dark:border-[#334155] dark:bg-[#0B1220]">
            <div>
              <p className="text-sm font-semibold text-[#172554] dark:text-[#F8FAFC]">
                Large-Print Reading Size
              </p>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
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
            <label className="flex items-center gap-2 text-xs font-semibold text-[#172554] dark:text-[#F8FAFC]">
              <Globe className="h-4 w-4 text-[#0D9488] dark:text-[#14B8A6]" />
              <span>Dadi-Nani Mode Language</span>
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setDadiNaniLanguage(lang.id)}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-center transition-colors cursor-pointer',
                    dadiNaniLanguage === lang.id
                      ? 'border-[#0D9488] bg-[#CCFBF1] text-[#0F766E] dark:border-[#14B8A6] dark:bg-[#14B8A6]/15 dark:text-[#14B8A6]'
                      : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#64748B] hover:bg-[#F8FAFC] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#94A3B8] dark:hover:bg-[#1E293B]',
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

      {/* Demo Workspace Switcher & Session Reset */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-[#0D9488] dark:text-[#14B8A6]" />
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
                      ? 'border-[#0D9488] bg-[#CCFBF1]/60 dark:border-[#14B8A6] dark:bg-[#14B8A6]/15'
                      : 'border-[#E2E8F0] hover:bg-[#F8FAFC] dark:border-[#334155] dark:hover:bg-[#1E293B]',
                  )}
                >
                  <span className="text-sm font-semibold text-[#172554] dark:text-[#F8FAFC]">
                    {acc.label}
                  </span>
                  <span className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                    {acc.subtitle}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 border-t border-[#E2E8F0] pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#334155]">
            <div className="flex items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
              <ShieldCheck className="h-4 w-4 text-[#0D9488] dark:text-[#14B8A6] shrink-0" />
              <span>Resets synthetic schedules, refills, and Care Circle invitations in browser storage.</span>
            </div>
            <Button type="button" variant="outline" onClick={resetDemo}>
              <RotateCcw className="h-4 w-4" />
              <span>Reset demo data</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
