import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BlueHeader, Button, Card, ChoiceList, ErrorText, Loading, Segmented, TextField, ToggleRow } from '@/components/ui';
import { Colors, ContentMaxWidth, Spacing } from '@/constants/theme';
import { formatMoney, parseDayMonthYear, parseMoney, parseQuantity, toDayMonthYear, todayIso, dateOrderWords, dateExample } from '@/lib/format';
import { loadCategories, loadProducts, priceSummary, type Product } from '@/lib/products';
import { supabase } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

type Mode = 'cost' | 'feed';

const OTHER = '__other__';
/** Categories whose costs come from the product list. The rest are typed in as an amount. */
const PRODUCT_BACKED = ['feed', 'medicine', 'supplements'];

const CATEGORY_CHOICES: { code: string; label: string }[] = [
  { code: 'medicine', label: 'Medicine' },
  { code: 'supplements', label: 'Supplements' },
  { code: 'feed', label: 'Feed' },
  { code: 'vet', label: 'Vet' },
  { code: 'farrier', label: 'Farrier' },
  { code: 'transport', label: 'Transport' },
  { code: 'training', label: 'Training' },
  { code: 'other', label: 'Other' },
];

export default function LogScreen() {
  const { horseId, mode: modeParam } = useLocalSearchParams<{ horseId: string; mode?: string }>();
  const mode: Mode = modeParam === 'feed' ? 'feed' : 'cost';
  const { business, role, isManager } = useBusiness();
  const bid = business!.id;
  const allowed = mode === 'feed' ? role === 'manager' || role === 'groom' : isManager;

  const { data, error, loading } = useScreenData(async () => {
    const [horse, products, categories] = await Promise.all([
      supabase.from('horses').select('id, name, current_owner_id').eq('id', horseId).single(),
      loadProducts(bid, isManager),
      loadCategories(bid),
    ]);
    return { horse: must(horse), products: products.filter((p) => p.active), categories };
  }, [bid, horseId, isManager]);

  if (!allowed) {
    return (
      <>
        <BlueHeader title={mode === 'feed' ? 'Log feed' : 'Log a cost'} showBack />
        <ErrorText message={mode === 'feed' ? 'Only the Manager and Grooms can log feed.' : 'Only the Manager can log costs.'} />
      </>
    );
  }
  if (loading && !data) return <Loading />;
  if (!data) {
    return (
      <>
        <BlueHeader title="Log" showBack />
        <ErrorText message={error ?? 'This horse could not be found.'} />
      </>
    );
  }

  return (
    <LogForm
      key={`${horseId}-${mode}`}
      mode={mode}
      horseId={horseId}
      horseName={data.horse.name}
      products={data.products}
      categories={data.categories}
    />
  );
}

function LogForm({
  mode,
  horseId,
  horseName,
  products,
  categories,
}: {
  mode: Mode;
  horseId: string;
  horseName: string;
  products: Product[];
  categories: { id: string; code: string; name: string }[];
}) {
  const insets = useSafeAreaInsets();
  const { business, isManager } = useBusiness();
  const bid = business!.id;
  const currency = business!.currency_code;

  const [categoryCode, setCategoryCode] = useState(mode === 'feed' ? 'feed' : 'medicine');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(toDayMonthYear(todayIso()));
  const [billable, setBillable] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productBacked = mode === 'feed' || PRODUCT_BACKED.includes(categoryCode);
  const choices = products.filter((p) => p.categoryCode === categoryCode);
  const product = productId && productId !== OTHER ? choices.find((p) => p.id === productId) ?? null : null;
  const usingProduct = productBacked && !!product;
  const qty = parseQuantity(quantity);
  const estimate = product && product.dosePrice != null && qty != null ? product.dosePrice * qty : null;

  const pickCategory = (code: string) => {
    setCategoryCode(code);
    setProductId('');
    setError(null);
  };

  const save = async () => {
    setError(null);
    const day = parseDayMonthYear(date);
    if (!day) return setError(`Enter the date as ${dateOrderWords()}, for example ${dateExample()}.`);

    if (mode === 'feed') {
      if (!product) return setError('Choose which feed was given.');
      if (qty === null) return setError('Enter how much was given, for example 2.');
      setBusy(true);
      const { error: e } = await supabase.from('feed_logs').insert({
        business_id: bid,
        horse_id: horseId,
        product_id: product.id,
        fed_on: day,
        quantity: qty,
        notes: notes.trim() || null,
      });
      if (e) {
        setError(e.message);
        setBusy(false);
        return;
      }
      router.back();
      return;
    }

    const category = categories.find((c) => c.code === categoryCode);
    if (!category) return setError('That category is missing. Go back and try again.');

    let entry: {
      product_id: string | null;
      quantity: number;
      description: string | null;
      unit_cost?: number;
      amount?: number;
    };

    if (usingProduct && product) {
      if (qty === null) return setError('Enter how many were used, for example 1.');
      if (product.dosePrice == null) return setError('This product has no price yet. Set it under Products & prices first.');
      entry = { product_id: product.id, quantity: qty, description: description.trim() || product.name };
    } else {
      if (!description.trim()) return setError('Describe the cost, for example “Vet call-out”.');
      const money = parseMoney(amount);
      if (money === null || money <= 0) return setError('Enter the amount as a number, for example 650.');
      entry = { product_id: null, quantity: 1, description: description.trim(), unit_cost: money, amount: money };
    }

    setBusy(true);
    const { error: e } = await supabase.from('cost_entries').insert({
      business_id: bid,
      horse_id: horseId,
      category_id: category.id,
      cost_on: day,
      billable,
      notes: notes.trim() || null,
      ...entry,
    });
    if (e) {
      setError(e.message);
      setBusy(false);
      return;
    }
    router.back();
  };

  const title = mode === 'feed' ? 'Log feed' : 'Log a cost';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlueHeader title={title} subtitle={horseName} showBack />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        {mode === 'cost' ? (
          <Card gold>
            <Segmented label="What kind of cost?" options={CATEGORY_CHOICES.map((c) => ({ value: c.code, label: c.label }))} value={categoryCode} onChange={pickCategory} />
          </Card>
        ) : null}

        {productBacked ? (
          <Card>
            {mode === 'feed' ? (
              <AppText variant="small">Everyday feed is charged automatically at the daily feed rate. Use this for extras.</AppText>
            ) : null}
            {choices.length === 0 ? (
              <AppText muted>
                {isManager
                  ? 'No products of this type yet. Add them under More → Products & prices, or enter an amount below.'
                  : 'No feeds have been set up yet. Ask your Manager to add them.'}
              </AppText>
            ) : (
              <ChoiceList
                label={mode === 'feed' ? 'Which feed?' : 'Which product?'}
                options={[
                  ...choices.map((p) => ({
                    value: p.id,
                    label: p.name,
                    note: isManager ? priceSummary(p, currency) : `Counted in ${p.doseLabel}s`,
                  })),
                  ...(mode === 'cost' ? [{ value: OTHER, label: 'Something else (type an amount)' }] : []),
                ]}
                value={productId || null}
                onChange={setProductId}
              />
            )}

            {product ? (
              <>
                <TextField
                  label={`How many ${product.doseLabel}s?`}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                />
                {mode === 'feed' && product.includedInFeedRate ? (
                  <AppText variant="small">This feed is covered by the flat daily rate, so no separate cost is added.</AppText>
                ) : null}
                {isManager && !(mode === 'feed' && product.includedInFeedRate) ? (
                  <AppText variant="bodyStrong" color={Colors.heading} accessibilityLiveRegion="polite">
                    {product.dosePrice == null
                      ? 'No price set for this product yet.'
                      : estimate != null
                        ? `Cost: ${formatMoney(estimate, currency)}`
                        : 'Enter a quantity to see the cost.'}
                  </AppText>
                ) : null}
              </>
            ) : null}
          </Card>
        ) : null}

        {mode === 'cost' && !usingProduct ? (
          <Card>
            <TextField label="Description" value={description} onChangeText={setDescription} placeholder="Vet call-out" autoCapitalize="sentences" />
            <TextField
              label={`Amount (${currency})`}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="650"
              hint="The full amount you were charged, including any tax."
            />
          </Card>
        ) : null}

        <Card>
          <TextField label="Date" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
          {mode === 'cost' ? (
            <ToggleRow label="Charge this to the owner on an invoice" value={billable} onChange={setBillable} last />
          ) : null}
          <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
        </Card>

        <ErrorText message={error} />
        <Button title={mode === 'feed' ? 'Save feed' : 'Save cost'} onPress={save} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
});
