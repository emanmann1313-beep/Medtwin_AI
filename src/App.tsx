import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '@/src/components/ui/toast';
import { MedTwinProvider } from '@/src/context/MedTwinContext';
import { AppShell } from '@/src/components/layout/AppShell';
import { PatientDashboardPage } from '@/src/modules/patient/PatientDashboardPage';
import { DadiNaniModePage } from '@/src/modules/patient/DadiNaniModePage';
import { PrescriptionScannerPage } from '@/src/modules/prescriptions/PrescriptionScannerPage';
import { MedicationsPage } from '@/src/modules/medications/MedicationsPage';
import { CareHistoryPage } from '@/src/modules/medications/CareHistoryPage';
import { DigitalTwinPage } from '@/src/modules/digital-twin/DigitalTwinPage';
import { CaregiverHubPage } from '@/src/modules/caregivers/CaregiverHubPage';
import { CareCirclePage } from '@/src/modules/caregivers/CareCirclePage';
import { DoctorDashboardPage } from '@/src/modules/doctor/DoctorDashboardPage';
import { HospitalDashboardPage } from '@/src/modules/hospital/HospitalDashboardPage';
import { HospitalTeamsPage } from '@/src/modules/hospital/HospitalTeamsPage';

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppShell title="Patient Dashboard" subtitle="Daily schedule, adherence, and care circle overview">
            <PatientDashboardPage />
          </AppShell>
        }
      />
      <Route
        path="/prescriptions"
        element={
          <AppShell title="Prescription Scanner" subtitle="Upload, review extracted fields, and confirm schedules">
            <PrescriptionScannerPage />
          </AppShell>
        }
      />
      <Route
        path="/medications"
        element={
          <AppShell title="Medications & Schedule" subtitle="Daily, weekly, and monthly dose confirmations">
            <MedicationsPage />
          </AppShell>
        }
      />
      <Route
        path="/digital-twin"
        element={
          <AppShell title="Medication Digital Twin" subtitle="Baseline vs scenario simulation for supply & adherence">
            <DigitalTwinPage />
          </AppShell>
        }
      />
      <Route
        path="/history"
        element={
          <AppShell title="Care History" subtitle="Searchable medication, refill, alert, and note timeline">
            <CareHistoryPage />
          </AppShell>
        }
      />
      <Route
        path="/caregivers"
        element={
          <AppShell title="Care Circle" subtitle="Consent-based family & caregiver permissions">
            <CareCirclePage />
          </AppShell>
        }
      />
      <Route
        path="/caregiver"
        element={
          <AppShell title="Caregiver Hub" subtitle="Permitted patient schedules & simulated alert acknowledgements">
            <CaregiverHubPage />
          </AppShell>
        }
      />
      <Route
        path="/dadi-nani"
        element={
          <AppShell title="Dadi-Nani Mode" subtitle="Simple elder-friendly medicine view & problem sharing">
            <DadiNaniModePage />
          </AppShell>
        }
      />
      <Route
        path="/doctor"
        element={
          <AppShell title="Doctor Workspace" subtitle="Multi-patient monitoring, clinical review & visit summaries">
            <DoctorDashboardPage />
          </AppShell>
        }
      />
      <Route
        path="/hospital"
        element={
          <AppShell title="Hospital Operations" subtitle="Organization overview, workload, and patient assignment">
            <HospitalDashboardPage />
          </AppShell>
        }
      />
      <Route
        path="/hospital/teams"
        element={
          <AppShell title="Care Teams & Access" subtitle="Staff roles and organization boundary management">
            <HospitalTeamsPage />
          </AppShell>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MedTwinProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </MedTwinProvider>
    </ToastProvider>
  );
}
