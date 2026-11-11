// Starting values for a new business. Every value stays editable in setup,
// because tax rates change and the business must confirm its own.

export type CountryPreset = {
  code: string;
  name: string;
  currency: string;
  locale: string;
  timezone: string;
  taxName: string;
  taxRate: number;
};

export const COUNTRY_PRESETS: CountryPreset[] = [
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', locale: 'en-ZA', timezone: 'Africa/Johannesburg', taxName: 'VAT', taxRate: 15 },
  { code: 'NA', name: 'Namibia', currency: 'NAD', locale: 'en-NA', timezone: 'Africa/Windhoek', taxName: 'VAT', taxRate: 15 },
  { code: 'BW', name: 'Botswana', currency: 'BWP', locale: 'en-BW', timezone: 'Africa/Gaborone', taxName: 'VAT', taxRate: 14 },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', locale: 'en-GB', timezone: 'Europe/London', taxName: 'VAT', taxRate: 20 },
  { code: 'US', name: 'United States', currency: 'USD', locale: 'en-US', timezone: 'America/Chicago', taxName: 'Sales tax', taxRate: 0 },
  { code: 'AU', name: 'Australia', currency: 'AUD', locale: 'en-AU', timezone: 'Australia/Sydney', taxName: 'GST', taxRate: 10 },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD', locale: 'en-NZ', timezone: 'Pacific/Auckland', taxName: 'GST', taxRate: 15 },
];

// Sales tax in the US differs by state and county, so the rate starts at 0
// and the business sets its own. Time zones for large countries (US,
// Australia) are a starting guess only.

/** The formatting locale for a country code, or null when it is not one of the presets. */
export function localeForCountry(code: string | null | undefined): string | null {
  return COUNTRY_PRESETS.find((p) => p.code === code)?.locale ?? null;
}

export function presetFor(code: string): CountryPreset {
  return COUNTRY_PRESETS.find((p) => p.code === code) ?? COUNTRY_PRESETS[0];
}
