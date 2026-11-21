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
