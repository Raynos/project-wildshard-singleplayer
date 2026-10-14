import { fetchDeflated } from '@wildshard/sdk/kit/geometryPack';
import { bakedMeshWorld, type BakedMeshKindRow, type LoadedMeshBake } from '@wildshard/game/shardfile/bakedKinds';
import WORLD_ROWS from '../data/worldBakes.generated.json' with { type: 'json' };
import { SIGNAL_PIECES } from '../data/pieces';
import { BAKED_URLS, WORLD_BYTES, type BakedPiece } from '../data/files';
import { warmByFire } from './meshes';

/**
 * SHARD-PLATFORM SF72 (SF67 fix 3, "bake the code-built worlds"): Signal Dunes' world pieces drawn from their offline bake.
 * The shapes are built at build time (`generators/*.ts`, `scripts/bake-signal-world.mjs`); the client reads each piece's
 * static GLB and its rows through the game's baked-world rows (`@wildshard/game/shardfile/bakedKinds`) and only adds its
 * own lighting: a kind marked `warm` is lit by the fires. The colliders never wait on the GLB.
 */
interface KindRow extends BakedMeshKindRow { readonly warm?: boolean; readonly brazier?: number }
export const WORLD = bakedMeshWorld<BakedPiece, KindRow>(WORLD_ROWS, BAKED_URLS, 'sunscar-dunes',
  { resources: WORLD_BYTES, readBytes: fetchDeflated, placements:{rows:SIGNAL_PIECES,colliders:WORLD_ROWS.braziers.braziers.map((row,index)=>({id:`sunscar.brazier.${String(index)}`,colliders:row.colliders}))}, decorate: (material, kind) => { if (kind.warm === true) warmByFire(material); } });

/** A loaded bake: each piece's instanced meshes (their geometry and transforms), keyed by the kind's name. */
export type BakedWorld = LoadedMeshBake<BakedPiece>;

