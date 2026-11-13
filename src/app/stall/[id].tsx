import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BlueHeader, Button, Card, ChoiceList, ErrorText, Loading, TextField } from '@/components/ui';
import { Colors, ContentMaxWidth, Spacing } from '@/constants/theme';
import { formatDate, parseDayMonthYear, dateOrderWords, dateExample, dateHint } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

export default function StallScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { business, isManager } = useBusiness();
  const bid = business!.id;

  const { data, error, loading, refreshing, reload } = useScreenData(async () => {
    const [stall, here, horses, taken] = await Promise.all([
      supabase.from('stalls').select('id, name, kind, capacity').eq('id', id).single(),
      supabase
        .from('stall_assignments')
        .select('horse_id, started_on, expected_end_on, horses(id, name, stock_number)')
        .eq('stall_id', id)
        .is('ended_on', null)
        .order('started_on'),
      supabase.from('horses').select('id, name, stock_number').eq('business_id', bid).is('archived_at', null).order('name'),
      supabase.from('stall_assignments').select('horse_id').eq('business_id', bid).is('ended_on', null),
    ]);

    const takenIds = new Set(must(taken).map((t) => t.horse_id));
    return {
      stall: must(stall),
      occupants: must(here).map((a) => ({
        horseId: a.horse_id,
        since: a.started_on,
        leaving: a.expected_end_on,
        name: (a.horses as { name: string } | null)?.name ?? 'Horse',
        stock: (a.horses as { stock_number: string | null } | null)?.stock_number ?? null,
      })),
      available: must(horses).filter((h) => !takenIds.has(h.id)),
    };
  }, [bid, id]);

  const [pick, setPick] = useState<string | null>(null);
  const [leaving, setLeaving] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading && !data) return <Loading />;
  if (!data) {
    return (
      <>
        <BlueHeader title="Stall" showBack />
        <ErrorText message={error ?? 'This stall could not be found.'} />
      </>
    );
  }

  const { stall, occupants, available } = data;
  const isCamp = stall.kind === 'camp';
  const full = occupants.length >= stall.capacity;

  const putInStall = async () => {
    setActionError(null);
    if (!pick) return setActionError('Choose a horse first.');
    let day: string | null = null;
    if (leaving.trim()) {
      day = parseDayMonthYear(leaving);
      if (!day) return setActionError(`Enter the leaving date as ${dateOrderWords()}, for example ${dateExample()}.`);
    }
    setBusy(true);
    const { error: e } = await supabase.rpc('assign_horse_to_stall', { horse: pick, stall: stall.id, expected_end: day ?? undefined });
    if (e) {
      setActionError(e.message);
    } else {
      setPick(null);
      setLeaving('');
      await reload();
    }
    setBusy(false);
  };

  const openHorse = (horseId: string) =>
    isManager
      ? router.push({ pathname: '/assign/[horseId]', params: { horseId } })
      : router.push({ pathname: '/horse/[id]', params: { id: horseId } });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlueHeader
        title={stall.name}
        subtitle={isCamp ? `Camp · ${occupants.length} here` : full ? 'Occupied' : 'Free'}
        showBack
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={Colors.link} />}>
        <ErrorText message={error ?? actionError} />

        <Card gold>
          <AppText variant="heading" accessibilityRole="header">
            {isCamp ? `In the ${stall.name.toLowerCase()} (${occupants.length} of ${stall.capacity})` : 'In this stall'}
          </AppText>
          {occupants.length === 0 ? <AppText muted>Empty.</AppText> : null}
          {occupants.map((o, i) => (
            <Pressable
              key={o.horseId}
              accessibilityRole="button"
              accessibilityLabel={`${o.name}${isManager ? '. Change stall' : ''}`}
              onPress={() => openHorse(o.horseId)}
              style={[styles.row, i < occupants.length - 1 && styles.divider]}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyStrong">{o.name}</AppText>
                <AppText variant="small">
                  {[o.stock, `since ${formatDate(o.since)}`, o.leaving ? `leaving ${formatDate(o.leaving)}` : null].filter(Boolean).join(' · ')}
                </AppText>
              </View>
              {isManager ? (
                <AppText variant="small" color={Colors.link}>
                  Change
                </AppText>
              ) : null}
            </Pressable>
          ))}
        </Card>

        {isManager ? (
          full ? (
            <Card>
              <AppText muted>This stall is full. To put another horse in, move or take out the horse that is here (tap it above).</AppText>
            </Card>
          ) : (
            <Card>
              <AppText variant="heading" accessibilityRole="header">
                Put a horse in {stall.name}
              </AppText>
              {available.length === 0 ? (
                <AppText muted>Every horse already has a stall. To move one, tap it in the stall it is in.</AppText>
              ) : (
                <>
                  <ChoiceList
                    label="Which horse?"
                    options={available.map((h) => ({ value: h.id, label: h.name, note: h.stock_number ?? undefined }))}
                    value={pick}
                    onChange={setPick}
                  />
                  {!isCamp ? (
                    <TextField
                      label="Expected to leave on (optional)"
                      value={leaving}
                      onChangeText={setLeaving}
                      keyboardType="numbers-and-punctuation"
                      placeholder={dateHint()}
                      hint="Shows on the stall board so you know when it frees up."
                    />
                  ) : null}
                  <Button title={`Put in ${stall.name}`} onPress={putInStall} loading={busy} disabled={!pick} />
                </>
              )}
            </Card>
          )
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10, minHeight: 56 },
  divider: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
});
