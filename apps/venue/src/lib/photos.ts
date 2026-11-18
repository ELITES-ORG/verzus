import { supabase } from './supabase';

const BUCKET = 'venue-photos';

/** Longest side in pixels for each kind of photo. Phone photos are shrunk before upload. */
export const PHOTO_SIZES = { logo: 512, cover: 2000, gallery: 1600 } as const;
export type PhotoKind = keyof typeof PHOTO_SIZES;

export function photoUrl(path: string | null | undefined): string | null {
  return path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null;
}

/**
 * Shrinks the image to fit `PHOTO_SIZES[kind]` on its longest side, re-encodes it as WebP, and
 * uploads it to venue-photos/<venueId>/<kind>-<time>.webp (owners can only write to their own
 * venue's folder). Returns the storage path.
 */
export async function uploadVenuePhoto(venueId: string, kind: PhotoKind, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.');
  const blob = await shrink(file, PHOTO_SIZES[kind]);
  const path = `${venueId}/${kind}-${Date.now()}.webp`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/webp', upsert: false });
  if (error) throw error;
  return path;
}

/** Deletes a replaced or removed photo. Failure only leaves an unused file behind, so it's not fatal. */
export async function removeVenuePhoto(path: string | null | undefined): Promise<void> {
  if (path) await supabase.storage.from(BUCKET).remove([path]);
}

async function shrink(file: File, maxSide: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot process images.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
  if (!blob) throw new Error('Could not process that image. Try a JPEG or PNG.');
  return blob;
}
