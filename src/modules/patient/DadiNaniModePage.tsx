import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  HeartHandshake,
  Loader2,
  Mic,
  MicOff,
  RefreshCw,
  Send,
  Square,
  Volume2,
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { useMedTwin } from '@/src/context/MedTwinContext';
import {
  buildDoseSlotsForDate,
  computeAdherenceMetrics,
  getTodayIso,
} from '@/src/services/adherenceEngine';
import { sendAiChatMessage } from '@/src/services/aiService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input, Textarea } from '@/src/components/ui/input';
import { cn, formatTime12h, formatTimestamp } from '@/src/lib/utils';
import { DadiNaniEntry } from '@/src/types/medtwin';

type VoiceState = 'idle' | 'listening' | 'understanding' | 'speaking' | 'error';

const VOICE_STATE_LABEL: Record<VoiceState, string> = {
  idle: 'Tap to Speak',
  listening: 'Listening...',
  understanding: 'Understanding...',
  speaking: 'Speaking...',
  error: 'Try Again',
};

const QUICK_QUESTIONS = [
  'What medicine should I take now?',
  'When is my next dose?',
  'Did I miss any medicines?',
  'How many tablets are left?',
  'Read my medicine instructions.',
  'Contact my caregiver.',
];

const QUICK_PROBLEMS = [
  'Mild stomach discomfort',
  'Feeling dizzy',
  'Knee or joint stiffness',
  'Evening tiredness',
  'Dry cough',
  'Trouble sleeping',
];

const LANG_OPTIONS = [
  { id: 'en' as const, label: 'English', speechLang: 'en-US' },
  { id: 'hi' as const, label: 'हिन्दी (Hindi)', speechLang: 'hi-IN' },
  { id: 'pa' as const, label: 'ਪੰਜਾਬੀ (Punjabi)', speechLang: 'pa-IN' },
];

export function DadiNaniModePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    state,
    hasPatients,
    activePatient,
    dadiNaniMode,
    setDadiNaniMode,
    dadiNaniLanguage,
    setDadiNaniLanguage,
    addDadiNaniEntry,
  } = useMedTwin();

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [recognizedText, setRecognizedText] = useState('');
  const [textFallback, setTextFallback] = useState('');
  const [assistantReply, setAssistantReply] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<{ stop?: () => void } | null>(null);

  // Sharing journal states (preserved)
  const [entryType, setEntryType] = useState<DadiNaniEntry['entryType']>('problem');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [feelingSummary, setFeelingSummary] = useState('');
  const [homeComfortNote, setHomeComfortNote] = useState('');
  const [shareWithCareCircle, setShareWithCareCircle] = useState(true);
  const [shareWithDoctor, setShareWithDoctor] = useState(true);

  const todayStr = getTodayIso();

  const activeMeds = useMemo(
    () =>
      hasPatients
        ? state.medications.filter(
            (m) => m.patientId === activePatient.id && m.status === 'active',
          )
        : [],
    [activePatient.id, hasPatients, state.medications],
  );

  const todaySlots = useMemo(
    () =>
      hasPatients
        ? buildDoseSlotsForDate(activePatient.id, todayStr, state.medications, state.doseLogs)
        : [],
    [activePatient.id, hasPatients, state.doseLogs, state.medications, todayStr],
  );

  const metrics7 = useMemo(
    () =>
      hasPatients
        ? computeAdherenceMetrics(activePatient.id, 7, state.medications, state.doseLogs)
        : { adherencePct: null, unconfirmedCount: 0 },
    [activePatient.id, hasPatients, state.doseLogs, state.medications],
  );

  const entries = useMemo(
    () =>
      hasPatients
        ? state.dadiNaniEntries.filter((e) => e.patientId === activePatient.id)
        : [],
    [activePatient.id, hasPatients, state.dadiNaniEntries],
  );

  const currentLangMeta =
    LANG_OPTIONS.find((l) => l.id === dadiNaniLanguage) ?? LANG_OPTIONS[0];

  const speakOutLoud = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setVoiceState('idle');
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = currentLangMeta.speechLang;
    u.rate = 0.88;
    setVoiceState('speaking');
    u.onend = () => setVoiceState('idle');
    u.onerror = () => setVoiceState('idle');
    window.speechSynthesis.speak(u);
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setVoiceState('idle');
  };

  const askElderQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed) return;

    setRecognizedText(trimmed);
    setVoiceError(null);
    setVoiceState('understanding');

    try {
      const patientContext = {
        patientName: hasPatients ? activePatient.name : user?.fullName || 'Patient',
        today: todayStr,
        medications: activeMeds.map((m) => ({
          name: m.name,
          strength: m.strength,
          instructions: m.instructions,
          scheduledTimes: m.scheduledTimes.map(formatTime12h),
          remainingQuantity: m.remainingQuantity,
          unitLabel: m.unitLabel,
        })),
        todaySchedule: todaySlots.map((s) => ({
          medicine: `${s.medication.name} ${s.medication.strength}`,
          time: formatTime12h(s.scheduledTime),
          status: s.state,
        })),
        missedOrUnconfirmed7d: metrics7.unconfirmedCount,
        caregivers: state.connections
          .filter((c) => c.patientId === activePatient.id && c.status === 'accepted')
          .map((c) => `${c.caregiverName} (${c.relationship})`),
      };

      const res = await sendAiChatMessage({
        message: trimmed,
        history: [],
        patientContext,
        dadiNaniMode: true,
        role: 'patient',
        language: dadiNaniLanguage,
      });

      setAssistantReply(res);
      speakOutLoud(res);
    } catch (err) {
      setVoiceState('error');
      setVoiceError(
        err instanceof Error
          ? err.message
          : 'Could not get an answer right now. Please tap Try Again.',
      );
    }
  };

  const handleMicButtonClick = () => {
    if (voiceState === 'listening') {
      recognitionRef.current?.stop?.();
      setVoiceState('idle');
      return;
    }
    if (voiceState === 'speaking') {
      stopSpeaking();
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
    };

    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceState('error');
      setVoiceError(
        'Voice microphone recognition is not supported in this browser. Please tap a quick question or type your question below.',
      );
      return;
    }

    setVoiceError(null);
    setVoiceState('listening');
    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.lang = currentLangMeta.speechLang;
    rec.interimResults = false;

    let gotResult = false;
    rec.onresult = (ev) => {
      gotResult = true;
      const spoken = ev.results[0]?.[0]?.transcript ?? '';
      if (spoken.trim()) {
        void askElderQuestion(spoken);
      } else {
        setVoiceState('error');
        setVoiceError('Did not hear words clearly. Please tap Try Again or type below.');
      }
    };
    rec.onerror = () => {
      setVoiceState('error');
      setVoiceError('Microphone access denied or unavailable. Please check permissions or type below.');
    };
    rec.onend = () => {
      if (!gotResult) {
        setVoiceState((prev) => (prev === 'listening' ? 'idle' : prev));
      }
    };
    rec.start();
  };

  const toggleSymptom = (sym: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym],
    );
  };

  const handleJournalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!feelingSummary.trim() && selectedSymptoms.length === 0) || !activePatient.id) return;

    addDadiNaniEntry({
      patientId: activePatient.id,
      entryType,
      feelingSummary:
        feelingSummary.trim() || `Shared symptoms: ${selectedSymptoms.join(', ')}`,
      symptoms: selectedSymptoms,
      homeComfortNote: homeComfortNote.trim() || undefined,
      sharedWithCareCircle: shareWithCareCircle,
      sharedWithDoctor: shareWithDoctor,
    });

    setFeelingSummary('');
    setHomeComfortNote('');
    setSelectedSymptoms([]);
  };

  return (
    <div className="space-y-6">
      {/* Elder Voice-First Hero */}
      <Card className="overflow-hidden border-[#8B5CF6]/35 bg-linear-to-b from-[#1A2740] to-[#101B30] shadow-[0_0_24px_rgba(139,92,246,0.16)]">
        <CardContent className="pt-8 pb-8 px-6 text-center space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl border border-[#334155] bg-[#0B1220] p-1">
              {LANG_OPTIONS.map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setDadiNaniLanguage(lang.id)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                    dadiNaniLanguage === lang.id
                      ? 'bg-[#8B5CF6] text-white'
                      : 'text-[#A8B8CC] hover:text-[#F8FAFC]',
                  )}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            <Button
              type="button"
              variant={dadiNaniMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDadiNaniMode(!dadiNaniMode)}
            >
              <HeartHandshake className="h-4 w-4" />
              <span>{dadiNaniMode ? 'Large-Print: On' : 'Enable Large-Print'}</span>
            </Button>
          </div>

          <div className="mx-auto max-w-2xl space-y-2">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#F8FAFC]">
              Namaste! How can I help you today? ❤️
            </h2>
            <p className="text-base sm:text-lg text-[#A8B8CC]">
              Just tap the microphone and speak. I’m here to help.
            </p>
          </div>

          {/* Central Voice Button + Animated Sound Waves */}
          <div className="flex flex-col items-center justify-center gap-4 py-2">
            <button
              type="button"
              onClick={handleMicButtonClick}
              aria-label={VOICE_STATE_LABEL[voiceState]}
              className={cn(
                'relative flex h-28 w-28 items-center justify-center rounded-full text-white shadow-xl transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8B5CF6]/40 cursor-pointer',
                voiceState === 'listening'
                  ? 'bg-linear-to-br from-[#8B5CF6] to-[#2DD4BF] ring-8 ring-[#8B5CF6]/25'
                  : voiceState === 'error'
                    ? 'bg-[#FBBF24] text-[#0B1220]'
                    : 'bg-linear-to-br from-[#8B5CF6] to-[#2DD4BF] shadow-[0_0_28px_rgba(45,212,191,0.28)]',
              )}
            >
              {voiceState === 'understanding' ? (
                <Loader2 className="h-11 w-11 animate-spin" />
              ) : voiceState === 'listening' ? (
                <MicOff className="h-11 w-11" />
              ) : voiceState === 'speaking' ? (
                <Square className="h-9 w-9" />
              ) : (
                <Mic className="h-11 w-11" />
              )}
            </button>

            {/* Animated Sound Waves */}
            <div className="flex h-7 items-center gap-1.5" aria-hidden="true">
              {[0, 120, 240, 160, 80].map((delay, i) => (
                <span
                  key={i}
                  style={{ animationDelay: `${delay}ms` }}
                  className={cn(
                    'w-1.5 rounded-full transition-all',
                    voiceState === 'listening' || voiceState === 'speaking'
                      ? 'h-6 bg-[#2DD4BF] animate-voice-wave'
                      : 'h-2 bg-[#334155]',
                  )}
                />
              ))}
            </div>

            <p className="font-display text-lg font-bold text-[#2DD4BF]">
              {VOICE_STATE_LABEL[voiceState]}
            </p>
          </div>

          {voiceError && (
            <div className="mx-auto max-w-xl flex items-center justify-center gap-2 rounded-xl border border-[#FBBF24]/35 bg-[#FBBF24]/10 p-3 text-xs text-[#FBBF24]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{voiceError}</span>
            </div>
          )}

          {/* Voice Response Box */}
          {(recognizedText || assistantReply) && (
            <div className="mx-auto max-w-2xl rounded-2xl border border-[#334155] bg-[#223451] p-5 text-left space-y-3 shadow-sm">
              {recognizedText && (
                <p className="text-sm text-[#A8B8CC]">
                  <strong>You asked:</strong> “{recognizedText}”
                </p>
              )}
              {assistantReply && (
                <>
                  <p className="text-base sm:text-lg leading-relaxed font-medium text-[#F8FAFC] whitespace-pre-wrap">
                    {assistantReply}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => speakOutLoud(assistantReply)}
                    >
                      <Volume2 className="h-4 w-4" />
                      <span>Replay Voice</span>
                    </Button>
                    {voiceState === 'speaking' && (
                      <Button type="button" size="sm" variant="outline" onClick={stopSpeaking}>
                        <Square className="h-3.5 w-3.5" />
                        <span>Stop</span>
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        stopSpeaking();
                        handleMicButtonClick();
                      }}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Ask Another Question</span>
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Text-Input Fallback */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = textFallback.trim();
              if (!q) return;
              setTextFallback('');
              void askElderQuestion(q);
            }}
            className="mx-auto max-w-xl flex flex-col gap-2 sm:flex-row"
          >
            <Input
              value={textFallback}
              onChange={(e) => setTextFallback(e.target.value)}
              placeholder="Or type your question here..."
              className="h-12 text-base"
            />
            <Button type="submit" size="lg" disabled={!textFallback.trim() || voiceState === 'understanding'}>
              <Send className="h-4 w-4" />
              <span>Ask</span>
            </Button>
          </form>

          {/* 6 Quick Question Buttons */}
          <div className="mx-auto max-w-3xl pt-2">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#A8B8CC]">
              Quick Voice Questions — Tap Any Button
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    if (q === 'Contact my caregiver.') {
                      navigate('/caregivers');
                      return;
                    }
                    void askElderQuestion(q);
                  }}
                  className="rounded-2xl border border-[#334155] bg-[#223451] px-4 py-3 text-left text-sm font-semibold text-[#F8FAFC] hover:border-[#8B5CF6] hover:text-[#2DD4BF] transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Large Plain-Language Medicine Cards + Share How You Feel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your medicines in simple words</CardTitle>
            <CardDescription>
              Tap “Read aloud” to hear clear timing and instructions
              {hasPatients ? ` for ${activePatient.name}` : ''}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeMeds.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#334155] p-6 text-center text-sm text-[#A8B8CC]">
                No saved prescriptions yet. Scan a prescription to see your medicine cards here.
              </div>
            ) : (
              activeMeds.map((med) => {
                const spoken = `${med.name} ${med.strength}. ${med.doseAndRoute}. ${med.instructions}. ${
                  med.scheduledTimes.length > 0
                    ? `Take at ${med.scheduledTimes.map(formatTime12h).join(' and ')}.`
                    : 'Take only as needed.'
                }`;
                return (
                  <div
                    key={med.id}
                    className="flex flex-col gap-3 rounded-2xl border border-[#334155] bg-[#223451] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-[#F8FAFC]">
                        {med.name} · {med.strength}
                      </p>
                      <p className="text-sm text-[#A8B8CC]">{med.instructions}</p>
                      <p className="text-xs font-mono text-[#2DD4BF] tabular-nums">
                        {med.scheduledTimes.length > 0
                          ? med.scheduledTimes.map(formatTime12h).join(' · ')
                          : 'As needed (PRN)'}
                        {typeof med.remainingQuantity === 'number'
                          ? ` · ${med.remainingQuantity} ${med.unitLabel} left`
                          : ''}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => speakOutLoud(spoken)}
                      className="shrink-0"
                    >
                      <Volume2 className="h-4 w-4" />
                      <span>Read aloud</span>
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Preserved Dadi-Nani Feeling & Home Comfort Sharing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Share how you feel with family &amp; doctor</CardTitle>
            <CardDescription>
              Tap common discomforts or write a quick note for your Care Circle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJournalSubmit} className="space-y-4">
              <div className="inline-flex rounded-xl border border-[#334155] bg-[#101B30] p-1">
                {(
                  [
                    { id: 'problem', label: 'Health Problem' },
                    { id: 'home_comfort', label: 'Home Comfort' },
                    { id: 'medicine_question', label: 'Medicine Question' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setEntryType(t.id)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                      entryType === t.id
                        ? 'bg-[#8B5CF6] text-white'
                        : 'text-[#A8B8CC] hover:text-[#F8FAFC]',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {QUICK_PROBLEMS.map((sym) => {
                  const active = selectedSymptoms.includes(sym);
                  return (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => toggleSymptom(sym)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors cursor-pointer',
                        active
                          ? 'border-[#8B5CF6] bg-[#8B5CF6]/20 text-[#F8FAFC]'
                          : 'border-[#334155] bg-[#223451] text-[#A8B8CC] hover:text-[#F8FAFC]',
                      )}
                    >
                      {active && <Check className="h-3.5 w-3.5 text-[#2DD4BF]" />}
                      <span>{sym}</span>
                    </button>
                  );
                })}
              </div>

              <Textarea
                value={feelingSummary}
                onChange={(e) => setFeelingSummary(e.target.value)}
                placeholder="Describe how you feel or ask a question about a medicine..."
              />

              <Input
                value={homeComfortNote}
                onChange={(e) => setHomeComfortNote(e.target.value)}
                placeholder="Optional home comfort routine (e.g., warm ginger tea, rest)"
              />

              <div className="space-y-2 rounded-xl border border-[#334155] bg-[#223451] p-3 text-xs text-[#F8FAFC]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shareWithCareCircle}
                    onChange={(e) => setShareWithCareCircle(e.target.checked)}
                    className="h-4 w-4 accent-[#8B5CF6]"
                  />
                  <span>Share with consented Care Circle family members</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shareWithDoctor}
                    onChange={(e) => setShareWithDoctor(e.target.checked)}
                    className="h-4 w-4 accent-[#8B5CF6]"
                  />
                  <span>Include in doctor’s summary timeline</span>
                </label>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={(!feelingSummary.trim() && selectedSymptoms.length === 0) || !hasPatients}
              >
                <Send className="h-4 w-4" />
                <span>Share update with care team</span>
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Shared Family & Problem Journal */}
      <Card>
        <CardHeader>
          <CardTitle>Shared Dadi-Nani updates &amp; problem log</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="py-4 text-center text-sm text-[#A8B8CC]">
              No shared updates yet.
            </p>
          ) : (
            <div className="divide-y divide-[#334155]">
              {entries.map((entry) => (
                <div key={entry.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#A8B8CC]">
                    <span className="font-semibold text-[#F8FAFC] capitalize">
                      {entry.entryType.replace('_', ' ')} · {entry.authorName}
                    </span>
                    <span className="font-mono tabular-nums">{formatTimestamp(entry.createdAt)}</span>
                  </div>
                  <p className="text-sm text-[#F8FAFC]">{entry.feelingSummary}</p>
                  {entry.homeComfortNote && (
                    <p className="text-xs text-[#2DD4BF]">
                      Home comfort routine: {entry.homeComfortNote}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
