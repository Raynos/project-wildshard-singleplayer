import { compactPhoneGlb, compactClearGlb, nameCompactBlobs } from '@wildshard/sdk/bake/compactGlb';
import { encodeCanonicalJson, hashImmutableBytes } from '@wildshard/sdk/immutable';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import type { Shardfile } from '@wildshard/sdk/shardfile';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';

function owned(input: Uint8Array): Uint8Array {
  if (!(input instanceof Uint8Array) || input.byteLength > 256_000_000) throw new Error('Invalid Pine phone geometry input');
  return new Uint8Array(input);
}

async function cached(ctx: Pick<ProjectGenerationContext, 'cached'>, id: string,
  generate: () => Promise<Uint8Array>): Promise<Uint8Array> {
  const files = await ctx.cached({ id, native: true }, async () => new Map([['geometry.glb', await generate()]]));
  const result = files.get('geometry.glb');
  if (files.size !== 1 || result === undefined || result.byteLength === 0) throw new Error('Missing cached Pine phone geometry');
  return result;
}

/** Preserve the original per-root-grid and brotli choice for an exact rest pool.
 * Normal ctx.cached binds the complete program/compiler and native host; named
 * blob admission still reads the returned bytes. Own input before keying it. */
export function cachedTreeRest(ctx: Pick<ProjectGenerationContext, 'cached'>, input: Uint8Array): Promise<Uint8Array> {
  const bytes = owned(input), hash = hashImmutableBytes(bytes);
  return cached(ctx, `tree-rest-${hash}`, () => compactPhoneGlb(bytes, { each: true }));
}

/** Cache the original contain-grid choice and complete entryway-clearance
 * selection against the owned GLB and every edge/width. Downstream geometry
 * admission is unchanged. Preserve the original identity when bytes were kept. */
export async function cachedGroundTile(ctx: Pick<ProjectGenerationContext, 'cached'>, input: Uint8Array,
  entryways: readonly Pick<Shardfile['entryways'][number], 'edge' | 'width'>[]): Promise<Uint8Array> {
  const bytes = owned(input), hash = hashImmutableBytes(bytes), entries = entryways.map(row => ({ edge: row.edge, width: row.width }));
  if (entries.some(row => !['north', 'east', 'south', 'west'].includes(row.edge) || !Number.isFinite(row.width) || row.width <= 0)) throw new Error('Invalid Pine ground entryway');
  const key = hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson({ input: hash, entries })));
  const result = await cached(ctx, `ground-glb-${key}`, () => compactClearGlb(bytes, entries));
  return hashImmutableBytes(result) === hash && hashImmutableBytes(input) === hash ? input : result;
}

/** Memo the original ordered batch, including its duplicate-hash fallback.
 * Keep all name/kind/cost admission fresh on the returned bytes. Inputs are
 * privately copied before hashing or awaiting the cache owner. */
export async function cachedCompactShapes(ctx: Pick<ProjectGenerationContext, 'cached'>,
  shapes: readonly (readonly [string, Uint8Array])[]): Promise<NamedBlob[]> {
  const inputs = shapes.map(([name, bytes]) => [name, owned(bytes)] as const);
  const identity = hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(
    inputs.map(([name, bytes]) => [name, hashImmutableBytes(bytes)]))));
  const files = await ctx.cached({ id: `cab-pack-${identity}`, native: true }, async () =>
    new Map((await nameCompactBlobs(inputs)).map((blob, index) => [`${String(index)}.glb`, blob.bytes])));
  if (files.size !== inputs.length) throw new Error('Pine shape cache inventory differs');
  return inputs.map(([name], index) => {
    const bytes = files.get(`${String(index)}.glb`);
    if (bytes === undefined || bytes.byteLength === 0) throw new Error('Pine shape cache inventory differs');
    return nameBlob(name, 'glb', bytes);
  });
}
