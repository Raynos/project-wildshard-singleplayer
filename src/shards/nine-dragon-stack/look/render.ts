// Nine Dragon Stack's render strategy (manifest.render → LookStrategy): the Jiehua Neon look as a post-graph look (G599 N1,
// game/looks/postGraphLook over weapons/jian-row.json look.post: the bleed pyramid, wet floor and haze march off the phone,
// the ink silhouette, 晕染 bleed, window glow, drizzle, shoulder, the learned LUT and grain as graphs). What stays here is
// the city's own frame: its culling, the sky standing on the eye, and the silk fog's lent params. Its per-frame numbers
// (the clock, the eye and near plane, the root's place, the band window, the halo and streak projection) are the look's
// declared 'nine.frame' channel group (generators/frameChannels.ts), evaluated by the post-graph look each frame.
import type { Object3D } from 'three';
import type { LookStrategy } from '@wildshard/engine/render/look';
import { postGraphLook } from '@wildshard/game/looks/postGraphLook';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { ndRuntime } from '../runtime/state';
import { Y0 } from '../boot/metadata.generated.json' with { type: 'json' };
import type { Shared } from './style';
import { syncLooks } from './facadeMaterial';

/**
 * The silk fog for the look graphs (O11): data/lookGraphs.json 'nine-silk-fog' is FOG_GLSL's silkFog as a `kind: 'fog'`
 * graph, and the graph looks that select it (`effectState.fog`: the Well's mist sheets) are fogged by it in the engine's
 * fog epilogue. Every eye write its params take the live shared rows the programs read (facadeMaterial.ts `syncLooks`; a
 * capture that clears the bands' depth scales them by `bandDepth`, which the composite reads too). Uniform writes only.
 */
const syncSilkFog = (shared: Shared): void => {
  const bandDepth = (shared.u.uBands.value[0]?.z ?? 0) / shared.baseBandDepth;
  shared.u.bandDepth.value = bandDepth;
  syncLooks(shared.u, { datum: Y0, bandDepth });
};

export async function shardRender(product: ShardProduct): Promise<LookStrategy> {
  const look = await postGraphLook(product, { file: 'weapons/jian-row.json', field: ['look', 'post'] });
  // the painted sky (the dressing step's, the 'nine-sky' look) is a sphere round the eye: it stands on uCam (the root's frame)
  let skyMesh: Object3D | null = null, skyRoot: Object3D | null = null;
  return {
    ...look,
    frame(dt, t): void {
      look.frame?.(dt, t);
      const rt = ndRuntime();
      rt.cull();
      const world = rt.world;
      if (skyRoot !== world.root) { skyRoot = world.root; skyMesh = world.root.getObjectByName('sky') ?? null; }
      skyMesh?.position.copy(world.shared.u.uCam.value);
      syncSilkFog(world.shared);
    },
  };
}
