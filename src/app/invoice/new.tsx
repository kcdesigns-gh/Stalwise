import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BlueHeader, Button, Card, ErrorText, Loading } from '@/components/ui';
import { Colors, ContentMaxWidth, Fonts, Radius, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

export default function NewInvoiceScreen() {
  const insets = useSafeAreaInsets();
  const { business, isManager } = useBusiness();
  const bid = business!.id;

  const { data, error, loading } = useScreenData(
    async () =>
      must(
        await supabase
          .from('owners')
          .select('id, name, is_self')
          .eq('business_id', bid)
          .eq('is_self', false)
          .is('archived_at', null)
          .order('name'),
      ),
    [bid],
  );

  const { owner: presetOwner } = useLocalSearchParams<{ owner?: string }>();
  const [ownerId, setOwnerId] = useState<string | null>(presetOwner ?? null);
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  if (!isManager) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="New invoice" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message="Only the Manager can create invoices." />
        </View>
      </View>
    );
  }
  if (loading && !data) return <Loading />;

  const create = async () => {
    if (!ownerId) return setCreateError('Choose who the invoice is for.');
    setCreateError(null);
    setBusy(true);
    const { data: inv, error: e } = await supabase.from('invoices').insert({ business_id: bid, owner_id: ownerId }).select('id').single();
    setBusy(false);
    if (e || !inv) return setCreateError(e?.message ?? 'Could not create the invoice.');
    router.replace({ pathname: '/invoice/[id]', params: { id: inv.id } });
  };

  return (
    <View style={{ flex: 1 }}>
      <BlueHeader title="New invoice" showBack />
      <View style={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <ErrorText message={error ?? createError} />
        <Card gold>
          <AppText variant="heading">Who is this invoice for?</AppText>
          {!data || data.length === 0 ? (
            <AppText muted>No clients yet. Add one under Owners & clients, or add a horse for a new client.</AppText>
          ) : (
            <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel="Owner">
              {data.map((o) => {
                const selected = o.id === ownerId;
                return (
                  <Pressable
                    key={o.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setOwnerId(o.id)}
                    style={[styles.chip, selected && styles.chipSelected]}>
                    <AppText style={{ fontFamily: selected ? Fonts.bold : Fonts.semibold }} color={selected ? Colors.gold : Colors.text}>
                      {o.name}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          )}
          <Button title="Create draft invoice" onPress={create} loading={busy} disabled={!ownerId} />
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
  list: { gap: Spacing.sm },
  chip: {
    minHeight: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  chipSelected: { backgroundColor: Colors.selected, borderColor: Colors.selectedBorder },
});
