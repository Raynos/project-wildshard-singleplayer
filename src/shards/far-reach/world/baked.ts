import { SKY_LIBRARY } from './meshes';
import { fetchDeflated } from '@wildshard/sdk/kit/geometryPack';
import STATIC_SCENES from '../data/staticScenes.generated.json' with { type:'json' };
import { bakedMeshWorld, type BakedMeshKindRow, type WorldPieceRow } from '@wildshard/game/shardfile/bakedKinds';
import WORLD_ROWS from '../data/worldRows.generated.json' with { type: 'json' };
import files from '../boot/assets.generated.json' with { type: 'json' };
import * as v from 'valibot';
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

type BakedPiece = keyof typeof files.BAKED_URLS;
const resources = v.parse(v.array(v.object({ id: v.string(), url: v.string(), compression: v.literal('deflate'),
  fault: v.object({ level: v.picklist(['warn', 'error']), message: v.string() }) })), files.WORLD_BYTES);

export const WORLD = bakedMeshWorld<BakedPiece, BakedMeshKindRow>(WORLD_ROWS.bakes, files.BAKED_URLS, 'far-reach', {
  resources, readBytes: fetchDeflated, placements:{rows:WORLD_ROWS.pieces as readonly WorldPieceRow<BakedPiece>[],colliders:STATIC_SCENES.standalone.fixed.colliders},
  material: (kind) => { const shack = shackKind(kind), dressed: unknown = 'dressing' in kind ? kind.dressing : undefined;
    return 'look' in kind && typeof kind.look === 'string' ? SKY_LIBRARY.look(kind.look) : shack !== undefined ? shackMaterial(shack) : typeof dressed === 'string' ? dressingMaterial(dressed) : 'paint' in kind ? isleMaterial() : undefined; },
  attributes: { _shk: 'aShk', _farcloth: 'aFarCloth' },
});
/** Load every baked piece, the islands and the meadow's blades (the plugin's `world` hook, before the world is built); a piece that fails to load is empty. */
export async function loadSkyBaked(): Promise<void> {
  await WORLD.load(); setIslePack(WORLD.bytes('isles'));
}

/** The meadow's baked blades (generators/meadowBlades.ts → baked/meadow-blades.bin, inflated); undefined when they did not load. */
export const skyMeadowBlades = (): Uint8Array | undefined => WORLD.bytes('blades') ?? undefined;

