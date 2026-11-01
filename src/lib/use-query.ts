import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/**
 * Runs a loader when the screen comes into focus (and on pull-to-refresh),
 * keeping the last good data while it reloads. Errors become plain messages.
 * `deps` are the values the loader depends on, such as the business id.
 */
export function useScreenData<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const key = JSON.stringify(deps);

  // The loader is rebuilt every render; only re-create it when its inputs change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => loader(), [key]);

  const run = useCallback(
    async (asRefresh: boolean) => {
      if (asRefresh) setRefreshing(true);
      try {
        const next = await load();
        setData(next);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load. Check your connection and try again.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [load],
  );

  useFocusEffect(
    useCallback(() => {
      run(false);
    }, [run]),
  );

  return { data, error, loading, refreshing, reload: () => run(true) };
}

/** Throws the Supabase error (or a missing row) so useScreenData can show it. */
export function must<R extends { data: unknown; error: { message: string } | null }>(result: R): NonNullable<R['data']> {
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new Error('Not found.');
  return result.data as NonNullable<R['data']>;
}
