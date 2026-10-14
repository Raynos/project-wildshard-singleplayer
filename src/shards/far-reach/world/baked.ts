import { fetchDeflated } from '@wildshard/sdk/kit/geometryPack';
import BRIDGE_PHYSICS from '../data/bridgePhysics.generated.json' with { type:'json' };
import PLACEMENTS from '../data/physicsPlacements.generated.json' with { type:'json' };
import { bakedMeshWorld, type BakedMeshKindRow } from '@wildshard/game/shardfile/bakedKinds';
import { SKY_PIECES } from '../data/pieces';
import { WORLD_BAKES } from '../data/worldBakes';
import { SKY_GROUND_COLLIDERS } from '../data/groundScene.generated';
import { BAKED_URLS, WORLD_BYTES, type BakedPiece } from '../data/files';
import { shackMaterial, type ShackKind } from './shack';
import { isleMaterial, setIslePack } from './isle';
import { dressingMaterial } from './dressing';

/**
 * SHARD-PLATFORM SF72: Sky Reach's world pieces drawn from their offline bake. The shapes are built at build time
 * (`generators/*.ts`, `scripts/bake-sky-world.mjs`) and folded into instanced kinds (`@wildshard/sdk/bake/kinds`); the
 * client loads each piece's GLB behind the loading screen and draws it in its own materials: a shack part in its kind's
 * material graph (`world/shack.ts`), a dressing kind in its own (`world/dressing.ts`), anything else in its row's standard material (a kind with a `paint` in the islands'
 * paint, `isleMaterial`). The colliders are the rows'.
 */

const SHACK: readonly ShackKind[] = ['plank', 'shingle', 'stone', 'beam'];
const shackKind = (kind: object): ShackKind | undefined => {
  const name: unknown = 'shack' in kind ? kind.shack : undefined;
  return SHACK.find((k) => k === name);
};

export const WORLD = bakedMeshWorld<BakedPiece, BakedMeshKindRow>(WORLD_BAKES, BAKED_URLS, 'far-reach', {
  resources: WORLD_BYTES, readBytes: fetchDeflated, placements:{rows:SKY_PIECES,colliders:[...BRIDGE_PHYSICS,...PLACEMENTS,...SKY_GROUND_COLLIDERS]},
  material: (kind) => { const shack = shackKind(kind), dressed: unknown = 'dressing' in kind ? kind.dressing : undefined;
    return shack !== undefined ? shackMaterial(shack) : typeof dressed === 'string' ? dressingMaterial(dressed) : 'paint' in kind ? isleMaterial() : undefined; },
  attributes: { _shk: 'aShk', _farcloth: 'aFarCloth' },
});
/** Load every baked piece, the islands and the meadow's blades (the plugin's `world` hook, before the world is built); a piece that fails to load is empty. */
export async function loadSkyBaked(): Promise<void> {
  await WORLD.load(); setIslePack(WORLD.bytes('isles'));
}

/** The meadow's baked blades (generators/meadowBlades.ts → baked/meadow-blades.bin, inflated); undefined when they did not load. */
export const skyMeadowBlades = (): Uint8Array | undefined => WORLD.bytes('blades') ?? undefined;

