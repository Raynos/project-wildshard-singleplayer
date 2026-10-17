import * as files from './fileInventory';
import { SKY_STAND_INS } from './standIns';
import { SKY_CREATURE_LOOK_ROWS } from './creatureLooks';
import { STRINGS } from '../data/strings';
import type { RigLibraryRows, ModelSpecimenRow } from '@wildshard/game/plugin/geometry';

/** Shared loader descriptor: original load order, body copies and decode release. */
export const SKY_RIG_LIBRARY = { bodies: { creatures: files.SKY_CREATURES, urls: files.SKY_CREATURE_RIGS, standIns: SKY_STAND_INS,
  fault: '[far-reach]', releaseDecoded: true }, looks: SKY_CREATURE_LOOK_ROWS } satisfies RigLibraryRows;
const clips = ['idle', 'fly', 'attack', 'hit', 'die'] as const;
const specimen = { parts: 'all', material: { color: 0xffffff, flatShading: true, roughness: 0.95, metalness: 0, vertexColors: true } } as const;
const file = 'src/shards/far-reach/generators/rigLibrary.ts';
/** Exact existing catalogue order and specimen policy; the shared model factory is the defining builder. */
export const SKY_MODEL_SPECIMENS = [
  { body: 'storm-roc', specimen, model: { id: 'far-reach/storm-roc', name: STRINGS.roc, category: 'creatures', pipeline: ['hunyuan', 'code'], file, rig: { clips, species: 'stormRoc' } } },
  { body: 'sky-goat', specimen, model: { id: 'far-reach/sky-goat', name: STRINGS.goat, category: 'creatures', pipeline: ['hunyuan', 'code'], file, rig: { clips: ['idle', 'walk', 'attack', 'hit', 'die'], species: 'skyGoat' } } },
  { body: 'drift-ray', specimen, model: { id: 'far-reach/drift-ray', name: STRINGS.ray, category: 'creatures', pipeline: ['hunyuan', 'code'], file, rig: { clips, species: 'driftRay' } } },
] as const satisfies readonly ModelSpecimenRow[];
