// Money and date formatting that follows the business's country settings.
// South Africa: R 1 250,00 and day/month/year.

function groupDigits(digits: string, separator: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

export function formatMoney(amount: number | string | null | undefined, currency = 'ZAR', locale = 'en-ZA'): string {
  const value = Number(amount ?? 0);
  if (!Number.isFinite(value)) return '—';

  if (currency === 'ZAR') {
    const sign = value < 0 ? '−' : '';
    const [whole, cents] = Math.abs(value).toFixed(2).split('.');
    return `${sign}R ${groupDigits(whole, ' ')},${cents}`;
  }

  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/** Whole rands with no cents, for dashboard tiles. */
export function formatMoneyShort(amount: number | string | null | undefined, currency = 'ZAR'): string {
  const value = Math.round(Number(amount ?? 0));
  if (currency === 'ZAR') {
    const sign = value < 0 ? '−' : '';
    return `${sign}R ${groupDigits(String(Math.abs(value)), ' ')}`;
  }
  return formatMoney(value, currency);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-01" -> "1 Nov 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '—';
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Today's date in the device's local time as "YYYY-MM-DD". */
export function todayIso(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

/** "01/11/2026" -> "2026-11-01", or null when it isn't a real date. */
export function parseDayMonthYear(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "2026-11-01" -> "01/11/2026" */
export function toDayMonthYear(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Reads an amount typed by a person: "45000", "45 000", "R 45 000,50".
 * Returns null when it is not a valid amount (up to 2 decimals, no negatives).
 */
export function parseMoney(text: string): number | null {
  const cleaned = text.replace(/[\s\u00a0R]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** Reads a quantity such as "2", "0,5" or "1.25". Returns null unless it is above zero (up to 3 decimals). */
export function parseQuantity(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,3})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value > 0 ? value : null;
}
