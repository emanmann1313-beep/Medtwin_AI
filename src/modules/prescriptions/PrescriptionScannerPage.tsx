import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { SAMPLE_PRESCRIPTION_IMAGE_URL } from '@/src/data/seedData';
import { extractPrescriptionWithAi } from '@/src/services/aiService';
import { PrescriptionExtractedItem } from '@/src/types/medtwin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
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
  const { isDemoMode } = useAuth();
  const { state, isRealAccountMode, activePatient, confirmPrescription } = useMedTwin();
  const navigate = useNavigate();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraFileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

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

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const openCameraCapture = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      cameraFileInputRef.current?.click();
      return;
    }
    setCameraModalOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 60);
    } catch {
      setCameraError(
        'Live camera access was denied or unavailable. You can still use "Choose photo / camera file" below.',
      );
    }
  };

  const capturePhotoFromVideo = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
    stopCameraStream();
    setCameraModalOpen(false);
    setSelectedFile({
      name: `camera_rx_${new Date().toISOString().slice(0, 10)}.jpg`,
      mimeType: 'image/jpeg',
      previewUrl: dataUrl,
      base64Data: base64,
      isSampleDemo: false,
    });
    setStep('preview');
  };

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
      name: 'sample_prescription_rx.jpg',
      mimeType: 'image/jpeg',
      previewUrl: SAMPLE_PRESCRIPTION_IMAGE_URL,
      isSampleDemo: true,
    });
    setStep('preview');
  };

  const populateSimulatedSampleFields = () => {
    setExtractionSource('simulated-sample');
    setPrescriberName('Dr. Ananya Rao, MD');
    setClinicName('Oakridge Medical Clinic');
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
    if (!selectedFile || hasInvalidRequiredFields || !confirmChecked || !activePatient.id) return;
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

  const handleDownloadReport = () => {
    const lines = [
      'MEDTWIN AI — VERIFIED PRESCRIPTION SUMMARY REPORT',
      `Generated: ${new Date().toISOString()}`,
      `Patient: ${activePatient.name} (${activePatient.mrn})`,
      `File: ${selectedFile?.name ?? 'Prescription'}`,
      `Prescriber: ${prescriberName || 'Not specified'}`,
      `Clinic: ${clinicName || 'Not specified'}`,
      `Prescription Date: ${prescriptionDate || 'Not specified'}`,
      `Extraction Source: ${extractionSource}`,
      '',
      'MEDICATIONS:',
      ...items.map(
        (it, i) =>
          `${i + 1}. ${it.medicineName} ${it.strength} | Dose: ${it.doseAndRoute} | Frequency: ${it.frequency} (${it.scheduledTimes.join(', ')}) | Duration: ${it.durationDays ?? 30} days | Qty: ${it.quantity ?? 'N/A'}\n   Instructions: ${it.instructions}`,
      ),
      '',
      'Disclaimer: Verify all medication schedules against your original signed prescription or pharmacist label.',
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MedTwin_Prescription_Report_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
                  { id: 'upload', label: '1. Upload / Camera' },
                  { id: 'preview', label: '2. Preview & Extract' },
                  { id: 'review', label: '3. Verify Fields' },
                  { id: 'confirmed', label: '4. Added to Schedule' },
                ] as const
              ).map((s, idx) => (
                <React.Fragment key={s.id}>
                  <span
                    className={cn(
                      'px-2.5 py-1 rounded-lg',
                      step === s.id
                        ? 'bg-[#8B5CF6] text-white font-semibold shadow-[0_0_12px_rgba(139,92,246,0.28)]'
                        : 'text-[#A8B8CC] bg-[#223451] border border-[#334155]',
                    )}
                  >
                    {s.label}
                  </span>
                  {idx < 3 && <span className="text-[#334155]">/</span>}
                </React.Fragment>
              ))}
            </div>

            {isDemoMode && !isRealAccountMode && (
              <Button type="button" variant="outline" size="sm" onClick={handleLoadSamplePrescription}>
                Load sample prescription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Upload / Camera / PDF */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Scan or upload a prescription for {activePatient.name}</CardTitle>
            <CardDescription>
              Upload a prescription image (JPG, PNG, WebP), take a photo with your camera, or upload a PDF up to 10 MB.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#334155] bg-[#223451]/60 px-6 py-12 text-center">
              <Upload className="h-9 w-9 text-[#8B5CF6]" />
              <p className="mt-3 text-sm font-semibold text-[#F8FAFC]">
                Upload image, take a photo, or choose a PDF
              </p>
              <p className="mt-1 text-xs text-[#A8B8CC]">
                Gemini AI extracts medication fields and highlights unclear text for your verification before saving.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0])}
              />
              <input
                ref={cameraFileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0])}
              />
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Button type="button" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  <span>Upload Image / PDF</span>
                </Button>
                <Button type="button" variant="secondary" onClick={openCameraCapture}>
                  <Camera className="h-4 w-4" />
                  <span>Use Camera</span>
                </Button>
                {isDemoMode && !isRealAccountMode && (
                  <Button type="button" variant="outline" onClick={handleLoadSamplePrescription}>
                    <FileText className="h-4 w-4" />
                    <span>Load Sample Rx</span>
                  </Button>
                )}
              </div>
            </div>

            {validationError && (
              <div className="flex items-center gap-2 rounded-xl border border-[#FB7185]/35 bg-[#FB7185]/10 p-3 text-xs text-[#FB7185]">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2 & 3: Preview + Editable Verification */}
      {(step === 'preview' || step === 'review') && selectedFile && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle>Prescription Preview</CardTitle>
              <CardDescription className="truncate">{selectedFile.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedFile.mimeType === 'application/pdf' ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-[#334155] bg-[#223451] p-10 text-center">
                  <FileText className="h-10 w-10 text-[#8B5CF6]" />
                  <p className="mt-2 text-sm font-medium text-[#F8FAFC]">{selectedFile.name}</p>
                  <p className="text-xs text-[#A8B8CC]">PDF ready for AI extraction</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-[#334155] bg-[#0B1220]">
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
                        <span>Extracting with AI...</span>
                      </>
                    ) : (
                      <span>Extract prescription fields</span>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle>
                {step === 'preview' ? 'AI OCR Extraction' : 'Verify & Edit Extracted Fields'}
              </CardTitle>
              <CardDescription>
                {extractionSource === 'live-ai'
                  ? 'AI extraction complete. Please verify medicine name, dosage, frequency, duration, and instructions before saving.'
                  : 'Run AI extraction or verify fields carefully before adding to your schedule.'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {step === 'preview' && (
                <div className="space-y-4">
                  {extractError ? (
                    <div className="rounded-xl border border-[#FBBF24]/35 bg-[#FBBF24]/10 p-4 text-xs text-[#FBBF24] space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FBBF24]" />
                        <div>
                          <p className="font-semibold">Extraction issue</p>
                          <p className="mt-0.5 text-[#F8FAFC]">{extractError}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button type="button" size="sm" variant="outline" onClick={runExtraction}>
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Retry extraction</span>
                        </Button>
                        {selectedFile.isSampleDemo ? (
                          <Button type="button" size="sm" variant="amber" onClick={populateSimulatedSampleFields}>
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
                  ) : (
                    <div className="rounded-xl border border-[#334155] bg-[#223451] p-5 space-y-3">
                      <p className="text-sm text-[#F8FAFC]">
                        Click <strong>Extract prescription fields</strong> to read medicine names, dosages, frequencies, durations, and instructions.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setExtractionSource('manual');
                          setItems([]);
                          addBlankMedication();
                          setStep('review');
                        }}
                      >
                        Enter fields manually instead
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {step === 'review' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-medium text-[#A8B8CC] mb-1">
                        Prescriber
                      </label>
                      <Input
                        value={prescriberName}
                        onChange={(e) => setPrescriberName(e.target.value)}
                        placeholder="e.g., Dr. Priya Nair"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#A8B8CC] mb-1">
                        Clinic / Hospital
                      </label>
                      <Input
                        value={clinicName}
                        onChange={(e) => setClinicName(e.target.value)}
                        placeholder="Clinic name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#A8B8CC] mb-1">
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
                      <h4 className="text-sm font-semibold text-[#F8FAFC]">Extracted medications ({items.length})</h4>
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
                              ? 'border-[#FBBF24]/40 bg-[#FBBF24]/10'
                              : 'border-[#334155] bg-[#223451]',
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#F8FAFC]">Medication #{idx + 1}</span>
                            <div className="flex items-center gap-3">
                              {hasUnclear && (
                                <span className="text-xs font-medium text-[#FBBF24]">
                                  Needs review: {item.unclearFields.join(', ') || 'missing field'}
                                </span>
                              )}
                              {items.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
                                  aria-label="Remove medication row"
                                  className="text-[#A8B8CC] hover:text-[#FB7185] cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="block text-xs font-medium text-[#A8B8CC] mb-1">
                                Medicine name *
                              </label>
                              <Input
                                value={item.medicineName}
                                onChange={(e) => updateItemField(item.id, 'medicineName', e.target.value)}
                                placeholder="Required"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#A8B8CC] mb-1">
                                Dosage / strength
                              </label>
                              <Input
                                value={item.strength}
                                onChange={(e) => updateItemField(item.id, 'strength', e.target.value)}
                                placeholder="e.g., 500 mg"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#A8B8CC] mb-1">
                                Dose &amp; route *
                              </label>
                              <Input
                                value={item.doseAndRoute}
                                onChange={(e) => updateItemField(item.id, 'doseAndRoute', e.target.value)}
                                placeholder="e.g., 1 tablet oral"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#A8B8CC] mb-1">
                                Frequency
                              </label>
                              <Input
                                value={item.frequency}
                                onChange={(e) => updateItemField(item.id, 'frequency', e.target.value)}
                                placeholder="e.g., Twice daily with meals"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#A8B8CC] mb-1">
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
                              <label className="block text-xs font-medium text-[#A8B8CC] mb-1">
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
                            <label className="block text-xs font-medium text-[#A8B8CC] mb-1">
                              Instructions *
                            </label>
                            <Input
                              value={item.instructions}
                              onChange={(e) => updateItemField(item.id, 'instructions', e.target.value)}
                              placeholder="Confirmed instructions from prescription"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-xl border border-[#334155] bg-[#223451] p-4 space-y-3">
                    <label className="flex items-start gap-2.5 text-xs text-[#F8FAFC] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmChecked}
                        onChange={(e) => setConfirmChecked(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-[#8B5CF6]"
                      />
                      <span>
                        I have verified every medicine name, dosage, frequency, duration, and instruction against the original prescription for <strong>{activePatient.name}</strong>.
                      </span>
                    </label>

                    <div className="flex flex-wrap justify-end gap-2">
                      <Button type="button" variant="outline" onClick={handleDownloadReport}>
                        <Download className="h-4 w-4" />
                        <span>Download Report</span>
                      </Button>
                      <Button
                        type="button"
                        onClick={handleConfirmSchedule}
                        disabled={hasInvalidRequiredFields || !confirmChecked}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Add to Schedule</span>
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
            <CheckCircle2 className="mx-auto h-11 w-11 text-[#34D399]" />
            <div>
              <h3 className="font-display text-xl font-bold text-[#F8FAFC]">Added to Medication Schedule</h3>
              <p className="mt-1 text-sm text-[#A8B8CC]">
                Activated {items.length} medicine(s) for {activePatient.name} and logged to Care History.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button type="button" onClick={() => navigate('/medications')}>
                View Active Medications
              </Button>
              <Button type="button" variant="outline" onClick={handleDownloadReport}>
                <Download className="h-4 w-4" />
                <span>Download Report</span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setStep('upload');
                  setSelectedFile(null);
                  setItems([]);
                }}
              >
                Scan Another Prescription
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prescription Archive */}
      <Card>
        <CardHeader>
          <CardTitle>Prescription Archive</CardTitle>
          <CardDescription>Confirmed prescriptions saved for {activePatient.name}</CardDescription>
        </CardHeader>
        <CardContent>
          {patientPrescriptions.length === 0 ? (
            <p className="text-sm text-[#A8B8CC]">
              No prescriptions recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-[#334155]">
              {patientPrescriptions.map((rx) => (
                <div
                  key={rx.id}
                  className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#F8FAFC]">
                      {rx.fileName} · {rx.items.map((i) => `${i.medicineName} ${i.strength}`).join(', ')}
                    </p>
                    <p className="text-xs text-[#A8B8CC]">
                      Prescriber: {rx.prescriberName ?? 'Unspecified'} · Source: {rx.extractionSource}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-[#A8B8CC] tabular-nums">
                    {formatTimestamp(rx.confirmedAt ?? rx.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Camera Capture Dialog */}
      <Dialog
        open={cameraModalOpen}
        onOpenChange={(open) => {
          if (!open) stopCameraStream();
          setCameraModalOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Capture Prescription Photo</DialogTitle>
            <DialogDescription>
              Position the prescription clearly inside the frame and click Capture Photo.
            </DialogDescription>
          </DialogHeader>
          {cameraError ? (
            <div className="space-y-3">
              <p className="text-xs text-[#FBBF24]">{cameraError}</p>
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  setCameraModalOpen(false);
                  cameraFileInputRef.current?.click();
                }}
              >
                Choose Photo / Camera File
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-xl border border-[#334155] bg-black"
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    stopCameraStream();
                    setCameraModalOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={capturePhotoFromVideo}>
                  <Camera className="h-4 w-4" />
                  <span>Capture Photo</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
