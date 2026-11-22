import React, { useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  MailCheck,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { useToast } from '@/src/components/ui/toast';
import { cn, formatShortDate } from '@/src/lib/utils';

export function ProfilePage() {
  const {
    user,
    isDemoMode,
    supabaseConfigured,
    lastEmailVerificationToken,
    updateProfile,
    verifyEmail,
  } = useAuth();
  const {
    isRealAccountMode,
    doctorAuthorizations,
    authorizeDoctorByEmail,
    respondDoctorAuthorization,
  } = useMedTwin();
  const { pushToast } = useToast();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'hi' | 'pa'>(
    user?.preferredLanguage ?? 'en',
  );
  const [country, setCountry] = useState(user?.country ?? '');
  const [specialty, setSpecialty] = useState(user?.specialty ?? '');
  const [affiliation, setAffiliation] = useState(user?.affiliation ?? '');
  const [contactInfo, setContactInfo] = useState(user?.contactInfo ?? '');
  const [hospitalAddress, setHospitalAddress] = useState(user?.hospitalAddress ?? '');
  const [saving, setSaving] = useState(false);

  const [verifyTokenInput, setVerifyTokenInput] = useState(lastEmailVerificationToken ?? '');
  const [verifyingEmail, setVerifyingEmail] = useState(false);

  const [docEmailInput, setDocEmailInput] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  if (isDemoMode || !user) {
    return (
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Account Profile</CardTitle>
          <CardDescription>
            You are currently viewing the isolated Interactive Demo workspace. Sign up or sign in with a real account to manage persistent profile credentials and authorizations.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        fullName: fullName.trim() || user.fullName,
        phone: phone.trim(),
        preferredLanguage,
        country: country.trim(),
        specialty: specialty.trim(),
        affiliation: affiliation.trim(),
        contactInfo: contactInfo.trim(),
        hospitalAddress: hospitalAddress.trim(),
      });
      pushToast({
        title: 'Profile updated',
        description: 'Your account preferences were saved.',
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Failed to update profile',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyTokenInput.trim()) return;
    setVerifyingEmail(true);
    try {
      await verifyEmail(verifyTokenInput.trim());
      pushToast({
        title: 'Email verified',
        description: 'Your email address is now confirmed.',
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Verification failed',
        description: err instanceof Error ? err.message : 'Invalid token.',
        variant: 'error',
      });
    } finally {
      setVerifyingEmail(false);
    }
  };

  const handleAuthorizeDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docEmailInput.trim()) return;
    setAuthSubmitting(true);
    try {
      await authorizeDoctorByEmail(docEmailInput.trim());
      setDocEmailInput('');
    } finally {
      setAuthSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Account Status & Verification Card */}
      <Card>
        <CardHeader>
          <CardTitle>Account Identity &amp; Verification</CardTitle>
          <CardDescription>
            Role permissions and verification states are enforced server-side.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
            <div className="rounded-xl border border-[#E6E0D8] bg-[#FAF8F5] p-4 dark:border-[#2B314D] dark:bg-[#101322]">
              <span className="text-[#5C627D] dark:text-[#A3A9C2] block">Role</span>
              <span className="mt-1 font-display text-base font-bold capitalize text-[#20243A] dark:text-[#F7F5F0] block">
                {user.role.replace('_', ' ')}
              </span>
            </div>

            <div className="rounded-xl border border-[#E6E0D8] bg-[#FAF8F5] p-4 dark:border-[#2B314D] dark:bg-[#101322]">
              <span className="text-[#5C627D] dark:text-[#A3A9C2] block">Email status</span>
              <span
                className={cn(
                  'mt-1 inline-flex items-center gap-1.5 font-display text-sm font-bold',
                  user.emailVerified
                    ? 'text-[#24A99B] dark:text-[#2DD4BF]'
                    : 'text-amber-700 dark:text-amber-400',
                )}
              >
                {user.emailVerified ? (
                  <>
                    <MailCheck className="h-4 w-4" />
                    <span>Verified</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-4 w-4" />
                    <span>Unverified</span>
                  </>
                )}
              </span>
            </div>

            <div className="rounded-xl border border-[#E6E0D8] bg-[#FAF8F5] p-4 dark:border-[#2B314D] dark:bg-[#101322]">
              <span className="text-[#5C627D] dark:text-[#A3A9C2] block">Credential status</span>
              <span
                className={cn(
                  'mt-1 inline-flex items-center gap-1.5 font-display text-sm font-bold capitalize',
                  user.verificationStatus === 'verified'
                    ? 'text-[#24A99B] dark:text-[#2DD4BF]'
                    : 'text-amber-700 dark:text-amber-400',
                )}
              >
                {user.verificationStatus === 'verified' ? (
                  <ShieldCheck className="h-4 w-4" />
                ) : (
                  <ShieldAlert className="h-4 w-4" />
                )}
                <span>{user.verificationStatus.replace('_', ' ')}</span>
              </span>
            </div>
          </div>

          {!user.emailVerified && (
            <div className="rounded-xl border border-[#E6E0D8] bg-[#FAF8F5] p-4 space-y-3 dark:border-[#2B314D] dark:bg-[#101322]">
              <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">
                {supabaseConfigured
                  ? 'Check your inbox for a verification link, or paste your verification token below.'
                  : 'Outbound verification emails are not configured in this environment. If you have a verification token from registration, paste it below to confirm your email.'}
              </p>
              <form onSubmit={handleVerifyEmail} className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={verifyTokenInput}
                  onChange={(e) => setVerifyTokenInput(e.target.value)}
                  placeholder="Paste email verification token"
                  className="font-mono text-xs"
                />
                <Button type="submit" size="sm" disabled={verifyingEmail || !verifyTokenInput.trim()}>
                  {verifyingEmail ? 'Verifying...' : 'Verify Email'}
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Profile Details */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your name, language, and contact details for {user.email}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold mb-1.5" htmlFor="prof-name">
                  Full name
                </label>
                <Input
                  id="prof-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" htmlFor="prof-phone">
                  Phone number
                </label>
                <Input
                  id="prof-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Optional phone"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" htmlFor="prof-lang">
                  Preferred language
                </label>
                <select
                  id="prof-lang"
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value as 'en' | 'hi' | 'pa')}
                  className="h-10 w-full rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] px-3 text-sm text-[#20243A] dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]"
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi (हिन्दी)</option>
                  <option value="pa">Punjabi (ਪੰਜਾਬੀ)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" htmlFor="prof-country">
                  Country
                </label>
                <Input
                  id="prof-country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Country"
                />
              </div>

              {user.role === 'doctor' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" htmlFor="prof-spec">
                      Specialty
                    </label>
                    <Input
                      id="prof-spec"
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" htmlFor="prof-aff">
                      Clinic / hospital affiliation
                    </label>
                    <Input
                      id="prof-aff"
                      value={affiliation}
                      onChange={(e) => setAffiliation(e.target.value)}
                    />
                  </div>
                </>
              )}

              {(user.role === 'doctor' || user.role === 'hospital_admin') && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="prof-contact">
                    Contact information
                  </label>
                  <Input
                    id="prof-contact"
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                  />
                </div>
              )}

              {user.role === 'hospital_admin' && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="prof-addr">
                    Hospital address
                  </label>
                  <Input
                    id="prof-addr"
                    value={hospitalAddress}
                    onChange={(e) => setHospitalAddress(e.target.value)}
                  />
                </div>
              )}
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving changes...</span>
                </>
              ) : (
                <span>Save profile changes</span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Patient Doctor Authorizations */}
      {isRealAccountMode && user.role === 'patient' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-[#24A99B] dark:text-[#2DD4BF]" />
              <span>Authorized Doctors</span>
            </CardTitle>
            <CardDescription>
              Doctors can only access your medication history and adherence records after you explicitly authorize them by their registered email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleAuthorizeDoctor} className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                required
                value={docEmailInput}
                onChange={(e) => setDocEmailInput(e.target.value)}
                placeholder="Enter registered doctor email address"
              />
              <Button type="submit" disabled={authSubmitting} className="shrink-0">
                {authSubmitting ? 'Authorizing...' : 'Authorize Doctor'}
              </Button>
            </form>

            {doctorAuthorizations.length === 0 ? (
              <p className="text-xs text-[#5C627D] dark:text-[#A3A9C2]">
                No doctors authorized yet.
              </p>
            ) : (
              <div className="divide-y divide-[#E6E0D8] dark:divide-[#2B314D]">
                {doctorAuthorizations.map((auth) => (
                  <div
                    key={auth.id}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between text-xs"
                  >
                    <div>
                      <p className="font-semibold text-[#20243A] dark:text-[#F7F5F0]">
                        {auth.doctorName}{' '}
                        {auth.doctorSpecialty ? `· ${auth.doctorSpecialty}` : ''}
                      </p>
                      <p className="text-[#5C627D] dark:text-[#A3A9C2]">
                        Status: <span className="capitalize font-medium">{auth.status}</span> · Updated{' '}
                        {formatShortDate(auth.updatedAt.slice(0, 10))}
                      </p>
                    </div>
                    {auth.status === 'authorized' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => respondDoctorAuthorization(auth.id, 'revoked')}
                      >
                        <UserX className="h-3.5 w-3.5" />
                        <span>Revoke access</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => respondDoctorAuthorization(auth.id, 'authorized')}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Re-authorize</span>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
