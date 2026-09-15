import { decode as decodeJpeg } from 'jpeg-js';

export interface ImageSignature {
  /** DCT-based perceptual hash, 64 bits. Invariant to brightness scaling. */
  phash: string;
  /** Gradient hash (horizontal + vertical), 128 bits. Invariant to additive
   *  brightness and local lighting gradients (shadows). */
  dhash: string;
  /** Hue-based colour histogram (8 hue bins + 1 grey bin), normalized. */
  color: number[];
}

/** A rectangular region (in source pixels) used to test small translations. */
export interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DecodedImage {
  data: Uint8Array;
  width: number;
  height: number;
}

export interface MatchResult {
  match: boolean;
  confidence: number;
  distance: number;
}

// Fusion weights. dHash and pHash carry the geometry/luminance signal; colour
// only contributes identity, so it is weighted lower (it degrades in the dark).
const WEIGHT_PHASH = 0.45;
const WEIGHT_DHASH = 0.35;
const WEIGHT_COLOR = 0.2;

export const MATCH_THRESHOLD = 0.7;

const PHASH_GRID = 8; // 8x8 low-frequency DCT block -> 64 bits
const DHASH_GRID = 9; // 9x9 luminance grid -> 128 bits
const COLOR_GRID = 8; // 8x8 pixels for the colour signature

export function base64ToBytes(b64: string): Uint8Array {
  const binary = typeof atob === 'function' ? atob(b64) : undefined;
  if (binary) {
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = b64.replace(/=+$/, '');
  const length = clean.length;
  const bytes = new Uint8Array((length * 3) >> 2);
  let p = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < length; i++) {
    const value = alphabet.indexOf(clean[i]);
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[p++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes;
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Downscale a region of RGBA pixel data to a `size x size` grid using
// average sampling. Returns grayscale if `gray` is true, otherwise the
// per-pixel RGB triplets.
function downscale(
  data: Uint8Array,
  width: number,
  height: number,
  size: number,
  gray: boolean,
  crop?: CropBox
): number[] {
  const cx = crop?.x ?? 0;
  const cy = crop?.y ?? 0;
  const cw = crop?.w ?? width;
  const ch = crop?.h ?? height;
  const out: number[] = gray ? new Array(size * size) : new Array(size * size * 3);
  for (let row = 0; row < size; row++) {
    const y0 = cy + Math.floor((row * ch) / size);
    const y1 = cy + Math.max(1, Math.floor(((row + 1) * ch) / size));
    for (let col = 0; col < size; col++) {
      const x0 = cx + Math.floor((col * cw) / size);
      const x1 = cx + Math.max(1, Math.floor(((col + 1) * cw) / size));
      let sum = 0;
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * width + x) * 4;
          rSum += data[idx];
          gSum += data[idx + 1];
          bSum += data[idx + 2];
          sum += luminance(data[idx], data[idx + 1], data[idx + 2]);
          count++;
        }
      }
      if (count === 0) count = 1;
      if (gray) {
        out[row * size + col] = sum / count;
      } else {
        out[(row * size + col) * 3] = rSum / count;
        out[(row * size + col) * 3 + 1] = gSum / count;
        out[(row * size + col) * 3 + 2] = bSum / count;
      }
    }
  }
  return out;
}

function dct8x8(block: number[]): number[] {
  const out = new Array(64);
  const pi = Math.PI;
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let sum = 0;
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          sum +=
            block[y * 8 + x] *
            Math.cos(((2 * x + 1) * u * pi) / 16) *
            Math.cos(((2 * y + 1) * v * pi) / 16);
        }
      }
      const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
      out[v * 8 + u] = 0.25 * cu * cv * sum;
    }
  }
  return out;
}

function phashOf(gray: number[]): string {
  const dct = dct8x8(gray);
  const coeffs = dct.filter((_, i) => i !== 0);
  const sorted = [...coeffs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  let hash = '';
  for (let i = 0; i < 64; i++) {
    if (i === 0) {
      hash += '0';
      continue;
    }
    hash += dct[i] >= median ? '1' : '0';
  }
  return hash;
}

function dhashOf(gray: number[]): string {
  let hash = '';
  const n = DHASH_GRID;
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n - 1; col++) {
      hash += gray[row * n + col] > gray[row * n + col + 1] ? '1' : '0';
    }
  }
  for (let col = 0; col < n; col++) {
    for (let row = 0; row < n - 1; row++) {
      hash += gray[row * n + col] > gray[(row + 1) * n + col] ? '1' : '0';
    }
  }
  return hash;
}

function colorSignatureOf(rgb: number[]): number[] {
  const bins = new Array(9).fill(0);
  const count = rgb.length / 3;
  for (let i = 0; i < count; i++) {
    const r = rgb[i * 3] / 255;
    const g = rgb[i * 3 + 1] / 255;
    const b = rgb[i * 3 + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const sat = max === 0 ? 0 : delta / max;
    if (sat < 0.12) {
      bins[0] += 1;
      continue;
    }
    let h: number;
    if (max === r) h = ((g - b) / delta / 6 + 1) % 1;
    else if (max === g) h = ((b - r) / delta / 6 + 1 / 3) % 1;
    else h = ((r - g) / delta / 6 + 2 / 3) % 1;
    const bin = 1 + Math.min(7, Math.floor(h * 8));
    bins[bin] += 1;
  }
  const sum = bins.reduce((a, b) => a + b, 0) || 1;
  for (let i = 0; i < bins.length; i++) bins[i] /= sum;
  return bins;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na * nb);
  return denom === 0 ? 0 : dot / denom;
}

export function decodeJpegBytes(bytes: Uint8Array): DecodedImage {
  const image = decodeJpeg(bytes, {
    useTArray: true,
    formatAsRGBA: true,
    colorTransform: true,
    maxMemoryUsageInMB: 512,
  });
  return { data: image.data, width: image.width, height: image.height };
}

export function signatureFromBase64(base64: string, crop?: CropBox): ImageSignature {
  const decoded = decodeJpegBytes(base64ToBytes(base64));
  return signatureFromPixels(decoded, crop);
}

export function signatureFromPixels(
  image: DecodedImage,
  crop?: CropBox
): ImageSignature {
  const { data, width, height } = image;
  const gray = downscale(data, width, height, PHASH_GRID, true, crop);
  const dGray = downscale(data, width, height, DHASH_GRID, true, crop);
  const rgb = downscale(data, width, height, COLOR_GRID, false, crop);
  return {
    phash: phashOf(gray),
    dhash: dhashOf(dGray),
    color: colorSignatureOf(rgb),
  };
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Number.MAX_SAFE_INTEGER;
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) distance++;
  }
  return distance;
}

/**
 * Compares two signatures and returns a combined confidence score (0..1).
 * A distance metric blends pHash, dHash and the colour signature.
 */
export function signaturesMatch(a: ImageSignature, b: ImageSignature): MatchResult {
  const dPh = hammingDistance(a.phash, b.phash) / a.phash.length;
  const dDh = hammingDistance(a.dhash, b.dhash) / a.dhash.length;
  const dCol = 1 - cosineSimilarity(a.color, b.color);

  const distance = WEIGHT_PHASH * dPh + WEIGHT_DHASH * dDh + WEIGHT_COLOR * dCol;
  const confidence = 1 - distance;
  return {
    match: confidence >= MATCH_THRESHOLD,
    confidence,
    distance,
  };
}