export interface AiChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface ExtractedRxApiResult {
  mode: 'live-ai';
  extracted: {
    prescriberName?: string;
    prescriptionDate?: string;
    clinicName?: string;
    patientNameOnRx?: string;
    items?: Array<{
      medicineName?: string;
      strength?: string;
      doseAndRoute?: string;
      frequency?: string;
      duration?: string;
      instructions?: string;
      quantity?: number;
      unclearFields?: string[];
    }>;
    overallNotes?: string;
  };
}

export interface VisitSummaryApiResult {
  summary: {
    summaryParagraph: string;
    keyMedicationUpdates: string[];
    adherenceObservations: string[];
    discussionTopics: string[];
    citedSources: Array<{ id: string; label: string }>;
  };
  requiresClinicianReview: boolean;
  generatedAt: string;
}

export async function sendAiChatMessage(payload: {
  message: string;
  history: AiChatMessage[];
  patientContext?: Record<string, unknown>;
  dadiNaniMode?: boolean;
  role?: string;
}): Promise<string> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'AI assistant is currently unavailable.');
  }
  return data.reply;
}

export async function extractPrescriptionWithAi(payload: {
  base64Data: string;
  mimeType: string;
  fileName: string;
}): Promise<ExtractedRxApiResult> {
  const res = await fetch('/api/ai/extract-prescription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Prescription extraction service is unavailable.');
  }
  return data;
}

export async function generateVisitSummaryWithAi(
  patientSummaryPayload: Record<string, unknown>,
): Promise<VisitSummaryApiResult> {
  const res = await fetch('/api/ai/visit-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientSummaryPayload }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Visit summary generation service is unavailable.');
  }
  return data;
}
