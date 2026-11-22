import { RelationshipLabel, WorkspaceRole } from '@/src/types/medtwin';

export type VerificationStatus =
  | 'unverified'
  | 'pending_verification'
  | 'verified'
  | 'rejected';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: WorkspaceRole;
  verificationStatus: VerificationStatus;
  emailVerified: boolean;
  dateOfBirth?: string;
  phone?: string;
  preferredLanguage: 'en' | 'hi' | 'pa';
  country?: string;
  relationship?: RelationshipLabel;
  licenseNumber?: string;
  specialty?: string;
  affiliation?: string;
  jurisdiction?: string;
  contactInfo?: string;
  hospitalName?: string;
  hospitalAddress?: string;
  adminName?: string;
  registrationDetails?: string;
  hospitalId?: string;
  linkedPatientId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterPayload {
  role: WorkspaceRole;
  fullName: string;
  email: string;
  password: string;
  confirmPassword?: string;
  dateOfBirth?: string;
  phone?: string;
  preferredLanguage?: 'en' | 'hi' | 'pa';
  country?: string;
  consentAccepted?: boolean;
  relationship?: RelationshipLabel;
  licenseNumber?: string;
  specialty?: string;
  affiliation?: string;
  jurisdiction?: string;
  contactInfo?: string;
  hospitalName?: string;
  hospitalAddress?: string;
  address?: string;
  adminName?: string;
  registrationDetails?: string;
}

export interface DoctorAuthorizationRecord {
  id: string;
  patientId: string;
  patientName: string;
  doctorUserId: string;
  doctorName: string;
  doctorSpecialty?: string;
  status: 'pending' | 'authorized' | 'revoked';
  updatedAt: string;
}

export interface DirectoryEntry {
  id: string;
  fullName: string;
  email: string;
  role: WorkspaceRole;
  verificationStatus: VerificationStatus;
  specialty?: string;
  affiliation?: string;
  hospitalName?: string;
}
