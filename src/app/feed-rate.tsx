import { useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BlueHeader, Button, Card, DetailRow, ErrorText, Loading, TextField } from '@/components/ui';
import { Colors, ContentMaxWidth, Spacing } from '@/constants/theme';
import { formatDate, formatMoney, parseDayMonthYear, parseMoney, toDayMonthYear, todayIso, dateOrderWords, dateExample } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

export default function FeedRateScreen() {
  const insets = useSafeAreaInsets();
  const { business, isManager } = useBusiness();
  const bid = business!.id;
  const currency = business!.currency_code;

  const { data, error, loading, refreshing, reload } = useScreenData(async () => {
    const [rates, horses] = await Promise.all([
      supabase
        .from('feed_rates')
        .select('id, daily_rate, effective_from')
        .eq('business_id', bid)
        .is('purpose', null)
        .order('effective_from', { ascending: false }),
      supabase.from('horses').select('id', { count: 'exact', head: true }).eq('business_id', bid).is('archived_at', null),
    ]);
    return { rates: must(rates), horseCount: horses.count ?? 0 };
  }, [bid]);

  const [rate, setRate] = useState('');
  const [from, setFrom] = useState(toDayMonthYear(todayIso()));
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!isManager) {
    return (
      <>
        <BlueHeader title="Daily feed rate" showBack />
        <ErrorText message="Only the Manager can set the feed rate." />
      </>
    );
  }
  if (loading && !data) return <Loading />;

  const today = todayIso();
  const current = data?.rates.find((r) => r.effective_from <= today) ?? null;
  const later = data?.rates.filter((r) => r.effective_from > today) ?? [];
  const earlier = data?.rates.filter((r) => r !== current && r.effective_from <= today) ?? [];

  const typed = parseMoney(rate);
  const monthly = typed != null && data ? typed * 30.4 * data.horseCount : null;

  const save = async () => {
    setSaveError(null);
    setSaved(false);
    if (typed === null) return setSaveError('Enter the daily rate as a number, for example 50.');
    const day = parseDayMonthYear(from);
    if (!day) return setSaveError(`Enter the start date as ${dateOrderWords()}, for example ${dateExample()}.`);
    setBusy(true);
    const { error: e } = await supabase.rpc('set_daily_feed_rate', { bid, rate: typed, from_date: day });
    if (e) {
      setSaveError(e.message);
    } else {
      setRate('');
      setSaved(true);
      await reload();
    }
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlueHeader title="Daily feed rate" subtitle="Charged to every horse automatically" showBack />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={Colors.link} />}>
        <ErrorText message={error} />

        <Card gold>
          <AppText variant="label">Current rate</AppText>
          {current ? (
            <>
              <AppText variant="figure">{formatMoney(current.daily_rate, currency)}</AppText>
              <AppText variant="small">per horse per day, from {formatDate(current.effective_from)}</AppText>
            </>
          ) : (
            <AppText muted>No rate yet. Set one below and every horse is charged for feed automatically.</AppText>
          )}
          {later.map((r) => (
            <AppText key={r.id} variant="small">
              Changes to {formatMoney(r.daily_rate, currency)} on {formatDate(r.effective_from)}
            </AppText>
          ))}
        </Card>

        <Card>
          <AppText variant="heading" accessibilityRole="header">
            {current ? 'Change the rate' : 'Set the rate'}
          </AppText>
          <TextField
            label={`Daily feed cost per horse (${currency})`}
            value={rate}
            onChangeText={setRate}
            keyboardType="decimal-pad"
            placeholder={current ? String(Number(current.daily_rate)) : '50'}
            hint="What it costs to feed one horse for one day: hay, lucerne, cubes and everyday feed."
          />
          <TextField
            label="Applies from"
            value={from}
            onChangeText={setFrom}
            keyboardType="numbers-and-punctuation"
            hint={
              current
                ? 'Days before this date keep the rate they had.'
                : 'Horses are charged from this date. Use the day you want feed costs to start counting; earlier days are not charged.'
            }
          />
          {monthly != null ? (
            <AppText variant="bodyStrong" color={Colors.heading} accessibilityLiveRegion="polite">
              About {formatMoney(monthly, currency)} a month for {data!.horseCount} horse{data!.horseCount === 1 ? '' : 's'}
            </AppText>
          ) : null}
          <ErrorText message={saveError} />
          {saved ? <AppText color={Colors.success}>Saved. Every horse’s feed cost is up to date.</AppText> : null}
          <Button title="Save rate" onPress={save} loading={busy} disabled={!rate.trim()} />
        </Card>

        <Card>
          <AppText variant="heading" accessibilityRole="header">
            How it works
          </AppText>
          <AppText>
            Every horse is charged the daily rate for each day it is on the yard, from the day it arrives until the day it leaves. The cost goes straight into each horse’s full cost and profit. There is nothing to log.
          </AppText>
          <AppText variant="small">
            Anything extra, like a supplement or a special feed, is logged on the horse as before.
          </AppText>
        </Card>

        {earlier.length ? (
          <Card>
            <AppText variant="heading" accessibilityRole="header">
              Earlier rates
            </AppText>
            {earlier.map((r, i) => (
              <DetailRow
                key={r.id}
                label={`From ${formatDate(r.effective_from)}`}
                value={formatMoney(r.daily_rate, currency)}
                last={i === earlier.length - 1}
              />
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
});
