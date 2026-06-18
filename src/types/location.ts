/**
 * types/location.ts — TypeScript shapes for locations (branches).
 */

export interface Location {
  id: string;
  organizationId: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  gstin?: string | null;
  timezone: string;
  isActive: number;
  isDefault: number;
  createdAt: number;
  updatedAt: number;
  /** Joined from location_settings */
  settings?: LocationSettings | null;
  /** Count of staff assigned here (joined) */
  staffCount?: number;
}

export interface LocationSettings {
  locationId: string;
  openingTime: string;   // "HH:MM"
  closingTime: string;   // "HH:MM"
  slotDurationMinutes: number;
  maxAdvanceBookingDays: number;
  updatedAt: number;
}

export interface CreateLocationPayload {
  name: string;
  address?: string;
  phone?: string;
  gstin?: string;
  timezone?: string;
  openingTime?: string;
  closingTime?: string;
  slotDurationMinutes?: number;
  maxAdvanceBookingDays?: number;
}

export interface UpdateLocationPayload {
  name?: string;
  address?: string | null;
  phone?: string | null;
  gstin?: string | null;
  timezone?: string;
  isActive?: number;
  openingTime?: string;
  closingTime?: string;
  slotDurationMinutes?: number;
  maxAdvanceBookingDays?: number;
}

export interface StaffLocationAssignment {
  id: string;
  userId: string;
  organizationId: string;
  locationId: string;
  isPrimary: number;
  createdAt: number;
  /** Joined */
  userName?: string | null;
  locationName?: string | null;
}
