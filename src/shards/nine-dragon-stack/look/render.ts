// Nine Dragon Stack's render strategy (manifest.render → LookStrategy): the Jiehua Neon look as a post-graph look (G599 N1,
// game/looks/postGraphLook over weapons/jian-row.json look.post: the bleed pyramid, wet floor and haze march off the phone,
// the ink silhouette, 晕染 bleed, window glow, drizzle, shoulder, the learned LUT and grain as graphs). What stays here is
// the city's own frame: its culling, the eye the shared fog and sky stand on, and the silk fog's lent params.
import type { Object3D, PerspectiveCamera } from 'three';
import type { LookStrategy } from '@wildshard/engine/render/look';
import { postGraphLook } from '@wildshard/game/looks/postGraphLook';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { setLentParam } from '@wildshard/sdk/looks/lentLooks';
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
  const onEye = (root: Object3D, shared: Shared, camera: PerspectiveCamera): void => {
    shared.u.uHaloProjection.value = camera.projectionMatrix.elements[5];
    setLentParam('nine-streaks', 'projection', [camera.projectionMatrix.elements[0], camera.projectionMatrix.elements[5]]);
    if (skyRoot !== root) { skyRoot = root; skyMesh = root.getObjectByName('sky') ?? null; }
    skyMesh?.position.copy(shared.u.uCam.value);
    syncSilkFog(shared);
  };
  return {
    ...look,
    frame(dt, t): void {
      look.frame?.(dt, t);
      const rt = ndRuntime();
      rt.cull();
      const world = rt.world, view = rt.camera;
      // Pose the shared fog and sky from the drawn eye in either composition.
      world.shared.u.uCam.value.setFromMatrixPosition(view.matrixWorld);
      world.shared.bandWindow();
      onEye(world.root, world.shared, view);
      world.shared.u.uNear.value = view.near;
    },
  };
}
