import { parseStillImage } from '@wildshard/format/stillImage';

/** Resolve verified immutable bytes to a MIME-sniffed inert URL; never accept an authored URL or SVG. */
export function stillImageUrl(bytes: Uint8Array): string {
  const { mime } = parseStillImage(bytes);
  let binary = '';
  for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCodePoint(...bytes.subarray(start, start + 8192));
  return `data:${mime};base64,${btoa(binary)}`;
}
