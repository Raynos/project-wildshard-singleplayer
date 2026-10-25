import rows from '../data/nativeDecals.json' with { type: 'json' };
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';

const tiers = ['phone', 'desktop'] as const;

/** Admit the pinned native PNGs as real product images, with no generated metadata or source-tree blobs. */
export function nineDecalBlobs(files: ReadonlyMap<string, Uint8Array>): readonly NamedBlob[] {
  if (files.size !== tiers.length) throw new Error('Nine native decal inventory differs');
  return tiers.map(tier => {
    const row = rows[tier], bytes = files.get(row.file);
    if (bytes === undefined || hashImmutableBytes(bytes) !== row.hash) throw new Error(`Nine ${tier} native decal bytes differ`);
    return nameBlob(`looks/jian-decal-${tier}.png`, 'image', bytes);
  });
}

/** Public asset roots come only from the author CLI's explicit capabilities. Inputs are read on cache hits too. */
export async function nineNativeDecals(ctx: ProjectGenerationContext): Promise<readonly NamedBlob[]> {
  const files = await ctx.cached({ id: 'native-jian-decals', inputs: tiers.map(tier => rows[tier].url) }, inputs => new Map(tiers.map(tier => {
    const row = rows[tier], bytes = inputs.get(row.url);
    if (bytes === undefined) throw new Error(`Missing Nine ${tier} native decal`);
    return [row.file, bytes];
  })));
  const blobs = nineDecalBlobs(files);
  for (const blob of blobs) if (ctx.asset(blob.bytes) !== blob.file.hash) throw new Error('Nine native decal publication differs');
  return blobs;
}
