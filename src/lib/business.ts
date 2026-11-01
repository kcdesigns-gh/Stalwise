import type { BusinessFormValues } from '@/components/business-form';
import { presetFor } from '@/lib/countries';
import { supabase, type Tables } from '@/lib/supabase';
import { extensionFor, uploadImage, type PickedImage } from '@/lib/upload';

function blankToNull(text: string): string | null {
  const t = text.trim();
  return t ? t : null;
}

/** Saves profile fields (and a new logo, if chosen) onto an existing business. */
export async function saveBusinessProfile(businessId: string, values: BusinessFormValues, logo: PickedImage | null) {
  const preset = presetFor(values.countryCode);
  let logoPath: string | undefined;
  if (logo) {
    logoPath = await uploadImage(
      'business-assets',
      `${businessId}/logo-${Date.now()}.${extensionFor(logo.mimeType)}`,
      logo,
    );
  }

  const { error } = await supabase
    .from('businesses')
    .update({
      name: values.name.trim(),
      country_code: values.countryCode,
      currency_code: values.currencyCode,
      locale: preset.locale,
      timezone: preset.timezone,
      tax_name: values.taxName.trim() || 'Tax',
      default_tax_rate: Number(values.taxRate),
      tax_number: blankToNull(values.taxNumber),
      registration_number: blankToNull(values.registrationNumber),
      address: blankToNull(values.address),
      phone: blankToNull(values.phone),
      email: blankToNull(values.email),
      bank_details: blankToNull(values.bankDetails),
      invoice_prefix: values.invoicePrefix.trim() || 'INV-',
      payment_terms_days: Number(values.paymentTermsDays || '0'),
      setup_completed_at: new Date().toISOString(),
      ...(logoPath ? { logo_path: logoPath } : {}),
    })
    .eq('id', businessId);
  if (error) throw error;
}

/** Creates the business (making the caller its Manager), then saves the profile. */
export async function createBusiness(values: BusinessFormValues, logo: PickedImage | null): Promise<string> {
  const { data: businessId, error } = await supabase.rpc('create_business', {
    business_name: values.name.trim(),
    country_code: values.countryCode,
    currency_code: values.currencyCode,
    tax_name: values.taxName.trim() || 'Tax',
    default_tax_rate: Number(values.taxRate),
  });
  if (error || !businessId) throw error ?? new Error('The business could not be created.');
  await saveBusinessProfile(businessId, values, logo);
  return businessId;
}

export function formValuesFrom(b: Tables<'businesses'>): BusinessFormValues {
  return {
    name: b.name,
    countryCode: b.country_code,
    currencyCode: b.currency_code,
    taxName: b.tax_name,
    taxRate: String(b.default_tax_rate),
    taxNumber: b.tax_number ?? '',
    registrationNumber: b.registration_number ?? '',
    address: b.address ?? '',
    phone: b.phone ?? '',
    email: b.email ?? '',
    bankDetails: b.bank_details ?? '',
    invoicePrefix: b.invoice_prefix,
    paymentTermsDays: String(b.payment_terms_days),
  };
}
