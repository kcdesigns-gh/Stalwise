import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BlueHeader, Button, Card, ErrorText, Loading, Segmented, TextField, ToggleRow } from '@/components/ui';
import { Colors, ContentMaxWidth, Spacing } from '@/constants/theme';
import { formatMoney, parseMoney, parseQuantity, todayIso } from '@/lib/format';
import { loadCategories, loadProducts, PRODUCT_CATEGORY_CODES, type CostCategory, type ProductCategoryCode } from '@/lib/products';
import { supabase } from '@/lib/supabase';
import { useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

const CATEGORY_LABELS: Record<ProductCategoryCode, string> = {
  feed: 'Feed',
  medicine: 'Medicine',
  supplements: 'Supplement',
  other: 'Other',
};

type Initial = {
  name: string;
  categoryCode: ProductCategoryCode;
  unit: string;
  price: string;
  doses: string;
  doseLabel: string;
  includedInFeedRate: boolean;
  active: boolean;
};

const NEW_PRODUCT: Initial = {
  name: '',
  categoryCode: 'medicine',
  unit: 'bottle',
  price: '',
  doses: '1',
  doseLabel: 'dose',
  includedInFeedRate: false,
  active: true,
};

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { business, isManager } = useBusiness();
  const bid = business!.id;
  const isNew = id === 'new';

  const { data, error, loading } = useScreenData(async () => {
    const [categories, products] = await Promise.all([loadCategories(bid), isNew ? Promise.resolve([]) : loadProducts(bid, true)]);
    return { categories, product: products.find((p) => p.id === id) ?? null };
  }, [bid, id]);

  if (!isManager) {
    return (
      <>
        <BlueHeader title="Product" showBack />
        <ErrorText message="Only the Manager can change products and prices." />
      </>
    );
  }
  if (loading && !data) return <Loading />;
  if (!data || (!isNew && !data.product)) {
    return (
      <>
        <BlueHeader title="Product" showBack />
        <ErrorText message={error ?? 'This product could not be found.'} />
      </>
    );
  }

  const p = data.product;
  const initial: Initial = p
    ? {
        name: p.name,
        categoryCode: (PRODUCT_CATEGORY_CODES as readonly string[]).includes(p.categoryCode) ? (p.categoryCode as ProductCategoryCode) : 'other',
        unit: p.unit,
        price: p.unitPrice != null ? String(p.unitPrice) : '',
        doses: String(p.dosesPerUnit),
        doseLabel: p.doseLabel,
        includedInFeedRate: p.includedInFeedRate,
        active: p.active,
      }
    : NEW_PRODUCT;

  return <ProductForm key={id} productId={isNew ? null : id} initial={initial} categories={data.categories} />;
}

function ProductForm({ productId, initial, categories }: { productId: string | null; initial: Initial; categories: CostCategory[] }) {
  const insets = useSafeAreaInsets();
  const { business } = useBusiness();
  const bid = business!.id;
  const currency = business!.currency_code;

  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Initial>(key: K, value: Initial[K]) => setV((prev) => ({ ...prev, [key]: value }));

  const price = parseMoney(v.price);
  const doses = parseQuantity(v.doses);
  const perDose = price != null && doses != null ? price / doses : null;

  const save = async () => {
    setError(null);
    if (!v.name.trim()) return setError('Enter the product’s name.');
    if (!v.unit.trim()) return setError('Enter how it is sold, for example bottle, bag or bale.');
    if (price === null) return setError(`Enter the price as a number, for example 250. This is the price of one ${v.unit.trim() || 'unit'}.`);
    if (doses === null) return setError('Enter how many doses or portions one unit gives, for example 10. Use 1 if it is used whole.');
    const category = categories.find((c) => c.code === v.categoryCode);
    if (!category) return setError('That category is missing. Pull down to refresh and try again.');

    setBusy(true);
    try {
      const fields = {
        name: v.name.trim(),
        category_id: category.id,
        unit: v.unit.trim(),
        doses_per_unit: doses,
        dose_label: v.doseLabel.trim() || 'dose',
        included_in_feed_rate: v.categoryCode === 'feed' ? v.includedInFeedRate : false,
        active: v.active,
      };

      let id = productId;
      if (id) {
        const { error: e } = await supabase.from('products').update(fields).eq('id', id);
        if (e) throw e;
      } else {
        const { data: created, error: e } = await supabase
          .from('products')
          .insert({ business_id: bid, ...fields })
          .select('id')
          .single();
        if (e || !created) throw e ?? new Error('The product could not be saved.');
        id = created.id;
      }

      // A changed price is saved as a new price from today, so past costs keep the price they had.
      const priceChanged = parseMoney(initial.price) !== price;
      if (priceChanged) {
        const { error: e } = await supabase
          .from('product_prices')
          .upsert({ business_id: bid, product_id: id, unit_price: price, effective_from: todayIso() }, { onConflict: 'product_id,effective_from' });
        if (e) throw e;
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlueHeader title={productId ? 'Edit product' : 'Add a product'} showBack />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <Card gold>
          <TextField label="Name" value={v.name} onChangeText={(t) => set('name', t)} autoCapitalize="words" placeholder="Ecomectin" />
          <Segmented
            label="Type"
            options={PRODUCT_CATEGORY_CODES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
            value={v.categoryCode}
            onChange={(c) =>
              setV((prev) => ({
                ...prev,
                categoryCode: c,
                // New everyday feeds are already in the automatic daily rate.
                includedInFeedRate: !productId && c === 'feed' ? true : prev.includedInFeedRate,
              }))
            }
          />
        </Card>

        <Card>
          <AppText variant="heading" accessibilityRole="header">
            What it costs
          </AppText>
          <TextField label="Sold as" value={v.unit} onChangeText={(t) => set('unit', t)} placeholder="bottle" hint="One bottle, bag, bale, tub, kg…" />
          <TextField
            label={`Price per ${v.unit.trim() || 'unit'} (${currency})`}
            value={v.price}
            onChangeText={(t) => set('price', t)}
            keyboardType="decimal-pad"
            placeholder="250"
          />
          <TextField
            label={`Doses in one ${v.unit.trim() || 'unit'}`}
            value={v.doses}
            onChangeText={(t) => set('doses', t)}
            keyboardType="decimal-pad"
            hint="How many times one bottle or bag is used. A bottle that treats 10 horses is 10. Use 1 if you use it whole."
          />
          <TextField label="One portion is called a" value={v.doseLabel} onChangeText={(t) => set('doseLabel', t)} placeholder="dose" hint="Dose, scoop, kg, flake…" />
          <AppText variant="bodyStrong" color={Colors.heading} accessibilityLiveRegion="polite">
            {perDose != null ? `Works out to ${formatMoney(perDose, currency)} per ${v.doseLabel.trim() || 'dose'}` : 'Enter the price and doses to see the cost per dose'}
          </AppText>
        </Card>

        {v.categoryCode === 'feed' ? (
          <Card>
            <ToggleRow
              label="Already covered by the daily feed rate"
              value={v.includedInFeedRate}
              onChange={(next) => set('includedInFeedRate', next)}
              last
            />
            <AppText variant="small">
              Switch this on for your everyday feed, because it is already in the automatic daily feed rate. Logging it then adds no separate cost. Leave it off for extras you want costed one by one.
            </AppText>
          </Card>
        ) : null}

        {productId ? (
          <Card>
            <ToggleRow label="Still in use" value={v.active} onChange={(next) => set('active', next)} last />
            <AppText variant="small">Switch off products you no longer buy. They stay on old costs but disappear from the pick lists.</AppText>
          </Card>
        ) : null}

        <ErrorText message={error} />
        <Button title={productId ? 'Save changes' : 'Save product'} onPress={save} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
});
