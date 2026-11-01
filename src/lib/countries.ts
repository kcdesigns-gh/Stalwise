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
  { code: 'AU', name: 'Australia', currency: 'AUD', locale: 'en-AU', timezone: 'Australia/Sydney', taxName: 'GST', taxRate: 10 },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD', locale: 'en-NZ', timezone: 'Pacific/Auckland', taxName: 'GST', taxRate: 15 },
];

export function presetFor(code: string): CountryPreset {
  return COUNTRY_PRESETS.find((p) => p.code === code) ?? COUNTRY_PRESETS[0];
}
