import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '@/src/components/ui/toast';
import { ThemeProvider } from '@/src/context/ThemeContext';
import { AuthProvider, DEFAULT_ROUTE_FOR_ROLE, useAuth } from '@/src/context/AuthContext';
import { MedTwinProvider, useMedTwin } from '@/src/context/MedTwinContext';
import { WorkspaceRole } from '@/src/types/medtwin';
import { AppShell } from '@/src/components/layout/AppShell';
import { LandingPage } from '@/src/modules/landing/LandingPage';
import { RoleSelectionPage } from '@/src/modules/auth/RoleSelectionPage';
import { RegisterPage } from '@/src/modules/auth/RegisterPage';
import { LoginPage } from '@/src/modules/auth/LoginPage';
import { ForgotPasswordPage } from '@/src/modules/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/src/modules/auth/ResetPasswordPage';
import { ProfilePage } from '@/src/modules/auth/ProfilePage';
import { PatientDashboardPage } from '@/src/modules/patient/PatientDashboardPage';
import { DadiNaniModePage } from '@/src/modules/patient/DadiNaniModePage';
import { PrescriptionScannerPage } from '@/src/modules/prescriptions/PrescriptionScannerPage';
import { MedicationsPage } from '@/src/modules/medications/MedicationsPage';
import { RefillsPage } from '@/src/modules/medications/RefillsPage';
import { CareHistoryPage } from '@/src/modules/medications/CareHistoryPage';
import { DigitalTwinPage } from '@/src/modules/digital-twin/DigitalTwinPage';
import { CaregiverHubPage } from '@/src/modules/caregivers/CaregiverHubPage';
import { CareCirclePage } from '@/src/modules/caregivers/CareCirclePage';
import { DoctorDashboardPage } from '@/src/modules/doctor/DoctorDashboardPage';
import { HospitalDashboardPage } from '@/src/modules/hospital/HospitalDashboardPage';
import { HospitalTeamsPage } from '@/src/modules/hospital/HospitalTeamsPage';
import { SettingsPage } from '@/src/modules/settings/SettingsPage';
import { MedTwinLogo } from '@/src/components/shared/MedTwinLogo';

function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles?: WorkspaceRole[];
  children: React.ReactNode;
}) {
  const { user, isLoading, isAuthenticated, isDemoMode } = useAuth();
  const { activeRole } = useMedTwin();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#FAF8F5] text-[#20243A] dark:bg-[#101322] dark:text-[#F7F5F0]">
        <MedTwinLogo />
        <p className="text-sm text-[#5C627D] dark:text-[#A3A9C2]">Loading your workspace...</p>
      </div>
    );
  }

  if (!isAuthenticated && !isDemoMode) {
    return <Navigate to="/login" replace />;
  }

  const effectiveRole: WorkspaceRole = isAuthenticated && user ? user.role : activeRole;

  if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
    return <Navigate to={DEFAULT_ROUTE_FOR_ROLE[effectiveRole]} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public marketing & authentication routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/get-started" element={<RoleSelectionPage />} />
      <Route path="/register" element={<Navigate to="/get-started" replace />} />
      <Route path="/register/:role" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Patient & shared role-protected workspace routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <AppShell title="Patient Dashboard" subtitle="Daily schedule, adherence, and care circle overview">
              <PatientDashboardPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/prescriptions"
        element={
          <ProtectedRoute allowedRoles={['patient', 'doctor']}>
            <AppShell title="Prescription Scanner" subtitle="Upload, review extracted fields, and confirm schedules">
              <PrescriptionScannerPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/medications"
        element={
          <ProtectedRoute allowedRoles={['patient', 'caregiver']}>
            <AppShell title="Medications & Schedule" subtitle="Daily, weekly, and monthly dose confirmations">
              <MedicationsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/refills"
        element={
          <ProtectedRoute allowedRoles={['patient', 'caregiver']}>
            <AppShell title="Refills & Supply" subtitle="Smart refill countdowns and supply readiness">
              <RefillsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/digital-twin"
        element={
          <ProtectedRoute allowedRoles={['patient', 'doctor']}>
            <AppShell title="Your Medication Digital Twin" subtitle="Baseline vs scenario simulation for supply & adherence">
              <DigitalTwinPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute allowedRoles={['patient', 'caregiver']}>
            <AppShell title="Care History" subtitle="Searchable medication, refill, alert, and note timeline">
              <CareHistoryPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/caregivers"
        element={
          <ProtectedRoute allowedRoles={['patient', 'caregiver']}>
            <AppShell title="Care Circle" subtitle="Consent-based family, caregiver & clinician access">
              <CareCirclePage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/caregiver"
        element={
          <ProtectedRoute allowedRoles={['caregiver']}>
            <AppShell title="Caregiver Hub" subtitle="Connected patient schedules, requests & alert acknowledgements">
              <CaregiverHubPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dadi-nani"
        element={
          <ProtectedRoute allowedRoles={['patient', 'caregiver']}>
            <AppShell title="Dadi-Nani Mode" subtitle="Voice-first elder medicine helper & simple family sharing">
              <DadiNaniModePage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor"
        element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <AppShell title="Doctor Workspace" subtitle="Authorized patient monitoring, adherence & clinical review">
              <DoctorDashboardPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/hospital"
        element={
          <ProtectedRoute allowedRoles={['hospital_admin']}>
            <AppShell title="Hospital Operations" subtitle="Organization overview, workload, and patient coordination">
              <HospitalDashboardPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/hospital/teams"
        element={
          <ProtectedRoute allowedRoles={['hospital_admin']}>
            <AppShell title="Care Teams & Access" subtitle="Staff roles and organization boundary management">
              <HospitalTeamsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute allowedRoles={['patient', 'caregiver', 'doctor', 'hospital_admin']}>
            <AppShell title="Profile & Access" subtitle="Identity, verification status & authorized care connections">
              <ProfilePage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute allowedRoles={['patient', 'caregiver', 'doctor', 'hospital_admin']}>
            <AppShell title="Settings" subtitle="Appearance theme, language & accessibility preferences">
              <SettingsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <MedTwinProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </MedTwinProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
