import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { MedTwinLogo } from '@/src/components/shared/MedTwinLogo';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { resetPassword } = useAuth();

  const [token, setToken] = useState(searchParams.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const msg = await resetPassword(token.trim(), password);
      setDoneMessage(msg);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#20243A] dark:bg-[#101322] dark:text-[#F7F5F0]">
      <header className="border-b border-[#E6E0D8] bg-[#FFFFFF]/90 dark:border-[#2B314D] dark:bg-[#171B2E]/90">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link to="/">
            <MedTwinLogo />
          </Link>
          <Link to="/login" className="text-sm font-semibold text-[#7956C8] dark:text-[#A58AE8]">
            Sign In
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 py-14">
        <div className="rounded-2xl border border-[#E6E0D8] bg-[#FFFFFF] p-7 shadow-xs dark:border-[#2B314D] dark:bg-[#171B2E]">
          <h1 className="font-display text-2xl font-bold">Reset password</h1>
          <p className="mt-1.5 text-sm text-[#5C627D] dark:text-[#A3A9C2]">
            Enter your recovery token and choose a new password.
          </p>

          {errorMsg && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {doneMessage ? (
            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-2.5 rounded-xl border border-[#24A99B]/35 bg-[#24A99B]/10 p-4 text-xs">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#24A99B] dark:text-[#2DD4BF]" />
                <span>{doneMessage}</span>
              </div>
              <Button type="button" className="w-full" onClick={() => navigate('/login')}>
                Go to Sign In
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="reset-token" className="block text-xs font-semibold mb-1.5">
                  Recovery token
                </label>
                <Input
                  id="reset-token"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste recovery token"
                />
              </div>
              <div>
                <label htmlFor="reset-pass" className="block text-xs font-semibold mb-1.5">
                  New password (min 8 chars)
                </label>
                <Input
                  id="reset-pass"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="reset-confirm" className="block text-xs font-semibold mb-1.5">
                  Confirm new password
                </label>
                <Input
                  id="reset-confirm"
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Updating password...</span>
                  </>
                ) : (
                  <span>Update password</span>
                )}
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
