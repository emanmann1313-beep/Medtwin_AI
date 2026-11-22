import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  HeartHandshake,
  Loader2,
  Moon,
  ShieldAlert,
  Stethoscope,
  Sun,
  User,
} from 'lucide-react';
import { DEFAULT_ROUTE_FOR_ROLE, useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { MedTwinLogo } from '@/src/components/shared/MedTwinLogo';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { useToast } from '@/src/components/ui/toast';
import { RelationshipLabel, WorkspaceRole } from '@/src/types/medtwin';

type RouteRoleParam = 'patient' | 'doctor' | 'caregiver' | 'hospital';

const RELATIONSHIPS: RelationshipLabel[] = [
  'Child',
  'Spouse / Partner',
  'Parent',
  'Sibling',
  'Guardian',
  'Friend',
  'Other',
];

const ROLE_META: Record<
  RouteRoleParam,
  {
    workspaceRole: WorkspaceRole;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  patient: {
    workspaceRole: 'patient',
    title: 'Patient Registration',
    description: 'Create your personal medication routine, Digital Twin, and Care Circle.',
    icon: User,
  },
  doctor: {
    workspaceRole: 'doctor',
    title: 'Doctor Registration',
    description: 'Register your clinical profile. Accounts start pending verification and only view authorized patients.',
    icon: Stethoscope,
  },
  caregiver: {
    workspaceRole: 'caregiver',
    title: 'Family / Caregiver Registration',
    description: 'Connect with a loved one’s medication plan after explicit patient approval.',
    icon: HeartHandshake,
  },
  hospital: {
    workspaceRole: 'hospital_admin',
    title: 'Hospital / Clinic Registration',
    description: 'Register your organization. Verification is required before full administrative actions.',
    icon: Building2,
  },
};

export function RegisterPage() {
  const { role } = useParams<{ role: string }>();
  const normalizedParam: RouteRoleParam =
    role === 'doctor' || role === 'caregiver' || role === 'hospital' ? role : 'patient';
  const meta = useMemo(() => ROLE_META[normalizedParam], [normalizedParam]);
  const Icon = meta.icon;

  const navigate = useNavigate();
  const { register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pushToast } = useToast();

  // Shared fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Patient fields
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'hi' | 'pa'>('en');
  const [country, setCountry] = useState('United States');
  const [consentAccepted, setConsentAccepted] = useState(false);

  // Doctor fields
  const [licenseNumber, setLicenseNumber] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [contactInfo, setContactInfo] = useState('');

  // Caregiver fields
  const [relationship, setRelationship] = useState<RelationshipLabel>('Child');

  // Hospital fields
  const [hospitalName, setHospitalName] = useState('');
  const [registrationDetails, setRegistrationDetails] = useState('');
  const [address, setAddress] = useState('');
  const [adminName, setAdminName] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    if (
      (normalizedParam === 'patient' || confirmPassword.length > 0) &&
      password !== confirmPassword
    ) {
      setErrorMsg('Password and confirmation password do not match.');
      return;
    }

    if (normalizedParam === 'patient' && !consentAccepted) {
      setErrorMsg('Please accept account creation and data processing consent to continue.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await register({
        role: meta.workspaceRole,
        fullName: normalizedParam === 'hospital' ? adminName.trim() : fullName.trim(),
        email: email.trim(),
        password,
        confirmPassword: confirmPassword || password,
        dateOfBirth: normalizedParam === 'patient' ? dateOfBirth : undefined,
        phone: phone.trim() || undefined,
        preferredLanguage,
        country: country.trim() || undefined,
        consentAccepted: normalizedParam === 'patient' ? consentAccepted : undefined,
        relationship: normalizedParam === 'caregiver' ? relationship : undefined,
        licenseNumber: normalizedParam === 'doctor' ? licenseNumber.trim() : undefined,
        specialty: normalizedParam === 'doctor' ? specialty.trim() : undefined,
        affiliation: normalizedParam === 'doctor' ? affiliation.trim() : undefined,
        jurisdiction: normalizedParam === 'doctor' ? jurisdiction.trim() : undefined,
        contactInfo:
          normalizedParam === 'doctor' || normalizedParam === 'hospital'
            ? contactInfo.trim()
            : undefined,
        hospitalName: normalizedParam === 'hospital' ? hospitalName.trim() : undefined,
        registrationDetails:
          normalizedParam === 'hospital' ? registrationDetails.trim() : undefined,
        address: normalizedParam === 'hospital' ? address.trim() : undefined,
        adminName: normalizedParam === 'hospital' ? adminName.trim() : undefined,
      });

      pushToast({
        title: 'Account created',
        description:
          created.verificationStatus === 'pending_verification'
            ? 'Your account is pending credential verification.'
            : `Welcome to MedTwin AI, ${created.fullName}.`,
        variant: 'success',
      });

      navigate(DEFAULT_ROUTE_FOR_ROLE[created.role], { replace: true });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to complete registration.');
    } finally {
      setSubmitting(false);
    }
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
              to="/login"
              className="text-sm font-semibold text-[#7956C8] hover:underline whitespace-nowrap shrink-0 dark:text-[#A58AE8]"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10 sm:py-14">
        <Link
          to="/get-started"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5C627D] hover:text-[#20243A] dark:text-[#A3A9C2] dark:hover:text-[#F7F5F0]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to role selection</span>
        </Link>

        <div className="mt-5 rounded-2xl border border-[#E6E0D8] bg-[#FFFFFF] p-6 sm:p-8 shadow-xs dark:border-[#2B314D] dark:bg-[#171B2E]">
          <div className="flex items-start gap-4 border-b border-[#E6E0D8] pb-6 dark:border-[#2B314D]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D8C5E8]/35 text-[#7956C8] dark:bg-[#7956C8]/20 dark:text-[#A58AE8]">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-[#20243A] dark:text-[#F7F5F0]">
                {meta.title}
              </h1>
              <p className="mt-1 text-sm text-[#5C627D] dark:text-[#A3A9C2]">{meta.description}</p>
            </div>
          </div>

          {(normalizedParam === 'doctor' || normalizedParam === 'hospital') && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                {normalizedParam === 'doctor'
                  ? 'Entering a license number submits your profile for credential review (status: Pending Verification). Verified clinical privileges and patient records require explicit authorization.'
                  : 'Hospital accounts begin in Pending Verification status with restricted administrative privileges until organizational verification completes.'}
              </span>
            </div>
          )}

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
            {/* PATIENT FORM */}
            {normalizedParam === 'patient' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold mb-1.5" htmlFor="reg-fullname">
                      Full name *
                    </label>
                    <Input
                      id="reg-fullname"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g., Asha Sharma"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold mb-1.5" htmlFor="reg-email">
                      Email address *
                    </label>
                    <Input
                      id="reg-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="asha@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" htmlFor="reg-password">
                      Password * (min 8 chars)
                    </label>
                    <Input
                      id="reg-password"
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a strong password"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" htmlFor="reg-confirm">
                      Confirm password *
                    </label>
                    <Input
                      id="reg-confirm"
                      type="password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" htmlFor="reg-dob">
                      Date of birth *
                    </label>
                    <Input
                      id="reg-dob"
                      type="date"
                      required
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" htmlFor="reg-phone">
                      Phone number (optional)
                    </label>
                    <Input
                      id="reg-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 234-5678"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" htmlFor="reg-lang">
                      Preferred language *
                    </label>
                    <select
                      id="reg-lang"
                      value={preferredLanguage}
                      onChange={(e) =>
                        setPreferredLanguage(e.target.value as 'en' | 'hi' | 'pa')
                      }
                      className="h-10 w-full rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] px-3 text-sm text-[#20243A] focus:outline-none focus:ring-2 focus:ring-[#7956C8] dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]"
                    >
                      <option value="en">English</option>
                      <option value="hi">Hindi (हिन्दी)</option>
                      <option value="pa">Punjabi (ਪੰਜਾਬੀ)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" htmlFor="reg-country">
                      Country *
                    </label>
                    <Input
                      id="reg-country"
                      required
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="e.g., United States, India, Canada"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2.5 rounded-xl border border-[#E6E0D8] bg-[#FAF8F5] p-3.5 text-xs text-[#20243A] cursor-pointer dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]">
                  <input
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#7956C8]"
                    required
                  />
                  <span>
                    I consent to account creation and medication data processing inside MedTwin AI. I can control and revoke doctor and caregiver access at any time.
                  </span>
                </label>
              </>
            )}

            {/* DOCTOR FORM */}
            {normalizedParam === 'doctor' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="doc-name">
                    Full name *
                  </label>
                  <Input
                    id="doc-name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr. Meera Nair, MD"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="doc-email">
                    Professional email *
                  </label>
                  <Input
                    id="doc-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="doctor@clinic.org"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="doc-pass">
                    Password *
                  </label>
                  <Input
                    id="doc-pass"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="doc-confirm">
                    Confirm password *
                  </label>
                  <Input
                    id="doc-confirm"
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="doc-license">
                    Medical registration / license number *
                  </label>
                  <Input
                    id="doc-license"
                    required
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="e.g., MED-REG-88421"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="doc-specialty">
                    Specialty *
                  </label>
                  <Input
                    id="doc-specialty"
                    required
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="e.g., Internal Medicine"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="doc-affiliation">
                    Clinic or hospital affiliation *
                  </label>
                  <Input
                    id="doc-affiliation"
                    required
                    value={affiliation}
                    onChange={(e) => setAffiliation(e.target.value)}
                    placeholder="e.g., Mercy Crest Medical Center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="doc-country">
                    Country *
                  </label>
                  <Input
                    id="doc-country"
                    required
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="United States"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="doc-jurisdiction">
                    Licensing jurisdiction *
                  </label>
                  <Input
                    id="doc-jurisdiction"
                    required
                    value={jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value)}
                    placeholder="e.g., California Medical Board"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="doc-contact">
                    Professional contact information *
                  </label>
                  <Input
                    id="doc-contact"
                    required
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    placeholder="Clinic phone or paging extension"
                  />
                </div>
              </div>
            )}

            {/* CAREGIVER FORM */}
            {normalizedParam === 'caregiver' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="cg-name">
                    Full name *
                  </label>
                  <Input
                    id="cg-name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Rohan Kapoor"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="cg-email">
                    Email address *
                  </label>
                  <Input
                    id="cg-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="rohan@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="cg-pass">
                    Password *
                  </label>
                  <Input
                    id="cg-pass"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="cg-confirm">
                    Confirm password *
                  </label>
                  <Input
                    id="cg-confirm"
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="cg-rel">
                    Relationship to patient *
                  </label>
                  <select
                    id="cg-rel"
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value as RelationshipLabel)}
                    className="h-10 w-full rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] px-3 text-sm text-[#20243A] focus:outline-none focus:ring-2 focus:ring-[#7956C8] dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]"
                  >
                    {RELATIONSHIPS.map((rel) => (
                      <option key={rel} value={rel}>
                        {rel}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="cg-phone">
                    Phone number (optional)
                  </label>
                  <Input
                    id="cg-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 987-6543"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="cg-lang">
                    Preferred language *
                  </label>
                  <select
                    id="cg-lang"
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value as 'en' | 'hi' | 'pa')}
                    className="h-10 w-full rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] px-3 text-sm text-[#20243A] focus:outline-none focus:ring-2 focus:ring-[#7956C8] dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0]"
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi (हिन्दी)</option>
                    <option value="pa">Punjabi (ਪੰਜਾਬੀ)</option>
                  </select>
                </div>
              </div>
            )}

            {/* HOSPITAL FORM */}
            {normalizedParam === 'hospital' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="hosp-name">
                    Hospital or clinic name *
                  </label>
                  <Input
                    id="hosp-name"
                    required
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    placeholder="e.g., Oakridge Community Hospital"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="hosp-email">
                    Official institutional email *
                  </label>
                  <Input
                    id="hosp-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@oakridgeclinic.org"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="hosp-pass">
                    Password *
                  </label>
                  <Input
                    id="hosp-pass"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="hosp-confirm">
                    Confirm password *
                  </label>
                  <Input
                    id="hosp-confirm"
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="hosp-reg">
                    Institutional registration details *
                  </label>
                  <Input
                    id="hosp-reg"
                    required
                    value={registrationDetails}
                    onChange={(e) => setRegistrationDetails(e.target.value)}
                    placeholder="Accreditation ID / Facility Registration Number"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="hosp-address">
                    Physical address *
                  </label>
                  <Input
                    id="hosp-address"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, City, State/Province, Country"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="hosp-admin">
                    Administrator full name *
                  </label>
                  <Input
                    id="hosp-admin"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="e.g., Jordan Alvarez"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" htmlFor="hosp-contact">
                    Contact phone / desk *
                  </label>
                  <Input
                    id="hosp-contact"
                    required
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    placeholder="+1 (555) 400-1200"
                  />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full h-11" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating account...</span>
                </>
              ) : (
                <span>Create account &amp; continue</span>
              )}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-[#5C627D] dark:text-[#A3A9C2]">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-[#7956C8] hover:underline dark:text-[#A58AE8]">
              Sign in here
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
