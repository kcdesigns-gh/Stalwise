import { Image } from 'expo-image';
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
  CostBreakdownBar,
  DetailRow,
  ErrorText,
  IconStat,
  IconStatGrid,
  Loading,
  LogoMark,
  PLBreakdown,
  Segmented,
  TextField,
} from '@/components/ui';
import { Colors, ContentMaxWidth, Radius, Spacing } from '@/constants/theme';
import { formatDate, formatMoney, parseMoney, todayIso } from '@/lib/format';
import { ageFrom, PURPOSE_LABELS, SEX_LABELS } from '@/lib/labels';
import { addHorsePhotos, loadHorsePhotos, pickHorsePhotos } from '@/lib/photos';
import { supabase, type HorsePurpose } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

export default function HorseScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { business, isManager, role, features } = useBusiness();
  const currency = business!.currency_code;
  const seesStalls = role === 'manager' || role === 'trainer';
  const canAddPhotos = role === 'manager' || role === 'trainer';

  const { data, error, loading, refreshing, reload } = useScreenData(async () => {
    const horse = must(await supabase.from('horses').select('*').eq('id', id).single());

    const [photos, history, stall, owner, profit, profitMonth, purchase, costs] = await Promise.all([
      loadHorsePhotos(id).catch(() => []),
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
        ? supabase.from('horse_profitability_month').select('profit').eq('horse_id', id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      isManager
        ? supabase.from('cost_entries').select('amount').eq('horse_id', id).eq('source', 'purchase').maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      isManager
        ? supabase
            .from('cost_entries')
            .select('id, cost_on, description, amount, source, source_id, billable, cost_categories(name)')
            .eq('horse_id', id)
            .order('cost_on', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(8)
        : Promise.resolve({ data: null, error: null }),
    ]);

    return {
      horse,
      photos,
      history: must(history) ?? [],
      stallName: (stall.data as { stalls: { name: string } | null } | null)?.stalls?.name ?? null,
      stallSince: (stall.data as { started_on: string } | null)?.started_on ?? null,
      stallLeaving: (stall.data as { expected_end_on: string | null } | null)?.expected_end_on ?? null,
      owner: owner.data as { name: string; is_self: boolean } | null,
      profit: profit.data,
      monthProfit: profitMonth.data ? Number((profitMonth.data as { profit: number }).profit) : 0,
      purchasePrice: purchase.data ? Number((purchase.data as { amount: number }).amount) : null,
      costs: ((costs.data ?? []) as {
        id: string;
        cost_on: string;
        description: string | null;
        amount: number;
        source: string;
        source_id: string | null;
        billable: boolean;
        cost_categories: { name: string } | null;
      }[]),
    };
  }, [id, isManager, seesStalls]);

  const [valuation, setValuation] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
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

  const { horse, photos, history, stallName, stallSince, stallLeaving, owner, profit, monthProfit, purchasePrice, costs } = data;
  const facts = [horse.sex ? SEX_LABELS[horse.sex] : null, horse.colour, ageFrom(horse.date_of_birth)].filter(Boolean);
  const ownHorse = owner?.is_self ?? false;
  const canLogFeed = role === 'manager' || role === 'groom';

  const mainPhoto = photos.find((p) => p.is_main) ?? photos[0];

  const addPhotos = async (source: 'camera' | 'gallery') => {
    setActionError(null);
    try {
      const picked = await pickHorsePhotos(source);
      if (picked.length === 0) return;
      setUploading(picked.length === 1 ? 'Uploading photo…' : `Uploading ${picked.length} photos…`);
      await addHorsePhotos(horse.business_id, horse.id, picked);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'The photo could not be uploaded. Please try again.');
    }
    setUploading(null);
    await reload();
  };

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

  const archiveHorse = async () => {
    if (confirmArchive !== 'go') {
      setConfirmArchive('go');
      return;
    }
    setActionError(null);
    setSaving(true);
    // One step on the server: ends the horse's stay (so feed and shared costs
    // stop counting), frees its stall and archives it.
    const { error: e } = await supabase.rpc('archive_horse', { horse: horse.id });
    if (e) {
      setActionError(e.message);
      setSaving(false);
      return;
    }
    router.back();
  };

  const saveValuation = async () => {
    const amount = parseMoney(valuation);
    if (amount === null) return setActionError('Enter the valuation as a number, for example 85000.');
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
          <LogoMark name={horse.name} uri={mainPhoto?.url} size={56} />
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={Colors.link} />}>
        <ErrorText message={error ?? actionError} />

        {mainPhoto?.url ? (
          <View style={styles.hero}>
            <Image source={{ uri: mainPhoto.url }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <View style={styles.heroScrim} />
            <View style={styles.heroBadges}>
              <Badge label={PURPOSE_LABELS[horse.current_purpose]} />
              {stallName ? <Badge label={stallName} tone="outline" /> : null}
            </View>
            <AppText variant="bodyStrong" color={Colors.onChrome} style={styles.heroCaption}>
              On the yard since {formatDate(horse.entry_date)}
            </AppText>
          </View>
        ) : null}

        <Card>
          <AppText variant="heading" accessibilityRole="header">
            Photos
          </AppText>
          {photos.length === 0 ? (
            <AppText muted>{canAddPhotos ? 'No photos yet. Add the first one below.' : 'No photos yet.'}</AppText>
          ) : (
            <View style={styles.photoGrid}>
              {photos.map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={p.is_main ? `Main photo of ${horse.name}` : `Photo of ${horse.name}, ${formatDate(p.taken_on)}`}
                  onPress={() => router.push({ pathname: '/photo/[id]', params: { id: p.id } })}
                  style={({ pressed }) => [styles.thumb, p.is_main && styles.thumbMain, pressed && { opacity: 0.8 }]}>
                  {p.url ? <Image source={{ uri: p.url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                  {p.is_main ? (
                    <View style={styles.mainTag}>
                      <AppText variant="small" color={Colors.onGold} style={{ fontSize: 11 }}>
                        Main
                      </AppText>
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </View>
          )}
          {uploading ? <AppText variant="small">{uploading}</AppText> : null}
          {canAddPhotos ? (
            <View style={styles.photoButtons}>
              <View style={{ flex: 1 }}>
                <Button icon="camera" title="Take photo" onPress={() => addPhotos('camera')} loading={uploading !== null} />
              </View>
              <View style={{ flex: 1 }}>
                <Button kind="secondary" icon="gallery" title="From gallery" onPress={() => addPhotos('gallery')} disabled={uploading !== null} />
              </View>
            </View>
          ) : null}
        </Card>

        {isManager && profit ? (
          <View style={{ gap: Spacing.md }}>
            <PLBreakdown
              items={[
                {
                  label: 'This month',
                  value: formatMoney(monthProfit, currency),
                  tone: monthProfit >= 0 ? 'pos' : 'neg',
                  note: 'Revenue invoiced minus costs logged this month',
                  bar: Colors.royalBlue,
                },
                {
                  label: 'Lifetime (actual)',
                  value: formatMoney(profit.profit, currency),
                  tone: Number(profit.profit) >= 0 ? 'pos' : 'neg',
                  note: `${formatMoney(profit.total_income, currency)} earned to date minus ${formatMoney(profit.total_cost, currency)} spent since entry`,
                  bar: Colors.heading,
                },
                {
                  label: 'Projected',
                  value: profit.is_own_stock && profit.projected_profit != null ? formatMoney(profit.projected_profit, currency) : '—',
                  tone:
                    profit.is_own_stock && profit.projected_profit != null
                      ? Number(profit.projected_profit) >= 0
                        ? 'pos'
                        : 'neg'
                      : 'muted',
                  note:
                    profit.is_own_stock && profit.projected_profit != null
                      ? `${formatMoney(profit.latest_valuation, currency)} valuation minus ${formatMoney(profit.total_cost, currency)} spent since entry`
                      : profit.is_own_stock
                        ? 'Set a valuation below to see this'
                        : 'Client horses are valued on fees, not a sale',
                  bar: Colors.gold,
                },
              ]}
            />

            <Card>
              <AppText variant="heading" accessibilityRole="header">
                Cost breakdown since entry
              </AppText>
              <CostBreakdownBar
                items={[
                  { label: 'Logged costs', value: Number(profit.direct_costs) },
                  { label: `Feed (${profit.feed_days} day${profit.feed_days === 1 ? '' : 's'})`, value: Number(profit.feed_costs ?? 0) },
                  { label: 'Shared costs', value: Number(profit.shared_costs) },
                ]}
                formatValue={(v) => formatMoney(v, currency)}
              />
              <DetailRow
                label="Latest valuation"
                value={profit.latest_valuation != null ? `${formatMoney(profit.latest_valuation, currency)} · ${formatDate(profit.latest_valuation_on)}` : 'None yet'}
                last
              />
              {profit.feed_days === 0 ? (
                <AppText variant="small">No daily feed rate is set yet, so feed is not being counted. Set it under More → Daily feed rate.</AppText>
              ) : null}
              {ownHorse && Number(profit.sale_income ?? 0) === 0 ? (
                <AppText variant="small">Unsold own horses show no sale income until they are sold. The valuation is for reference only.</AppText>
              ) : null}
            </Card>
          </View>
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

        {features.health_reminders ? (
          <Card>
            <AppText variant="heading" accessibilityRole="header">
              Health
            </AppText>
            <Button kind="secondary" title="Reminders & care history" onPress={() => router.push({ pathname: '/health/[horseId]', params: { horseId: horse.id } })} />
          </Card>
        ) : null}

        {seesStalls && features.training && horse.current_purpose !== 'broodstock' && horse.current_purpose !== 'boarding' ? (
          <Card>
            <AppText variant="heading" accessibilityRole="header">
              Training
            </AppText>
            <Button kind="secondary" title="Sessions, notes & shows" onPress={() => router.push({ pathname: '/training/[horseId]', params: { horseId: horse.id } })} />
          </Card>
        ) : null}

        {seesStalls && features.breeding && horse.sex === 'mare' ? (
          <Card>
            <AppText variant="heading" accessibilityRole="header">
              Breeding
            </AppText>
            <Button kind="secondary" title="Breeding record" onPress={() => router.push({ pathname: '/breeding/[horseId]', params: { horseId: horse.id } })} />
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
            {costs.map((c, i) => {
              const editable = c.source === 'manual' || c.source === 'feed_log';
              const editTarget = c.source === 'manual' ? { pathname: '/cost/edit/[id]' as const, params: { id: c.id } } : { pathname: '/feed-log/edit/[id]' as const, params: { id: c.source_id ?? '' } };
              return (
              <Pressable
                key={c.id}
                disabled={!editable}
                onPress={() => editable && router.push(editTarget)}
                style={[styles.costRow, i < costs.length - 1 && styles.costDivider]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyStrong" numberOfLines={2}>
                    {c.description ?? c.cost_categories?.name ?? 'Cost'}
                  </AppText>
                  <AppText variant="small">
                    {formatDate(c.cost_on)} · {c.cost_categories?.name ?? 'Cost'}
                    {c.billable ? ' · on invoice' : ''}
                    {editable ? ' · tap to edit' : ''}
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
              </Pressable>
              );
            })}
            <Button icon="add" title="Log medicine or other cost" onPress={() => router.push({ pathname: '/log/[horseId]', params: { horseId: horse.id, mode: 'cost' } })} />
            <Button kind="secondary" title="Log extra feed" onPress={() => router.push({ pathname: '/log/[horseId]', params: { horseId: horse.id, mode: 'feed' } })} />
            <AppText variant="small">Everyday feed is charged automatically at the daily feed rate. Log only extras here.</AppText>
          </Card>
        ) : null}

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText variant="heading" accessibilityRole="header">
              Details
            </AppText>
            {isManager ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/horse/edit/[id]', params: { id: horse.id } })}
                hitSlop={8}>
                <AppText variant="small" color={Colors.link}>
                  Edit
                </AppText>
              </Pressable>
            ) : null}
          </View>
          <IconStatGrid>
            <IconStat icon="horseshoe" label="Breed" value={horse.breed ?? '—'} />
            <IconStat icon="gender" label="Sex" value={horse.sex ? SEX_LABELS[horse.sex] : '—'} />
            <IconStat icon="calendar" label="Entry date" value={formatDate(horse.entry_date)} />
            <IconStat icon="chip" label="Microchip" value={horse.microchipped ? 'Yes' : 'No'} tone="gold" />
            {isManager ? (
              <IconStat icon="tag" label="Passport / ID" value={horse.passport_number ?? '—'} />
            ) : null}
            <IconStat icon="trend" label="Age" value={ageFrom(horse.date_of_birth) ?? '—'} tone="green" />
          </IconStatGrid>

          {isManager ? <DetailRow label="Owner" value={owner ? (owner.is_self ? `${owner.name} (own)` : owner.name) : '—'} /> : null}
          {isManager && ownHorse ? (
            <DetailRow
              label="Cost price"
              value={purchasePrice != null ? formatMoney(purchasePrice, currency) : 'Not recorded'}
            />
          ) : null}
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
            <Segmented
              label="Change purpose"
              options={((ownHorse ? ['training', 'trading', 'broodstock'] : ['training', 'boarding']) as HorsePurpose[])
                .filter((p) => (p === 'trading' ? features.trading : p === 'broodstock' ? features.breeding : true))
                .map((p) => ({ value: p, label: PURPOSE_LABELS[p] }))}
              value={horse.current_purpose}
              onChange={changePurpose}
              disabled={saving}
            />
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

        {isManager ? (
          <Card>
            <AppText variant="heading" accessibilityRole="header">
              Leaving the yard
            </AppText>
            <Button
              kind="secondary"
              title="Sell this horse"
              onPress={() => router.push({ pathname: '/horse/sell/[id]', params: { id: horse.id } })}
            />
            <Button
              kind="secondary"
              title={confirmArchive ? 'Tap again to archive' : 'Archive (left without a sale)'}
              onPress={archiveHorse}
              loading={saving && confirmArchive === 'go'}
            />
            {confirmArchive ? (
              <AppText variant="small" color={Colors.danger}>
                This removes {horse.name} from the active list. Its history and costs stay on record.
              </AppText>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBadges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
  hero: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.deepBlue,
    justifyContent: 'flex-end',
  },
  heroScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(18,40,95,0.55)',
  },
  heroBadges: { flexDirection: 'row', gap: 6, paddingHorizontal: Spacing.lg, paddingBottom: 6 },
  heroCaption: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10 },
  costDivider: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  thumb: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    backgroundColor: Colors.divider,
  },
  thumbMain: { borderWidth: 2, borderColor: Colors.gold },
  mainTag: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    backgroundColor: Colors.gold,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  photoButtons: { flexDirection: 'row', gap: Spacing.sm },
  removeButton: { minHeight: 24, justifyContent: 'center', borderRadius: Radius.sm },
});
