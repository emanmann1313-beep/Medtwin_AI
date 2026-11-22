import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { MedTwinLogo } from '@/src/components/shared/MedTwinLogo';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';

export function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{
    emailServiceConfigured: boolean;
    message: string;
    resetToken?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await forgotPassword(email.trim());
      setResult(res);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to start password recovery.');
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
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5C627D] hover:text-[#20243A] dark:text-[#A3A9C2] dark:hover:text-[#F7F5F0]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Sign In</span>
        </Link>

        <div className="mt-5 rounded-2xl border border-[#E6E0D8] bg-[#FFFFFF] p-7 shadow-xs dark:border-[#2B314D] dark:bg-[#171B2E]">
          <h1 className="font-display text-2xl font-bold">Forgot your password?</h1>
          <p className="mt-1.5 text-sm text-[#5C627D] dark:text-[#A3A9C2]">
            Enter the email address associated with your account to request a password reset.
          </p>

          {errorMsg && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {result ? (
            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-2.5 rounded-xl border border-[#24A99B]/35 bg-[#24A99B]/10 p-4 text-xs text-[#20243A] dark:text-[#F7F5F0]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#24A99B] dark:text-[#2DD4BF]" />
                <div className="space-y-1">
                  <p className="font-semibold">
                    {result.emailServiceConfigured
                      ? 'Recovery email dispatched'
                      : 'Email provider not configured'}
                  </p>
                  <p className="text-[#5C627D] dark:text-[#A3A9C2]">{result.message}</p>
                </div>
              </div>

              {result.resetToken && (
                <div className="rounded-xl border border-[#E6E0D8] bg-[#FAF8F5] p-3.5 space-y-2 dark:border-[#2B314D] dark:bg-[#101322]">
                  <p className="text-xs font-semibold">Reset token:</p>
                  <code className="block break-all rounded-lg bg-[#FFFFFF] p-2 font-mono text-xs border border-[#E6E0D8] dark:bg-[#171B2E] dark:border-[#2B314D]">
                    {result.resetToken}
                  </code>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => navigate(`/reset-password?token=${encodeURIComponent(result.resetToken!)}`)}
                  >
                    Continue to Reset Password
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="forgot-email" className="block text-xs font-semibold mb-1.5">
                  Account email
                </label>
                <Input
                  id="forgot-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Request password reset</span>
                )}
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
