import { Directory, File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import {
  base64ToBytes,
  decodeJpegBytes,
  signatureFromBase64,
  signatureFromPixels,
  signaturesMatch,
  type CropBox,
  type ImageSignature,
  type MatchResult,
} from './photoMatcher';

const DIRECTORY = 'upshot';
const MAX_REFERENCES = 3;

// Translation sweep on the captured photo: the object is rarely perfectly
// framed twice, so we test a handful of slightly shifted crop windows and keep
// the best confidence. Greatly improves tolerance to hand position.
const TRANSLATIONS: [number, number][] = [
  [0, 0],
  [8, 0],
  [-8, 0],
  [0, 8],
  [0, -8],
];
const CROP_PADDING = 16;

export interface ReferencePhoto {
  uri: string;
  index: number;
  signature: ImageSignature;
}

function refDir(): Directory {
  return new Directory(Paths.document, DIRECTORY);
}

function refFile(index: number): File {
  return new File(Paths.document, DIRECTORY, `ref-${index}.jpg`);
}

function ensureDirectory(): void {
  const dir = refDir();
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
}

// Migration from the previous single-file format (reference.jpg).
function migrateLegacy(): void {
  const dir = refDir();
  if (!dir.exists) return;
  const legacy = new File(dir, 'reference.jpg');
  if (legacy.exists && !refFile(0).exists) {
    legacy.copySync(refFile(0));
    legacy.delete();
  }
}

export function listReferenceUris(): string[] {
  migrateLegacy();
  const dir = refDir();
  if (!dir.exists) return [];
  try {
    return dir.list().filter((f) => /^ref-\d+\.jpg$/.test(f.name)).sort((a, b) => {
      const na = Number(a.name.replace(/\D/g, ''));
      const nb = Number(b.name.replace(/\D/g, ''));
      return na - nb;
    }).map((f) => f.uri);
  } catch {
    return [];
  }
}

export function getReferenceUri(): string | null {
  const uris = listReferenceUris();
  return uris.length > 0 ? uris[0] : null;
}

export async function hasReferencePhoto(): Promise<boolean> {
  return listReferenceUris().length > 0;
}

export async function getReferenceCount(): Promise<number> {
  return listReferenceUris().length;
}

export async function getReferencePhotos(): Promise<ReferencePhoto[]> {
  return listReferenceUris().map((uri, index) => ({
    uri,
    index,
    signature: signatureFromBase64(new File(uri).base64Sync()),
  }));
}

async function normalizeTo640(uri: string): Promise<string> {
  const result = await manipulateAsync(uri, [{ resize: { width: 640 } }], {
    compress: 0.8,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}

/**
 * Stores a reference photo. With `targetIndex` it replaces that exact angle;
 * without it, it appends a new angle (up to MAX_REFERENCES). Returns the final
 * stored URI.
 */
export async function saveReferencePhoto(
  sourceUri: string,
  targetIndex?: number
): Promise<string> {
  ensureDirectory();
  const normalized = await normalizeTo640(sourceUri);
  const source = new File(normalized);

  const index = targetIndex ?? listReferenceUris().length;
  if (index >= MAX_REFERENCES) {
    throw new Error('Já tens o máximo de 3 ângulos de referência.');
  }

  const target = refFile(index);
  if (target.exists) {
    target.delete();
  }
  source.copySync(target);
  return target.uri;
}

/**
 * Deletes one reference angle and renumbers the remaining files so there are
 * no gaps (ref-0, ref-1, ...).
 */
export async function deleteReferencePhoto(index: number): Promise<void> {
  const file = refFile(index);
  if (file.exists) {
    file.delete();
  }
  const nums = listReferenceUris().map((uri) =>
    Number(uri.slice(uri.lastIndexOf('ref-') + 4, uri.lastIndexOf('.')))
  );
  nums.forEach((num, newPos) => {
    if (num === newPos) return;
    const src = refFile(num);
    if (!src.exists) return;
    const dst = refFile(newPos);
    if (dst.exists) {
      dst.delete();
    }
    src.copySync(dst);
    src.delete();
  });
}

function translationCrops(decoded: {
  width: number;
  height: number;
}): CropBox[] {
  const maxW = Math.min(decoded.width, Math.max(200, decoded.width - CROP_PADDING));
  const maxH = Math.min(decoded.height, Math.max(200, decoded.height - CROP_PADDING));
  const cx0 = Math.round((decoded.width - maxW) / 2);
  const cy0 = Math.round((decoded.height - maxH) / 2);
  const stepX = Math.min(8, Math.floor(maxW / 8));
  const stepY = Math.min(8, Math.floor(maxH / 8));
  return TRANSLATIONS.map(([dx, dy]) => ({
    x: Math.max(0, Math.min(decoded.width - maxW, cx0 + dx * stepX)),
    y: Math.max(0, Math.min(decoded.height - maxH, cy0 + dy * stepY)),
    w: maxW,
    h: maxH,
  }));
}

/**
 * Compares a photo against every stored reference and returns the best match.
 * Returns undefined when no reference photo has been saved yet.
 */
export async function comparePhotoAgainstReference(
  photoUri: string
): Promise<(MatchResult & { referenceIndex: number }) | undefined> {
  const references = await getReferencePhotos();
  if (references.length === 0) return undefined;

  const normalized = await normalizeTo640(photoUri);
  const decoded = decodeJpegBytes(base64ToBytes(new File(normalized).base64Sync()));
  const capturedSignatures = translationCrops(decoded).map((crop) =>
    signatureFromPixels(decoded, crop)
  );

  let best: (MatchResult & { referenceIndex: number }) | null = null;
  for (const ref of references) {
    for (const captured of capturedSignatures) {
      const result = signaturesMatch(ref.signature, captured);
      if (!best || result.confidence > best.confidence) {
        best = { ...result, referenceIndex: ref.index };
      }
    }
  }
  return best ?? undefined;
}