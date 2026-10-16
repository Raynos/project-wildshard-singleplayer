/**
 * RopeBridge — where the gully's rope bridge hangs (E306 / E315 M1: the bridge is the model
 * src/shards/driftwood-isle/runtime/models/ropeBridge.ts; this is the world side). It places the bridge on its span: the model
 * is built for its ends (the terrain under them) and handed over in its own space, placed `single` back at end a; this
 * side hands its deck to the physics chain and poses the drawn deck from it.
 *
 *   const bridge = placeRopeBridge(sky, { a: [52, 48], b: [64, 60], sag: 1.1 }, registry);  // the game: piece `bridge`
 *   const chain = new RopeChain(physics, bridge.chainSpec());                                     // the deck
 *   game.onFixed('post', () => { chain.capture(); });
 *   game.onUpdate(() => { bridge.setPoses(chain, game.alpha); });
 */
import { modelContext } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { ropeBridge, ropeBridgeLayout, type RopeBridgeLayout, type RopeBridgeSpec } from '../runtime/models/ropeBridge';


/** Place the model and lend its original chain, pose and live floor owners. */
export function placeRopeBridge(sky: Sky, spec: RopeBridgeSpec, registry: WorldRegistry): Pick<RopeBridgeLayout, 'colliders' | 'chainSpec' | 'setPoses' | 'floorHeightAt'> & { placed: Placed } {
  const params = { span: spec, ground: heightAt };
  const lay = ropeBridgeLayout(sky, params), o = lay.o;
  const placed = place(ropeBridge, [{ x: o.x, y: o.y, z: o.z, params }], { ctx: modelContext(sky), draw: 'single', registry,
    piece: { id: 'bridge', floor: (px, pz) => lay.floorHeightAt(px, pz), solidFloor: true } });
  return {
    placed,
    colliders: lay.colliders,
    chainSpec: lay.chainSpec.bind(lay),
    setPoses: lay.setPoses.bind(lay),
    floorHeightAt: lay.floorHeightAt.bind(lay),
  };
}
