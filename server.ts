import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'medtwin-api',
      aiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    });
  });

  // MedTwin AI Agent Bot (voice & text chat, Dadi-Nani supportive explanations)
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { message, history = [], patientContext, dadiNaniMode = false, role = 'patient' } = req.body ?? {};
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'A message string is required.' });
        return;
      }

      const ai = getGeminiClient();
      const toneGuidance = dadiNaniMode
        ? 'The user has Dadi-Nani Mode active. Respond in warm, gentle, simple, elder-friendly language with short sentences. Respect traditional family comfort routines (like warm water, ginger tea, rest) while clearly stating that prescribed doctor medicines must be taken exactly as prescribed and any new symptoms or changes should be shared with their doctor.'
        : 'Respond clearly, concisely, and empathetically as a medication-management and care-coordination assistant.';

      const systemInstruction = [
        'You are the MedTwin Care Assistant inside MedTwin AI ("Your medicines. Your care team. One connected view.").',
        toneGuidance,
        `Active workspace role: ${role}.`,
        'Safety rules (non-negotiable):',
        '- Never diagnose diseases, estimate organ damage, predict drug blood concentrations, or recommend dose adjustments.',
        '- Base answers strictly on the provided patient schedule, adherence, and care circle context when referencing their records.',
        '- If someone reports severe symptoms (chest pain, difficulty breathing, severe allergic reaction, fainting), advise seeking urgent medical attention immediately.',
        '- Keep responses practical, structured, and under 180 words unless asked for more detail.',
        patientContext ? `Current Patient Context (synthetic/demo or session data):\n${JSON.stringify(patientContext)}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const conversationText = [
        ...history.slice(-8).map((item: { role: string; text: string }) => `${item.role === 'user' ? 'User' : 'Assistant'}: ${item.text}`),
        `User: ${message}`,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: conversationText,
        config: {
          systemInstruction,
        },
      });

      res.json({
        reply: response.text ?? 'I could not generate a response right now. Please try again.',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI assistant request failed.';
      const status = msg.includes('GEMINI_API_KEY') ? 503 : 500;
      res.status(status).json({ error: msg });
    }
  });

  // Prescription Extraction Endpoint
  app.post('/api/ai/extract-prescription', async (req, res) => {
    try {
      const { base64Data, mimeType, fileName } = req.body ?? {};
      if (!base64Data || !mimeType) {
        res.status(400).json({ error: 'base64Data and mimeType are required.' });
        return;
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: `Extract prescription details from this document (${fileName ?? 'uploaded prescription'}). Never invent unreadable medicine names, doses, or instructions. If a field is unclear or missing, return empty string and add the field name to unclearFields.`,
            },
          ],
        },
        config: {
          systemInstruction:
            'You are a careful medical prescription OCR extractor. Only transcribe clearly visible text. Never guess or fabricate unreadable medicine names, strengths, doses, or instructions. Mark any ambiguous or missing field in unclearFields.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              prescriberName: { type: Type.STRING },
              prescriptionDate: { type: Type.STRING },
              clinicName: { type: Type.STRING },
              patientNameOnRx: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    medicineName: { type: Type.STRING },
                    strength: { type: Type.STRING },
                    doseAndRoute: { type: Type.STRING },
                    frequency: { type: Type.STRING },
                    duration: { type: Type.STRING },
                    instructions: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    unclearFields: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                },
              },
              overallNotes: { type: Type.STRING },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim() || '{}');
      res.json({
        mode: 'live-ai',
        extracted: parsed,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Prescription extraction failed.';
      const status = msg.includes('GEMINI_API_KEY') ? 503 : 500;
      res.status(status).json({ error: msg });
    }
  });

  // Clinician AI-generated Visit Summary (with explicit source citations & clinician review flag)
  app.post('/api/ai/visit-summary', async (req, res) => {
    try {
      const { patientSummaryPayload } = req.body ?? {};
      if (!patientSummaryPayload) {
        res.status(400).json({ error: 'patientSummaryPayload is required.' });
        return;
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Generate a concise structured visit preparation summary strictly from these patient records:\n${JSON.stringify(patientSummaryPayload)}`,
        config: {
          systemInstruction:
            'Summarize existing patient records for a clinician review. Cite exact source record IDs provided in the payload. Never invent diagnoses, clinical predictions, or dose recommendations. Return JSON.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summaryParagraph: { type: Type.STRING },
              keyMedicationUpdates: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              adherenceObservations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              discussionTopics: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              citedSources: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    label: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim() || '{}');
      res.json({
        summary: parsed,
        requiresClinicianReview: true,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Visit summary generation failed.';
      const status = msg.includes('GEMINI_API_KEY') ? 503 : 500;
      res.status(status).json({ error: msg });
    }
  });

  // ---------------------------------------------------------------------------
  // Backend-Owned Caregiver Module Calculations & Permission Redaction
  // ---------------------------------------------------------------------------
  function addDaysToIso(isoDate: string, days: number): string {
    const parts = isoDate.split('-').map(Number);
    const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
    return dt.toISOString().slice(0, 10);
  }

  interface ServerMedication {
    id: string;
    patientId: string;
    name: string;
    strength: string;
    scheduledTimes: string[];
    asNeeded?: boolean;
    startDate: string;
    endDate?: string;
    remainingQuantity?: number;
    unitLabel: string;
    status: string;
  }

  interface ServerDoseLog {
    patientId: string;
    medicationId: string;
    scheduledDate: string;
    scheduledTime: string;
    status: 'taken' | 'skipped';
  }

  interface ServerConnection {
    patientId: string;
    caregiverId: string;
    status: string;
    permissions: {
      viewSchedules?: boolean;
      receiveDoseAlerts?: boolean;
      viewHistoryAndReports?: boolean;
      viewClinicianNotes?: boolean;
    };
  }

  interface ServerPatient {
    id: string;
    name: string;
    mrn: string;
  }

  function computeServerAdherence(
    patientId: string,
    periodDays: number,
    todayStr: string,
    nowHhMm: string,
    medications: ServerMedication[],
    doseLogs: ServerDoseLog[],
  ) {
    let scheduledDueCount = 0;
    let takenCount = 0;
    let skippedCount = 0;
    let unconfirmedCount = 0;
    let todayTaken = 0;
    let todayTotal = 0;

    const activeMeds = medications.filter(
      (m) => m.patientId === patientId && m.status === 'active' && !m.asNeeded,
    );

    for (let offset = periodDays - 1; offset >= 0; offset--) {
      const dateStr = addDaysToIso(todayStr, -offset);
      for (const med of activeMeds) {
        if (dateStr < med.startDate) continue;
        if (med.endDate && dateStr > med.endDate) continue;

        for (const timeStr of med.scheduledTimes ?? []) {
          const log = doseLogs.find(
            (l) =>
              l.patientId === patientId &&
              l.medicationId === med.id &&
              l.scheduledDate === dateStr &&
              l.scheduledTime === timeStr,
          );

          if (dateStr === todayStr) {
            todayTotal += 1;
            if (log?.status === 'taken') todayTaken += 1;
          }

          const isDue =
            dateStr < todayStr ||
            (dateStr === todayStr && (Boolean(log) || timeStr <= nowHhMm));

          if (!isDue) continue;
          scheduledDueCount += 1;
          if (log?.status === 'taken') {
            takenCount += 1;
          } else if (log?.status === 'skipped') {
            skippedCount += 1;
          } else {
            unconfirmedCount += 1;
          }
        }
      }
    }

    return {
      scheduledDueCount,
      takenCount,
      skippedCount,
      unconfirmedCount,
      todayTaken,
      todayTotal,
      adherencePct:
        scheduledDueCount > 0 ? Math.round((takenCount / scheduledDueCount) * 100) : null,
    };
  }

  function computeServerRefillCountdowns(
    patientId: string,
    todayStr: string,
    medications: ServerMedication[],
    viewSchedulesAllowed: boolean,
  ) {
    const activeMeds = medications.filter(
      (m) => m.patientId === patientId && m.status === 'active',
    );

    if (!viewSchedulesAllowed) {
      return [];
    }

    return activeMeds
      .map((med) => {
        const dailyUsage = med.asNeeded ? 0 : (med.scheduledTimes ?? []).length;
        const qty = typeof med.remainingQuantity === 'number' ? med.remainingQuantity : null;
        const daysRemaining =
          qty !== null && dailyUsage > 0 ? Math.floor(qty / dailyUsage) : null;
        const estimatedRefillDate =
          daysRemaining !== null ? addDaysToIso(todayStr, daysRemaining) : null;

        let urgency: 'critical' | 'warning' | 'nominal' = 'nominal';
        if (daysRemaining !== null) {
          if (daysRemaining <= 2) {
            urgency = 'critical';
          } else if (daysRemaining <= 7) {
            urgency = 'warning';
          }
        }

        return {
          medication_id: med.id,
          medication_name: med.name,
          strength: med.strength,
          remaining_quantity: qty,
          unit_label: med.unitLabel,
          daily_usage: dailyUsage,
          days_remaining: daysRemaining,
          estimated_refill_date: estimatedRefillDate,
          urgency,
          redacted: false,
        };
      })
      .sort((a, b) => {
        const rank = { critical: 0, warning: 1, nominal: 2 };
        if (rank[a.urgency] !== rank[b.urgency]) return rank[a.urgency] - rank[b.urgency];
        return (a.days_remaining ?? 999) - (b.days_remaining ?? 999);
      });
  }

  function computeServerRedactedTwin(
    patientId: string,
    todayStr: string,
    medications: ServerMedication[],
    perms: ServerConnection['permissions'] | undefined,
  ) {
    const viewSchedules = Boolean(perms?.viewSchedules);
    const viewHistoryAndReports = Boolean(perms?.viewHistoryAndReports);

    if (!viewSchedules) {
      return {
        patient_id: patientId,
        access_level: 'redacted',
        redaction_reason:
          'Patient has not enabled the "view_schedules" consent scope for this Care Circle link.',
        projected_adherence_14d_pct: null,
        supply_runout_risk_count: 0,
        next_supply_gap_date: null,
        continuity_note:
          'Digital Twin supply and adherence insights are hidden until schedule consent is granted.',
        disclaimer:
          'Medication continuity simulation only; no clinical diagnosis or unvalidated predictions.',
      };
    }

    const activeMeds = medications.filter(
      (m) =>
        m.patientId === patientId &&
        m.status === 'active' &&
        !m.asNeeded &&
        (m.scheduledTimes ?? []).length > 0,
    );

    const countdowns = computeServerRefillCountdowns(patientId, todayStr, medications, true);
    const lowStock = countdowns.filter((c) => c.urgency === 'critical' || c.urgency === 'warning');
    const firstGap = countdowns.find((c) => c.days_remaining !== null && c.days_remaining < 14);

    if (!viewHistoryAndReports) {
      return {
        patient_id: patientId,
        access_level: 'schedule_only',
        redaction_reason:
          'Enable "view_history_reports" consent to view 14-day Digital Twin continuity projections.',
        projected_adherence_14d_pct: null,
        supply_runout_risk_count: lowStock.length,
        next_supply_gap_date: null,
        continuity_note:
          lowStock.length > 0
            ? `${lowStock.length} active medication(s) fall within the 7-day refill window based on current schedule counts.`
            : 'Current active schedules have more than 7 days of supply recorded.',
        disclaimer:
          'Restricted to schedule-level supply counts per caregiver consent; non-diagnostic.',
      };
    }

    // Deterministic 14-day supply coverage calculation without refill replenishment
    let scheduled14d = 0;
    let covered14d = 0;
    for (const med of activeMeds) {
      const perDay = med.scheduledTimes.length;
      const stock = typeof med.remainingQuantity === 'number' ? med.remainingQuantity : 0;
      const totalNeeded = perDay * 14;
      scheduled14d += totalNeeded;
      covered14d += Math.min(stock, totalNeeded);
    }

    const projectedPct = scheduled14d > 0 ? Math.round((covered14d / scheduled14d) * 100) : 100;

    return {
      patient_id: patientId,
      access_level: 'full',
      projected_adherence_14d_pct: projectedPct,
      supply_runout_risk_count: lowStock.length,
      next_supply_gap_date: firstGap?.estimated_refill_date ?? null,
      continuity_note:
        lowStock.length > 0
          ? `Without a refill, ${lowStock.map((m) => m.medication_name).join(', ')} will reach depletion within ${lowStock[0].days_remaining ?? 0} day(s), limiting 14-day schedule coverage to ${projectedPct}%.`
          : `Recorded stock covers 100% of scheduled doses over the next 14 days (${projectedPct}% continuity).`,
      disclaimer:
        'Deterministic supply & adherence continuity model from recorded stock and schedule; non-diagnostic.',
    };
  }

  app.post('/api/caregiver/insights', (req, res) => {
    try {
      const {
        todayStr = new Date().toISOString().slice(0, 10),
        nowHhMm = new Date().toISOString().slice(11, 16),
        caregiverId,
        patients = [],
        connections = [],
        medications = [],
        doseLogs = [],
      } = (req.body ?? {}) as {
        todayStr?: string;
        nowHhMm?: string;
        caregiverId?: string;
        patients?: ServerPatient[];
        connections?: ServerConnection[];
        medications?: ServerMedication[];
        doseLogs?: ServerDoseLog[];
      };

      const adherenceSummaries: Record<string, unknown> = {};
      const refillCountdownsByPatient: Record<string, unknown[]> = {};
      const digitalTwinInsightsByPatient: Record<string, unknown> = {};

      const relevantConnections = connections.filter(
        (c) => (!caregiverId || c.caregiverId === caregiverId) && c.status === 'accepted',
      );

      for (const conn of relevantConnections) {
        const pat = patients.find((p) => p.id === conn.patientId);
        if (!pat) continue;
        const canViewSchedules = Boolean(conn.permissions?.viewSchedules);

        if (canViewSchedules) {
          const m7 = computeServerAdherence(pat.id, 7, todayStr, nowHhMm, medications, doseLogs);
          const m30 = computeServerAdherence(pat.id, 30, todayStr, nowHhMm, medications, doseLogs);

          adherenceSummaries[pat.id] = {
            patient_id: pat.id,
            patient_name: pat.name,
            mrn: pat.mrn,
            access_granted: true,
            today_taken: m7.todayTaken,
            today_total: m7.todayTotal,
            adherence_7d_pct: m7.adherencePct,
            adherence_30d_pct: m30.adherencePct,
            taken_7d: m7.takenCount,
            due_7d: m7.scheduledDueCount,
            skipped_7d: m7.skippedCount,
            unconfirmed_7d: m7.unconfirmedCount,
            calculated_by: 'backend-api',
          };
        } else {
          adherenceSummaries[pat.id] = {
            patient_id: pat.id,
            patient_name: pat.name,
            mrn: pat.mrn,
            access_granted: false,
            today_taken: 0,
            today_total: 0,
            adherence_7d_pct: null,
            adherence_30d_pct: null,
            taken_7d: 0,
            due_7d: 0,
            skipped_7d: 0,
            unconfirmed_7d: 0,
            calculated_by: 'backend-api',
          };
        }

        refillCountdownsByPatient[pat.id] = computeServerRefillCountdowns(
          pat.id,
          todayStr,
          medications,
          canViewSchedules,
        );

        digitalTwinInsightsByPatient[pat.id] = computeServerRedactedTwin(
          pat.id,
          todayStr,
          medications,
          conn.permissions,
        );
      }

      res.json({
        calculatedBy: 'backend-api',
        generatedAt: new Date().toISOString(),
        adherenceSummaries,
        refillCountdownsByPatient,
        digitalTwinInsightsByPatient,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to compute caregiver insights.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/caregiver/alerts/acknowledge', (req, res) => {
    const { alertId, caregiverName, followUpNote } = (req.body ?? {}) as {
      alertId?: string;
      caregiverName?: string;
      followUpNote?: string;
    };

    if (!alertId || !caregiverName) {
      res.status(400).json({ error: 'alertId and caregiverName are required.' });
      return;
    }

    res.json({
      ok: true,
      alertId,
      delivery_status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: caregiverName,
      follow_up_note: followUpNote?.trim() || undefined,
    });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MedTwin AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MedTwin AI server:', err);
  process.exit(1);
});
