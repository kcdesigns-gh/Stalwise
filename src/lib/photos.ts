import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/upload';

export const PHOTO_BUCKET = 'horse-photos';
const URL_SECONDS = 60 * 60;

export type HorsePhoto = {
  id: string;
  horse_id: string;
  storage_path: string;
  caption: string | null;
  taken_on: string;
  is_main: boolean;
  url: string | null;
};

async function signedUrls(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, URL_SECONDS);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return map;
}

/** All photos of one horse, main photo first, then newest first. */
export async function loadHorsePhotos(horseId: string): Promise<HorsePhoto[]> {
  const { data, error } = await supabase
    .from('horse_photos')
    .select('id, horse_id, storage_path, caption, taken_on, is_main')
    .eq('horse_id', horseId)
    .order('is_main', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  const urls = await signedUrls((data ?? []).map((p) => p.storage_path));
  return (data ?? []).map((p) => ({ ...p, url: urls.get(p.storage_path) ?? null }));
}

/** One picture per horse for lists: the main photo, or else the newest. */
export async function loadAvatarUrls(businessId: string): Promise<Record<string, string>> {
  const { data } = await supabase
    .from('horse_photos')
    .select('horse_id, storage_path, is_main, created_at')
    .eq('business_id', businessId)
    .order('is_main', { ascending: false })
    .order('created_at', { ascending: false });
  const chosen = new Map<string, string>();
  for (const p of data ?? []) {
    if (!chosen.has(p.horse_id)) chosen.set(p.horse_id, p.storage_path);
  }
  const urls = await signedUrls([...chosen.values()]);
  const result: Record<string, string> = {};
  for (const [horseId, path] of chosen) {
    const url = urls.get(path);
    if (url) result[horseId] = url;
  }
  return result;
}

export type PickedPhoto = { uri: string; width: number };

/** Opens the camera or the gallery. Returns the chosen pictures, or [] if cancelled. */
export async function pickHorsePhotos(source: 'camera' | 'gallery'): Promise<PickedPhoto[]> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Allow camera access for Stalwise in your phone settings to take photos.');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    return result.canceled ? [] : result.assets.map((a) => ({ uri: a.uri, width: a.width }));
  }
  // iPhone's system photo picker needs no permission, so we don't ask there.
  if (Platform.OS !== 'ios') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('Allow photo access for Stalwise in your phone settings to add photos.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 10,
    quality: 0.8,
  });
  return result.canceled ? [] : result.assets.map((a) => ({ uri: a.uri, width: a.width }));
}

/** Shrinks a picture to at most 1600 pixels wide and saves it as JPEG. */
async function shrink({ uri, width }: PickedPhoto): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  if (!width || width > 1600) context.resize({ width: 1600, height: null });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  return saved.uri;
}

/** Shrinks, uploads and records each picture. Returns how many were added. */
export async function addHorsePhotos(businessId: string, horseId: string, photos: PickedPhoto[]): Promise<number> {
  let added = 0;
  for (const photo of photos) {
    const small = await shrink(photo);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const path = `${businessId}/${horseId}/${name}`;
    await uploadImage(PHOTO_BUCKET, path, { uri: small, mimeType: 'image/jpeg' }, { upsert: false });
    const { error } = await supabase
      .from('horse_photos')
      .insert({ business_id: businessId, horse_id: horseId, storage_path: path });
    if (error) {
      // Trainers cannot delete files, so a failed record may leave an unused file behind.
      await supabase.storage.from(PHOTO_BUCKET).remove([path]);
      throw error;
    }
    added += 1;
  }
  return added;
}
