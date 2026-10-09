/**
 * Pine Hollow's offline bakes as they ship (G285): a binary of 4-byte words whose bytes are split into four lanes (every
 * word's first bytes, then its second …: floats compress ~30 % better so) and zlib-compressed. The generators write them
 * (../generators/crags.ts `shuffleLanes`); the page reads them here, behind the loading screen.
 */

/** The binary from its shipped lanes (`shuffleLanes` reversed). */
export function unshuffleLanes(lanes: Uint8Array): Uint8Array {
  if (lanes.length % 4 !== 0) throw new Error('[pine-hollow] a bake is not whole words');
  const n = lanes.length / 4, out = new Uint8Array(lanes.length);
  for (let b = 0; b < 4; b++) for (let i = 0; i < n; i++) out[i * 4 + b] = lanes[b * n + i] ?? 0;
  return out;
}

/** Fetch a bake, inflate it and put its lanes back. */
export async function fetchBake(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok || response.body === null) throw new Error(`${String(response.status)} ${url}`);
  return unshuffleLanes(new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer()));
}
