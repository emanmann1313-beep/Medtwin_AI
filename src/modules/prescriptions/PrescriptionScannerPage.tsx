import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { SAMPLE_PRESCRIPTION_IMAGE_URL } from '@/src/data/seedData';
import { extractPrescriptionWithAi } from '@/src/services/aiService';
import { PrescriptionExtractedItem } from '@/src/types/medtwin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { cn, formatTimestamp } from '@/src/lib/utils';

type ScanStep = 'upload' | 'preview' | 'review' | 'confirmed';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function parseTimesFromFrequency(freq: string): string[] {
  const lower = freq.toLowerCase();
  if (lower.includes('twice') || lower.includes('bid') || lower.includes('2x')) {
    return ['08:00', '20:00'];
  }
  if (lower.includes('three') || lower.includes('tid') || lower.includes('3x')) {
    return ['08:00', '14:00', '20:00'];
  }
  if (lower.includes('night') || lower.includes('bedtime') || lower.includes('evening')) {
    return ['21:00'];
  }
  return ['08:00'];
}

export function PrescriptionScannerPage() {
  const { state, activePatient, confirmPrescription } = useMedTwin();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<ScanStep>('upload');
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    mimeType: string;
    previewUrl: string;
    base64Data?: string;
    isSampleDemo: boolean;
  } | null>(null);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractionSource, setExtractionSource] = useState<'live-ai' | 'simulated-sample' | 'manual'>('manual');

  const [prescriberName, setPrescriberName] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [prescriptionDate, setPrescriptionDate] = useState('');
  const [items, setItems] = useState<PrescriptionExtractedItem[]>([]);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const patientPrescriptions = useMemo(
    () => state.prescriptions.filter((p) => p.patientId === activePatient.id),
    [activePatient.id, state.prescriptions],
  );

  const handleFileChange = (file: File | undefined) => {
    setValidationError(null);
    setExtractError(null);
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setValidationError('Unsupported file format. Please choose a JPG, PNG, WebP image, or PDF.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setValidationError('File exceeds 10 MB limit. Please upload a smaller scan.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
      setSelectedFile({
        name: file.name,
        mimeType: file.type,
        previewUrl: dataUrl,
        base64Data: base64,
        isSampleDemo: false,
      });
      setStep('preview');
    };
    reader.onerror = () => {
      setValidationError('Could not read the selected file.');
    };
    reader.readAsDataURL(file);
  };

  const handleLoadSamplePrescription = () => {
    setValidationError(null);
    setExtractError(null);
    setSelectedFile({
      name: 'elena_vance_sample_rx.jpg',
      mimeType: 'image/jpeg',
      previewUrl: SAMPLE_PRESCRIPTION_IMAGE_URL,
      isSampleDemo: true,
    });
    setStep('preview');
  };

  const populateSimulatedSampleFields = () => {
    setExtractionSource('simulated-sample');
    setPrescriberName('Dr. Ananya Rao, MD');
    setClinicName('Oakridge / Mercy Crest Medical Clinic');
    setPrescriptionDate('2026-11-18');
    setItems([
      {
        id: `item-${Date.now()}-1`,
        medicineName: 'Metformin Hydrochloride',
        strength: '500 mg',
        doseAndRoute: '1 tablet oral',
        frequency: 'Twice daily with meals',
        scheduledTimes: ['08:00', '20:00'],
        durationDays: 30,
        instructions: 'Take 1 tablet twice daily with meals for 30 days.',
        quantity: 60,
        unclearFields: [],
      },
      {
        id: `item-${Date.now()}-2`,
        medicineName: 'Lisinopril',
        strength: '10 mg',
        doseAndRoute: '1 tablet oral',
        frequency: 'Once daily in the morning',
        scheduledTimes: ['08:00'],
        durationDays: 30,
        instructions: 'Take 1 tablet once daily in the morning for 30 days.',
        quantity: 30,
        unclearFields: ['durationDays (verify refill count on line 2)'],
      },
    ]);
    setConfirmChecked(false);
    setStep('review');
  };

  const runExtraction = async () => {
    if (!selectedFile) return;
    setExtractLoading(true);
    setExtractError(null);

    try {
      let base64 = selectedFile.base64Data;
      if (!base64 && selectedFile.isSampleDemo) {
        const imgRes = await fetch(selectedFile.previewUrl);
        const blob = await imgRes.blob();
        base64 = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => {
            const out = String(r.result ?? '');
            resolve(out.includes(',') ? out.split(',')[1] : '');
          };
          r.onerror = () => reject(new Error('Failed to load sample image bytes.'));
          r.readAsDataURL(blob);
        });
      }

      if (!base64) {
        throw new Error('Document bytes missing.');
      }

      const result = await extractPrescriptionWithAi({
        base64Data: base64,
        mimeType: selectedFile.mimeType,
        fileName: selectedFile.name,
      });

      const ex = result.extracted;
      setExtractionSource('live-ai');
      setPrescriberName(ex.prescriberName ?? '');
      setClinicName(ex.clinicName ?? '');
      setPrescriptionDate(ex.prescriptionDate ?? '');
      const mapped: PrescriptionExtractedItem[] = (ex.items ?? []).map((it, i) => {
        const freq = it.frequency ?? '';
        const unclear = [...(it.unclearFields ?? [])];
        if (!it.medicineName) unclear.push('medicineName');
        if (!it.strength) unclear.push('strength');
        if (!it.instructions) unclear.push('instructions');
        const durationMatch = String(it.duration ?? '').match(/\d+/);
        return {
          id: `item-${Date.now()}-${i}`,
          medicineName: it.medicineName ?? '',
          strength: it.strength ?? '',
          doseAndRoute: it.doseAndRoute ?? '',
          frequency: freq,
          scheduledTimes: parseTimesFromFrequency(freq),
          durationDays: durationMatch ? Number(durationMatch[0]) : 30,
          instructions: it.instructions ?? '',
          quantity: typeof it.quantity === 'number' ? it.quantity : undefined,
          unclearFields: Array.from(new Set(unclear)),
        };
      });

      setItems(
        mapped.length > 0
          ? mapped
          : [
              {
                id: `item-${Date.now()}-empty`,
                medicineName: '',
                strength: '',
                doseAndRoute: '',
                frequency: '',
                scheduledTimes: ['08:00'],
                durationDays: 30,
                instructions: '',
                unclearFields: ['medicineName', 'strength', 'doseAndRoute', 'instructions'],
              },
            ],
      );
      setConfirmChecked(false);
      setStep('review');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Extraction service unavailable.';
      setExtractError(msg);
      // Do NOT claim to have read an arbitrary uploaded file!
      // Only allow explicitly labeled simulated extraction for the demo sample prescription.
    } finally {
      setExtractLoading(false);
    }
  };

  const updateItemField = <K extends keyof PrescriptionExtractedItem>(
    id: string,
    field: K,
    value: PrescriptionExtractedItem[K],
  ) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const updated = { ...it, [field]: value };
        if (field === 'frequency' && typeof value === 'string') {
          updated.scheduledTimes = parseTimesFromFrequency(value);
        }
        updated.unclearFields = it.unclearFields.filter(
          (u) => !u.toLowerCase().includes(String(field).toLowerCase()),
        );
        return updated;
      }),
    );
  };

  const addBlankMedication = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        medicineName: '',
        strength: '',
        doseAndRoute: '1 tablet oral',
        frequency: 'Once daily',
        scheduledTimes: ['08:00'],
        durationDays: 30,
        instructions: '',
        quantity: 30,
        unclearFields: ['medicineName', 'strength', 'instructions'],
      },
    ]);
  };

  const hasInvalidRequiredFields =
    items.length === 0 ||
    items.some(
      (it) => !it.medicineName.trim() || !it.doseAndRoute.trim() || !it.instructions.trim(),
    );

  const handleConfirmSchedule = () => {
    if (!selectedFile || hasInvalidRequiredFields || !confirmChecked) return;
    confirmPrescription({
      patientId: activePatient.id,
      prescription: {
        patientId: activePatient.id,
        prescriberName: prescriberName.trim() || undefined,
        clinicName: clinicName.trim() || undefined,
        prescriptionDate: prescriptionDate.trim() || undefined,
        fileName: selectedFile.name,
        previewUrl: selectedFile.isSampleDemo ? selectedFile.previewUrl : undefined,
        extractionSource,
        items,
      },
    });
    setStep('confirmed');
  };

  return (
    <div className="space-y-6">
      {/* Progress Stepper */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
              {(
                [
                  { id: 'upload', label: '1. Upload' },
                  { id: 'preview', label: '2. Preview & Extract' },
                  { id: 'review', label: '3. Review & Correct' },
                  { id: 'confirmed', label: '4. Schedule Active' },
                ] as const
              ).map((s, idx) => (
                <React.Fragment key={s.id}>
                  <span
                    className={cn(
                      'px-2.5 py-1 rounded-lg',
                      step === s.id
                        ? 'bg-[#0D9488] text-white font-semibold dark:bg-[#14B8A6] dark:text-[#0B1220]'
                        : 'text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] dark:text-[#94A3B8] dark:bg-[#0B1220] dark:border-[#334155]',
                    )}
                  >
                    {s.label}
                  </span>
                  {idx < 3 && <span className="text-[#CBD5E1] dark:text-[#475569]">/</span>}
                </React.Fragment>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleLoadSamplePrescription}>
                Load sample prescription
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload a prescription for {activePatient.name}</CardTitle>
            <CardDescription>
              Select a prescription image (JPG, PNG, WebP) or PDF up to 10 MB, or load our demo sample.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-6 py-12 text-center dark:border-[#334155] dark:bg-[#0B1220]">
              <Upload className="h-9 w-9 text-[#0D9488] dark:text-[#14B8A6]" />
              <p className="mt-3 text-sm font-semibold text-[#172554] dark:text-[#F8FAFC]">
                Choose a prescription photo or PDF
              </p>
              <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                Unclear fields are always highlighted for your confirmation before any schedule is created.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0])}
              />
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Button type="button" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  <span>Select file</span>
                </Button>
                <Button type="button" variant="outline" onClick={handleLoadSamplePrescription}>
                  <FileText className="h-4 w-4" />
                  <span>Load sample prescription</span>
                </Button>
              </div>
            </div>

            {validationError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2 & 3: Side-by-side Original Prescription + Extraction / Review */}
      {(step === 'preview' || step === 'review') && selectedFile && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Left: Original Prescription Preview */}
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle>Original prescription</CardTitle>
              <CardDescription className="truncate">{selectedFile.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedFile.mimeType === 'application/pdf' ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-10 text-center dark:border-[#334155] dark:bg-[#0B1220]">
                  <FileText className="h-10 w-10 text-[#64748B] dark:text-[#94A3B8]" />
                  <p className="mt-2 text-sm font-medium text-[#172554] dark:text-[#F8FAFC]">{selectedFile.name}</p>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">PDF document ready for extraction</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] dark:border-[#334155] dark:bg-[#0B1220]">
                  <img
                    src={selectedFile.previewUrl}
                    alt={`Uploaded prescription ${selectedFile.name}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-auto max-h-[540px] object-contain"
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStep('upload');
                    setSelectedFile(null);
                    setExtractError(null);
                  }}
                >
                  Choose another file
                </Button>
                {step === 'preview' && (
                  <Button type="button" size="sm" onClick={runExtraction} disabled={extractLoading}>
                    {extractLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Extracting fields...</span>
                      </>
                    ) : (
                      <span>Extract prescription fields</span>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right: Extraction Status or Editable Review Form */}
          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle>
                {step === 'preview' ? 'Extract structured fields' : 'Review & correct extracted fields'}
              </CardTitle>
              <CardDescription>
                {extractionSource === 'simulated-sample'
                  ? 'Simulated sample extraction active — verify every field before confirming.'
                  : extractionSource === 'live-ai'
                    ? 'AI extraction complete — unclear or missing fields are highlighted for verification.'
                    : 'Run extraction or enter prescription details manually.'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {step === 'preview' && (
                <div className="space-y-4">
                  {extractError && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-2 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div>
                          <p className="font-semibold">Extraction API unavailable</p>
                          <p className="mt-0.5 text-amber-800 dark:text-amber-300">{extractError}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button type="button" size="sm" variant="outline" onClick={runExtraction}>
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Retry extraction</span>
                        </Button>
                        {selectedFile.isSampleDemo ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="amber"
                            onClick={populateSimulatedSampleFields}
                          >
                            Use simulated sample extraction
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setExtractionSource('manual');
                              setItems([]);
                              addBlankMedication();
                              setStep('review');
                            }}
                          >
                            Enter fields manually
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {!extractError && (
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 space-y-3 dark:border-[#334155] dark:bg-[#0B1220]">
                      <p className="text-sm text-[#172554] dark:text-[#F8FAFC]">
                        Click <strong>Extract prescription fields</strong> to read visible medicine names,
                        strengths, dose instructions, and prescriber details.
                      </p>
                      {selectedFile.isSampleDemo && (
                        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                          Demo note: If live extraction is not configured, you can run{' '}
                          <button
                            type="button"
                            onClick={populateSimulatedSampleFields}
                            className="font-semibold text-[#0D9488] underline cursor-pointer dark:text-[#14B8A6]"
                          >
                            Simulated sample extraction
                          </button>{' '}
                          on this sample prescription.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {step === 'review' && (
                <div className="space-y-5">
                  {extractionSource === 'simulated-sample' && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200">
                      <strong>Simulated extraction:</strong> Loaded pre-parsed fields for the demo sample prescription. Please review and confirm.
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                        Prescriber (if present)
                      </label>
                      <Input
                        value={prescriberName}
                        onChange={(e) => setPrescriberName(e.target.value)}
                        placeholder="e.g., Dr. Priya Nair"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                        Clinic / Hospital
                      </label>
                      <Input
                        value={clinicName}
                        onChange={(e) => setClinicName(e.target.value)}
                        placeholder="Clinic name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                        Prescription date
                      </label>
                      <Input
                        type="date"
                        value={prescriptionDate}
                        onChange={(e) => setPrescriptionDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-[#172554] dark:text-[#F8FAFC]">
                        Extracted medications ({items.length})
                      </h4>
                      <Button type="button" variant="outline" size="sm" onClick={addBlankMedication}>
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add medicine</span>
                      </Button>
                    </div>

                    {items.map((item, idx) => {
                      const hasUnclear =
                        item.unclearFields.length > 0 ||
                        !item.medicineName.trim() ||
                        !item.instructions.trim();

                      return (
                        <div
                          key={item.id}
                          className={cn(
                            'rounded-xl border p-4 space-y-3',
                            hasUnclear
                              ? 'border-amber-300 bg-amber-50/30 dark:border-amber-700/60 dark:bg-amber-950/20'
                              : 'border-[#E2E8F0] bg-[#FFFFFF] dark:border-[#334155] dark:bg-[#0B1220]',
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#172554] dark:text-[#F8FAFC]">
                              Medication #{idx + 1}
                            </span>
                            <div className="flex items-center gap-3">
                              {hasUnclear && (
                                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                  Needs review: {item.unclearFields.join(', ') || 'missing required field'}
                                </span>
                              )}
                              {items.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setItems((prev) => prev.filter((x) => x.id !== item.id))
                                  }
                                  aria-label="Remove medication row"
                                  className="text-[#64748B] hover:text-red-600 cursor-pointer dark:text-[#94A3B8] dark:hover:text-red-400"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                                Medicine name *
                              </label>
                              <Input
                                value={item.medicineName}
                                onChange={(e) =>
                                  updateItemField(item.id, 'medicineName', e.target.value)
                                }
                                className={cn(!item.medicineName.trim() && 'border-amber-400')}
                                placeholder="Required"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                                Strength
                              </label>
                              <Input
                                value={item.strength}
                                onChange={(e) => updateItemField(item.id, 'strength', e.target.value)}
                                placeholder="e.g., 500 mg"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                                Prescribed dose &amp; route *
                              </label>
                              <Input
                                value={item.doseAndRoute}
                                onChange={(e) =>
                                  updateItemField(item.id, 'doseAndRoute', e.target.value)
                                }
                                className={cn(!item.doseAndRoute.trim() && 'border-amber-400')}
                                placeholder="e.g., 1 tablet oral"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                                Frequency
                              </label>
                              <Input
                                value={item.frequency}
                                onChange={(e) =>
                                  updateItemField(item.id, 'frequency', e.target.value)
                                }
                                placeholder="e.g., Twice daily with meals"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                                Duration (days)
                              </label>
                              <Input
                                type="number"
                                min={1}
                                value={item.durationDays ?? ''}
                                onChange={(e) =>
                                  updateItemField(
                                    item.id,
                                    'durationDays',
                                    e.target.value ? Number(e.target.value) : undefined,
                                  )
                                }
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                                Quantity dispensed
                              </label>
                              <Input
                                type="number"
                                min={0}
                                value={item.quantity ?? ''}
                                onChange={(e) =>
                                  updateItemField(
                                    item.id,
                                    'quantity',
                                    e.target.value ? Number(e.target.value) : undefined,
                                  )
                                }
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                              Instructions *
                            </label>
                            <Input
                              value={item.instructions}
                              onChange={(e) =>
                                updateItemField(item.id, 'instructions', e.target.value)
                              }
                              className={cn(!item.instructions.trim() && 'border-amber-400')}
                              placeholder="Confirmed instructions from prescription"
                            />
                          </div>

                          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-mono">
                            Scheduled daily times: {item.scheduledTimes.join(', ')}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3 dark:border-[#334155] dark:bg-[#0B1220]">
                    <label className="flex items-start gap-2.5 text-xs text-[#172554] dark:text-[#F8FAFC] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmChecked}
                        onChange={(e) => setConfirmChecked(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-[#0D9488] dark:accent-[#14B8A6]"
                      />
                      <span>
                        I have reviewed all highlighted fields against the original prescription and confirm these medication schedules are ready to activate for{' '}
                        <strong>{activePatient.name}</strong>.
                      </span>
                    </label>

                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        onClick={handleConfirmSchedule}
                        disabled={hasInvalidRequiredFields || !confirmChecked}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Confirm &amp; create schedule</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 4: Confirmed */}
      {step === 'confirmed' && (
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <CheckCircle2 className="mx-auto h-11 w-11 text-[#0D9488] dark:text-[#14B8A6]" />
            <div>
              <h3 className="font-display text-xl font-bold text-[#172554] dark:text-[#F8FAFC]">
                Medication schedule activated
              </h3>
              <p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">
                Added {items.length} medicine(s) to {activePatient.name}’s schedule and logged to Care History.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button type="button" onClick={() => navigate('/medications')}>
                View active medications
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/dashboard')}>
                Return to dashboard
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep('upload');
                  setSelectedFile(null);
                  setItems([]);
                }}
              >
                Scan another prescription
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prescription Archive */}
      <Card>
        <CardHeader>
          <CardTitle>Prescription archive</CardTitle>
          <CardDescription>Confirmed prescriptions on file for {activePatient.name}</CardDescription>
        </CardHeader>
        <CardContent>
          {patientPrescriptions.length === 0 ? (
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">No prescriptions recorded yet.</p>
          ) : (
            <div className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
              {patientPrescriptions.map((rx) => (
                <div
                  key={rx.id}
                  className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#172554] dark:text-[#F8FAFC]">
                      {rx.fileName} · {rx.items.map((i) => `${i.medicineName} ${i.strength}`).join(', ')}
                    </p>
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                      Prescriber: {rx.prescriberName ?? 'Unspecified'} · Source:{' '}
                      {rx.extractionSource === 'simulated-sample'
                        ? 'Simulated sample'
                        : rx.extractionSource}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                    {formatTimestamp(rx.confirmedAt ?? rx.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
