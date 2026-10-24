import { templateProduct } from './product';
import { templateTerrain } from './terrain';
import { templatePropRows } from './props';
import type { ProjectGenerationContext, GeneratedProject } from '@wildshard/sdk/projectGeneration';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { templateBehaviour } from './behaviour';
import { templateBoss, TEMPLATE_BOSS_INPUTS } from './boss';
import { templateOutput } from './productOutput';

// Edit the build-time declaration to author this project's data.
export async function generate(ctx: ProjectGenerationContext): Promise<GeneratedProject> {
  const behaviour = await templateBehaviour(ctx), boss = await templateBoss(ctx);
  const files = await ctx.cached({ id: 'world-product', inputs: TEMPLATE_BOSS_INPUTS }, () => {
    const { assets, ...terrain } = templateTerrain();
    const props = templatePropRows();
    return new Map([['shard.json', new TextEncoder().encode(JSON.stringify(templateProduct(terrain, props, behaviour, boss)))], ...assets, ...props.assets]);
  });
  const metadata = files.get('shard.json');
  if (metadata === undefined) throw new Error('Terrain cache misses shard rows');
  const shard = parseShardfile(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(metadata)));
  for (const [hash, bytes] of files) if (hash !== 'shard.json' && ctx.asset(bytes) !== hash) throw new Error('Terrain asset hash differs');
  return { shard, output: templateOutput(boss) };
}
