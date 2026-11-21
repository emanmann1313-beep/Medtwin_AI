// "Elderly Parent" audio player - drop into the React app (Tailwind classes).
// Needs:  VITE_API_URL=http://localhost:8000  in the frontend .env  (optional, this is the default)
import { useEffect, useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const LANGS = [
  { code: "hi", label: "हिन्दी" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
  { code: "en", label: "English" },
];

export default function ElderAudioPlayer({ patientId, parentLabel = "Mom/Dad", prescriptionId = null }) {
  const [lang, setLang] = useState("hi");
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [sentences, setSentences] = useState([]);
  const [active, setActive] = useState(-1);
  const audioRef = useRef(null);

  function stop() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setPlaying(false);
    setActive(-1);
  }

  useEffect(() => stop, []); // stop sound when the component disappears

  // Fallback voice: the browser's built-in text-to-speech, one sentence at a time
  function speakWithBrowser(data) {
    if (!("speechSynthesis" in window)) {
      setError("This browser cannot speak. Please open the app in Chrome.");
      setPlaying(false);
      return;
    }
    window.speechSynthesis.cancel();
    data.sentences.forEach((sentence, i) => {
      const u = new SpeechSynthesisUtterance(sentence);
      u.lang = data.tts_lang_code; // hi-IN, pa-IN or en-IN
      u.rate = 0.85; // slower = easier to follow
      u.onstart = () => setActive(i);
      if (i === data.sentences.length - 1) {
        u.onend = () => {
          setPlaying(false);
          setActive(-1);
        };
      }
      window.speechSynthesis.speak(u);
    });
  }

  async function handlePlay() {
    if (playing) {
      stop();
      return;
    }
    setError("");
    try {
      const params = new URLSearchParams({ lang });
      if (prescriptionId) params.set("prescription_id", prescriptionId);
      const res = await fetch(`${API}/patients/${patientId}/audio-summary?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not load the summary");

      setSentences(data.sentences);
      setPlaying(true);

      // 1) natural MP3 voice from the backend; 2) browser voice if that is unavailable
      const audio = new Audio(`${API}${data.audio_url}`);
      audioRef.current = audio;
      audio.onended = () => {
        setPlaying(false);
        setActive(-1);
      };
      try {
        await audio.play();
      } catch {
        audioRef.current = null;
        speakWithBrowser(data);
      }
    } catch (e) {
      setError(e.message);
      setPlaying(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4">
      <div className="grid grid-cols-3 gap-3">
        {LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => {
              stop();
              setLang(l.code);
            }}
            className={`rounded-2xl border-4 border-black py-4 text-2xl font-bold ${
              lang === l.code ? "bg-black text-yellow-300" : "bg-white text-black"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <button
        onClick={handlePlay}
        className="w-full rounded-3xl border-8 border-black bg-yellow-400 px-6 py-10 text-3xl font-extrabold text-black active:scale-95"
      >
        {playing ? "⏹ Stop" : `🔊 Play Audio Summary for ${parentLabel}`}
      </button>

      {error && <p className="rounded-xl bg-red-100 p-3 text-lg font-semibold text-red-800">{error}</p>}

      {sentences.length > 0 && (
        <div className="space-y-2 rounded-2xl bg-gray-100 p-4 text-xl leading-relaxed">
          {sentences.map((s, i) => (
            <p key={i} className={i === active ? "rounded bg-yellow-200 font-bold" : ""}>
              {s}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
