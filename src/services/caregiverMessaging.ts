import {
  AlertDeliveryState,
  CareAlertType,
  CaregiverAlertPreferences,
  CaregiverConnection,
  CaregiverLanguage,
  CaregiverProfile,
  RelationshipLabel,
} from '@/src/types/medtwin';

export const CAREGIVER_RELATIONSHIP_OPTIONS: RelationshipLabel[] = [
  'Mother',
  'Father',
  'Son',
  'Daughter',
  'Spouse',
  'Other',
];

export const COUNTRY_CODE_OPTIONS = [
  { code: '+1', label: '+1 (US / Canada)' },
  { code: '+91', label: '+91 (India)' },
  { code: '+44', label: '+44 (UK)' },
  { code: '+61', label: '+61 (Australia)' },
  { code: '+971', label: '+971 (UAE)' },
  { code: '+65', label: '+65 (Singapore)' },
];

export const CAREGIVER_LANGUAGE_OPTIONS: Array<{
  id: CaregiverLanguage;
  label: string;
  nativeLabel: string;
}> = [
  { id: 'en', label: 'English', nativeLabel: 'English' },
  { id: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { id: 'pa', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ' },
];

export const ALERT_RULE_DEFINITIONS: Array<{
  key: keyof Pick<
    CaregiverAlertPreferences,
    | 'repeatedMissedDoses'
    | 'supplyRunningLow'
    | 'upcomingRefillDate'
    | 'caregiverInvitation'
    | 'patientRequestedAssistance'
  >;
  alertType: CareAlertType;
  label: string;
  description: string;
}> = [
  {
    key: 'repeatedMissedDoses',
    alertType: 'repeated_missed_doses',
    label: 'Repeated missed doses',
    description: 'Alert caregiver when scheduled doses remain unconfirmed or skipped past threshold.',
  },
  {
    key: 'supplyRunningLow',
    alertType: 'supply_running_low',
    label: 'Medicine supply running low',
    description: 'Alert when active medication units drop within the low-supply window.',
  },
  {
    key: 'upcomingRefillDate',
    alertType: 'upcoming_refill',
    label: 'Upcoming refill date',
    description: 'Remind caregiver ahead of an estimated medication runout or refill date.',
  },
  {
    key: 'caregiverInvitation',
    alertType: 'caregiver_invitation',
    label: 'Caregiver invitation',
    description: 'Share consent-protected Care Circle invitation details for caregiver acceptance.',
  },
  {
    key: 'patientRequestedAssistance',
    alertType: 'patient_assistance',
    label: 'Patient-requested assistance',
    description: 'Notify caregiver immediately when the patient requests help or sends a Dadi-Nani check-in.',
  },
];

export function extractDigitsOnly(phoneInput: string): string {
  return (phoneInput || '').replace(/\D/g, '');
}

export function normalizeCountryCode(rawCode?: string): string {
  const digits = extractDigitsOnly(rawCode || '+1');
  return `+${digits || '1'}`;
}

export function formatFullPhone(countryCode?: string, phoneNumber?: string): string {
  const num = (phoneNumber || '').trim();
  if (!num) return '';
  if (num.startsWith('+')) return num;
  const code = normalizeCountryCode(countryCode);
  return `${code} ${num}`;
}

export function validateCaregiverPhone(
  countryCode: string,
  phoneNumber: string,
): { valid: boolean; error?: string; formatted: string; digits: string } {
  const cleanCode = normalizeCountryCode(countryCode);
  const codeDigits = extractDigitsOnly(cleanCode);
  const numberDigits = extractDigitsOnly(phoneNumber);

  if (!numberDigits) {
    return { valid: false, error: 'Phone number is required.', formatted: '', digits: '' };
  }

  // Allow users pasting full international number or local number without code
  const combinedDigits = phoneNumber.trim().startsWith('+')
    ? numberDigits
    : `${codeDigits}${numberDigits}`;

  if (combinedDigits.length < 8 || combinedDigits.length > 15) {
    return {
      valid: false,
      error: 'Enter a valid phone number with country code (8 to 15 digits total).',
      formatted: '',
      digits: combinedDigits,
    };
  }

  return {
    valid: true,
    formatted: phoneNumber.trim().startsWith('+')
      ? phoneNumber.trim()
      : `${cleanCode} ${phoneNumber.trim()}`,
    digits: combinedDigits,
  };
}

export function resolveContactPhones(
  conn: Pick<
    CaregiverConnection,
    'phoneCountryCode' | 'phoneNumber' | 'whatsappSameAsPhone' | 'whatsappNumber'
  >,
  profile?: CaregiverProfile,
): {
  phoneCountryCode: string;
  phoneNumber: string;
  fullPhone: string;
  whatsappNumber: string;
  fullWhatsapp: string;
  preferredLanguage: CaregiverLanguage;
} {
  const countryCode = normalizeCountryCode(
    conn.phoneCountryCode || profile?.phoneCountryCode || '+1',
  );
  const phoneNum = (conn.phoneNumber || profile?.phoneNumber || '').trim();
  const sameAsPhone =
    typeof conn.whatsappSameAsPhone === 'boolean'
      ? conn.whatsappSameAsPhone
      : typeof profile?.whatsappSameAsPhone === 'boolean'
        ? profile.whatsappSameAsPhone
        : true;
  const waNum = sameAsPhone
    ? phoneNum
    : (conn.whatsappNumber || profile?.whatsappNumber || phoneNum).trim();

  return {
    phoneCountryCode: countryCode,
    phoneNumber: phoneNum,
    fullPhone: formatFullPhone(countryCode, phoneNum),
    whatsappNumber: waNum,
    fullWhatsapp: formatFullPhone(countryCode, waNum),
    preferredLanguage: profile?.preferredLanguage || 'en',
  };
}

export function buildWhatsAppUrl(fullPhone: string, message: string): string {
  const digits = extractDigitsOnly(fullPhone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildSmsUrl(fullPhone: string, message: string): string {
  const digits = extractDigitsOnly(fullPhone);
  return `sms:+${digits}?body=${encodeURIComponent(message)}`;
}

export function getNormalizedAlertPreferences(
  prefs?: Partial<CaregiverAlertPreferences>,
): Required<CaregiverAlertPreferences> {
  return {
    repeatedMissedThreshold: prefs?.repeatedMissedThreshold ?? 2,
    notifyOnRefillNeeded: prefs?.notifyOnRefillNeeded ?? true,
    notifyOnDadiNaniShare: prefs?.notifyOnDadiNaniShare ?? true,
    repeatedMissedDoses: prefs?.repeatedMissedDoses ?? true,
    supplyRunningLow: prefs?.supplyRunningLow ?? (prefs?.notifyOnRefillNeeded ?? true),
    upcomingRefillDate: prefs?.upcomingRefillDate ?? (prefs?.notifyOnRefillNeeded ?? true),
    caregiverInvitation: prefs?.caregiverInvitation ?? true,
    patientRequestedAssistance:
      prefs?.patientRequestedAssistance ?? (prefs?.notifyOnDadiNaniShare ?? true),
  };
}

export function getDeliveryStatusLabel(state: AlertDeliveryState): string {
  switch (state) {
    case 'draft':
      return 'Draft';
    case 'opened_messaging_app':
      return 'Opened Messaging App';
    case 'sent':
      return 'Sent';
    case 'delivered':
      return 'Delivered';
    case 'failed':
      return 'Failed';
    case 'acknowledged':
      return 'Acknowledged';
    case 'queued':
      return 'Queued';
    case 'created':
    default:
      return 'Draft';
  }
}

export function getAlertTypeLabel(type?: CareAlertType | string): string {
  switch (type) {
    case 'repeated_missed_doses':
    case 'missed_dose':
      return 'Repeated missed doses';
    case 'supply_running_low':
      return 'Medicine supply running low';
    case 'upcoming_refill':
    case 'refill_countdown':
      return 'Upcoming refill date';
    case 'caregiver_invitation':
      return 'Caregiver invitation';
    case 'patient_assistance':
    case 'checkin':
      return 'Patient-requested assistance';
    default:
      return 'Medication alert';
  }
}

export function buildCaregiverAlertMessage(params: {
  alertType: CareAlertType;
  caregiverName: string;
  patientName: string;
  language?: CaregiverLanguage;
  consentStatus: 'invited' | 'accepted' | 'revoked';
  medicationName?: string;
  refillDetail?: string;
  customNote?: string;
  simulated?: boolean;
}): {
  message: string;
  redactedForConsent: boolean;
} {
  const cgFirst = (params.caregiverName || 'Caregiver').trim().split(' ')[0];
  const patFirst = (params.patientName || 'your family member').trim().split(' ')[0];
  const lang = params.language || 'en';
  const simPrefix = params.simulated ? '[Simulated Demo Alert] ' : '';

  // Enforce patient privacy: unapproved contacts NEVER receive medication details
  if (params.consentStatus !== 'accepted' && params.alertType !== 'caregiver_invitation') {
    const redactedMsg =
      lang === 'hi'
        ? `${simPrefix}नमस्ते ${cgFirst}, MedTwin AI Pro की ओर से सूचना: ${patFirst} के साथ देखभाल अपडेट प्राप्त करने के लिए कृपया पहले Care Circle निमंत्रण स्वीकार करें। रोगी की सहमति के बिना दवा विवरण साझा नहीं किए जाते हैं।`
        : lang === 'pa'
          ? `${simPrefix}ਸਤ ਸ੍ਰੀ ਅਕਾਲ ${cgFirst}, MedTwin AI Pro ਵੱਲੋਂ ਸੂਚਨਾ: ${patFirst} ਦੇ ਦਵਾਈ ਅਪਡੇਟ ਪ੍ਰਾਪਤ ਕਰਨ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਪਹਿਲਾਂ Care Circle ਸੱਦਾ ਸਵੀਕਾਰ ਕਰੋ। ਮਰੀਜ਼ ਦੀ ਸਹਿਮਤੀ ਤੋਂ ਬਿਨਾਂ ਦਵਾਈ ਦੀ ਜਾਣਕਾਰੀ ਸਾਂਝੀ ਨਹੀਂ ਕੀਤੀ ਜਾਂਦੀ।`
          : `${simPrefix}Hello ${cgFirst}, this is a privacy-protected message from MedTwin AI Pro. ${patFirst} has not yet approved caregiver data sharing for this contact, so medication details cannot be included. Please accept your Care Circle invitation to connect.`;
    return { message: redactedMsg, redactedForConsent: true };
  }

  const medLabel = params.medicationName ? ` (${params.medicationName})` : '';

  if (params.alertType === 'caregiver_invitation') {
    const msg =
      lang === 'hi'
        ? `${simPrefix}नमस्ते ${cgFirst}, ${params.patientName} ने आपको MedTwin AI Pro Care Circle में देखभालकर्ता के रूप में आमंत्रित किया है ताकि आप अनुमोदित दवा शेड्यूल और रिफिल रिमाइंडर में सहायता कर सकें।`
        : lang === 'pa'
          ? `${simPrefix}ਸਤ ਸ੍ਰੀ ਅਕਾਲ ${cgFirst}, ${params.patientName} ਨੇ ਤੁਹਾਨੂੰ MedTwin AI Pro Care Circle ਵਿੱਚ ਕੇਅਰਗਿਵਰ ਵਜੋਂ ਸੱਦਾ ਦਿੱਤਾ ਹੈ ਤਾਂ ਜੋ ਤੁਸੀਂ ਮਨਜ਼ੂਰਸ਼ੁਦਾ ਦਵਾਈ ਸਮਾਂ-ਸਾਰਣੀ ਅਤੇ ਰੀਫਿਲ ਵਿੱਚ ਮਦਦ ਕਰ ਸਕੋ।`
          : `${simPrefix}Hello ${cgFirst}, ${params.patientName} has invited you as a caregiver on MedTwin AI Pro to help support their medication routine and refill reminders. Your access remains governed by their explicit consent scopes.`;
    return { message: msg, redactedForConsent: false };
  }

  if (params.alertType === 'supply_running_low') {
    const detail = params.refillDetail || 'is running low on remaining supply';
    const msg =
      lang === 'hi'
        ? `${simPrefix}नमस्ते ${cgFirst}, यह MedTwin AI Pro की ओर से दवा रिफिल अपडेट है। ${patFirst} की दवा${medLabel} ${detail}। कृपया रिफिल में सहायता करें।`
        : lang === 'pa'
          ? `${simPrefix}ਸਤ ਸ੍ਰੀ ਅਕਾਲ ${cgFirst}, ਇਹ MedTwin AI Pro ਵੱਲੋਂ ਦਵਾਈ ਸਪਲਾਈ ਅਪਡੇਟ ਹੈ। ${patFirst} ਦੀ ਦਵਾਈ${medLabel} ${detail}। ਕਿਰਪਾ ਕਰਕੇ ਰੀਫਿਲ ਵਿੱਚ ਮਦਦ ਕਰੋ।`
          : `${simPrefix}Hello ${cgFirst}, this is a medication update from MedTwin AI Pro. ${patFirst}'s medicine${medLabel} ${detail}. Please help coordinate a refill soon.`;
    return { message: msg, redactedForConsent: false };
  }

  if (params.alertType === 'upcoming_refill') {
    const detail = params.refillDetail || 'has an upcoming refill date approaching';
    const msg =
      lang === 'hi'
        ? `${simPrefix}नमस्ते ${cgFirst}, MedTwin AI Pro रिफिल रिमाइंडर: ${patFirst} की दवा${medLabel} के लिए आगामी रिफिल तिथि नजदीक है (${detail})।`
        : lang === 'pa'
          ? `${simPrefix}ਸਤ ਸ੍ਰੀ ਅਕਾਲ ${cgFirst}, MedTwin AI Pro ਰੀਫਿਲ ਯਾਦ-ਦਹਾਨੀ: ${patFirst} ਦੀ ਦਵਾਈ${medLabel} ਦੀ ਰੀਫਿਲ ਮਿਤੀ ਨੇੜੇ ਆ ਰਹੀ ਹੈ (${detail})।`
          : `${simPrefix}Hello ${cgFirst}, this is a refill reminder from MedTwin AI Pro. ${patFirst}'s medicine${medLabel} ${detail}. Please check in on pharmacy pickup.`;
    return { message: msg, redactedForConsent: false };
  }

  if (params.alertType === 'patient_assistance') {
    const note = params.customNote ? ` Note: ${params.customNote}` : '';
    const msg =
      lang === 'hi'
        ? `${simPrefix}नमस्ते ${cgFirst}, ${patFirst} ने MedTwin AI Pro पर आपसे सहायता का अनुरोध किया है। कृपया उनसे संपर्क करें।${note}`
        : lang === 'pa'
          ? `${simPrefix}ਸਤ ਸ੍ਰੀ ਅਕਾਲ ${cgFirst}, ${patFirst} ਨੇ MedTwin AI Pro ਰਾਹੀਂ ਤੁਹਾਡੇ ਤੋਂ ਮਦਦ ਦੀ ਬੇਨਤੀ ਕੀਤੀ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਉਨ੍ਹਾਂ ਨਾਲ ਗੱਲ ਕਰੋ।${note}`
          : `${simPrefix}Hello ${cgFirst}, this is an update from MedTwin AI Pro. ${patFirst} requested caregiver check-in assistance.${note} Please reach out when you can.`;
    return { message: msg, redactedForConsent: false };
  }

  // Default: repeated_missed_doses
  const msg =
    lang === 'hi'
      ? `${simPrefix}नमस्ते ${cgFirst}, यह MedTwin AI Pro की ओर से दवा अपडेट है। ${patFirst} की निर्धारित दवा${medLabel} अभी तक ली गई चिह्नित नहीं हुई है। कृपया उनसे बात करके जाँच करें।`
      : lang === 'pa'
        ? `${simPrefix}ਸਤ ਸ੍ਰੀ ਅਕਾਲ ${cgFirst}, ਇਹ MedTwin AI Pro ਵੱਲੋਂ ਦਵਾਈ ਅਪਡੇਟ ਹੈ। ${patFirst} ਦੀ ਨਿਰਧਾਰਤ ਦਵਾਈ${medLabel} ਅਜੇ ਤੱਕ ਲਈ ਗਈ ਦਰਜ ਨਹੀਂ ਹੋਈ। ਕਿਰਪਾ ਕਰਕੇ ਉਨ੍ਹਾਂ ਨਾਲ ਗੱਲ ਕਰੋ।`
        : `${simPrefix}Hello ${cgFirst}, this is a medication update from MedTwin AI Pro. ${patFirst} has a scheduled medicine${medLabel} that has not yet been marked as taken. Please check in with them.`;

  return { message: msg, redactedForConsent: false };
}
