export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganisationUser {
  id: string;
  userId: string;
  organisationId: string;
  role: string;
  permissions: string[];
  isDefault: boolean;
  joinedAt: Date;
}

export interface AuthPayload {
  userId: string;
  email: string;
  organisationId: string;
  role: string;
  permissions: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
  organisationId?: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
  organisation: { id: string; name: string; type: string };
}
