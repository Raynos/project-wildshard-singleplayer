import { hashImmutableBytes } from '@wildshard/sdk/immutable';

/** Original four-byte lane order, without compression or filesystem publication. */
export function shuffleNalatiWords(bin:Uint8Array):Uint8Array {
  if (bin.length % 4 !== 0) throw new Error('[nalati places] the bake is not whole words');
  const n = bin.length / 4, shuffled = new Uint8Array(bin.length);
  for (let i = 0; i < n; i++) for (let b = 0; b < 4; b++) shuffled[b * n + i] = bin[i * 4 + b] ?? 0;
  return shuffled;
}

/** Original Nalati lane ordering and wire envelope, without filesystem publication. */
export function encodeNalatiPart(part: { readonly rows: readonly unknown[]; readonly bin: Uint8Array }, deflate: (bytes: Uint8Array) => Uint8Array): { binary: Uint8Array; document: Uint8Array } {
  const bin=part.bin,shuffled=shuffleNalatiWords(bin);
  const stamp = { notice: 'DO NOT EDIT: regenerate with generators/bake-nalati-places.mjs (Node canonical).',
    bin: hashImmutableBytes(bin), bytes: bin.length, rows: part.rows };
  return { binary: new Uint8Array(deflate(shuffled)), document: new TextEncoder().encode(`${JSON.stringify(stamp)}\n`) };
}
