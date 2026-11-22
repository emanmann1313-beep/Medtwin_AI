import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2, Moon, Sparkles, Sun } from 'lucide-react';
import { DEFAULT_ROUTE_FOR_ROLE, useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { MedTwinLogo } from '@/src/components/shared/MedTwinLogo';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { useToast } from '@/src/components/ui/toast';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, enterDemoMode } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pushToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fromPath = (location.state as { from?: string } | null)?.from;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const signedIn = await login(email.trim(), password);
      pushToast({
        title: `Welcome back, ${signedIn.fullName}`,
        description: `Signed in as ${signedIn.role.replace('_', ' ')}.`,
        variant: 'success',
      });
      navigate(fromPath || DEFAULT_ROUTE_FOR_ROLE[signedIn.role], { replace: true });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => {
    enterDemoMode();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#20243A] dark:bg-[#101322] dark:text-[#F7F5F0] transition-colors">
      <header className="border-b border-[#E6E0D8] bg-[#FFFFFF]/90 backdrop-blur-md dark:border-[#2B314D] dark:bg-[#171B2E]/90">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link to="/" className="whitespace-nowrap shrink-0">
            <MedTwinLogo />
          </Link>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] text-[#20243A] cursor-pointer dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              to="/get-started"
              className="rounded-xl bg-[#7956C8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6644B4] whitespace-nowrap shrink-0"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 py-14 sm:py-20">
        <div className="rounded-2xl border border-[#E6E0D8] bg-[#FFFFFF] p-7 sm:p-8 shadow-xs dark:border-[#2B314D] dark:bg-[#171B2E]">
          <h1 className="font-display text-2xl font-bold text-[#20243A] dark:text-[#F7F5F0]">
            Sign in to MedTwin AI
          </h1>
          <p className="mt-1.5 text-sm text-[#5C627D] dark:text-[#A3A9C2]">
            Access your patient, caregiver, doctor, or hospital workspace.
          </p>

          {errorMsg && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold mb-1.5">
                Email address
              </label>
              <Input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="text-xs font-semibold">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-[#7956C8] hover:underline dark:text-[#A58AE8]"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>

            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </Button>
          </form>

          <div className="mt-6 border-t border-[#E6E0D8] pt-5 space-y-3 dark:border-[#2B314D]">
            <Button type="button" variant="outline" className="w-full" onClick={handleDemo}>
              <Sparkles className="h-4 w-4 text-[#7956C8] dark:text-[#A58AE8]" />
              <span>Explore Interactive Demo</span>
            </Button>

            <p className="text-center text-xs text-[#5C627D] dark:text-[#A3A9C2]">
              New to MedTwin AI?{' '}
              <Link
                to="/get-started"
                className="font-semibold text-[#24A99B] hover:underline dark:text-[#2DD4BF]"
              >
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
