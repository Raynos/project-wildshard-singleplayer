/** Legacy word-lane encoding, retained only for frozen consumers; no scene or runtime dependency. */
export function wildlifeWordLanes(bin: Uint8Array): Uint8Array {
  if (bin.length % 4 !== 0) throw new Error('[wildlife] the shape bake is not whole words');
  const n = bin.length / 4, out = new Uint8Array(bin.length);
  for (let i = 0; i < n; i++) for (let b = 0; b < 4; b++) out[b * n + i] = bin[i * 4 + b] ?? 0;
  return out;
}
