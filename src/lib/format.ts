// Money and date formatting that follows the business's country settings.
// South Africa: R 1 250,00 and day/month/year.

// The locale of the business currently signed in (set by BusinessProvider).
// It decides money style and whether dates are typed day/month/year or
// month/day/year. Defaults to South Africa.
let currentLocale = 'en-ZA';

export function setFormatLocale(locale: string | null | undefined) {
  currentLocale = locale || 'en-ZA';
}

const MONTH_FIRST_LOCALES = ['en-US'];

function monthFirst(): boolean {
  return MONTH_FIRST_LOCALES.includes(currentLocale);
}

/** "day/month/year" or "month/day/year", for error messages. */
export function dateOrderWords(): string {
  return monthFirst() ? 'month/day/year' : 'day/month/year';
}

/** Placeholder text such as "dd/mm/yyyy". */
export function dateHint(): string {
  return monthFirst() ? 'mm/dd/yyyy' : 'dd/mm/yyyy';
}

/** A sample date typed the way this business types dates: 1 November 2026. */
export function dateExample(): string {
  return monthFirst() ? '11/01/2026' : '01/11/2026';
}

function groupDigits(digits: string, separator: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

export function formatMoney(amount: number | string | null | undefined, currency = 'ZAR', locale = currentLocale): string {
  const value = Number(amount ?? 0);
  if (!Number.isFinite(value)) return '—';

  if (currency === 'ZAR') {
    const sign = value < 0 ? '−' : '';
    const [whole, cents] = Math.abs(value).toFixed(2).split('.');
    return `${sign}R ${groupDigits(whole, ' ')},${cents}`;
  }

  // The Namibian dollar would otherwise show as a bare "$".
  if (currency === 'NAD') {
    return `${value < 0 ? '−' : ''}N$ ${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(value))}`;
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
  try {
    return new Intl.NumberFormat(currentLocale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
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

/**
 * Reads a typed date such as "01/11/2026" (day/month/year) or, for US
 * businesses, "11/01/2026" (month/day/year). Returns "2026-11-01", or null
 * when it isn't a real date.
 */
export function parseDayMonthYear(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!match) return null;
  const first = Number(match[1]);
  const second = Number(match[2]);
  const y = Number(match[3]);
  const [d, m] = monthFirst() ? [second, first] : [first, second];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "2026-11-01" -> "01/11/2026", or "11/01/2026" for a US business. */
export function toDayMonthYear(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return monthFirst() ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
}

export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Reads an amount typed by a person, in either style: "45000", "45 000",
 * "R 45 000,50", "$1,250.00", "1.250,50". Returns null when it is not a
 * valid amount (up to 2 decimals, no negatives).
 */
export function parseMoney(text: string): number | null {
  let t = text.replace(/[\s\u00a0]/g, '').replace(/^[^\d-]+/, '');
  const lastDot = t.lastIndexOf('.');
  const lastComma = t.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    // Both present: whichever comes last is the decimal mark.
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    t = t.split(thousands).join('').replace(decimal, '.');
  } else if (lastComma >= 0) {
    // "1,250" is thousands; "1,5" or "1,50" is a decimal comma.
    t = /^\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  } else if (lastDot >= 0 && /^\d{1,3}(\.\d{3}){2,}$/.test(t)) {
    t = t.replace(/\./g, '');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Number(t);
}

/** Reads a quantity such as "2", "0,5" or "1.25". Returns null unless it is above zero (up to 3 decimals). */
export function parseQuantity(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,3})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value > 0 ? value : null;
}
