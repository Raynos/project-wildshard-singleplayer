import type { AnimalSpecies } from '@wildshard/engine/entities/species/registry';
import { bakedLook, creatureBodies, type BakedLookRow } from '@wildshard/game/plugin/geometry';
import type { SpeciesClips } from '@wildshard/sdk/species/clips';
import { SKY_CREATURES, SKY_CREATURE_RIGS, type SkyCreature } from '../data/files';
import { releaseDecodedOnUpload } from '../look/image';
import { SKY_STAND_INS } from '../data/standIns';

/**
 * Sky Reach's creature bodies, baked offline (SHARD-PLATFORM M3: `generators/creatures.ts` → `rigs/<creature>.glb`) and
 * loaded by the game's shared creature-body loader; a body that did not load stands undrawn on its stand-in skeleton
 * (data/standIns.ts). Memory saver: each decoded atlas goes at its upload (no CPU reader; every Roc shares one texture).
 */
const BODIES = creatureBodies({ creatures: SKY_CREATURES, urls: SKY_CREATURE_RIGS, standIns: SKY_STAND_INS, fault: '[far-reach]',
  onMap: (map) => { const atlas: unknown = map.image; if (typeof ImageBitmap !== 'undefined' && atlas instanceof ImageBitmap) releaseDecodedOnUpload(map, () => { atlas.close(); }); } });
/** Load every baked creature body once (a failed one is faulted). */
export const preloadSkyBodies = BODIES.preload;
/** A copy of a baked creature body, as the species look's `build()` returns it, or null (not loaded). */
export const skyBody: (creature: SkyCreature) => AnimalSpecies | null = BODIES.body;
/** A species look's body: the baked copy, else (not loaded) its undrawn stand-in on the authored skeleton. */
export const skyBodyOrStandIn: (creature: SkyCreature) => AnimalSpecies = BODIES.bodyOrStandIn;
/** A creature's look: its rows on its baked body (else its stand-in), animated by its clip rows. */
export const skyLook = (row: BakedLookRow, creature: SkyCreature, clips: SpeciesClips): ReturnType<typeof bakedLook> => bakedLook(row, () => skyBodyOrStandIn(creature), clips);
