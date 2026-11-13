import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Badge, BlueHeader, Button, Card, EmptyState, ErrorText, HeaderIconButton, Loading } from '@/components/ui';
import { Colors, WideContentMaxWidth, Spacing } from '@/constants/theme';
import { loadProducts, priceSummary, PRODUCT_CATEGORY_CODES } from '@/lib/products';
import { useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

const SECTION_TITLES: Record<string, string> = {
  feed: 'Feeds',
  medicine: 'Medicine',
  supplements: 'Supplements',
  other: 'Other products',
};

export default function ProductsScreen() {
  const insets = useSafeAreaInsets();
  const { business, isManager } = useBusiness();
  const bid = business!.id;
  const currency = business!.currency_code;

  const { data, error, loading, refreshing, reload } = useScreenData(() => loadProducts(bid, true), [bid]);

  if (!isManager) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Products & prices" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message="Only the Manager can see and change prices." />
        </View>
      </View>
    );
  }

  const add = () => router.push({ pathname: '/product/[id]', params: { id: 'new' } });

  return (
    <View style={{ flex: 1 }}>
      <BlueHeader
        title="Products & prices"
        subtitle={data ? `${data.length} product${data.length === 1 ? '' : 's'}` : undefined}
        showBack
        right={<HeaderIconButton icon="add" label="Add a product" onPress={add} />}
        wide
      />
      {loading && !data ? (
        <Loading />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={Colors.link} />}>
          <ErrorText message={error} />

          {data && data.length === 0 ? (
            <EmptyState
              title="No products yet"
              message="Add the feeds, medicine and supplements you use, with what each one costs. Then you can log them against horses and the cost is worked out for you."
              action={<Button title="Add your first product" icon="add" onPress={add} />}
            />
          ) : null}

          {PRODUCT_CATEGORY_CODES.map((code) => {
            const items = (data ?? []).filter((p) => p.categoryCode === code);
            if (!items.length) return null;
            return (
              <Card key={code}>
                <AppText variant="heading" accessibilityRole="header">
                  {SECTION_TITLES[code]}
                </AppText>
                {items.map((p, i) => (
                  <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${p.name}. ${priceSummary(p, currency)}`}
                    onPress={() => router.push({ pathname: '/product/[id]', params: { id: p.id } })}
                    style={[styles.row, i < items.length - 1 && styles.divider]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="bodyStrong" color={p.active ? Colors.text : Colors.textMuted}>
                        {p.name}
                      </AppText>
                      <AppText variant="small">{priceSummary(p, currency)}</AppText>
                    </View>
                    {!p.active ? <Badge label="Not in use" tone="muted" /> : null}
                    {p.unitPrice == null && p.active ? <Badge label="Set price" tone="gold" /> : null}
                  </Pressable>
                ))}
              </Card>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: WideContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10, minHeight: 56 },
  divider: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
});
