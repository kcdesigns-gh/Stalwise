import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Badge,
  BlueHeader,
  Button,
  Card,
  DetailRow,
  ErrorText,
  Loading,
  LogoMark,
  Segmented,
  TextField,
} from '@/components/ui';
import { Colors, ContentMaxWidth, Radius, Spacing } from '@/constants/theme';
import { formatDate, formatMoney, formatMoneyShort, parseMoney, todayIso } from '@/lib/format';
import { ageFrom, PURPOSE_LABELS, SEX_LABELS } from '@/lib/labels';
import { supabase, type HorsePurpose } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

export default function HorseScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { business, isManager, role, features } = useBusiness();
  const currency = business!.currency_code;
  const seesStalls = role === 'manager' || role === 'trainer';

  const { data, error, loading, refreshing, reload } = useScreenData(async () => {
    const horse = must(await supabase.from('horses').select('*').eq('id', id).single());

    const [history, stall, owner, profit, purchase, costs] = await Promise.all([
      supabase
        .from('horse_purpose_history')
        .select('purpose, started_on, ended_on')
        .eq('horse_id', id)
        .order('started_on', { ascending: false }),
      seesStalls
        ? supabase.from('stall_assignments').select('started_on, expected_end_on, stalls(name)').eq('horse_id', id).is('ended_on', null).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      isManager && horse.current_owner_id
        ? supabase.from('owners').select('name, is_self').eq('id', horse.current_owner_id).single()
        : Promise.resolve({ data: null, error: null }),
      isManager
        ? supabase.from('horse_profitability').select('*').eq('horse_id', id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      isManager
        ? supabase.from('cost_entries').select('amount').eq('horse_id', id).eq('source', 'purchase').maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      isManager
        ? supabase
            .from('cost_entries')
            .select('id, cost_on, description, amount, source, billable, cost_categories(name)')
            .eq('horse_id', id)
            .order('cost_on', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(8)
        : Promise.resolve({ data: null, error: null }),
    ]);

    return {
      horse,
      history: must(history) ?? [],
      stallName: (stall.data as { stalls: { name: string } | null } | null)?.stalls?.name ?? null,
      stallSince: (stall.data as { started_on: string } | null)?.started_on ?? null,
      stallLeaving: (stall.data as { expected_end_on: string | null } | null)?.expected_end_on ?? null,
      owner: owner.data as { name: string; is_self: boolean } | null,
      profit: profit.data,
      purchasePrice: purchase.data ? Number((purchase.data as { amount: number }).amount) : null,
      costs: ((costs.data ?? []) as {
        id: string;
        cost_on: string;
        description: string | null;
        amount: number;
        source: string;
        billable: boolean;
        cost_categories: { name: string } | null;
      }[]),
    };
  }, [id, isManager, seesStalls]);

  const [valuation, setValuation] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading && !data) return <Loading />;
  if (!data) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Horse" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message={error ?? 'This horse could not be found.'} />
        </View>
      </View>
    );
  }

  const { horse, history, stallName, stallSince, stallLeaving, owner, profit, purchasePrice, costs } = data;
  const facts = [horse.sex ? SEX_LABELS[horse.sex] : null, horse.colour, ageFrom(horse.date_of_birth)].filter(Boolean);
  const ownHorse = owner?.is_self ?? false;
  const canLogFeed = role === 'manager' || role === 'groom';

  const changePurpose = async (next: HorsePurpose) => {
    if (next === horse.current_purpose) return;
    setActionError(null);
    setSaving(true);
    const { error: e } = await supabase.from('horses').update({ current_purpose: next }).eq('id', horse.id);
    if (e) setActionError(e.message);
    await reload();
    setSaving(false);
  };

  const removeCost = async (costId: string) => {
    if (confirmRemove !== costId) {
      setConfirmRemove(costId);
      return;
    }
    setActionError(null);
    setSaving(true);
    const { error: e } = await supabase.from('cost_entries').delete().eq('id', costId);
    if (e) setActionError(e.message);
    setConfirmRemove(null);
    await reload();
    setSaving(false);
  };

  const saveCostPrice = async () => {
    const amount = parseMoney(costPrice);
    if (amount === null) return setActionError('Enter the cost price as a number, for example 45000.');
    setActionError(null);
    setSaving(true);
    const { error: e } = await supabase.rpc('set_horse_purchase_price', { horse: horse.id, price: amount });
    if (e) setActionError(e.message);
    else setCostPrice('');
    await reload();
    setSaving(false);
  };

  const saveValuation = async () => {
    const amount = Number(valuation.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(amount) || amount < 0) return setActionError('Enter the valuation as a number, for example 85000.');
    setActionError(null);
    setSaving(true);
    const { error: e } = await supabase
      .from('horse_valuations')
      .insert({ business_id: horse.business_id, horse_id: horse.id, amount, valued_on: todayIso() });
    if (e) setActionError(e.message);
    else setValuation('');
    await reload();
    setSaving(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <BlueHeader title={horse.name} subtitle={[horse.stock_number, ...facts].filter(Boolean).join(' · ')} showBack>
        <View style={styles.headerBadges}>
          <LogoMark name={horse.name} size={56} />
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Badge label={PURPOSE_LABELS[horse.current_purpose]} />
              {stallName ? <Badge label={stallName} tone="outline" /> : null}
            </View>
            <AppText variant="small" color={Colors.softBlue}>
              On the yard since {formatDate(horse.entry_date)}
            </AppText>
          </View>
        </View>
      </BlueHeader>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={Colors.royalBlue} />}>
        <ErrorText message={error ?? actionError} />

        {isManager && profit ? (
          <Card gold>
            <AppText variant="heading" accessibilityRole="header">
              Profitability to date
            </AppText>
            <View style={styles.figures}>
              <Figure label="Income" value={formatMoneyShort(profit.total_income, currency)} />
              <Figure label="Full cost" value={formatMoneyShort(profit.total_cost, currency)} />
              <Figure label="Profit" value={formatMoneyShort(profit.profit, currency)} />
            </View>
            <DetailRow label="Logged costs" value={formatMoney(profit.direct_costs, currency)} />
            <DetailRow
              label={`Feed (${profit.feed_days} day${profit.feed_days === 1 ? '' : 's'})`}
              value={formatMoney(profit.feed_costs, currency)}
            />
            <DetailRow label="Shared costs" value={formatMoney(profit.shared_costs, currency)} />
            <DetailRow
              label="Latest valuation"
              value={profit.latest_valuation != null ? `${formatMoney(profit.latest_valuation, currency)} · ${formatDate(profit.latest_valuation_on)}` : 'None yet'}
              last
            />
            {profit.feed_days === 0 ? (
              <AppText variant="small">No daily feed rate is set yet, so feed is not being counted. Set it under More → Daily feed rate.</AppText>
            ) : null}
            {ownHorse && Number(profit.sale_income ?? 0) === 0 ? (
              <AppText variant="small">Unsold own horses show no income until they are sold. The valuation is for reference only.</AppText>
            ) : null}
          </Card>
        ) : null}

        {seesStalls ? (
          <Card>
            <AppText variant="heading" accessibilityRole="header">
              Stall
            </AppText>
            {stallName ? (
              <>
                <AppText variant="bodyStrong">{stallName}</AppText>
                <AppText variant="small">
                  Since {formatDate(stallSince)}
                  {stallLeaving ? ` · expected to leave ${formatDate(stallLeaving)}` : ''}
                </AppText>
              </>
            ) : (
              <AppText muted>Not in a stall.</AppText>
            )}
            {isManager ? (
              <Button
                kind={stallName ? 'secondary' : 'primary'}
                title={stallName ? 'Move or take out of stall' : 'Put in a stall'}
                onPress={() => router.push({ pathname: '/assign/[horseId]', params: { horseId: horse.id } })}
              />
            ) : null}
          </Card>
        ) : null}

        {canLogFeed && !isManager ? (
          <Card>
            <AppText variant="heading" accessibilityRole="header">
              Feeding
            </AppText>
            <AppText variant="small">Everyday feed is charged automatically. Log anything extra here.</AppText>
            <Button icon="add" title="Log feed" onPress={() => router.push({ pathname: '/log/[horseId]', params: { horseId: horse.id, mode: 'feed' } })} />
          </Card>
        ) : null}

        {isManager ? (
          <Card>
            <AppText variant="heading" accessibilityRole="header">
              Costs
            </AppText>
            {costs.length === 0 ? <AppText muted>No costs logged yet.</AppText> : null}
            {costs.map((c, i) => (
              <View key={c.id} style={[styles.costRow, i < costs.length - 1 && styles.costDivider]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyStrong" numberOfLines={2}>
                    {c.description ?? c.cost_categories?.name ?? 'Cost'}
                  </AppText>
                  <AppText variant="small">
                    {formatDate(c.cost_on)} · {c.cost_categories?.name ?? 'Cost'}
                    {c.billable ? ' · on invoice' : ''}
                  </AppText>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <AppText variant="bodyStrong">{formatMoney(c.amount, currency)}</AppText>
                  {c.source === 'manual' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={confirmRemove === c.id ? 'Tap again to remove this cost' : 'Remove this cost'}
                      onPress={() => removeCost(c.id)}
                      disabled={saving}
                      hitSlop={8}
                      style={styles.removeButton}>
                      <AppText variant="small" color={confirmRemove === c.id ? Colors.danger : Colors.textMuted}>
                        {confirmRemove === c.id ? 'Tap again to remove' : 'Remove'}
                      </AppText>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
            <Button icon="add" title="Log medicine or other cost" onPress={() => router.push({ pathname: '/log/[horseId]', params: { horseId: horse.id, mode: 'cost' } })} />
            <Button kind="secondary" title="Log extra feed" onPress={() => router.push({ pathname: '/log/[horseId]', params: { horseId: horse.id, mode: 'feed' } })} />
            <AppText variant="small">Everyday feed is charged automatically at the daily feed rate. Log only extras here.</AppText>
          </Card>
        ) : null}

        <Card>
          <AppText variant="heading" accessibilityRole="header">
            Details
          </AppText>
          {isManager ? <DetailRow label="Owner" value={owner ? (owner.is_self ? `${owner.name} (own)` : owner.name) : '—'} /> : null}
          {isManager && ownHorse ? (
            <DetailRow
              label="Cost price"
              value={purchasePrice != null ? formatMoney(purchasePrice, currency) : 'Not recorded'}
            />
          ) : null}
          <DetailRow label="Breed" value={horse.breed ?? '—'} />
          <DetailRow label="Passport / ID" value={horse.passport_number ?? '—'} />
          <DetailRow label="Microchipped" value={horse.microchipped ? 'Yes' : 'No'} />
          <DetailRow label="Date of birth" value={formatDate(horse.date_of_birth)} />
          <DetailRow label="Previous owner" value={horse.previous_owner ?? '—'} last={!horse.notes} />
          {horse.notes ? <AppText>{horse.notes}</AppText> : null}
        </Card>

        <Card>
          <AppText variant="heading" accessibilityRole="header">
            Purpose history
          </AppText>
          {history.map((h, i) => (
            <DetailRow
              key={`${h.purpose}-${h.started_on}`}
              label={PURPOSE_LABELS[h.purpose]}
              value={h.ended_on ? `${formatDate(h.started_on)} – ${formatDate(h.ended_on)}` : `Since ${formatDate(h.started_on)}`}
              last={i === history.length - 1}
            />
          ))}
        </Card>

        {isManager ? (
          <Card>
            <AppText variant="heading" accessibilityRole="header">
              Manager actions
            </AppText>
            {ownHorse ? (
              <Segmented
                label="Change purpose"
                options={(['training', 'trading', 'broodstock'] as HorsePurpose[])
                  .filter((p) => (p === 'trading' ? features.trading : p === 'broodstock' ? features.breeding : true))
                  .map((p) => ({ value: p, label: PURPOSE_LABELS[p] }))}
                value={horse.current_purpose}
                onChange={changePurpose}
                disabled={saving}
              />
            ) : (
              <AppText variant="small">Client horses stay on Training.</AppText>
            )}
            {ownHorse ? (
              <>
                <TextField
                  label={`Cost price (${currency})`}
                  value={costPrice}
                  onChangeText={setCostPrice}
                  keyboardType="decimal-pad"
                  placeholder={purchasePrice != null ? String(purchasePrice) : '45000'}
                  hint="What you paid for the horse. Enter 0 to remove it."
                />
                <Button
                  kind="secondary"
                  title="Save cost price"
                  onPress={saveCostPrice}
                  loading={saving}
                  disabled={!costPrice.trim()}
                />
              </>
            ) : null}
            <TextField
              label={`New valuation (${currency})`}
              value={valuation}
              onChangeText={setValuation}
              keyboardType="decimal-pad"
              placeholder="85000"
            />
            <Button kind="secondary" title="Save valuation" onPress={saveValuation} loading={saving} disabled={!valuation.trim()} />
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <AppText variant="small">{label}</AppText>
      <AppText variant="bodyStrong" style={{ fontSize: 16 }}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBadges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
  figures: { flexDirection: 'row', gap: Spacing.sm },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10 },
  costDivider: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  removeButton: { minHeight: 24, justifyContent: 'center', borderRadius: Radius.sm },
});
