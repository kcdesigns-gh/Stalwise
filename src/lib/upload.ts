import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

export type PickedImage = { uri: string; mimeType: string };

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/** Opens the photo library for a square image (used for business logos). */
export async function pickSquareImage(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    // Below 1 makes iOS re-encode as JPEG, which also shrinks the file.
    quality: 0.7,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const mimeType = asset.mimeType && ALLOWED.includes(asset.mimeType) ? asset.mimeType : 'image/jpeg';
  return { uri: asset.uri, mimeType };
}

/** Uploads a local image to a private bucket and returns its storage path. */
export async function uploadImage(bucket: string, path: string, image: PickedImage): Promise<string> {
  const response = await fetch(image.uri);
  const bytes = await response.arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: image.mimeType,
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export function extensionFor(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}
