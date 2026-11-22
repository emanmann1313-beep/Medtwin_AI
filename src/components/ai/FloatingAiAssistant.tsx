import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  Minus,
  Send,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { useAuth } from '@/src/context/AuthContext';
import {
  buildDoseSlotsForDate,
  computeAdherenceMetrics,
  computeRefillForecasts,
  getTodayIso,
} from '@/src/services/adherenceEngine';
import { runDigitalTwinSimulation } from '@/src/services/digitalTwinEngine';
import { sendAiChatMessage } from '@/src/services/aiService';
import { Button } from '@/src/components/ui/button';
import { cn, formatTime12h } from '@/src/lib/utils';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

const SUGGESTED_QUESTIONS = [
  'What medicines do I have today?',
  'When is my next dose?',
  'Show missed doses.',
  'When will I need a refill?',
  'Explain my Digital Twin results.',
  'How do I scan a prescription?',
];

export function FloatingAiAssistant() {
  const {
    state,
    hasPatients,
    activePatient,
    activeRole,
    dadiNaniMode,
    dadiNaniLanguage,
    assistantOpen,
    setAssistantOpen,
  } = useMedTwin();
  const { user, isDemoMode } = useAuth();

  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const todayStr = getTodayIso();

  const patientContextPayload = useMemo(() => {
    if (!hasPatients || !activePatient.id) {
      return {
        accountName: user?.fullName || 'User',
        role: activeRole,
        demoMode: isDemoMode,
        note: 'No patient medications recorded yet. Guide the user on adding or scanning a prescription.',
      };
    }

    const activeMeds = state.medications.filter(
      (m) => m.patientId === activePatient.id && m.status === 'active',
    );
    const todaySlots = buildDoseSlotsForDate(
      activePatient.id,
      todayStr,
      state.medications,
      state.doseLogs,
    );
    const metrics7 = computeAdherenceMetrics(
      activePatient.id,
      7,
      state.medications,
      state.doseLogs,
    );
    const metrics30 = computeAdherenceMetrics(
      activePatient.id,
      30,
      state.medications,
      state.doseLogs,
    );
    const refills = computeRefillForecasts(activePatient.id, state.medications);
    const twinSummary = runDigitalTwinSimulation(activeMeds, {
      horizonDays: 14,
      mode: 'refill-delay',
      omittedDatesCount: 2,
      selectedMedicationId: 'all',
      refillDelayDays: 3,
      replenishOnDayOffset: 2,
      replenishQuantity: 30,
      alertMissThreshold: 2,
    });

    return {
      patientName: activePatient.name,
      role: activeRole,
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
        state: s.state,
      })),
      adherence7dPct: metrics7.adherencePct,
      adherence30dPct: metrics30.adherencePct,
      missedOrUnconfirmed7d: metrics7.unconfirmedCount,
      refillForecasts: refills.map((r) => ({
        medicine: `${r.medicationName} ${r.strength}`,
        daysRemaining: r.daysRemaining,
        needsRefill: r.needsRefill,
      })),
      digitalTwin14d: {
        baselineAdherencePct: twinSummary.baselineAdherencePct,
        scenarioAdherencePct: twinSummary.scenarioAdherencePct,
        supplyGapDays: twinSummary.supplyGapDates.length,
      },
    };
  }, [activePatient, activeRole, hasPatients, isDemoMode, state.doseLogs, state.medications, todayStr, user?.fullName]);

  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang =
      dadiNaniLanguage === 'hi' ? 'hi-IN' : dadiNaniLanguage === 'pa' ? 'pa-IN' : 'en-US';
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const handleSend = async (promptText?: string) => {
    const trimmed = (promptText ?? input).trim();
    if (!trimmed || sending) return;

    setErrorMsg(null);
    if (!promptText) setInput('');

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setSending(true);

    try {
      const res = await sendAiChatMessage({
        message: trimmed,
        history: messages.map((m) => ({ role: m.role, text: m.text })),
        patientContext: patientContextPayload,
        dadiNaniMode,
        role: activeRole,
        language: dadiNaniLanguage,
      });

      const botMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: res,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
      if (autoSpeak) speakText(res);
      window.setTimeout(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
      }, 60);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to reach MedTwin AI right now.',
      );
    } finally {
      setSending(false);
    }
  };

  const handleVoiceInput = () => {
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
      setErrorMsg('Microphone speech recognition is unavailable in this browser. Please type below.');
      return;
    }

    setErrorMsg(null);
    setListening(true);
    const rec = new Ctor();
    rec.lang =
      dadiNaniLanguage === 'hi' ? 'hi-IN' : dadiNaniLanguage === 'pa' ? 'pa-IN' : 'en-US';
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const transcript = ev.results[0]?.[0]?.transcript ?? '';
      if (transcript.trim()) {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };
    rec.onerror = () => {
      setListening(false);
      setErrorMsg('Could not capture voice input. Please check microphone permission.');
    };
    rec.onend = () => setListening(false);
    rec.start();
  };

  if (!assistantOpen || minimized) {
    return (
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setAssistantOpen(true);
            setMinimized(false);
          }}
          aria-label="Ask MedTwin AI"
          className="group inline-flex h-13 items-center gap-2.5 rounded-full bg-linear-to-r from-[#8B5CF6] to-[#2DD4BF] px-4 text-sm font-semibold text-[#F8FAFC] shadow-[0_0_28px_rgba(139,92,246,0.4)] transition-transform duration-150 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] cursor-pointer"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B1220]/25">
            <Sparkles className="h-4 w-4 text-[#F8FAFC]" />
          </span>
          <span className="hidden sm:inline whitespace-nowrap pr-1">Ask MedTwin AI</span>
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="MedTwin AI Care Assistant"
      className="fixed bottom-4 right-4 z-40 flex h-[540px] max-h-[82vh] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden rounded-2xl border border-[#334155] bg-[#1A2740] text-[#F8FAFC] shadow-[0_24px_64px_rgba(2,6,23,0.75)]"
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between gap-2 border-b border-[#334155] bg-linear-to-r from-[#101B30] via-[#8B5CF6]/70 to-[#2DD4BF]/50 px-4 py-3 text-[#F8FAFC]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#0B1220]/35 border border-[#F8FAFC]/15">
            <MessageCircle className="h-4 w-4 text-[#2DD4BF]" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-bold leading-tight truncate">MedTwin AI Assistant</p>
            <p className="text-[11px] text-[#F8FAFC]/80 truncate">
              {hasPatients ? `Context: ${activePatient.name}` : 'Medication & schedule guide'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (autoSpeak) stopSpeaking();
              setAutoSpeak((v) => !v);
            }}
            title={autoSpeak ? 'Mute auto read-aloud' : 'Auto read-aloud replies'}
            aria-label={autoSpeak ? 'Mute auto read-aloud' : 'Enable auto read-aloud'}
            className="rounded-lg p-1.5 hover:bg-white/15 cursor-pointer"
          >
            {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              setErrorMsg(null);
            }}
            title="Clear chat history"
            aria-label="Clear chat history"
            className="rounded-lg p-1.5 hover:bg-white/15 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            title="Minimize assistant"
            aria-label="Minimize assistant"
            className="rounded-lg p-1.5 hover:bg-white/15 cursor-pointer"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              setAssistantOpen(false);
            }}
            title="Close assistant"
            aria-label="Close assistant"
            className="rounded-lg p-1.5 hover:bg-white/15 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={listRef} className="flex-1 overflow-y-auto bg-[#0B1220] p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#334155] bg-[#1A2740] p-4 text-xs leading-relaxed text-[#F8FAFC]">
              <p className="font-semibold">Hello! How can I help with your medication plan?</p>
              <p className="mt-1 text-[#A8B8CC]">
                Ask about today’s doses, refill timing, Digital Twin scenarios, or scanning prescriptions. Answers are non-diagnostic and based on your saved workspace records.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-[#A8B8CC]">
                Suggested questions
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSend(q)}
                    className="rounded-xl border border-[#334155] bg-[#223451] px-3 py-2 text-left text-xs font-medium text-[#F8FAFC] hover:border-[#8B5CF6] hover:text-[#2DD4BF] transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex flex-col gap-1',
                msg.role === 'user' ? 'items-end' : 'items-start',
              )}
            >
              <div
                className={cn(
                  'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap',
                  msg.role === 'user'
                    ? 'bg-[#8B5CF6] text-[#F8FAFC] shadow-[0_4px_16px_rgba(139,92,246,0.28)]'
                    : 'border border-[#334155] bg-[#223451] text-[#F8FAFC]',
                )}
              >
                {msg.text}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[#A8B8CC]">
                <span>{msg.timestamp}</span>
                {msg.role === 'assistant' && (
                  <button
                    type="button"
                    onClick={() => speakText(msg.text)}
                    className="inline-flex items-center gap-1 font-semibold text-[#2DD4BF] hover:underline cursor-pointer"
                  >
                    <Volume2 className="h-3 w-3" />
                    <span>Read aloud</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}

        {sending && (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-[#334155] bg-[#223451] px-3.5 py-2 text-xs text-[#A8B8CC]">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8B5CF6]" />
            <span>Thinking...</span>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-start gap-2 rounded-xl border border-[#FB7185]/45 bg-[#FB7185]/12 p-2.5 text-xs text-[#FB7185]">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 border-t border-[#334155] bg-[#101B30] p-3"
      >
        <button
          type="button"
          onClick={handleVoiceInput}
          aria-label={listening ? 'Listening for voice' : 'Speak question'}
          className={cn(
            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors cursor-pointer',
            listening
              ? 'border-[#FB7185] bg-[#FB7185]/15 text-[#FB7185]'
              : 'border-[#334155] bg-[#223451] text-[#F8FAFC] hover:border-[#8B5CF6]',
          )}
        >
          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about doses, refills, or Digital Twin..."
          className="h-9 flex-1 rounded-xl border border-[#334155] bg-[#0B1220] px-3 text-xs text-[#F8FAFC] placeholder:text-[#A8B8CC]/65 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
        />

        <Button
          type="submit"
          size="sm"
          disabled={!input.trim() || sending}
          aria-label="Send message"
          className="h-9 px-3"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}
