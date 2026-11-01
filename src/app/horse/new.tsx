import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  BlueHeader,
  Button,
  Card,
  ErrorText,
  Loading,
  Segmented,
  TextField,
  ToggleRow,
} from '@/components/ui';
import { Colors, ContentMaxWidth, Fonts, Radius, Spacing } from '@/constants/theme';
import { parseDayMonthYear, toDayMonthYear, todayIso } from '@/lib/format';
import { PURPOSE_LABELS, SEX_LABELS } from '@/lib/labels';
import { supabase, type HorsePurpose, type HorseSex } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

const NEW_CLIENT = 'new';

export default function NewHorseScreen() {
  const insets = useSafeAreaInsets();
  const { business, features } = useBusiness();
  const bid = business!.id;

  const { data: owners, loading } = useScreenData(
    async () =>
      must(
        await supabase
          .from('owners')
          .select('id, name, is_self')
          .eq('business_id', bid)
          .is('archived_at', null)
          .order('is_self', { ascending: false })
          .order('name'),
      ),
    [bid],
  );

  const [name, setName] = useState('');
  const [stockNumber, setStockNumber] = useState('');
  const [breed, setBreed] = useState('');
  const [colour, setColour] = useState('');
  const [sex, setSex] = useState<HorseSex | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [entryDate, setEntryDate] = useState(toDayMonthYear(todayIso()));
  const [passport, setPassport] = useState('');
  const [microchipped, setMicrochipped] = useState(false);
  const [previousOwner, setPreviousOwner] = useState('');
  const [notes, setNotes] = useState('');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<HorsePurpose>('training');

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientConsent, setClientConsent] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selfOwner = owners?.find((o) => o.is_self);
  const chosenOwner = ownerId ?? selfOwner?.id ?? null;
  const isClientHorse = chosenOwner === NEW_CLIENT || (!!chosenOwner && chosenOwner !== selfOwner?.id);

  const purposeOptions = (['training', 'trading', 'broodstock'] as HorsePurpose[])
    .filter((p) => (p === 'trading' ? features.trading : p === 'broodstock' ? features.breeding : true))
    .map((p) => ({ value: p, label: PURPOSE_LABELS[p] }));

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError('Enter the horse’s name.');
    const entry = parseDayMonthYear(entryDate);
    if (!entry) return setError('Enter the entry date as day/month/year, for example 01/11/2026.');
    const born = birthDate.trim() ? parseDayMonthYear(birthDate) : null;
    if (birthDate.trim() && !born) return setError('Enter the birth date as day/month/year.');
    if (chosenOwner === NEW_CLIENT && !clientName.trim()) return setError('Enter the new client’s name.');
    if (!chosenOwner) return setError('Choose who owns this horse.');

    setBusy(true);
    try {
      let finalOwner = chosenOwner;
      if (chosenOwner === NEW_CLIENT) {
        const created = must(
          await supabase
            .from('owners')
            .insert({
              business_id: bid,
              name: clientName.trim(),
              phone: clientPhone.trim() || null,
              email: clientEmail.trim() || null,
              updates_consent: clientConsent,
              updates_consent_at: clientConsent ? new Date().toISOString() : null,
            })
            .select('id')
            .single(),
        );
        finalOwner = created.id;
      }

      const horse = must(
        await supabase
          .from('horses')
          .insert({
            business_id: bid,
            name: name.trim(),
            stock_number: stockNumber.trim() || null,
            breed: breed.trim() || null,
            colour: colour.trim() || null,
            sex,
            date_of_birth: born,
            entry_date: entry,
            passport_number: passport.trim() || null,
            microchipped,
            previous_owner: previousOwner.trim() || null,
            notes: notes.trim() || null,
            current_owner_id: finalOwner,
            current_purpose: isClientHorse ? 'training' : purpose,
          })
          .select('id')
          .single(),
      );
      router.replace({ pathname: '/horse/[id]', params: { id: horse.id } });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save the horse.';
      setError(message.includes('stock_number') ? 'Another horse already has this stock number.' : message);
      setBusy(false);
    }
  };

  if (loading && !owners) return <Loading />;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlueHeader title="Add a horse" showBack />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled">
        <Card gold>
          <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <TextField label="Stock number" value={stockNumber} onChangeText={setStockNumber} autoCapitalize="characters" />
            </View>
            <View style={styles.col}>
              <TextField label="Entry date" value={entryDate} onChangeText={setEntryDate} keyboardType="numbers-and-punctuation" />
            </View>
          </View>
        </Card>

        <Card>
          <AppText variant="heading">Owner</AppText>
          <View style={styles.ownerList} accessibilityRole="radiogroup" accessibilityLabel="Owner">
            {[...(owners ?? []), { id: NEW_CLIENT, name: '+ New client', is_self: false }].map((o) => {
              const selected = o.id === chosenOwner;
              return (
                <Pressable
                  key={o.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setOwnerId(o.id)}
                  style={[styles.ownerChip, selected && styles.ownerChipSelected]}>
                  <AppText
                    style={{ fontFamily: selected ? Fonts.bold : Fonts.semibold }}
                    color={selected ? Colors.gold : Colors.text}>
                    {o.is_self ? `${o.name} (own horse)` : o.name}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          {chosenOwner === NEW_CLIENT ? (
            <View style={{ gap: Spacing.md }}>
              <TextField label="Client name" value={clientName} onChangeText={setClientName} autoCapitalize="words" />
              <TextField label="Client phone" value={clientPhone} onChangeText={setClientPhone} keyboardType="phone-pad" />
              <TextField
                label="Client email"
                value={clientEmail}
                onChangeText={setClientEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <ToggleRow
                label="Client agreed to receive updates"
                value={clientConsent}
                onChange={setClientConsent}
                last
              />
            </View>
          ) : null}
          <Segmented
            label="Purpose"
            options={purposeOptions}
            value={isClientHorse ? 'training' : purpose}
            onChange={setPurpose}
            disabled={isClientHorse}
          />
          {isClientHorse ? <AppText variant="small">Client horses are always Training.</AppText> : null}
        </Card>

        <Card>
          <AppText variant="heading">Details</AppText>
          <Segmented
            label="Sex"
            options={(Object.keys(SEX_LABELS) as HorseSex[]).map((s) => ({ value: s, label: SEX_LABELS[s] }))}
            value={sex}
            onChange={setSex}
          />
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <TextField label="Breed" value={breed} onChangeText={setBreed} autoCapitalize="words" />
            </View>
            <View style={styles.col}>
              <TextField label="Colour" value={colour} onChangeText={setColour} autoCapitalize="words" />
            </View>
          </View>
          <TextField
            label="Date of birth"
            value={birthDate}
            onChangeText={setBirthDate}
            placeholder="dd/mm/yyyy"
            keyboardType="numbers-and-punctuation"
          />
          <TextField label="Passport / ID number" value={passport} onChangeText={setPassport} autoCapitalize="characters" />
          <ToggleRow label="Microchipped" value={microchipped} onChange={setMicrochipped} last />
          <TextField label="Previous owner" value={previousOwner} onChangeText={setPreviousOwner} autoCapitalize="words" />
          <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
        </Card>

        <ErrorText message={error} />
        <Button title="Save horse" onPress={save} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
  twoCol: { flexDirection: 'row', gap: Spacing.sm },
  col: { flex: 1 },
  ownerList: { gap: Spacing.sm },
  ownerChip: {
    minHeight: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  ownerChipSelected: { backgroundColor: Colors.deepBlue, borderColor: Colors.deepBlue },
});
