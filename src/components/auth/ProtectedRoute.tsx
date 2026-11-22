import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { DEFAULT_ROUTE_FOR_ROLE, useAuth } from '@/src/context/AuthContext';
import { useMedTwin } from '@/src/context/MedTwinContext';
import { WorkspaceRole } from '@/src/types/medtwin';

export function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles?: WorkspaceRole[];
  children: React.ReactNode;
}) {
  const { user, isLoading, isAuthenticated, isDemoMode } = useAuth();
  const { activeRole } = useMedTwin();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] text-[#20243A] dark:bg-[#101322] dark:text-[#F7F5F0]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-[#7956C8] dark:text-[#A58AE8]" />
          <p className="text-sm text-[#5C627D] dark:text-[#A3A9C2]">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !isDemoMode) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Enforce role-based access control: authenticated users cannot jump to another role's URL
  if (isAuthenticated && user && allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={DEFAULT_ROUTE_FOR_ROLE[user.role]} replace />;
  }

  // In demo mode, keep active demo role aligned with allowed routes
  if (!isAuthenticated && isDemoMode && allowedRoles && !allowedRoles.includes(activeRole)) {
    return <Navigate to={DEFAULT_ROUTE_FOR_ROLE[activeRole]} replace />;
  }

  return <>{children}</>;
}
