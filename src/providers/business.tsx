import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { localeForCountry } from '@/lib/countries';
import { setFormatLocale } from '@/lib/format';
import { supabase, type MemberRole, type Tables } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';

export type Feature = 'breeding' | 'training' | 'trading' | 'health_reminders' | 'task_board' | 'owner_updates';

type BusinessState = {
  /** The business this person is working in, or null before setup. */
  business: Tables<'businesses'> | null;
  role: MemberRole | null;
  features: Record<Feature, boolean>;
  logoUrl: string | null;
  loading: boolean;
  /** Set when the business could not be loaded (for example no connection). Not the same as "no business yet". */
  error: string | null;
  isManager: boolean;
  refresh: () => Promise<void>;
};

type Loaded = {
  forUser: string;
  business: Tables<'businesses'> | null;
  role: MemberRole | null;
  features: Record<Feature, boolean>;
  logoUrl: string | null;
};

const NO_FEATURES: Record<Feature, boolean> = {
  breeding: false,
  training: false,
  trading: false,
  health_reminders: false,
  task_board: false,
  owner_updates: false,
};

const BusinessContext = createContext<BusinessState | null>(null);

async function loadFor(userId: string): Promise<Loaded> {
  // Version 1: a person works in one business. The oldest active membership wins.
  // Any failed request throws. A failure must never look like "no business yet",
  // or the person is sent to the setup screen.
  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select('role, business_id')
    .eq('user_id', userId)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipError) throw new Error(membershipError.message);

  if (!membership) {
    return { forUser: userId, business: null, role: null, features: NO_FEATURES, logoUrl: null };
  }

  const [{ data: biz, error: bizError }, { data: featureRows, error: featureError }] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', membership.business_id).single(),
    supabase.from('business_features').select('feature, enabled').eq('business_id', membership.business_id),
  ]);
  if (bizError || !biz) throw new Error(bizError?.message ?? 'The business could not be loaded.');
  if (featureError) throw new Error(featureError.message);

  const features = { ...NO_FEATURES };
  for (const row of featureRows ?? []) {
    features[row.feature as Feature] = row.enabled;
  }

  let logoUrl: string | null = null;
  if (biz.logo_path) {
    const { data: signed } = await supabase.storage.from('business-assets').createSignedUrl(biz.logo_path, 60 * 60 * 24);
    logoUrl = signed?.signedUrl ?? null;
  }

  return { forUser: userId, business: biz, role: membership.role, features, logoUrl };
}

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<{ forUser: string; message: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const next = await loadFor(userId);
      setLoaded(next);
      setFailed(null);
    } catch (e) {
      // Keep whatever was loaded before; only report the failure.
      setFailed({ forUser: userId, message: e instanceof Error ? e.message : 'The business could not be loaded.' });
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadFor(userId)
      .then((next) => {
        if (cancelled) return;
        setLoaded(next);
        setFailed(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setFailed({ forUser: userId, message: e instanceof Error ? e.message : 'The business could not be loaded.' });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Only trust data loaded for the person signed in right now.
  const current = userId && loaded?.forUser === userId ? loaded : null;
  // A failure only blocks the app when there is nothing loaded to fall back on.
  const error = userId && !current && failed?.forUser === userId ? failed.message : null;
  const role = current?.role ?? null;

  // Money and dates follow the business's country (US: $1,250.00 and mm/dd/yyyy).
  const business = current?.business ?? null;
  setFormatLocale(localeForCountry(business?.country_code) ?? business?.locale);

  return (
    <BusinessContext.Provider
      value={{
        business: current?.business ?? null,
        role,
        features: current?.features ?? NO_FEATURES,
        logoUrl: current?.logoUrl ?? null,
        loading: !!userId && !current && !error,
        error,
        isManager: role === 'manager',
        refresh,
      }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness(): BusinessState {
  const value = useContext(BusinessContext);
  if (!value) throw new Error('useBusiness must be used inside BusinessProvider');
  return value;
}
