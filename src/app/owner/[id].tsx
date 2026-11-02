import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BlueHeader, Button, Card, ErrorText, Loading, TextField, ToggleRow } from '@/components/ui';
import { Colors, ContentMaxWidth, Spacing } from '@/constants/theme';
import { supabase, type Tables } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';

export default function OwnerScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, error, loading, reload } = useScreenData(async () => {
    const [owner, horses] = await Promise.all([
      supabase.from('owners').select('*').eq('id', id).single(),
      supabase.from('horses').select('id, name, stock_number, current_purpose').eq('current_owner_id', id).is('archived_at', null).order('name'),
    ]);
    return { owner: must(owner), horses: must(horses) ?? [] };
  }, [id]);

  if (loading && !data) return <Loading />;
  if (!data) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Owner" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message={error ?? 'This owner could not be found.'} />
        </View>
      </View>
    );
  }
  return <OwnerView key={data.owner.id} owner={data.owner} horses={data.horses} insetsBottom={insets.bottom} reload={reload} />;
}

function OwnerView({
  owner,
  horses,
  insetsBottom,
  reload,
}: {
  owner: Tables<'owners'>;
  horses: { id: string; name: string; stock_number: string | null; current_purpose: string }[];
  insetsBottom: number;
  reload: () => Promise<void>;
}) {
  const [name, setName] = useState(owner.name);
  const [phone, setPhone] = useState(owner.phone ?? '');
  const [email, setEmail] = useState(owner.email ?? '');
  const [address, setAddress] = useState(owner.address ?? '');
  const [taxNumber, setTaxNumber] = useState(owner.tax_number ?? '');
  const [notes, setNotes] = useState(owner.notes ?? '');
  const [consent, setConsent] = useState(owner.updates_consent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    setNotice(null);
    if (!name.trim()) return setError('Enter the owner’s name.');
    setBusy(true);
    const { error: e } = await supabase
      .from('owners')
      .update({
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        tax_number: taxNumber.trim() || null,
        notes: notes.trim() || null,
        updates_consent: consent,
        updates_consent_at: consent && !owner.updates_consent ? new Date().toISOString() : owner.updates_consent_at,
      })
      .eq('id', owner.id);
    setBusy(false);
    if (e) return setError(e.message);
    setNotice('Saved.');
    await reload();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlueHeader title={owner.is_self ? `${owner.name} (own)` : owner.name} showBack />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insetsBottom + 32 }]} keyboardShouldPersistTaps="handled">
        {horses.length > 0 ? (
          <Card>
            <AppText variant="heading">Horses</AppText>
            {horses.map((h, i) => (
              <Pressable
                key={h.id}
                accessibilityRole="link"
                onPress={() => router.push({ pathname: '/horse/[id]', params: { id: h.id } })}
                style={[styles.horseRow, i < horses.length - 1 && styles.divider]}>
                <AppText>{h.name}</AppText>
                <AppText variant="small">{h.stock_number ?? ''}</AppText>
              </Pressable>
            ))}
          </Card>
        ) : null}

        {!owner.is_self ? (
          <Card gold>
            <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
            <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextField label="Address" value={address} onChangeText={setAddress} multiline />
            <TextField label="Tax / VAT number" value={taxNumber} onChangeText={setTaxNumber} />
            <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
            <ToggleRow label="Agreed to receive WhatsApp/email updates" value={consent} onChange={setConsent} last />
            <ErrorText message={error} />
            {notice ? <AppText variant="small" color={Colors.success}>{notice}</AppText> : null}
            <Button title="Save" onPress={save} loading={busy} />
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
  horseRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
});
