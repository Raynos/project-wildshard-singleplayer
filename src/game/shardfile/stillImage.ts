import { parseStillImage } from '@wildshard/format/stillImage';

/** Resolve verified immutable bytes to a MIME-sniffed inert URL; never accept an authored URL or SVG. */
export function stillImageUrl(bytes: Uint8Array): string {
  const { mime } = parseStillImage(bytes);
  let binary = '';
  for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCodePoint(...bytes.subarray(start, start + 8192));
  return `data:${mime};base64,${btoa(binary)}`;
}

/** The same inert image as an object URL that its owner revokes: a large map's base64 copy cost a frame (44 ms at 4x CPU). */
export function stillImageObjectUrl(bytes: Uint8Array, owner: { onDispose: (fn: () => void) => void }): string {
  const { mime } = parseStillImage(bytes);
  const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: mime }));
  owner.onDispose(() => { URL.revokeObjectURL(url); });
  return url;
}
