import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { AppText, Button, Card, ErrorText, Segmented, TextField } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { COUNTRY_PRESETS, presetFor } from '@/lib/countries';
import { pickSquareImage, type PickedImage } from '@/lib/upload';

export type BusinessFormValues = {
  name: string;
  countryCode: string;
  currencyCode: string;
  taxName: string;
  taxRate: string;
  taxNumber: string;
  registrationNumber: string;
  address: string;
  phone: string;
  email: string;
  bankDetails: string;
  invoicePrefix: string;
  paymentTermsDays: string;
};

export const EMPTY_BUSINESS: BusinessFormValues = {
  name: '',
  countryCode: 'ZA',
  currencyCode: 'ZAR',
  taxName: 'VAT',
  taxRate: '15',
  taxNumber: '',
  registrationNumber: '',
  address: '',
  phone: '',
  email: '',
  bankDetails: '',
  invoicePrefix: 'INV-',
  paymentTermsDays: '14',
};

export function BusinessForm({
  initial,
  currentLogoUrl,
  submitLabel,
  onSubmit,
}: {
  initial: BusinessFormValues;
  currentLogoUrl?: string | null;
  submitLabel: string;
  onSubmit: (values: BusinessFormValues, logo: PickedImage | null) => Promise<void>;
}) {
  const [values, setValues] = useState(initial);
  const [logo, setLogo] = useState<PickedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof BusinessFormValues>(key: K, value: BusinessFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const chooseCountry = (code: string) => {
    const preset = presetFor(code);
    setValues((v) => ({
      ...v,
      countryCode: preset.code,
      currencyCode: preset.currency,
      taxName: preset.taxName,
      taxRate: String(preset.taxRate),
    }));
  };

  const chooseLogo = async () => {
    const picked = await pickSquareImage();
    if (picked) setLogo(picked);
  };

  const submit = async () => {
    setError(null);
    const rate = Number(values.taxRate.replace(',', '.'));
    const terms = Number(values.paymentTermsDays);
    if (!values.name.trim()) return setError('Enter your business name.');
    if (!Number.isFinite(rate) || rate < 0 || rate >= 100) return setError('Enter a tax rate between 0 and 99.');
    if (!Number.isInteger(terms) || terms < 0 || terms > 365) return setError('Payment terms must be 0 to 365 days.');
    if (!/^[A-Z]{3}$/.test(values.currencyCode.trim().toUpperCase())) return setError('Currency must be a 3-letter code, like ZAR.');

    setBusy(true);
    try {
      await onSubmit({ ...values, taxRate: String(rate), currencyCode: values.currencyCode.trim().toUpperCase() }, logo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    }
    setBusy(false);
  };

  const previewUri = logo?.uri ?? currentLogoUrl ?? null;

  return (
    <View style={styles.form}>
      <Card gold>
        <View style={styles.logoRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={previewUri ? 'Change business logo' : 'Upload business logo'}
            onPress={chooseLogo}
            style={styles.logoButton}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.logoImage} contentFit="cover" />
            ) : (
              <SymbolView name="square.and.arrow.up" tintColor={Colors.darkGold} size={24} />
            )}
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">Business logo</AppText>
            <AppText variant="small">Square image works best. It appears on your screens and invoices.</AppText>
          </View>
        </View>
        <TextField label="Business name" value={values.name} onChangeText={(t) => set('name', t)} />
      </Card>

      <Card>
        <AppText variant="heading">Country and tax</AppText>
        <Segmented
          label="Country"
          options={COUNTRY_PRESETS.map((p) => ({ value: p.code, label: p.name }))}
          value={values.countryCode}
          onChange={chooseCountry}
        />
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <TextField
              label="Currency"
              value={values.currencyCode}
              onChangeText={(t) => set('currencyCode', t)}
              autoCapitalize="characters"
              maxLength={3}
            />
          </View>
          <View style={styles.col}>
            <TextField label="Tax name" value={values.taxName} onChangeText={(t) => set('taxName', t)} />
          </View>
        </View>
        <TextField
          label="Tax rate (%)"
          value={values.taxRate}
          onChangeText={(t) => set('taxRate', t)}
          keyboardType="decimal-pad"
          hint="Check this is your current rate. You can switch tax on or off per invoice line."
        />
      </Card>

      <Card>
        <AppText variant="heading">Invoice details</AppText>
        <TextField label={`${values.taxName || 'Tax'} number`} value={values.taxNumber} onChangeText={(t) => set('taxNumber', t)} />
        <TextField
          label="Company registration number"
          value={values.registrationNumber}
          onChangeText={(t) => set('registrationNumber', t)}
        />
        <TextField label="Address" value={values.address} onChangeText={(t) => set('address', t)} multiline />
        <TextField label="Phone" value={values.phone} onChangeText={(t) => set('phone', t)} keyboardType="phone-pad" />
        <TextField
          label="Email for invoices"
          value={values.email}
          onChangeText={(t) => set('email', t)}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextField
          label="Banking details"
          value={values.bankDetails}
          onChangeText={(t) => set('bankDetails', t)}
          multiline
          hint="Bank, account name, account number, branch code. Printed on invoices."
        />
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <TextField
              label="Invoice prefix"
              value={values.invoicePrefix}
              onChangeText={(t) => set('invoicePrefix', t)}
              autoCapitalize="characters"
            />
          </View>
          <View style={styles.col}>
            <TextField
              label="Payment terms (days)"
              value={values.paymentTermsDays}
              onChangeText={(t) => set('paymentTermsDays', t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
            />
          </View>
        </View>
      </Card>

      <ErrorText message={error} />
      <Button title={submitLabel} onPress={submit} loading={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.md },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  logoButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.mutedGold,
    backgroundColor: Colors.lightGold,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: { width: 64, height: 64 },
  twoCol: { flexDirection: 'row', gap: Spacing.sm },
  col: { flex: 1 },
});
