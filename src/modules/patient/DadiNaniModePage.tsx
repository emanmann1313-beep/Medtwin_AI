import React, { useMemo, useState } from 'react';
import {
  Check,
  HeartHandshake,
  Mic,
  MicOff,
  Send,
  Volume2,
  AlertCircle,
} from 'lucide-react';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input, Textarea } from '@/src/components/ui/input';
import { cn, formatTime12h, formatTimestamp } from '@/src/lib/utils';
import { DadiNaniEntry } from '@/src/types/medtwin';

const QUICK_PROBLEMS = [
  'Mild stomach discomfort',
  'Feeling dizzy',
  'Knee or joint stiffness',
  'Evening tiredness',
  'Dry cough',
  'Trouble sleeping',
];

export function DadiNaniModePage() {
  const {
    state,
    activePatient,
    dadiNaniMode,
    setDadiNaniMode,
    addDadiNaniEntry,
  } = useMedTwin();

  const [entryType, setEntryType] = useState<DadiNaniEntry['entryType']>('problem');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [feelingSummary, setFeelingSummary] = useState('');
  const [homeComfortNote, setHomeComfortNote] = useState('');
  const [shareWithCareCircle, setShareWithCareCircle] = useState(true);
  const [shareWithDoctor, setShareWithDoctor] = useState(true);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const activeMeds = useMemo(
    () =>
      state.medications.filter(
        (m) => m.patientId === activePatient.id && m.status === 'active',
      ),
    [activePatient.id, state.medications],
  );

  const entries = useMemo(
    () => state.dadiNaniEntries.filter((e) => e.patientId === activePatient.id),
    [activePatient.id, state.dadiNaniEntries],
  );

  const toggleSymptom = (sym: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym],
    );
  };

  const speakMedicine = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  };

  const handleVoiceDictate = () => {
    const w = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
      };
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceError('Voice dictation is not supported in this browser; please type below.');
      return;
    }
    setVoiceError(null);
    setListening(true);
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const spoken = ev.results[0]?.[0]?.transcript ?? '';
      setFeelingSummary((prev) => (prev ? `${prev} ${spoken}` : spoken));
    };
    rec.onerror = () => {
      setListening(false);
      setVoiceError('Could not capture microphone audio.');
    };
    rec.onend = () => setListening(false);
    rec.start();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feelingSummary.trim() && selectedSymptoms.length === 0) return;

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
      <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-500/35 dark:bg-amber-500/10">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
              <HeartHandshake className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-[#172554] dark:text-[#F8FAFC]">
                Dadi-Nani Mode — Share Medicines &amp; Problems
              </h2>
              <p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8] max-w-2xl">
                Warm, simple, large-print family view for elders and loved ones to review medicines,
                share daily discomforts or questions, and coordinate comforting home routines alongside prescribed care.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant={dadiNaniMode ? 'amber' : 'outline'}
              onClick={() => setDadiNaniMode(!dadiNaniMode)}
            >
              {dadiNaniMode ? 'Large-Print Mode: On' : 'Enable Large-Print Mode'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Share your problem or comfort routine */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Share how you feel today</CardTitle>
            <CardDescription>
              Tap common discomforts or speak/type what you want your family or doctor to know.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="inline-flex rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1 dark:border-[#334155] dark:bg-[#0B1220]">
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
                        ? 'bg-[#FFFFFF] text-[#172554] shadow-xs dark:bg-[#172033] dark:text-[#F8FAFC]'
                        : 'text-[#64748B] hover:text-[#172554] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-[#172554] dark:text-[#F8FAFC]">
                  Common feelings or problems (optional):
                </p>
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
                            ? 'border-[#0D9488] bg-[#CCFBF1]/70 text-[#0D9488] dark:border-[#14B8A6] dark:bg-[#14B8A6]/18 dark:text-[#14B8A6]'
                            : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#172554] hover:bg-[#F8FAFC] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC] dark:hover:bg-[#1E293B]',
                        )}
                      >
                        {active && <Check className="h-3.5 w-3.5" />}
                        <span>{sym}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="dn-summary" className="text-xs font-medium text-[#172554] dark:text-[#F8FAFC]">
                    Describe what is bothering you or what happened with a medicine
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant={listening ? 'danger' : 'outline'}
                    onClick={handleVoiceDictate}
                  >
                    {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                    <span>{listening ? 'Listening...' : 'Speak'}</span>
                  </Button>
                </div>
                <Textarea
                  id="dn-summary"
                  value={feelingSummary}
                  onChange={(e) => setFeelingSummary(e.target.value)}
                  placeholder="Example: Felt mild dizziness 30 minutes after my morning tablet, so I rested and drank water."
                />
                {voiceError && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>{voiceError}</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="dn-comfort" className="block text-xs font-medium text-[#172554] dark:text-[#F8FAFC] mb-1.5">
                  Home comfort routine used (kept separate from prescribed medicines)
                </label>
                <Input
                  id="dn-comfort"
                  value={homeComfortNote}
                  onChange={(e) => setHomeComfortNote(e.target.value)}
                  placeholder="e.g., Warm ginger tea, warm compress on knee, light walk..."
                />
              </div>

              <div className="space-y-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs text-[#172554] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC]">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shareWithCareCircle}
                    onChange={(e) => setShareWithCareCircle(e.target.checked)}
                    className="h-4 w-4 accent-[#0D9488] dark:accent-[#14B8A6]"
                  />
                  <span>Share with consented Care Circle family members (triggers simulated notification if enabled)</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shareWithDoctor}
                    onChange={(e) => setShareWithDoctor(e.target.checked)}
                    className="h-4 w-4 accent-[#0D9488] dark:accent-[#14B8A6]"
                  />
                  <span>Include in doctor’s pre-visit summary timeline</span>
                </label>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={!feelingSummary.trim() && selectedSymptoms.length === 0}
              >
                <Send className="h-4 w-4" />
                <span>Share update with care team</span>
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right: Simple Plain-Language Medicine Cards with Read-Aloud */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your medicines in simple words</CardTitle>
            <CardDescription>
              Tap “Read aloud” to hear clear timing and instructions for {activePatient.name}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeMeds.map((med) => {
              const spoken = `${med.name} ${med.strength}. ${med.doseAndRoute}. ${med.instructions}. ${
                med.scheduledTimes.length > 0
                  ? `Take at ${med.scheduledTimes.map(formatTime12h).join(' and ')}.`
                  : 'Take only as needed.'
              }`;
              return (
                <div
                  key={med.id}
                  className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#334155] dark:bg-[#0B1220]"
                >
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-[#172554] dark:text-[#F8FAFC]">
                      {med.name} · {med.strength}
                    </p>
                    <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">{med.instructions}</p>
                    <p className="text-xs font-mono text-[#0D9488] dark:text-[#14B8A6] tabular-nums">
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
                    onClick={() => speakMedicine(spoken)}
                    className="shrink-0"
                  >
                    <Volume2 className="h-4 w-4" />
                    <span>Read aloud</span>
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Shared Family & Problem Journal */}
      <Card>
        <CardHeader>
          <CardTitle>Shared Dadi-Nani updates &amp; problem log</CardTitle>
          <CardDescription>
            Clearly separates family comfort routines from clinical prescriptions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">
              No shared updates yet. Use the form above to share how you are feeling.
            </p>
          ) : (
            <div className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
              {entries.map((entry) => (
                <div key={entry.id} className="py-4 first:pt-0 last:pb-0 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
                    <span className="font-semibold text-[#172554] dark:text-[#F8FAFC] capitalize">
                      {entry.entryType.replace('_', ' ')} · {entry.authorName}
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatTimestamp(entry.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-[#172554] dark:text-[#F8FAFC]">{entry.feelingSummary}</p>
                  {entry.symptoms.length > 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Reported feelings: {entry.symptoms.join(', ')}
                    </p>
                  )}
                  {entry.homeComfortNote && (
                    <p className="text-xs text-[#0D9488] dark:text-[#14B8A6]">
                      Home comfort routine: {entry.homeComfortNote}
                    </p>
                  )}
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    Shared with:{' '}
                    {[
                      entry.sharedWithCareCircle && 'Care Circle',
                      entry.sharedWithDoctor && 'Assigned Doctor',
                    ]
                      .filter(Boolean)
                      .join(' & ') || 'Private journal only'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
