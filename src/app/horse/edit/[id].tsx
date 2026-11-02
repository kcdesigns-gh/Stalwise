import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlueHeader, Button, Card, ErrorText, Loading, Segmented, TextField, ToggleRow } from '@/components/ui';
import { ContentMaxWidth, Spacing } from '@/constants/theme';
import { parseDayMonthYear, toDayMonthYear } from '@/lib/format';
import { SEX_LABELS } from '@/lib/labels';
import { supabase, type HorseSex, type Tables } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

export default function EditHorseScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isManager } = useBusiness();

  const { data: horse, error, loading } = useScreenData(
    async () => must(await supabase.from('horses').select('*').eq('id', id).single()),
    [id],
  );

  if (!isManager) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Edit horse" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message="Only the Manager can edit horse details." />
        </View>
      </View>
    );
  }
  if (loading && !horse) return <Loading />;
  if (!horse) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Edit horse" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message={error ?? 'This horse could not be found.'} />
        </View>
      </View>
    );
  }
  return <EditForm key={horse.id} horse={horse} insetsBottom={insets.bottom} />;
}

function EditForm({ horse, insetsBottom }: { horse: Tables<'horses'>; insetsBottom: number }) {
  const [name, setName] = useState(horse.name);
  const [stockNumber, setStockNumber] = useState(horse.stock_number ?? '');
  const [breed, setBreed] = useState(horse.breed ?? '');
  const [colour, setColour] = useState(horse.colour ?? '');
  const [sex, setSex] = useState<HorseSex | null>(horse.sex);
  const [birthDate, setBirthDate] = useState(horse.date_of_birth ? toDayMonthYear(horse.date_of_birth) : '');
  const [entryDate, setEntryDate] = useState(toDayMonthYear(horse.entry_date));
  const [passport, setPassport] = useState(horse.passport_number ?? '');
  const [microchipped, setMicrochipped] = useState(horse.microchipped);
  const [previousOwner, setPreviousOwner] = useState(horse.previous_owner ?? '');
  const [notes, setNotes] = useState(horse.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError('Enter the horse’s name.');
    const entry = parseDayMonthYear(entryDate);
    if (!entry) return setError('Enter the entry date as day/month/year, for example 01/11/2026.');
    const born = birthDate.trim() ? parseDayMonthYear(birthDate) : null;
    if (birthDate.trim() && !born) return setError('Enter the birth date as day/month/year.');

    setBusy(true);
    const { error: e } = await supabase
      .from('horses')
      .update({
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
      })
      .eq('id', horse.id);
    setBusy(false);
    if (e) {
      setError(e.message.includes('stock_number') ? 'Another horse already has this stock number.' : e.message);
      return;
    }
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlueHeader title={`Edit ${horse.name}`} showBack />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insetsBottom + 32 }]}
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
        <Button title="Save changes" onPress={save} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
  twoCol: { flexDirection: 'row', gap: Spacing.sm },
  col: { flex: 1 },
});
