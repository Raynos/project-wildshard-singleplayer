import { HORIZON_RADIUS } from '@wildshard/format/contentBounds';
import { SHORE_REVETMENT_INNER_FACE } from '@wildshard/engine/sim/shore';
import { OCEAN } from './worldSites';
import { collectionRows } from './collections';
import { FIXED_DRAW_ROWS } from './modelFiles';
import { DRIFTWOOD_ASSET_NAMES } from './assets';
import { ENTRY_DECKS } from './entryDecks';
import cumulusPuffs from '../data/cumulusPuffs.json' with { type: 'json' };
import { GULL_FLOCK } from './gullsLook';
import { OCEAN_SURFACE } from './oceanLook';
import { OCEAN_FILES } from './oceanFiles';
import { OCEAN_FOAM, type Box } from './oceanFoam';



/** O7: the lowered sea as the client plan's `world.water` row: its baked grid per tier, floor and foam, clipped out
 *  under each whole road deck (G170: the socket and its landing, in the landings' edge order), its night param lent from
 *  the toon lighting, whose sea level is the sea's. */
/** a product file name for an authored asset label (the build's asset index; the runtime reads names only) */
const named = (label: string): string => { const name = DRIFTWOOD_ASSET_NAMES[label]; if (name === undefined) throw new Error(`Missing named asset: ${label}`); return name; };
export const OCEAN_WATER_ROW: { readonly id: "sea"; readonly surface: { readonly params: { readonly level: number; readonly deepDepth: number; readonly shallow: readonly [number, number, number]; readonly deep: readonly [number, number, number]; readonly edgeInset: 0.8; readonly seaEnd: 2300; }; readonly look: "driftwood-ocean"; readonly name: "driftwood-ocean"; readonly renderOrder: 4; readonly culled: false; readonly waves: true; readonly bind: { readonly clock: "clock"; readonly waterHalf: "waterHalf"; readonly chunkHalf: "chunkHalf"; }; readonly floor: { readonly texture: "tSea"; readonly res: 512; readonly foamReach: 3; readonly foamBand: 0.3; }; readonly dry: { readonly prefix: "dry"; readonly slots: 4; readonly none: readonly [number, number, number, number]; }; }; readonly draw: { readonly grid: { readonly phone: { readonly url: typeof OCEAN_FILES.phone; }; readonly desktop: { readonly url: typeof OCEAN_FILES.desktop; }; }; readonly attributes: { readonly _depth: "aDepth"; readonly _seed: "aSeed"; }; readonly level: 0; readonly floor: { readonly url: typeof OCEAN_FILES.floor; }; readonly dry: { minX: number; minZ: number; maxX: number; maxZ: number; }[]; readonly foam: Box[]; readonly lent: { readonly night: "uToonNight"; }; readonly toonSeaLevel: true; }; } = { id: 'sea',
  surface: { ...OCEAN_SURFACE, params: { level: OCEAN.level, deepDepth: OCEAN.deepDepth, shallow: [...OCEAN.shallowColor], deep: [...OCEAN.deepColor], edgeInset: SHORE_REVETMENT_INNER_FACE, seaEnd: HORIZON_RADIUS } },
  draw: { grid: { phone: { url: OCEAN_FILES.phone }, desktop: { url: OCEAN_FILES.desktop } }, attributes: { _depth: 'aDepth', _seed: 'aSeed' },
    level: OCEAN_FILES.level, floor: { url: OCEAN_FILES.floor }, dry: ENTRY_DECKS.map(({ rect }) => rect), foam: OCEAN_FOAM,
    lent: { night: 'uToonNight' }, toonSeaLevel: true } } as const;

/** Build-only client row assembly; the canonical registry validates it at publication. */
export const DRIFTWOOD_CLIENT_SECTIONS: readonly {name:string;value:unknown}[] = [
  {name:'custom/collections',value:collectionRows()},
  {name:'custom/cumulusPuffs', value:cumulusPuffs},
  {name:'custom/gullFlock', value:GULL_FLOCK},
  {name:'custom/fixedLayouts', value:{id:'driftwood.island', draws:FIXED_DRAW_ROWS.map(({ slot, channels }) => ({ slot, file: named(`fixed:${slot}`), channels })), groups:'models/fixed-geometry.json', figures:'people/catalogue.json', collections:{chime:'chime',trophyPlaques:'trophyPlaques',trophyDrop:'trophyDrop'}}},
];
