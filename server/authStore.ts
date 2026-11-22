import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  AppointmentItem,
  CareAlert,
  CareAlertChannel,
  CareAlertType,
  CareHistoryEvent,
  CaregiverAlertPreferences,
  CaregiverConnection,
  CaregiverLanguage,
  CaregiverPermissions,
  CaregiverProfile,
  ClinicianNote,
  DadiNaniEntry,
  DoseLog,
  FamilyMedicalHistoryItem,
  Hospital,
  ManagedUserRecord,
  MedTwinState,
  Medication,
  MedicationStatus,
  MessagingProviderStatus,
  Patient,
  Prescription,
  RelationshipLabel,
  UploadedReport,
  WorkspaceRole,
} from '../src/types/medtwin.ts';
import type {
  AuthUser,
  DirectoryEntry,
  DoctorAuthorizationRecord,
  RegisterPayload,
  VerificationStatus,
} from '../src/types/auth.ts';

interface StoredUser extends AuthUser {
  passwordHash: string;
  passwordSalt: string;
}

interface StoredCaregiverConnection extends CaregiverConnection {
  caregiverUserId?: string;
  caregiverEmail?: string;
  requestedBy?: 'patient' | 'caregiver';
}

interface StoredSession {
  token: string;
  userId: string;
  expiresAt: number;
}

interface StoredToken {
  token: string;
  userId: string;
  expiresAt: number;
}

interface StoreData {
  users: Record<string, StoredUser>;
  sessions: Record<string, StoredSession>;
  resetTokens: Record<string, StoredToken>;
  verifyTokens: Record<string, StoredToken>;
  hospitals: Hospital[];
  patients: (Patient & { ownerUserId?: string })[];
  medications: Medication[];
  doseLogs: DoseLog[];
  prescriptions: Prescription[];
  connections: StoredCaregiverConnection[];
  doctorAuthorizations: DoctorAuthorizationRecord[];
  alerts: CareAlert[];
  history: CareHistoryEvent[];
  clinicianNotes: ClinicianNote[];
  dadiNaniEntries: DadiNaniEntry[];
  familyMedicalHistory: FamilyMedicalHistoryItem[];
  reports: UploadedReport[];
  appointments: AppointmentItem[];
  managedUsers: ManagedUserRecord[];
}

const STORE_FILE = path.resolve(process.cwd(), '.medtwin-store.json');
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hour

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

function addDaysIso(dateStr: string, days: number): string {
  const base = new Date(`${dateStr}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const useSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, useSalt, 64).toString('hex');
  return { hash: derived, salt: useSalt };
}

function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
  const { hash } = hashPassword(password, storedSalt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function sanitizeUser(u: StoredUser): AuthUser {
  const { passwordHash: _ph, passwordSalt: _ps, ...clean } = u;
  return clean;
}

function createInitialStore(): StoreData {
  return {
    users: {},
    sessions: {},
    resetTokens: {},
    verifyTokens: {},
    hospitals: [],
    patients: [],
    medications: [],
    doseLogs: [],
    prescriptions: [],
    connections: [],
    doctorAuthorizations: [],
    alerts: [],
    history: [],
    clinicianNotes: [],
    dadiNaniEntries: [],
    familyMedicalHistory: [],
    reports: [],
    appointments: [],
    managedUsers: [],
  };
}

let store: StoreData = loadStore();

function loadStore(): StoreData {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoreData>;
      return {
        ...createInitialStore(),
        ...parsed,
      };
    }
  } catch {
    // Fall back to fresh store if corrupted
  }
  return createInitialStore();
}

function persistStore(): void {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch {
    // Non-fatal in read-only sandboxes
  }
}

export function isSupabaseConfigured(): boolean {
  const url = (process.env.SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_KEY || '').trim();
  return Boolean(url && key && url.startsWith('http'));
}

async function syncUserToSupabaseIfConfigured(
  email: string,
  password: string,
  user: AuthUser,
): Promise<{ synced: boolean; warning?: string }> {
  if (!isSupabaseConfigured()) {
    return { synced: false };
  }
  const baseUrl = process.env.SUPABASE_URL!.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_KEY!;
  try {
    const authRes = await fetch(`${baseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: false,
        user_metadata: {
          full_name: user.fullName,
          role: user.role,
          verification_status: user.verificationStatus,
        },
      }),
    });
    if (!authRes.ok) {
      return { synced: false, warning: `Supabase user sync returned ${authRes.status}` };
    }
    return { synced: true };
  } catch (err) {
    return {
      synced: false,
      warning: err instanceof Error ? err.message : 'Supabase sync failed',
    };
  }
}

export function getSessionUser(token?: string | null): AuthUser | null {
  if (!token) return null;
  const session = store.sessions[token];
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    delete store.sessions[token];
    persistStore();
    return null;
  }
  const user = store.users[session.userId];
  return user ? sanitizeUser(user) : null;
}

export function createSessionForUser(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  store.sessions[token] = {
    token,
    userId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  persistStore();
  return token;
}

export function destroySession(token?: string | null): void {
  if (!token) return;
  if (store.sessions[token]) {
    delete store.sessions[token];
    persistStore();
  }
}

export async function registerUserAccount(payload: RegisterPayload): Promise<{
  user: AuthUser;
  sessionToken: string;
  emailVerificationToken: string;
  supabaseSynced: boolean;
}> {
  const email = (payload.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error('Please enter a valid email address.'), { status: 400 });
  }
  if (!payload.password || payload.password.length < 8) {
    throw Object.assign(new Error('Password must be at least 8 characters long.'), { status: 400 });
  }
  if (payload.confirmPassword !== undefined && payload.password !== payload.confirmPassword) {
    throw Object.assign(new Error('Passwords do not match.'), { status: 400 });
  }

  const existing = Object.values(store.users).find((u) => u.email.toLowerCase() === email);
  if (existing) {
    throw Object.assign(
      new Error('An account with this email address already exists. Please sign in or reset your password.'),
      { status: 409 },
    );
  }

  const nowIso = new Date().toISOString();
  const todayIso = nowIso.slice(0, 10);
  const userId = makeId('usr');
  const { hash, salt } = hashPassword(payload.password);

  // Server-enforced initial verification status:
  // Doctors and Hospitals ALWAYS start as pending_verification regardless of user-entered registration/license fields.
  let verificationStatus: VerificationStatus = 'verified';
  if (payload.role === 'doctor' || payload.role === 'hospital_admin') {
    verificationStatus = 'pending_verification';
  }

  if (payload.role === 'patient') {
    if (!payload.fullName?.trim() || !payload.dateOfBirth || !payload.country?.trim() || !payload.consentAccepted) {
      throw Object.assign(
        new Error('Full name, date of birth, country, and consent acceptance are required.'),
        { status: 400 },
      );
    }
  } else if (payload.role === 'doctor') {
    if (
      !payload.fullName?.trim() ||
      !payload.licenseNumber?.trim() ||
      !payload.specialty?.trim() ||
      !payload.affiliation?.trim() ||
      !payload.country?.trim() ||
      !payload.jurisdiction?.trim() ||
      !payload.contactInfo?.trim()
    ) {
      throw Object.assign(
        new Error('All doctor credential, affiliation, jurisdiction, and contact fields are required.'),
        { status: 400 },
      );
    }
  } else if (payload.role === 'caregiver') {
    if (!payload.fullName?.trim() || !payload.relationship) {
      throw Object.assign(new Error('Full name and relationship to patient are required.'), {
        status: 400,
      });
    }
  } else if (payload.role === 'hospital_admin') {
    if (
      !payload.hospitalName?.trim() ||
      !payload.registrationDetails?.trim() ||
      !payload.contactInfo?.trim() ||
      !payload.address?.trim() ||
      !payload.adminName?.trim()
    ) {
      throw Object.assign(
        new Error('Hospital name, registration details, contact info, address, and administrator details are required.'),
        { status: 400 },
      );
    }
  } else {
    throw Object.assign(new Error('Unsupported account role.'), { status: 400 });
  }

  let linkedPatientId: string | undefined;
  let hospitalId: string | undefined;

  if (payload.role === 'patient') {
    linkedPatientId = makeId('pat');
    const dob = payload.dateOfBirth!;
    const birthYear = Number(dob.slice(0, 4));
    const age = Number.isFinite(birthYear) && birthYear > 1900
      ? Math.max(1, new Date().getUTCFullYear() - birthYear)
      : 35;

    store.patients.push({
      id: linkedPatientId,
      ownerUserId: userId,
      mrn: `MT-${String(10500 + store.patients.length + 1)}`,
      name: payload.fullName.trim(),
      age,
      gender: 'Not specified',
      hospitalId: 'hosp-unassigned',
      assignedDoctorId: '',
      conditions: [],
      allergies: ['None recorded'],
      lastReviewDate: todayIso,
      dadiNaniPreferred: false,
      preferredLanguageNote: payload.preferredLanguage || 'en',
    });
  }

  if (payload.role === 'hospital_admin') {
    hospitalId = makeId('hosp');
    store.hospitals.push({
      id: hospitalId,
      name: payload.hospitalName!.trim(),
      city: payload.address!.trim(),
      code: `HOSP-${String(100 + store.hospitals.length + 1)}`,
      activeDepartments: ['Internal Medicine', 'Primary Care'],
    });
    store.managedUsers.push({
      id: makeId('mu'),
      name: payload.adminName!.trim(),
      role: 'hospital_admin',
      hospitalId,
      email,
      active: true,
    });
  }

  const storedUser: StoredUser = {
    id: userId,
    email,
    fullName:
      payload.role === 'hospital_admin'
        ? payload.adminName!.trim()
        : payload.fullName.trim(),
    role: payload.role,
    verificationStatus,
    emailVerified: false,
    dateOfBirth: payload.dateOfBirth,
    phone: payload.phone?.trim() || undefined,
    preferredLanguage: payload.preferredLanguage || 'en',
    country: payload.country?.trim() || undefined,
    relationship: payload.relationship,
    licenseNumber: payload.licenseNumber?.trim() || undefined,
    specialty: payload.specialty?.trim() || undefined,
    affiliation: payload.affiliation?.trim() || undefined,
    jurisdiction: payload.jurisdiction?.trim() || undefined,
    contactInfo: payload.contactInfo?.trim() || undefined,
    hospitalName: payload.hospitalName?.trim() || undefined,
    hospitalAddress: payload.address?.trim() || undefined,
    adminName: payload.adminName?.trim() || undefined,
    registrationDetails: payload.registrationDetails?.trim() || undefined,
    hospitalId,
    linkedPatientId,
    createdAt: nowIso,
    updatedAt: nowIso,
    passwordHash: hash,
    passwordSalt: salt,
  };

  store.users[userId] = storedUser;

  const verifyToken = crypto.randomBytes(24).toString('hex');
  store.verifyTokens[verifyToken] = {
    token: verifyToken,
    userId,
    expiresAt: Date.now() + TOKEN_TTL_MS * 24,
  };

  const sessionToken = createSessionForUser(userId);
  persistStore();

  const supa = await syncUserToSupabaseIfConfigured(email, payload.password, sanitizeUser(storedUser));

  return {
    user: sanitizeUser(storedUser),
    sessionToken,
    emailVerificationToken: verifyToken,
    supabaseSynced: supa.synced,
  };
}

export function loginUserAccount(emailInput: string, password: string): {
  user: AuthUser;
  sessionToken: string;
} {
  const email = (emailInput || '').trim().toLowerCase();
  const user = Object.values(store.users).find((u) => u.email.toLowerCase() === email);
  if (!user || !verifyPassword(password || '', user.passwordHash, user.passwordSalt)) {
    throw Object.assign(new Error('Invalid email or password.'), { status: 401 });
  }
  const sessionToken = createSessionForUser(user.id);
  return { user: sanitizeUser(user), sessionToken };
}

export function updateUserProfile(
  userId: string,
  updates: Partial<
    Pick<
      AuthUser,
      | 'fullName'
      | 'phone'
      | 'preferredLanguage'
      | 'country'
      | 'specialty'
      | 'affiliation'
      | 'contactInfo'
      | 'hospitalAddress'
    >
  >,
): AuthUser {
  const user = store.users[userId];
  if (!user) {
    throw Object.assign(new Error('Account not found.'), { status: 404 });
  }

  // Strictly whitelist editable fields; role and verificationStatus can NEVER be self-modified.
  if (typeof updates.fullName === 'string' && updates.fullName.trim()) {
    user.fullName = updates.fullName.trim();
    if (user.linkedPatientId) {
      store.patients = store.patients.map((p) =>
        p.id === user.linkedPatientId ? { ...p, name: user.fullName } : p,
      );
    }
  }
  if (typeof updates.phone === 'string') user.phone = updates.phone.trim() || undefined;
  if (updates.preferredLanguage === 'en' || updates.preferredLanguage === 'hi' || updates.preferredLanguage === 'pa') {
    user.preferredLanguage = updates.preferredLanguage;
  }
  if (typeof updates.country === 'string') user.country = updates.country.trim() || undefined;
  if (typeof updates.specialty === 'string' && user.role === 'doctor') {
    user.specialty = updates.specialty.trim() || user.specialty;
  }
  if (typeof updates.affiliation === 'string' && user.role === 'doctor') {
    user.affiliation = updates.affiliation.trim() || user.affiliation;
  }
  if (typeof updates.contactInfo === 'string') {
    user.contactInfo = updates.contactInfo.trim() || user.contactInfo;
  }
  if (typeof updates.hospitalAddress === 'string' && user.role === 'hospital_admin') {
    user.hospitalAddress = updates.hospitalAddress.trim() || user.hospitalAddress;
  }

  user.updatedAt = new Date().toISOString();
  persistStore();
  return sanitizeUser(user);
}

export async function createPasswordResetRequest(emailInput: string): Promise<{
  ok: boolean;
  emailServiceConfigured: boolean;
  message: string;
  resetToken?: string;
}> {
  const email = (emailInput || '').trim().toLowerCase();
  const user = Object.values(store.users).find((u) => u.email.toLowerCase() === email);

  if (isSupabaseConfigured()) {
    const baseUrl = process.env.SUPABASE_URL!.replace(/\/$/, '');
    const serviceKey = process.env.SUPABASE_SERVICE_KEY!;
    try {
      await fetch(`${baseUrl}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceKey,
        },
        body: JSON.stringify({ email }),
      });
      return {
        ok: true,
        emailServiceConfigured: true,
        message: 'If an account matches that email, password recovery instructions have been sent.',
      };
    } catch {
      return {
        ok: false,
        emailServiceConfigured: false,
        message: 'Configured Supabase recovery endpoint could not be reached.',
      };
    }
  }

  if (!user) {
    return {
      ok: true,
      emailServiceConfigured: false,
      message:
        'Outbound email delivery (Supabase Auth / SMTP) is not configured in this environment. No recovery email was sent.',
    };
  }

  const token = crypto.randomBytes(24).toString('hex');
  store.resetTokens[token] = {
    token,
    userId: user.id,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
  persistStore();

  return {
    ok: true,
    emailServiceConfigured: false,
    message:
      'Outbound email delivery (Supabase Auth / SMTP) is not configured in this environment, so no email was dispatched. Use the generated recovery token below to test password reset.',
    resetToken: token,
  };
}

export function resetPasswordWithToken(token: string, newPassword: string): void {
  if (!token || !newPassword || newPassword.length < 8) {
    throw Object.assign(new Error('Valid reset token and a password of at least 8 characters are required.'), {
      status: 400,
    });
  }
  const record = store.resetTokens[token];
  if (!record || Date.now() > record.expiresAt) {
    throw Object.assign(new Error('Reset token is invalid or has expired.'), { status: 400 });
  }
  const user = store.users[record.userId];
  if (!user) {
    throw Object.assign(new Error('Account not found.'), { status: 404 });
  }
  const { hash, salt } = hashPassword(newPassword);
  user.passwordHash = hash;
  user.passwordSalt = salt;
  user.updatedAt = new Date().toISOString();
  delete store.resetTokens[token];
  persistStore();
}

export function verifyEmailWithToken(token: string): AuthUser {
  const record = store.verifyTokens[token];
  if (!record || Date.now() > record.expiresAt) {
    throw Object.assign(new Error('Verification token is invalid or expired.'), { status: 400 });
  }
  const user = store.users[record.userId];
  if (!user) {
    throw Object.assign(new Error('Account not found.'), { status: 404 });
  }
  user.emailVerified = true;
  user.updatedAt = new Date().toISOString();
  delete store.verifyTokens[token];
  persistStore();
  return sanitizeUser(user);
}

// ---------------------------------------------------------------------------
// Server-Enforced Authorization & Scoped Workspace State
// ---------------------------------------------------------------------------

function getAuthorizedPatientIdsForUser(user: AuthUser): Set<string> {
  const allowed = new Set<string>();
  if (user.role === 'patient') {
    if (user.linkedPatientId) allowed.add(user.linkedPatientId);
    return allowed;
  }
  if (user.role === 'caregiver') {
    for (const c of store.connections) {
      const matchesCaregiver =
        c.caregiverUserId === user.id ||
        (c.caregiverEmail && c.caregiverEmail.toLowerCase() === user.email.toLowerCase());
      if (matchesCaregiver && c.status === 'accepted') {
        allowed.add(c.patientId);
      }
    }
    return allowed;
  }
  if (user.role === 'doctor') {
    // Only patients who explicitly authorized this doctor
    for (const auth of store.doctorAuthorizations) {
      if (auth.doctorUserId === user.id && auth.status === 'authorized') {
        allowed.add(auth.patientId);
      }
    }
    return allowed;
  }
  if (user.role === 'hospital_admin') {
    for (const p of store.patients) {
      if (user.hospitalId && p.hospitalId === user.hospitalId) {
        allowed.add(p.id);
      }
    }
    return allowed;
  }
  return allowed;
}

export function assertCanAccessPatient(user: AuthUser, patientId: string): void {
  const allowed = getAuthorizedPatientIdsForUser(user);
  if (!allowed.has(patientId)) {
    throw Object.assign(new Error('Access denied: you are not authorized for this patient record.'), {
      status: 403,
    });
  }
}

export function getScopedWorkspaceForUser(user: AuthUser): {
  workspace: MedTwinState;
  doctorAuthorizations: DoctorAuthorizationRecord[];
  directory: DirectoryEntry[];
} {
  const allowedPatientIds = getAuthorizedPatientIdsForUser(user);
  const authorizedPatients = store.patients.filter((p) => allowedPatientIds.has(p.id));

  const userHospital =
    store.hospitals.find((h) => h.id === user.hospitalId) ?? {
      id: user.hospitalId || 'hosp-medtwin',
      name: user.hospitalName || 'MedTwin Connected Care Network',
      city: user.hospitalAddress || user.country || 'Connected Care',
      code: 'MT-NET',
      activeDepartments: ['Primary Care', 'Internal Medicine'],
    };

  const directory: DirectoryEntry[] = Object.values(store.users)
    .filter((u) => u.role === 'doctor' || u.role === 'caregiver' || u.role === 'hospital_admin')
    .map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      role: u.role,
      verificationStatus: u.verificationStatus,
      specialty: u.specialty,
      affiliation: u.affiliation,
      hospitalName: u.hospitalName,
    }));

  const doctorsList = Object.values(store.users)
    .filter((u) => u.role === 'doctor')
    .map((d) => ({
      id: d.id,
      name: d.fullName,
      specialty: d.specialty || 'General Medicine',
      licenseNumber: d.licenseNumber || 'Pending',
      hospitalId: d.hospitalId || userHospital.id,
      email: d.email,
    }));

  const caregiversMap = new Map<string, CaregiverProfile>();
  for (const u of Object.values(store.users)) {
    if (u.role === 'caregiver') {
      caregiversMap.set(u.id, {
        id: u.id,
        name: u.fullName,
        email: u.email,
        phoneLabel: u.phone || 'Connected Caregiver Account',
      });
    }
  }
  if (user.role === 'caregiver' && !caregiversMap.has(user.id)) {
    caregiversMap.set(user.id, {
      id: user.id,
      name: user.fullName,
      email: user.email,
      phoneLabel: user.phone || 'Connected Caregiver Account',
    });
  }

  // Connections visible to user
  const visibleConnections = store.connections.filter((c) => {
    if (user.role === 'patient') return c.patientId === user.linkedPatientId;
    if (user.role === 'caregiver') {
      return (
        c.caregiverUserId === user.id ||
        (c.caregiverEmail && c.caregiverEmail.toLowerCase() === user.email.toLowerCase())
      );
    }
    // Doctors & hospital admins only see accepted (patient-consented) caregiver contacts
    return allowedPatientIds.has(c.patientId) && c.status === 'accepted';
  });

  // Include contact details for visible caregiver connections so UI cards show phone/WhatsApp/language
  for (const conn of visibleConnections) {
    if (!caregiversMap.has(conn.caregiverId)) {
      const fullPhone =
        conn.phoneNumber
          ? `${conn.phoneCountryCode || '+1'} ${conn.phoneNumber}`.trim()
          : conn.caregiverEmail || 'Contact on file';
      caregiversMap.set(conn.caregiverId, {
        id: conn.caregiverId,
        name: conn.caregiverName,
        email: conn.caregiverEmail || '',
        phoneLabel: fullPhone,
        phoneCountryCode: conn.phoneCountryCode,
        phoneNumber: conn.phoneNumber,
        whatsappSameAsPhone: conn.whatsappSameAsPhone,
        whatsappNumber: conn.whatsappNumber,
        preferredLanguage: conn.preferredLanguage,
      });
    }
  }

  // Scope medications, doseLogs, prescriptions, notes, alerts, history by role & consent
  const scopedMedications = store.medications.filter((m) => {
    if (!allowedPatientIds.has(m.patientId)) return false;
    if (user.role === 'caregiver') {
      const conn = visibleConnections.find(
        (c) => c.patientId === m.patientId && c.status === 'accepted',
      );
      return Boolean(conn?.permissions.viewSchedules);
    }
    return true;
  });

  const scopedDoseLogs = store.doseLogs.filter((dl) => {
    if (!allowedPatientIds.has(dl.patientId)) return false;
    if (user.role === 'caregiver') {
      const conn = visibleConnections.find(
        (c) => c.patientId === dl.patientId && c.status === 'accepted',
      );
      return Boolean(conn?.permissions.viewSchedules);
    }
    return true;
  });

  const scopedPrescriptions = store.prescriptions.filter((rx) => {
    if (!allowedPatientIds.has(rx.patientId)) return false;
    if (user.role === 'caregiver') {
      const conn = visibleConnections.find(
        (c) => c.patientId === rx.patientId && c.status === 'accepted',
      );
      return Boolean(conn?.permissions.viewHistoryAndReports);
    }
    return true;
  });

  const scopedHistory = store.history.filter((h) => {
    if (!allowedPatientIds.has(h.patientId)) return false;
    if (user.role === 'caregiver') {
      const conn = visibleConnections.find(
        (c) => c.patientId === h.patientId && c.status === 'accepted',
      );
      if (!conn?.permissions.viewHistoryAndReports) return false;
      if (h.restrictedToClinician && !conn.permissions.viewClinicianNotes) return false;
    }
    if (user.role === 'hospital_admin' && h.restrictedToClinician) return false;
    return true;
  });

  const scopedNotes = store.clinicianNotes.filter((n) => {
    if (!allowedPatientIds.has(n.patientId)) return false;
    if (user.role === 'caregiver') {
      const conn = visibleConnections.find(
        (c) => c.patientId === n.patientId && c.status === 'accepted',
      );
      return Boolean(conn?.permissions.viewClinicianNotes);
    }
    if (user.role === 'doctor' && user.verificationStatus !== 'verified') {
      return false;
    }
    if (user.role === 'hospital_admin') return false;
    return true;
  });

  const scopedAlerts = store.alerts.filter((a) => {
    if (!allowedPatientIds.has(a.patientId)) return false;
    if (user.role === 'caregiver') {
      const conn = visibleConnections.find(
        (c) => c.patientId === a.patientId && c.status === 'accepted',
      );
      if (!conn) return false;
      if (a.alertType !== 'caregiver_invitation' && !conn.permissions.receiveDoseAlerts) {
        return false;
      }
      return !a.caregiverId || a.caregiverId === conn.caregiverId || a.caregiverId === user.id;
    }
    return true;
  });

  const scopedDadiNani = store.dadiNaniEntries.filter((d) => {
    if (!allowedPatientIds.has(d.patientId)) return false;
    if (user.role === 'doctor') return d.sharedWithDoctor;
    if (user.role === 'caregiver') return d.sharedWithCareCircle;
    return true;
  });

  const scopedAuths = store.doctorAuthorizations.filter((a) => {
    if (user.role === 'patient') return a.patientId === user.linkedPatientId;
    if (user.role === 'doctor') return a.doctorUserId === user.id;
    return allowedPatientIds.has(a.patientId);
  });

  const scopedManagedUsers = store.managedUsers.filter(
    (mu) => !user.hospitalId || mu.hospitalId === user.hospitalId,
  );

  const activePatientId =
    user.role === 'patient'
      ? user.linkedPatientId || ''
      : authorizedPatients[0]?.id || '';

  return {
    workspace: {
      hospital: userHospital,
      doctors: doctorsList,
      patients: authorizedPatients,
      caregivers: Array.from(caregiversMap.values()),
      connections: visibleConnections,
      familyMedicalHistory: store.familyMedicalHistory.filter((f) =>
        allowedPatientIds.has(f.patientId),
      ),
      medications: scopedMedications,
      doseLogs: scopedDoseLogs,
      prescriptions: scopedPrescriptions,
      alerts: scopedAlerts,
      history: scopedHistory,
      clinicianNotes: scopedNotes,
      reports: store.reports.filter((r) => allowedPatientIds.has(r.patientId)),
      appointments: store.appointments.filter((a) => allowedPatientIds.has(a.patientId)),
      dadiNaniEntries: scopedDadiNani,
      managedUsers: scopedManagedUsers,
      activePatientId,
      activeCaregiverId: user.role === 'caregiver' ? user.id : '',
      activeDoctorId: user.role === 'doctor' ? user.id : doctorsList[0]?.id || '',
    },
    doctorAuthorizations: scopedAuths,
    directory,
  };
}

// ---------------------------------------------------------------------------
// Server-Side Mutations (Authorized)
// ---------------------------------------------------------------------------

export function mutateLogDose(
  user: AuthUser,
  input: {
    patientId: string;
    medicationId: string;
    scheduledDate: string;
    scheduledTime: string;
    status: 'taken' | 'skipped';
    skipReason?: string;
  },
): void {
  assertCanAccessPatient(user, input.patientId);
  const existing = store.doseLogs.find(
    (l) =>
      l.patientId === input.patientId &&
      l.medicationId === input.medicationId &&
      l.scheduledDate === input.scheduledDate &&
      l.scheduledTime === input.scheduledTime,
  );
  if (existing) return;

  const med = store.medications.find((m) => m.id === input.medicationId && m.patientId === input.patientId);
  if (!med) {
    throw Object.assign(new Error('Medication not found for this patient.'), { status: 404 });
  }

  const nowIso = new Date().toISOString();
  const logId = makeId('dl');
  store.doseLogs.push({
    id: logId,
    patientId: input.patientId,
    medicationId: input.medicationId,
    scheduledDate: input.scheduledDate,
    scheduledTime: input.scheduledTime,
    status: input.status,
    skipReason: input.skipReason?.trim() || undefined,
    recordedAt: nowIso,
    recordedBy: user.fullName,
  });

  if (input.status === 'taken' && typeof med.remainingQuantity === 'number') {
    med.remainingQuantity = Math.max(0, med.remainingQuantity - 1);
    med.updatedAt = nowIso;
  }

  store.history.unshift({
    id: makeId('hist'),
    patientId: input.patientId,
    category: 'dose',
    title: `${med.name} ${med.strength} marked ${input.status}`,
    details:
      input.status === 'taken'
        ? `Confirmed for ${input.scheduledDate} at ${input.scheduledTime}.`
        : `Skipped for ${input.scheduledDate} at ${input.scheduledTime}${input.skipReason ? ` · Reason: ${input.skipReason}` : ''}.`,
    actorName: user.fullName,
    actorRole: user.role,
    timestamp: nowIso,
    sourceId: logId,
  });

  persistStore();
}

export function mutateUndoDose(user: AuthUser, logId: string): void {
  const idx = store.doseLogs.findIndex((l) => l.id === logId);
  if (idx === -1) return;
  const target = store.doseLogs[idx];
  assertCanAccessPatient(user, target.patientId);

  const med = store.medications.find((m) => m.id === target.medicationId);
  const nowIso = new Date().toISOString();
  store.doseLogs.splice(idx, 1);

  if (med && target.status === 'taken' && typeof med.remainingQuantity === 'number') {
    med.remainingQuantity += 1;
    med.updatedAt = nowIso;
  }

  store.history.unshift({
    id: makeId('hist'),
    patientId: target.patientId,
    category: 'medication_change',
    title: `Undid dose entry for ${med?.name ?? 'Medication'}`,
    details: `Reverted ${target.status} entry for ${target.scheduledDate} at ${target.scheduledTime}.`,
    actorName: user.fullName,
    actorRole: user.role,
    timestamp: nowIso,
  });

  persistStore();
}

export function mutateConfirmPrescription(
  user: AuthUser,
  input: {
    patientId: string;
    prescription: Omit<Prescription, 'id' | 'createdAt' | 'status' | 'confirmedAt'>;
  },
): void {
  assertCanAccessPatient(user, input.patientId);
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.slice(0, 10);
  const rxId = makeId('rx');

  const newRx: Prescription = {
    ...input.prescription,
    patientId: input.patientId,
    id: rxId,
    status: 'confirmed',
    createdAt: nowIso,
    confirmedAt: nowIso,
  };
  store.prescriptions.unshift(newRx);

  const newMeds: Medication[] = input.prescription.items.map((item, idx) => {
    const duration = item.durationDays && item.durationDays > 0 ? item.durationDays : 30;
    const times =
      item.scheduledTimes && item.scheduledTimes.length > 0 ? item.scheduledTimes : ['08:00'];
    return {
      id: makeId(`med-${idx}`),
      patientId: input.patientId,
      prescriptionId: rxId,
      name: item.medicineName,
      strength: item.strength || 'Unspecified',
      doseAndRoute: item.doseAndRoute || '1 tablet oral',
      instructions: item.instructions || 'Take as prescribed.',
      scheduledTimes: times,
      startDate: todayStr,
      endDate: addDaysIso(todayStr, duration),
      remainingQuantity: item.quantity,
      unitLabel: 'units',
      refillThresholdDays: 7,
      status: 'active',
      prescriberName: input.prescription.prescriberName || 'Prescriber on file',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  });

  store.medications.unshift(...newMeds);
  store.history.unshift({
    id: makeId('hist'),
    patientId: input.patientId,
    category: 'prescription',
    title: `Confirmed prescription (${input.prescription.fileName})`,
    details: `Activated ${newMeds.length} medication schedule(s): ${newMeds
      .map((m) => `${m.name} ${m.strength}`)
      .join(', ')}.`,
    actorName: user.fullName,
    actorRole: user.role,
    timestamp: nowIso,
    sourceId: rxId,
  });

  persistStore();
}

export function mutateMedicationStatus(
  user: AuthUser,
  medicationId: string,
  status: MedicationStatus,
): void {
  const med = store.medications.find((m) => m.id === medicationId);
  if (!med) throw Object.assign(new Error('Medication not found.'), { status: 404 });
  assertCanAccessPatient(user, med.patientId);
  const nowIso = new Date().toISOString();
  const prev = med.status;
  med.status = status;
  med.updatedAt = nowIso;
  store.history.unshift({
    id: makeId('hist'),
    patientId: med.patientId,
    category: 'medication_change',
    title: `${med.name} ${med.strength} marked ${status}`,
    details: `Medication status updated from ${prev} to ${status}.`,
    actorName: user.fullName,
    actorRole: user.role,
    timestamp: nowIso,
    sourceId: medicationId,
  });
  persistStore();
}

export function mutateReplenishMedication(
  user: AuthUser,
  medicationId: string,
  addUnits: number,
): void {
  const med = store.medications.find((m) => m.id === medicationId);
  if (!med) throw Object.assign(new Error('Medication not found.'), { status: 404 });
  assertCanAccessPatient(user, med.patientId);
  if (addUnits <= 0) return;

  const nowIso = new Date().toISOString();
  med.remainingQuantity = (med.remainingQuantity ?? 0) + addUnits;
  med.updatedAt = nowIso;

  store.history.unshift({
    id: makeId('hist'),
    patientId: med.patientId,
    category: 'refill',
    title: `Refill logged for ${med.name} ${med.strength}`,
    details: `Added +${addUnits} ${med.unitLabel} to remaining supply.`,
    actorName: user.fullName,
    actorRole: user.role,
    timestamp: nowIso,
    sourceId: medicationId,
  });
  persistStore();
}

export function mutateAddDadiNaniEntry(
  user: AuthUser,
  input: Omit<DadiNaniEntry, 'id' | 'createdAt' | 'authorName'>,
): void {
  assertCanAccessPatient(user, input.patientId);
  const nowIso = new Date().toISOString();
  const entryId = makeId('dn');
  store.dadiNaniEntries.unshift({
    ...input,
    id: entryId,
    authorName: user.fullName,
    createdAt: nowIso,
  });
  store.history.unshift({
    id: makeId('hist'),
    patientId: input.patientId,
    category: 'dadi_nani_share',
    title: `Dadi-Nani Share: ${input.entryType.replace('_', ' ')}`,
    details: `${input.feelingSummary}${input.homeComfortNote ? ` · Comfort routine: ${input.homeComfortNote}` : ''}`,
    actorName: user.fullName,
    actorRole: user.role,
    timestamp: nowIso,
    sourceId: entryId,
  });
  persistStore();
}

export function mutateAddClinicianNote(
  user: AuthUser,
  input: { patientId: string; title: string; content: string },
): void {
  if (user.role !== 'doctor') {
    throw Object.assign(new Error('Only doctors can create clinician notes.'), { status: 403 });
  }
  if (user.verificationStatus !== 'verified') {
    throw Object.assign(
      new Error('Doctor account verification is pending. Verified status is required to sign clinical notes.'),
      { status: 403 },
    );
  }
  assertCanAccessPatient(user, input.patientId);

  const nowIso = new Date().toISOString();
  const noteId = makeId('note');
  store.clinicianNotes.unshift({
    id: noteId,
    patientId: input.patientId,
    doctorId: user.id,
    doctorName: user.fullName,
    title: input.title,
    content: input.content,
    createdAt: nowIso,
    auditTrail: [
      {
        action: 'Note signed and published',
        actor: user.fullName,
        timestamp: nowIso,
      },
    ],
  });

  store.patients = store.patients.map((p) =>
    p.id === input.patientId ? { ...p, lastReviewDate: nowIso.slice(0, 10) } : p,
  );
  store.history.unshift({
    id: makeId('hist'),
    patientId: input.patientId,
    category: 'clinician_note',
    title: `Clinician note: ${input.title}`,
    details: input.content.slice(0, 140),
    actorName: user.fullName,
    actorRole: 'doctor',
    timestamp: nowIso,
    restrictedToClinician: true,
    sourceId: noteId,
  });
  persistStore();
}

function normalizeDigits(val?: string): string {
  return (val || '').replace(/\D/g, '');
}

export function mutateInviteOrRequestCaregiver(
  user: AuthUser,
  input: {
    patientEmailOrMrn?: string;
    patientId?: string;
    caregiverName?: string;
    caregiverEmail?: string;
    phoneCountryCode?: string;
    phoneNumber?: string;
    whatsappSameAsPhone?: boolean;
    whatsappNumber?: string;
    preferredLanguage?: CaregiverLanguage;
    relationship: RelationshipLabel;
    contactPriority?: 'primary' | 'secondary';
    permissions?: CaregiverPermissions;
    alertPreferences?: Partial<CaregiverAlertPreferences>;
  },
): void {
  const nowIso = new Date().toISOString();

  if (user.role === 'patient') {
    const patientId = user.linkedPatientId!;
    const targetEmail = (input.caregiverEmail || '').trim().toLowerCase();
    const rawPhone = (input.phoneNumber || '').trim();
    const countryCode = (input.phoneCountryCode || '+1').trim();
    const phoneDigits = normalizeDigits(rawPhone);

    if (!input.caregiverName?.trim()) {
      throw Object.assign(new Error('Caregiver full name is required.'), { status: 400 });
    }
    if (!phoneDigits && !targetEmail) {
      throw Object.assign(new Error('Provide a phone number or email address for the caregiver.'), { status: 400 });
    }
    if (phoneDigits && (normalizeDigits(countryCode + rawPhone).length < 8 || normalizeDigits(countryCode + rawPhone).length > 15)) {
      throw Object.assign(new Error('Enter a valid phone number with country code (8 to 15 digits).'), { status: 400 });
    }

    const sameAsPhone = input.whatsappSameAsPhone !== false;
    const whatsappNum = sameAsPhone ? rawPhone : (input.whatsappNumber || rawPhone).trim();

    const matchedCg = targetEmail
      ? Object.values(store.users).find(
          (u) => u.email.toLowerCase() === targetEmail && u.role === 'caregiver',
        )
      : undefined;

    const caregiverId = matchedCg?.id || makeId('cg');
    const prefLang: CaregiverLanguage =
      input.preferredLanguage === 'hi' || input.preferredLanguage === 'pa' ? input.preferredLanguage : 'en';

    const mergedPrefs: CaregiverAlertPreferences = {
      repeatedMissedThreshold: input.alertPreferences?.repeatedMissedThreshold ?? 2,
      notifyOnRefillNeeded: input.alertPreferences?.notifyOnRefillNeeded ?? true,
      notifyOnDadiNaniShare: input.alertPreferences?.notifyOnDadiNaniShare ?? true,
      repeatedMissedDoses: input.alertPreferences?.repeatedMissedDoses ?? true,
      supplyRunningLow: input.alertPreferences?.supplyRunningLow ?? true,
      upcomingRefillDate: input.alertPreferences?.upcomingRefillDate ?? true,
      caregiverInvitation: input.alertPreferences?.caregiverInvitation ?? true,
      patientRequestedAssistance: input.alertPreferences?.patientRequestedAssistance ?? true,
    };

    store.connections.unshift({
      id: makeId('conn'),
      patientId,
      caregiverId,
      caregiverUserId: matchedCg?.id,
      caregiverEmail: targetEmail || undefined,
      caregiverName: input.caregiverName.trim(),
      phoneCountryCode: countryCode,
      phoneNumber: rawPhone || undefined,
      whatsappSameAsPhone: sameAsPhone,
      whatsappNumber: whatsappNum || undefined,
      preferredLanguage: prefLang,
      relationship: input.relationship || 'Other',
      contactPriority: input.contactPriority || 'secondary',
      status: 'invited',
      requestedBy: 'patient',
      permissions: input.permissions ?? {
        viewSchedules: true,
        receiveDoseAlerts: true,
        viewHistoryAndReports: false,
        viewClinicianNotes: false,
      },
      alertPreferences: mergedPrefs,
      invitedAt: nowIso.slice(0, 10),
    });

    store.history.unshift({
      id: makeId('hist'),
      patientId,
      category: 'caregiver_alert',
      title: `Caregiver contact added: ${input.caregiverName.trim()}`,
      details: `Invitation prepared for ${input.relationship} (${countryCode} ${rawPhone || targetEmail}). Pending caregiver acceptance.`,
      actorName: user.fullName,
      actorRole: user.role,
      timestamp: nowIso,
    });

    persistStore();
    return;
  }

  if (user.role === 'caregiver') {
    const query = (input.patientEmailOrMrn || '').trim().toLowerCase();
    if (!query) {
      throw Object.assign(new Error('Patient email or MRN is required to send a connection request.'), {
        status: 400,
      });
    }
    const patientUser = Object.values(store.users).find(
      (u) => u.role === 'patient' && u.email.toLowerCase() === query,
    );
    const pat =
      store.patients.find((p) => p.mrn.toLowerCase() === query) ??
      (patientUser?.linkedPatientId
        ? store.patients.find((p) => p.id === patientUser.linkedPatientId)
        : undefined);

    if (!pat) {
      throw Object.assign(
        new Error('No registered patient found matching that email or MRN.'),
        { status: 404 },
      );
    }

    const dup = store.connections.find(
      (c) =>
        c.patientId === pat.id &&
        (c.caregiverUserId === user.id || c.caregiverEmail === user.email) &&
        c.status !== 'revoked',
    );
    if (dup) {
      throw Object.assign(new Error('A connection or pending request already exists for this patient.'), {
        status: 409,
      });
    }

    store.connections.unshift({
      id: makeId('conn'),
      patientId: pat.id,
      caregiverId: user.id,
      caregiverUserId: user.id,
      caregiverEmail: user.email,
      caregiverName: user.fullName,
      relationship: input.relationship || user.relationship || 'Other',
      contactPriority: 'secondary',
      status: 'invited',
      requestedBy: 'caregiver',
      // Zero access granted until the patient explicitly approves
      permissions: {
        viewSchedules: false,
        receiveDoseAlerts: false,
        viewHistoryAndReports: false,
        viewClinicianNotes: false,
      },
      alertPreferences: {
        repeatedMissedThreshold: 2,
        notifyOnRefillNeeded: true,
        notifyOnDadiNaniShare: true,
      },
      invitedAt: nowIso.slice(0, 10),
    });
    persistStore();
    return;
  }

  throw Object.assign(new Error('Only patients or caregivers can manage Care Circle requests.'), {
    status: 403,
  });
}

export function mutateRespondCaregiverConnection(
  user: AuthUser,
  connectionId: string,
  decision: 'accepted' | 'revoked',
): void {
  const conn = store.connections.find((c) => c.id === connectionId);
  if (!conn) throw Object.assign(new Error('Connection not found.'), { status: 404 });

  const isPatientOwner = user.role === 'patient' && user.linkedPatientId === conn.patientId;
  const isCaregiverRecipient =
    user.role === 'caregiver' &&
    (conn.caregiverUserId === user.id || conn.caregiverEmail === user.email);

  if (!isPatientOwner && !isCaregiverRecipient) {
    throw Object.assign(new Error('Not authorized to respond to this connection.'), { status: 403 });
  }

  // Caregiver cannot self-approve a request they initiated — only the patient can approve sharing health info!
  if (decision === 'accepted' && conn.requestedBy === 'caregiver' && !isPatientOwner) {
    throw Object.assign(
      new Error('Patient approval is required before health information can be shared.'),
      { status: 403 },
    );
  }

  conn.status = decision;
  conn.respondedAt = new Date().toISOString().slice(0, 10);
  if (decision === 'accepted' && conn.requestedBy === 'caregiver') {
    conn.permissions = {
      viewSchedules: true,
      receiveDoseAlerts: true,
      viewHistoryAndReports: true,
      viewClinicianNotes: false,
    };
  }
  if (decision === 'revoked') {
    conn.permissions = {
      viewSchedules: false,
      receiveDoseAlerts: false,
      viewHistoryAndReports: false,
      viewClinicianNotes: false,
    };
  }
  persistStore();
}

export function mutateUpdateCaregiverPermissions(
  user: AuthUser,
  connectionId: string,
  permissions: CaregiverPermissions,
  alertPreferences?: CaregiverConnection['alertPreferences'],
): void {
  const conn = store.connections.find((c) => c.id === connectionId);
  if (!conn) throw Object.assign(new Error('Connection not found.'), { status: 404 });

  if (user.role === 'patient' && user.linkedPatientId === conn.patientId) {
    conn.permissions = permissions;
    if (alertPreferences) conn.alertPreferences = alertPreferences;
    persistStore();
    return;
  }

  // Caregiver may only adjust their own notification alertPreferences, never escalate their own permissions
  if (
    user.role === 'caregiver' &&
    (conn.caregiverUserId === user.id || conn.caregiverEmail === user.email) &&
    alertPreferences
  ) {
    conn.alertPreferences = alertPreferences;
    persistStore();
    return;
  }

  throw Object.assign(new Error('Not authorized to modify these permissions.'), { status: 403 });
}

export function mutateDoctorAuthorization(
  user: AuthUser,
  input: {
    doctorEmail?: string;
    authorizationId?: string;
    decision?: 'authorized' | 'revoked';
  },
): void {
  const nowIso = new Date().toISOString();

  if (user.role === 'patient' && input.doctorEmail) {
    const docEmail = input.doctorEmail.trim().toLowerCase();
    const doc = Object.values(store.users).find(
      (u) => u.role === 'doctor' && u.email.toLowerCase() === docEmail,
    );
    if (!doc) {
      throw Object.assign(new Error('No registered doctor found with that email.'), { status: 404 });
    }
    const patientId = user.linkedPatientId!;
    const pat = store.patients.find((p) => p.id === patientId);
    const existing = store.doctorAuthorizations.find(
      (a) => a.patientId === patientId && a.doctorUserId === doc.id,
    );
    if (existing) {
      existing.status = 'authorized';
      existing.updatedAt = nowIso;
    } else {
      store.doctorAuthorizations.unshift({
        id: makeId('pda'),
        patientId,
        patientName: pat?.name || user.fullName,
        doctorUserId: doc.id,
        doctorName: doc.fullName,
        doctorSpecialty: doc.specialty,
        status: 'authorized',
        updatedAt: nowIso,
      });
    }
    persistStore();
    return;
  }

  if (user.role === 'patient' && input.authorizationId && input.decision) {
    const auth = store.doctorAuthorizations.find((a) => a.id === input.authorizationId);
    if (!auth || auth.patientId !== user.linkedPatientId) {
      throw Object.assign(new Error('Authorization record not found.'), { status: 404 });
    }
    auth.status = input.decision;
    auth.updatedAt = nowIso;
    persistStore();
    return;
  }

  throw Object.assign(new Error('Only patients can grant or revoke doctor access.'), { status: 403 });
}

export function mutateEnrollHospitalPatient(
  user: AuthUser,
  input: {
    name: string;
    age: number;
    gender: string;
    bloodGroup?: string;
    assignedDoctorId: string;
    conditions: string[];
  },
): void {
  if (user.role !== 'hospital_admin' || !user.hospitalId) {
    throw Object.assign(new Error('Hospital administrator role required.'), { status: 403 });
  }
  if (user.verificationStatus !== 'verified') {
    throw Object.assign(
      new Error('Hospital verification is pending. Verified status is required before enrolling patients.'),
      { status: 403 },
    );
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  store.patients.unshift({
    id: makeId('pat'),
    mrn: `MT-${String(10500 + store.patients.length + 1)}`,
    name: input.name,
    age: input.age,
    gender: input.gender,
    bloodGroup: input.bloodGroup?.trim() || undefined,
    hospitalId: user.hospitalId,
    assignedDoctorId: input.assignedDoctorId,
    conditions: input.conditions,
    allergies: ['None recorded'],
    nextFollowUpDate: addDaysIso(todayStr, 14),
    lastReviewDate: todayStr,
  });
  persistStore();
}

export function mutateUpdateCaregiverContact(
  user: AuthUser,
  input: {
    connectionId: string;
    caregiverName?: string;
    caregiverEmail?: string;
    phoneCountryCode?: string;
    phoneNumber?: string;
    whatsappSameAsPhone?: boolean;
    whatsappNumber?: string;
    preferredLanguage?: CaregiverLanguage;
    relationship?: RelationshipLabel;
    contactPriority?: 'primary' | 'secondary';
    permissions?: CaregiverPermissions;
    alertPreferences?: Partial<CaregiverAlertPreferences>;
  },
): void {
  const conn = store.connections.find((c) => c.id === input.connectionId);
  if (!conn) {
    throw Object.assign(new Error('Caregiver contact not found.'), { status: 404 });
  }
  if (user.role !== 'patient' || user.linkedPatientId !== conn.patientId) {
    throw Object.assign(new Error('Only the patient can edit caregiver contact details.'), {
      status: 403,
    });
  }

  if (typeof input.caregiverName === 'string' && input.caregiverName.trim()) {
    conn.caregiverName = input.caregiverName.trim();
  }
  if (typeof input.caregiverEmail === 'string') {
    conn.caregiverEmail = input.caregiverEmail.trim().toLowerCase() || undefined;
  }
  if (typeof input.phoneCountryCode === 'string') {
    conn.phoneCountryCode = input.phoneCountryCode.trim() || '+1';
  }
  if (typeof input.phoneNumber === 'string') {
    const rawPhone = input.phoneNumber.trim();
    const digits = normalizeDigits((conn.phoneCountryCode || '+1') + rawPhone);
    if (rawPhone && (digits.length < 8 || digits.length > 15)) {
      throw Object.assign(new Error('Enter a valid phone number with country code (8 to 15 digits).'), {
        status: 400,
      });
    }
    conn.phoneNumber = rawPhone || undefined;
  }
  if (typeof input.whatsappSameAsPhone === 'boolean') {
    conn.whatsappSameAsPhone = input.whatsappSameAsPhone;
  }
  if (conn.whatsappSameAsPhone) {
    conn.whatsappNumber = conn.phoneNumber;
  } else if (typeof input.whatsappNumber === 'string') {
    conn.whatsappNumber = input.whatsappNumber.trim() || conn.phoneNumber;
  }
  if (
    input.preferredLanguage === 'en' ||
    input.preferredLanguage === 'hi' ||
    input.preferredLanguage === 'pa'
  ) {
    conn.preferredLanguage = input.preferredLanguage;
  }
  if (input.relationship) conn.relationship = input.relationship;
  if (input.contactPriority) conn.contactPriority = input.contactPriority;
  if (input.permissions) conn.permissions = input.permissions;
  if (input.alertPreferences) {
    conn.alertPreferences = {
      ...conn.alertPreferences,
      ...input.alertPreferences,
    };
  }

  persistStore();
}

export function mutateRemoveCaregiverContact(user: AuthUser, connectionId: string): void {
  const idx = store.connections.findIndex((c) => c.id === connectionId);
  if (idx === -1) {
    throw Object.assign(new Error('Caregiver contact not found.'), { status: 404 });
  }
  const conn = store.connections[idx];
  if (user.role !== 'patient' || user.linkedPatientId !== conn.patientId) {
    throw Object.assign(new Error('Only the patient can remove caregiver contacts.'), {
      status: 403,
    });
  }
  store.connections.splice(idx, 1);
  store.history.unshift({
    id: makeId('hist'),
    patientId: conn.patientId,
    category: 'caregiver_alert',
    title: `Caregiver contact removed: ${conn.caregiverName}`,
    details: `Removed ${conn.relationship} contact and revoked Care Circle data sharing.`,
    actorName: user.fullName,
    actorRole: user.role,
    timestamp: new Date().toISOString(),
  });
  persistStore();
}

export function getMessagingProviderStatus(): MessagingProviderStatus {
  const whatsappConfigured = Boolean(
    (process.env.WHATSAPP_ACCESS_TOKEN || '').trim() &&
      (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim(),
  );
  const smsConfigured = Boolean(
    (process.env.TWILIO_ACCOUNT_SID || '').trim() &&
      (process.env.TWILIO_AUTH_TOKEN || '').trim() &&
      (process.env.TWILIO_FROM_NUMBER || '').trim(),
  );

  return {
    whatsappProviderConfigured: whatsappConfigured,
    smsProviderConfigured: smsConfigured,
    whatsappProviderLabel: whatsappConfigured
      ? 'WhatsApp Business Cloud API configured'
      : 'Not configured (manual WhatsApp launch ready)',
    smsProviderLabel: smsConfigured
      ? 'Twilio Programmable SMS configured'
      : 'Not configured (manual SMS app launch ready)',
  };
}

export async function mutateDispatchCaregiverAlert(
  user: AuthUser,
  input: {
    patientId: string;
    connectionId?: string;
    caregiverId?: string;
    caregiverName?: string;
    alertType: CareAlertType;
    channel: CareAlertChannel;
    recipientPhone?: string;
    title: string;
    reason: string;
    messageBody: string;
    severity?: 'attention' | 'urgent';
    deliveryMode: 'draft' | 'opened_messaging_app' | 'automated';
  },
): Promise<{
  alert: CareAlert;
  providerConfirmed: boolean;
  providerConfigured: boolean;
  error?: string;
}> {
  assertCanAccessPatient(user, input.patientId);

  const conn =
    (input.connectionId ? store.connections.find((c) => c.id === input.connectionId) : undefined) ??
    (input.caregiverId
      ? store.connections.find(
          (c) => c.patientId === input.patientId && c.caregiverId === input.caregiverId,
        )
      : undefined);

  if (conn && conn.patientId !== input.patientId) {
    throw Object.assign(new Error('Caregiver connection does not match patient.'), { status: 403 });
  }

  // Enforce consent boundary strictly on backend: unapproved contacts NEVER receive sensitive medication details
  if (
    conn &&
    conn.status !== 'accepted' &&
    input.alertType !== 'caregiver_invitation'
  ) {
    throw Object.assign(
      new Error(
        'Consent required: caregiver invitation must be accepted by patient consent before sharing medication alerts.',
      ),
      { status: 403 },
    );
  }

  if (
    conn &&
    conn.status === 'accepted' &&
    !conn.permissions.receiveDoseAlerts &&
    input.alertType !== 'caregiver_invitation' &&
    input.alertType !== 'patient_assistance'
  ) {
    throw Object.assign(
      new Error('Receive dose alerts consent scope is disabled for this caregiver.'),
      { status: 403 },
    );
  }

  const nowIso = new Date().toISOString();
  const recipientName = conn?.caregiverName || input.caregiverName || 'Caregiver';
  const resolvedPhone =
    input.recipientPhone ||
    (conn?.phoneNumber ? `${conn.phoneCountryCode || '+1'} ${conn.phoneNumber}` : undefined);

  const channelTitle =
    input.channel === 'whatsapp'
      ? `WhatsApp to ${recipientName}`
      : input.channel === 'sms'
        ? `SMS to ${recipientName}`
        : `In-App Alert for ${recipientName}`;

  if (input.deliveryMode === 'draft' || input.deliveryMode === 'opened_messaging_app') {
    const alert: CareAlert = {
      id: makeId('alert'),
      patientId: input.patientId,
      caregiverId: conn?.caregiverId || input.caregiverId,
      caregiverName: recipientName,
      alertType: input.alertType,
      channel: input.channel,
      recipientPhone: resolvedPhone,
      messageBody: input.messageBody,
      providerConfirmed: false,
      title: input.title,
      reason: input.reason,
      severity: input.severity ?? 'attention',
      deliveryState: input.deliveryMode,
      simulated: false,
      channelLabel:
        input.deliveryMode === 'opened_messaging_app'
          ? `${channelTitle} (Opened Messaging App)`
          : `${channelTitle} (Draft)`,
      createdAt: nowIso,
    };
    store.alerts.unshift(alert);
    store.history.unshift({
      id: makeId('hist'),
      patientId: input.patientId,
      category: 'caregiver_alert',
      title:
        input.deliveryMode === 'opened_messaging_app'
          ? `Prepared & opened ${input.channel.toUpperCase()} message to ${recipientName}`
          : `Saved draft ${input.channel.toUpperCase()} alert for ${recipientName}`,
      details: input.title,
      actorName: user.fullName,
      actorRole: user.role,
      timestamp: nowIso,
      sourceId: alert.id,
    });
    persistStore();
    return {
      alert,
      providerConfirmed: false,
      providerConfigured: false,
    };
  }

  // Automated provider dispatch — NEVER claim 'sent' or 'delivered' unless provider confirms it
  const providerStatus = getMessagingProviderStatus();
  const toDigits = normalizeDigits(resolvedPhone);

  if (input.channel === 'whatsapp') {
    if (!providerStatus.whatsappProviderConfigured) {
      return {
        alert: {
          id: 'unavailable',
          patientId: input.patientId,
          title: input.title,
          reason: input.reason,
          severity: input.severity ?? 'attention',
          deliveryState: 'failed',
          simulated: false,
          channelLabel: channelTitle,
          createdAt: nowIso,
          providerConfirmed: false,
          providerError: 'WhatsApp Business Cloud API credentials are not configured on the server.',
        },
        providerConfirmed: false,
        providerConfigured: false,
        error:
          'Automated WhatsApp delivery is unavailable because WhatsApp Business API credentials are not configured. Use manual "Send WhatsApp Message" instead.',
      };
    }

    try {
      const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
      const token = process.env.WHATSAPP_ACCESS_TOKEN!;
      const waRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: toDigits,
          type: 'text',
          text: { body: input.messageBody },
        }),
      });
      const waData = (await waRes.json().catch(() => ({}))) as {
        messages?: Array<{ id?: string }>;
        error?: { message?: string };
      };
      const confirmed = waRes.ok && Boolean(waData.messages?.[0]?.id);
      const alert: CareAlert = {
        id: makeId('alert'),
        patientId: input.patientId,
        caregiverId: conn?.caregiverId || input.caregiverId,
        caregiverName: recipientName,
        alertType: input.alertType,
        channel: 'whatsapp',
        recipientPhone: resolvedPhone,
        messageBody: input.messageBody,
        providerConfirmed: confirmed,
        providerMessageId: waData.messages?.[0]?.id,
        providerError: confirmed ? undefined : waData.error?.message || `HTTP ${waRes.status}`,
        title: input.title,
        reason: input.reason,
        severity: input.severity ?? 'attention',
        deliveryState: confirmed ? 'sent' : 'failed',
        simulated: false,
        channelLabel: channelTitle,
        createdAt: nowIso,
      };
      store.alerts.unshift(alert);
      persistStore();
      return {
        alert,
        providerConfirmed: confirmed,
        providerConfigured: true,
        error: alert.providerError,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'WhatsApp API call failed.';
      const alert: CareAlert = {
        id: makeId('alert'),
        patientId: input.patientId,
        caregiverId: conn?.caregiverId || input.caregiverId,
        caregiverName: recipientName,
        alertType: input.alertType,
        channel: 'whatsapp',
        recipientPhone: resolvedPhone,
        messageBody: input.messageBody,
        providerConfirmed: false,
        providerError: msg,
        title: input.title,
        reason: input.reason,
        severity: input.severity ?? 'attention',
        deliveryState: 'failed',
        simulated: false,
        channelLabel: channelTitle,
        createdAt: nowIso,
      };
      store.alerts.unshift(alert);
      persistStore();
      return { alert, providerConfirmed: false, providerConfigured: true, error: msg };
    }
  }

  if (input.channel === 'sms') {
    if (!providerStatus.smsProviderConfigured) {
      return {
        alert: {
          id: 'unavailable',
          patientId: input.patientId,
          title: input.title,
          reason: input.reason,
          severity: input.severity ?? 'attention',
          deliveryState: 'failed',
          simulated: false,
          channelLabel: channelTitle,
          createdAt: nowIso,
          providerConfirmed: false,
          providerError: 'Twilio SMS credentials are not configured on the server.',
        },
        providerConfirmed: false,
        providerConfigured: false,
        error:
          'Automated SMS delivery is unavailable because SMS provider credentials are not configured. Use manual "Send SMS" instead.',
      };
    }

    try {
      const sid = process.env.TWILIO_ACCOUNT_SID!;
      const auth = process.env.TWILIO_AUTH_TOKEN!;
      const fromNum = process.env.TWILIO_FROM_NUMBER!;
      const formBody = new URLSearchParams({
        To: `+${toDigits}`,
        From: fromNum,
        Body: input.messageBody,
      });
      const twRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody.toString(),
      });
      const twData = (await twRes.json().catch(() => ({}))) as {
        sid?: string;
        message?: string;
      };
      const confirmed = twRes.ok && Boolean(twData.sid);
      const alert: CareAlert = {
        id: makeId('alert'),
        patientId: input.patientId,
        caregiverId: conn?.caregiverId || input.caregiverId,
        caregiverName: recipientName,
        alertType: input.alertType,
        channel: 'sms',
        recipientPhone: resolvedPhone,
        messageBody: input.messageBody,
        providerConfirmed: confirmed,
        providerMessageId: twData.sid,
        providerError: confirmed ? undefined : twData.message || `HTTP ${twRes.status}`,
        title: input.title,
        reason: input.reason,
        severity: input.severity ?? 'attention',
        deliveryState: confirmed ? 'sent' : 'failed',
        simulated: false,
        channelLabel: channelTitle,
        createdAt: nowIso,
      };
      store.alerts.unshift(alert);
      persistStore();
      return {
        alert,
        providerConfirmed: confirmed,
        providerConfigured: true,
        error: alert.providerError,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'SMS provider API call failed.';
      const alert: CareAlert = {
        id: makeId('alert'),
        patientId: input.patientId,
        caregiverId: conn?.caregiverId || input.caregiverId,
        caregiverName: recipientName,
        alertType: input.alertType,
        channel: 'sms',
        recipientPhone: resolvedPhone,
        messageBody: input.messageBody,
        providerConfirmed: false,
        providerError: msg,
        title: input.title,
        reason: input.reason,
        severity: input.severity ?? 'attention',
        deliveryState: 'failed',
        simulated: false,
        channelLabel: channelTitle,
        createdAt: nowIso,
      };
      store.alerts.unshift(alert);
      persistStore();
      return { alert, providerConfirmed: false, providerConfigured: true, error: msg };
    }
  }

  // In-app alert
  const inAppAlert: CareAlert = {
    id: makeId('alert'),
    patientId: input.patientId,
    caregiverId: conn?.caregiverId || input.caregiverId,
    caregiverName: recipientName,
    alertType: input.alertType,
    channel: 'in_app',
    recipientPhone: resolvedPhone,
    messageBody: input.messageBody,
    providerConfirmed: true,
    title: input.title,
    reason: input.reason,
    severity: input.severity ?? 'attention',
    deliveryState: 'delivered',
    simulated: false,
    channelLabel: `In-App Care Circle notification for ${recipientName}`,
    createdAt: nowIso,
  };
  store.alerts.unshift(inAppAlert);
  persistStore();
  return { alert: inAppAlert, providerConfirmed: true, providerConfigured: true };
}

