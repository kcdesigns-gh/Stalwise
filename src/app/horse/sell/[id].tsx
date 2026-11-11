import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BlueHeader, Button, Card, ErrorText, Loading, TextField, ToggleRow } from '@/components/ui';
import { Colors, ContentMaxWidth, Fonts, Radius, Spacing } from '@/constants/theme';
import { parseDayMonthYear, parseMoney, toDayMonthYear, todayIso, dateOrderWords } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

const NEW_BUYER = 'new';

export default function SellHorseScreen() {
  const insets = useSafeAreaInsets();
  const { business, isManager } = useBusiness();
  const bid = business!.id;
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, error, loading } = useScreenData(async () => {
    const [horse, owners] = await Promise.all([
      supabase.from('horses').select('id, name, current_owner_id').eq('id', id).single(),
      supabase.from('owners').select('id, name, is_self').eq('business_id', bid).is('archived_at', null).order('name'),
    ]);
    return { horse: must(horse), owners: must(owners) ?? [] };
  }, [id, bid]);

  if (!isManager) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Sell horse" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message="Only the Manager can record a sale." />
        </View>
      </View>
    );
  }
  if (loading && !data) return <Loading />;
  if (!data) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Sell horse" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message={error ?? 'This horse could not be found.'} />
        </View>
      </View>
    );
  }

  const ownedByClient = data.horse.current_owner_id && !data.owners.find((o) => o.id === data.horse.current_owner_id)?.is_self;

  return <SellForm horseId={data.horse.id} horseName={data.horse.name} owners={data.owners} ownedByClient={!!ownedByClient} insetsBottom={insets.bottom} />;
}

function SellForm({
  horseId,
  horseName,
  owners,
  ownedByClient,
  insetsBottom,
}: {
  horseId: string;
  horseName: string;
  owners: { id: string; name: string; is_self: boolean }[];
  ownedByClient: boolean;
  insetsBottom: number;
}) {
  const { business } = useBusiness();
  const currency = business!.currency_code;
  const [soldOn, setSoldOn] = useState(toDayMonthYear(todayIso()));
  const [price, setPrice] = useState('');
  const [buyerId, setBuyerId] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState('');
  const [onBehalf, setOnBehalf] = useState(ownedByClient);
  const [commission, setCommission] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const save = async () => {
    setError(null);
    const date = parseDayMonthYear(soldOn);
    if (!date) return setError(`Enter the sale date as ${dateOrderWords()}.`);
    const amount = parseMoney(price);
    if (amount === null || amount < 0) return setError('Enter the sale price, for example 65000.');
    let commissionPercent: number | null = null;
    if (onBehalf) {
      commissionPercent = parseMoney(commission);
      if (commissionPercent === null || commissionPercent < 0 || commissionPercent > 100) {
        return setError('Enter the commission as a percentage from 0 to 100, for example 10.');
      }
    }
    if (!confirmed) {
      setConfirmed(true);
      return;
    }

    setBusy(true);
    const { error: e } = await supabase.rpc('sell_horse', {
      horse: horseId,
      sold_on: date,
      sale_price: amount,
      buyer_owner_id: (buyerId && buyerId !== NEW_BUYER ? buyerId : null) ?? undefined,
      buyer_name: (buyerId === NEW_BUYER || !buyerId ? buyerName.trim() || null : null) ?? undefined,
      on_behalf_of_client: onBehalf,
      commission_percent: commissionPercent ?? undefined,
      notes: (notes.trim() || null) ?? undefined,
    });
    setBusy(false);
    if (e) {
      setError(e.message);
      setConfirmed(false);
      return;
    }
    router.replace('/horses');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlueHeader title={`Sell ${horseName}`} showBack />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insetsBottom + 32 }]} keyboardShouldPersistTaps="handled">
        <Card gold>
          <AppText variant="small">
            This records the sale, ends {horseName}&rsquo;s stay and stall, and takes it off the active horses list.
          </AppText>
          <TextField label="Sale date" value={soldOn} onChangeText={setSoldOn} keyboardType="numbers-and-punctuation" />
          <TextField label={`Sale price (${currency})`} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="65000" />
        </Card>

        <Card>
          <AppText variant="heading">Buyer (optional)</AppText>
          <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel="Buyer">
            {[{ id: 'none', name: 'Not recorded' }, ...owners, { id: NEW_BUYER, name: '+ Someone not listed' }].map((o) => {
              const selected = (o.id === 'none' && !buyerId) || o.id === buyerId;
              return (
                <Pressable
                  key={o.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setBuyerId(o.id === 'none' ? null : o.id)}
                  style={[styles.chip, selected && styles.chipSelected]}>
                  <AppText style={{ fontFamily: selected ? Fonts.bold : Fonts.semibold }} color={selected ? Colors.gold : Colors.text}>
                    {o.name}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          {buyerId === NEW_BUYER ? <TextField label="Buyer's name" value={buyerName} onChangeText={setBuyerName} autoCapitalize="words" /> : null}
        </Card>

        <Card>
          <ToggleRow
            label="Sold on behalf of a client (commission)"
            value={onBehalf}
            onChange={setOnBehalf}
            last={!onBehalf}
          />
          {onBehalf ? (
            <TextField
              label="Commission (%)"
              value={commission}
              onChangeText={setCommission}
              keyboardType="decimal-pad"
              placeholder="10"
              hint="Only your commission counts as income; the rest goes to the client."
            />
          ) : null}
          <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
        </Card>

        <ErrorText message={error} />
        {confirmed ? (
          <AppText variant="small" color={Colors.danger}>
            Tap again to confirm — this cannot be undone from the app.
          </AppText>
        ) : null}
        <Button title={confirmed ? 'Confirm sale' : 'Record sale'} onPress={save} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  chipSelected: { backgroundColor: Colors.deepBlue, borderColor: Colors.deepBlue },
});
