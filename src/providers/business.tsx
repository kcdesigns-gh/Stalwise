import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

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
  const { data: membership } = await supabase
    .from('memberships')
    .select('role, business_id')
    .eq('user_id', userId)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return { forUser: userId, business: null, role: null, features: NO_FEATURES, logoUrl: null };
  }

  const [{ data: biz }, { data: featureRows }] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', membership.business_id).single(),
    supabase.from('business_features').select('feature, enabled').eq('business_id', membership.business_id),
  ]);

  const features = { ...NO_FEATURES };
  for (const row of featureRows ?? []) {
    features[row.feature as Feature] = row.enabled;
  }

  let logoUrl: string | null = null;
  if (biz?.logo_path) {
    const { data: signed } = await supabase.storage.from('business-assets').createSignedUrl(biz.logo_path, 60 * 60 * 24);
    logoUrl = signed?.signedUrl ?? null;
  }

  return { forUser: userId, business: biz ?? null, role: membership.role, features, logoUrl };
}

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const next = await loadFor(userId);
    setLoaded(next);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadFor(userId).then((next) => {
      if (!cancelled) setLoaded(next);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Only trust data loaded for the person signed in right now.
  const current = userId && loaded?.forUser === userId ? loaded : null;
  const role = current?.role ?? null;

  return (
    <BusinessContext.Provider
      value={{
        business: current?.business ?? null,
        role,
        features: current?.features ?? NO_FEATURES,
        logoUrl: current?.logoUrl ?? null,
        loading: !!userId && !current,
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
