/**
 * types/org.ts
 *
 * TypeScript shapes for organisation profile.
 */

export interface OrgProfile {
  id: string;
  name: string;
  tagline?: string | null;
  slug: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  website?: string | null;
  registrationNumber?: string | null;
  logoUrl?: string | null;
  themeConfig?: string | null;
  isActive: 0 | 1;
  dpaVersion?: string | null;
  dpaAcceptedAt?: number | null;
  dpaAcceptedBy?: string | null;
  dataRetentionYears?: number | null;
  createdAt: number;
  updatedAt: number;
}
