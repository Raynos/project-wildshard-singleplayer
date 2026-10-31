import { compactPhoneGlb, compactClearGlb } from '@wildshard/sdk/bake/compactGlb';
import { encodeCanonicalJson, hashImmutableBytes } from '@wildshard/sdk/immutable';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import type { ShardEntryways } from '@wildshard/format/entryways';

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
  entryways: readonly Pick<ShardEntryways[number], 'edge' | 'width'>[]): Promise<Uint8Array> {
  const bytes = owned(input), hash = hashImmutableBytes(bytes), entries = entryways.map(row => ({ edge: row.edge, width: row.width }));
  if (entries.some(row => !['north', 'east', 'south', 'west'].includes(row.edge) || !Number.isFinite(row.width) || row.width <= 0)) throw new Error('Invalid Pine ground entryway');
  const key = hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson({ input: hash, entries })));
  const result = await cached(ctx, `ground-glb-${key}`, () => compactClearGlb(bytes, entries));
  return hashImmutableBytes(result) === hash && hashImmutableBytes(input) === hash ? input : result;
}
