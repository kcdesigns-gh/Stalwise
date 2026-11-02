import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Badge, BlueHeader, Button, Card, ErrorText, Loading, TextField } from '@/components/ui';
import { Colors, ContentMaxWidth, Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import { PHOTO_BUCKET } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

export default function PhotoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, error, loading, reload } = useScreenData(async () => {
    const photo = must(
      await supabase
        .from('horse_photos')
        .select('id, horse_id, storage_path, caption, taken_on, is_main, horses(name)')
        .eq('id', id)
        .single(),
    );
    const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(photo.storage_path, 60 * 60);
    return { photo, url: signed?.signedUrl ?? null };
  }, [id]);

  if (loading && !data) return <Loading />;
  if (!data) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Photo" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message={error ?? 'This photo could not be found.'} />
        </View>
      </View>
    );
  }
  return <PhotoView key={data.photo.id} {...data} reload={reload} />;
}

type Photo = {
  id: string;
  horse_id: string;
  storage_path: string;
  caption: string | null;
  taken_on: string;
  is_main: boolean;
  horses: { name: string } | null;
};

function PhotoView({ photo, url, reload }: { photo: Photo; url: string | null; reload: () => Promise<void> }) {
  const insets = useSafeAreaInsets();
  const { isManager } = useBusiness();
  const [caption, setCaption] = useState(photo.caption ?? '');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const horseName = photo.horses?.name ?? 'Horse';

  const run = async (work: () => Promise<{ error: { message: string } | null }>, done: string) => {
    setError(null);
    setMessage(null);
    setBusy(true);
    const { error: e } = await work();
    setBusy(false);
    if (e) return setError(e.message);
    setMessage(done);
    await reload();
  };

  const saveCaption = () =>
    run(
      async () => await supabase.from('horse_photos').update({ caption: caption.trim() || null }).eq('id', photo.id),
      'Caption saved.',
    );

  const makeMain = () => run(async () => await supabase.rpc('set_main_horse_photo', { photo: photo.id }), 'This is now the main photo.');

  const remove = async () => {
    if (!confirmDelete) return setConfirmDelete(true);
    setError(null);
    setBusy(true);
    const { error: e } = await supabase.from('horse_photos').delete().eq('id', photo.id);
    if (e) {
      setBusy(false);
      return setError(e.message);
    }
    // The record is gone; removing the file itself is a tidy-up and may fail quietly.
    await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
    router.back();
  };

  return (
    <View style={{ flex: 1 }}>
      <BlueHeader title={horseName} subtitle={`Photo · ${formatDate(photo.taken_on)}`} showBack />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.frame}>
          {url ? (
            <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel={photo.caption ?? `Photo of ${horseName}`} />
          ) : (
            <AppText color={Colors.softBlue}>The picture could not be loaded.</AppText>
          )}
        </View>

        {photo.is_main ? <Badge label="Main photo" tone="gold" /> : null}
        {!isManager && photo.caption ? <AppText>{photo.caption}</AppText> : null}

        <ErrorText message={error} />
        {message ? <AppText variant="small">{message}</AppText> : null}

        {isManager ? (
          <Card>
            <TextField label="Caption" value={caption} onChangeText={setCaption} placeholder="For example: after the show in Bloemfontein" />
            <Button
              kind="secondary"
              title="Save caption"
              onPress={saveCaption}
              loading={busy}
              disabled={caption.trim() === (photo.caption ?? '')}
            />
            {!photo.is_main ? <Button icon="crown" title="Make main photo" onPress={makeMain} disabled={busy} /> : null}
            <Button
              kind="secondary"
              title={confirmDelete ? 'Tap again to delete this photo' : 'Delete photo'}
              onPress={remove}
              disabled={busy}
            />
            {confirmDelete ? <AppText variant="small" color={Colors.danger}>This will permanently remove the photo.</AppText> : null}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
  frame: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.deepBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
