// oxlint-disable-next-line unicorn/prefer-export-from -- E434 forbids re-export barrels.
import product, { templateProduct } from './generators/product';
import { templateTerrain } from './generators/terrain';
import { templatePropRows } from './generators/props';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { parseShardfile, type Shardfile } from '@wildshard/sdk/shardfile';
import { BUILD_OPTIONS } from './generators/buildOptions';

// Edit the build-time declaration to author this project's data.
export async function generate(ctx: ProjectGenerationContext): Promise<Shardfile> {
  const files = await ctx.cached({ id: 'world-product' }, () => {
    const { assets, ...terrain } = templateTerrain();
    const props = templatePropRows();
    return new Map([['shard.json', new TextEncoder().encode(JSON.stringify(templateProduct(terrain, props)))], ...assets, ...props.assets]);
  });
  const metadata = files.get('shard.json');
  if (metadata === undefined) throw new Error('Terrain cache misses shard rows');
  const shard = parseShardfile(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(metadata)));
  for (const [hash, bytes] of files) if (hash !== 'shard.json' && ctx.asset(bytes) !== hash) throw new Error('Terrain asset hash differs');
  return shard;
}

// oxlint-disable-next-line import/no-default-export -- Preserve direct declaration readers during GR1 migration.
export default product;

/** Explicit standalone AssemblyScript policy, consumed only by the author build. */
export const buildOptions = { ...BUILD_OPTIONS };
