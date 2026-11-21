// "Second Doctor" clash warning: full-screen flashing red overlay + siren + spoken warning.
// Use it with the `interaction_report` returned by POST /prescriptions,
// or with the response of POST /interactions/check:
//   <ClashAlarm report={report} lang="hi" onClose={() => setReport(null)} />
// Browsers only allow sound after a user click - the "Upload prescription" click counts.
import { useEffect } from "react";

export default function ClashAlarm({ report, lang = "en", onClose }) {
  useEffect(() => {
    if (!report || !report.play_alarm) return undefined;

    let ctx = null;
    let osc = null;
    let timer = null;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.25;
      osc.type = "square";
      osc.frequency.value = 650;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      let high = false;
      timer = setInterval(() => {
        high = !high;
        osc.frequency.setValueAtTime(high ? 950 : 650, ctx.currentTime);
      }, 400);
    } catch {
      /* no audio available - the visual warning still works */
    }

    if ("speechSynthesis" in window && report.interactions.length > 0) {
      const codes = { en: "en-IN", hi: "hi-IN", pa: "pa-IN" };
      const u = new SpeechSynthesisUtterance(`${report.banner[lang]} ${report.interactions[0].speech[lang]}`);
      u.lang = codes[lang] || "en-IN";
      u.rate = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }

    return () => {
      if (timer) clearInterval(timer);
      try {
        if (osc) osc.stop();
        if (ctx) ctx.close();
      } catch {
        /* already stopped */
      }
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [report, lang]);

  if (!report || !report.play_alarm) return null;

  return (
    <div className="fixed inset-0 z-50 flex animate-pulse flex-col items-center justify-center gap-6 overflow-y-auto bg-red-700 p-6 text-center text-white">
      <div className="text-8xl">⚠️</div>
      <h1 className="text-4xl font-extrabold">{report.banner[lang]}</h1>

      <div className="w-full max-w-2xl space-y-3">
        {report.interactions
          .filter((i) => i.severity !== "moderate")
          .map((i, idx) => (
            <div key={idx} className="rounded-2xl bg-white p-4 text-left text-black">
              <p className="text-2xl font-bold">
                {i.medication_a.name} + {i.medication_b.name}
              </p>
              <p className="text-lg font-semibold text-red-700">{i.title}</p>
              <p className="text-lg">{i.detail}</p>
              <p className="text-lg font-semibold">👉 {i.advice}</p>
            </div>
          ))}
      </div>

      <p className="max-w-2xl text-sm opacity-90">{report.disclaimer}</p>
      <button onClick={onClose} className="rounded-2xl bg-white px-8 py-4 text-2xl font-extrabold text-red-700">
        I understand - I will ask my doctor
      </button>
    </div>
  );
}
