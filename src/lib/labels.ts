import type { HorsePurpose, HorseSex, MemberRole } from '@/lib/supabase';

export const PURPOSE_LABELS: Record<HorsePurpose, string> = {
  broodstock: 'Broodstock',
  trading: 'Trading',
  training: 'Training',
};

export const SEX_LABELS: Record<HorseSex, string> = {
  mare: 'Mare',
  stallion: 'Stallion',
  gelding: 'Gelding',
  colt: 'Colt',
  filly: 'Filly',
  rig: 'Rig',
};

export const ROLE_LABELS: Record<MemberRole, string> = {
  manager: 'Manager',
  trainer: 'Trainer',
  groom: 'Groom',
  casual: 'Casual',
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  part_paid: 'Part paid',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

export function ageFrom(dateOfBirth: string | null): string | null {
  if (!dateOfBirth) return null;
  const born = new Date(`${dateOfBirth}T00:00:00`);
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const beforeBirthday =
    now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  if (beforeBirthday) years -= 1;
  return years < 1 ? 'under 1 yr' : `${years} yrs`;
}
