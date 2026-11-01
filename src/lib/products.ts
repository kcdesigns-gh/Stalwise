import { formatMoney } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { must } from '@/lib/use-query';

/** Categories a product can belong to. Vet, farrier and transport are one-off amounts, not products. */
export const PRODUCT_CATEGORY_CODES = ['feed', 'medicine', 'supplements', 'other'] as const;
export type ProductCategoryCode = (typeof PRODUCT_CATEGORY_CODES)[number];

export type Product = {
  id: string;
  name: string;
  unit: string;
  dosesPerUnit: number;
  doseLabel: string;
  includedInFeedRate: boolean;
  active: boolean;
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  /** Price per unit today. Null for roles that may not see prices, or when none is set. */
  unitPrice: number | null;
  /** unitPrice divided by doses per unit. */
  dosePrice: number | null;
};

export type CostCategory = { id: string; code: string; name: string };

export async function loadCategories(businessId: string): Promise<CostCategory[]> {
  return must(
    await supabase
      .from('cost_categories')
      .select('id, code, name')
      .eq('business_id', businessId)
      .eq('active', true)
      .order('sort_order'),
  );
}

/** Loads the product list. Prices are only fetched when `withPrices` is true (Manager). */
export async function loadProducts(businessId: string, withPrices: boolean): Promise<Product[]> {
  const rows = must(
    await supabase
      .from('products')
      .select('id, name, unit, doses_per_unit, dose_label, included_in_feed_rate, active, category_id, cost_categories(code, name)')
      .eq('business_id', businessId)
      .order('name'),
  );

  const priceByProduct = new Map<string, number>();
  if (withPrices && rows.length) {
    const today = new Date().toISOString().slice(0, 10);
    const prices = must(
      await supabase
        .from('product_prices')
        .select('product_id, unit_price, effective_from')
        .eq('business_id', businessId)
        .lte('effective_from', today)
        .order('effective_from', { ascending: false }),
    );
    for (const p of prices) {
      if (!priceByProduct.has(p.product_id)) priceByProduct.set(p.product_id, Number(p.unit_price));
    }
  }

  return rows.map((r) => {
    const category = r.cost_categories as { code: string; name: string } | null;
    const doses = Number(r.doses_per_unit);
    const unitPrice = priceByProduct.get(r.id) ?? null;
    return {
      id: r.id,
      name: r.name,
      unit: r.unit,
      dosesPerUnit: doses,
      doseLabel: r.dose_label,
      includedInFeedRate: r.included_in_feed_rate,
      active: r.active,
      categoryId: r.category_id,
      categoryCode: category?.code ?? 'other',
      categoryName: category?.name ?? 'Other',
      unitPrice,
      dosePrice: unitPrice != null && doses > 0 ? unitPrice / doses : null,
    };
  });
}

/** "R 250,00 per bottle · R 25,00 per dose" */
export function priceSummary(product: Product, currency: string): string {
  if (product.unitPrice == null) return 'No price set';
  const perUnit = `${formatMoney(product.unitPrice, currency)} per ${product.unit}`;
  if (product.dosesPerUnit === 1 && product.doseLabel === product.unit) return perUnit;
  if (product.dosesPerUnit === 1) return `${perUnit} · 1 ${product.doseLabel}`;
  return `${perUnit} · ${formatMoney(product.dosePrice ?? 0, currency)} per ${product.doseLabel}`;
}
