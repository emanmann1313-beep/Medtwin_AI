import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  X,
  AlertCircle,
  HeartHandshake,
} from 'lucide-react';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { AiChatMessage, sendAiChatMessage } from '@/src/services/aiService';
import { computeAdherenceMetrics, computeRefillForecasts } from '@/src/services/adherenceEngine';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { cn } from '@/src/lib/utils';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

export function CareAssistantDrawer() {
  const {
    state,
    activePatient,
    activeRole,
    dadiNaniMode,
    setDadiNaniMode,
    assistantOpen,
    setAssistantOpen,
  } = useMedTwin();

  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      role: 'assistant',
      text: 'Hello! I am your MedTwin Care Assistant. Ask me about your medication schedule, upcoming refills, or speak to share how you are feeling.',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  const speechSupported = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  }, []);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, assistantOpen]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speakText = (text: string) => {
    if (!voiceOutputEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = dadiNaniMode ? 0.92 : 1.0;
    window.speechSynthesis.speak(utter);
  };

  const patientContextPayload = useMemo(() => {
    const meds = state.medications
      .filter((m) => m.patientId === activePatient.id && m.status === 'active')
      .map((m) => ({
        name: m.name,
        strength: m.strength,
        instructions: m.instructions,
        scheduledTimes: m.scheduledTimes,
        remainingQuantity: m.remainingQuantity,
      }));
    const adherence7 = computeAdherenceMetrics(
      activePatient.id,
      7,
      state.medications,
      state.doseLogs,
    );
    const refills = computeRefillForecasts(activePatient.id, state.medications).filter(
      (r) => r.needsRefill,
    );
    return {
      patientName: activePatient.name,
      age: activePatient.age,
      conditions: activePatient.conditions,
      activeMedications: meds,
      recordedAdherence7dPct: adherence7.adherencePct,
      medicinesApproachingRefill: refills.map((r) => ({
        name: r.medicationName,
        daysRemaining: r.daysRemaining,
      })),
    };
  }, [activePatient, state.doseLogs, state.medications]);

  const handleSend = async (overrideText?: string) => {
    const trimmed = (overrideText ?? inputValue).trim();
    if (!trimmed || isSending) return;

    setErrorText(null);
    const nextUserMsg: AiChatMessage = { role: 'user', text: trimmed };
    const updatedHistory = [...messages, nextUserMsg];
    setMessages(updatedHistory);
    setInputValue('');
    setIsSending(true);

    try {
      const reply = await sendAiChatMessage({
        message: trimmed,
        history: messages,
        patientContext: patientContextPayload,
        dadiNaniMode,
        role: activeRole,
      });
      setMessages([...updatedHistory, { role: 'assistant', text: reply }]);
      speakText(reply);
    } catch (err) {
      setErrorText(
        err instanceof Error
          ? err.message
          : 'Unable to reach the AI assistant right now. Check server configuration.',
      );
    } finally {
      setIsSending(false);
    }
  };

  const toggleVoiceInput = () => {
    if (!speechSupported) {
      setErrorText('Browser voice recognition is unavailable here. Please type your message.');
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;

    rec.onresult = (event) => {
      let transcript = '';
      let isFinal = false;
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0]?.transcript ?? '';
        if (event.results[i].isFinal) isFinal = true;
      }
      setInputValue(transcript);
      if (isFinal && transcript.trim()) {
        setIsListening(false);
        void handleSend(transcript.trim());
      }
    };

    rec.onerror = (ev) => {
      setIsListening(false);
      if (ev.error !== 'aborted') {
        setErrorText(`Voice input stopped (${ev.error ?? 'microphone unavailable'}).`);
      }
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;
    setErrorText(null);
    setIsListening(true);
    rec.start();
  };

  if (!assistantOpen) return null;

  const starterPrompts = dadiNaniMode
    ? [
        'Explain today’s medicines in simple words',
        'Which tablet needs a refill soon?',
        'How should I note mild stomach discomfort?',
      ]
    : [
        'Summarize my schedule for today',
        'Which medicines are low on supply?',
        'What changed in my 7-day adherence?',
      ];

  return (
    <aside
      aria-label="MedTwin AI Voice and Chat Assistant"
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0D9488]/10 text-[#0D9488]">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-sm font-semibold text-slate-900 truncate">
              MedTwin Care Assistant
            </h2>
            <p className="text-xs text-slate-500 truncate">
              Voice &amp; chat · Context: {activePatient.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setVoiceOutputEnabled((v) => !v)}
            title={voiceOutputEnabled ? 'Mute spoken replies' : 'Speak replies aloud'}
            aria-label={voiceOutputEnabled ? 'Mute spoken replies' : 'Speak replies aloud'}
            className={cn(
              'rounded-lg p-2 text-slate-500 hover:bg-slate-100',
              voiceOutputEnabled && 'bg-[#0D9488]/10 text-[#0D9488]',
            )}
          >
            {voiceOutputEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setAssistantOpen(false)}
            aria-label="Close Care Assistant"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-2.5">
        <div className="flex items-center gap-2 text-xs text-slate-700">
          <HeartHandshake className="h-4 w-4 text-amber-600" />
          <span>Dadi-Nani gentle voice &amp; plain-language mode</span>
        </div>
        <button
          type="button"
          onClick={() => setDadiNaniMode(!dadiNaniMode)}
          className={cn(
            'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
            dadiNaniMode
              ? 'bg-amber-600 text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100',
          )}
        >
          {dadiNaniMode ? 'Active' : 'Enable'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={cn('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}
          >
            <span className="mb-1 text-[11px] font-medium text-slate-400">
              {m.role === 'user' ? 'You' : 'MedTwin Assistant'}
            </span>
            <div
              className={cn(
                'max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                m.role === 'user'
                  ? 'bg-[#0B1220] text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-800',
              )}
            >
              {m.text}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex items-start">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Reviewing your medication profile...
            </div>
          </div>
        )}

        {errorText && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div>
              <p className="font-semibold">Assistant Error</p>
              <p className="mt-0.5">{errorText}</p>
            </div>
          </div>
        )}

        <div ref={scrollEndRef} />
      </div>

      <div className="border-t border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {starterPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void handleSend(prompt)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 text-left cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
          className="flex items-center gap-2"
        >
          <Button
            type="button"
            variant={isListening ? 'danger' : 'outline'}
            size="icon"
            onClick={toggleVoiceInput}
            title={isListening ? 'Stop voice listening' : 'Speak to assistant'}
            aria-label={isListening ? 'Stop voice listening' : 'Speak to assistant'}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              isListening
                ? 'Listening... speak now'
                : 'Ask about doses, refills, or symptoms...'
            }
            aria-label="Message MedTwin Care Assistant"
          />
          <Button type="submit" size="icon" disabled={isSending || !inputValue.trim()} aria-label="Send message">
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="text-[11px] text-slate-400">
          Informational care support only. Does not replace medical advice or prescribe doses.
        </p>
      </div>
    </aside>
  );
}
