import { encodeCanonicalJson, hashImmutableBytes } from '@wildshard/sdk/immutable';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { isFrozenSources, type PineSources } from './pineSources';

const PIXEL_BYTES = 1000 * 1000 * 4;
/** Retain the normal full-program key and every already-read source identity.
 * Only pixel painting is memoized; raw inputs still cross ctx.cached admission.
 * Painting reads detached, hash-checked bodies so a changing source cannot
 * publish pixels under an earlier input identity. */
export async function cachedMapPixels(ctx: Pick<ProjectGenerationContext, 'cached'>, sources: PineSources,
  paint: (sources: PineSources) => Promise<Uint8Array>): Promise<Uint8Array> {
  const names = sources.list('').sort(), hashes = new Map<string, string>();
  for (const name of names) {
    if (hashes.has(name)) throw new Error('Duplicate Pine map source');
    hashes.set(name, hashImmutableBytes(sources.bytes(name)));
  }
  const identity = hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson([...hashes])));
  const checked: PineSources = {
    has: name => hashes.has(name),
    list: folder => names.filter(name => name.startsWith(folder)),
    bytes: name => {
      const hash = hashes.get(name);
      if (hash === undefined) throw new Error(`Undeclared Pine source ${name}`);
      const bytes = new Uint8Array(sources.bytes(name));
      if (hashImmutableBytes(bytes) !== hash) throw new Error(`Pine map source changed: ${name}`);
      return bytes;
    },
  };
  const files = await ctx.cached({ id: `pine-map-${identity}`, native: true }, async () => {
    const pixels = await paint(isFrozenSources(sources) ? sources : checked);
    if (pixels.byteLength !== PIXEL_BYTES) throw new Error('Pine map lattice size differs');
    return new Map([['map.rgba', pixels]]);
  });
  const pixels = files.get('map.rgba');
  if (files.size !== 1 || pixels === undefined || pixels.byteLength !== PIXEL_BYTES) throw new Error('Pine map lattice size differs');
  return pixels;
}
