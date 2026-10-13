import { defineModel } from '@wildshard/engine/models/model';
import { creatureSpecimen } from '@wildshard/sdk/looks/modelLibrary';
import { SKY_BODIES } from '../species/bodies';
import { vane } from '../world/shapes';
import { STRINGS } from '../data/strings';

const FILE = 'src/shards/far-reach/models/creatures.ts';
const CLIPS = ['idle', 'fly', 'attack', 'hit', 'die'] as const;
const SPECIMEN = { parts: 'all', material: { color: 0xffffff, flatShading: true, roughness: 0.95, metalness: 0, vertexColors: true } } as const;

/** The Storm Roc (C6): Hunyuan3D-2 from `art/far-reach/round-7-models/ref-roc.jpg`, the code Roc as its stand-in. */
export const rocEntry = defineModel({ id: 'far-reach/storm-roc', name: STRINGS.roc, category: 'creatures', pipeline: ['hunyuan', 'code'], file: FILE,
  defaults: {}, rig: { clips: CLIPS, species: 'stormRoc' }, build: () => creatureSpecimen(SKY_BODIES.bodyOrStandIn('storm-roc'), SPECIMEN) });
/** The sky goat (C6): Hunyuan3D-2 from `ref-goat.jpg`. */
export const goatEntry = defineModel({ id: 'far-reach/sky-goat', name: STRINGS.goat, category: 'creatures', pipeline: ['hunyuan', 'code'], file: FILE,
  defaults: {}, rig: { clips: ['idle', 'walk', 'attack', 'hit', 'die'], species: 'skyGoat' }, build: () => creatureSpecimen(SKY_BODIES.bodyOrStandIn('sky-goat'), SPECIMEN) });
/** The drift ray (C6): Hunyuan3D-2 from `ref-manta.jpg`. */
export const rayEntry = defineModel({ id: 'far-reach/drift-ray', name: STRINGS.ray, category: 'creatures', pipeline: ['hunyuan', 'code'], file: FILE,
  defaults: {}, rig: { clips: CLIPS, species: 'driftRay' }, build: () => creatureSpecimen(SKY_BODIES.bodyOrStandIn('drift-ray'), SPECIMEN) });
/** The wind vane shrine (C6): Hunyuan3D-2 from `ref-vane.jpg`, its rotor split off to spin. */
export const vaneEntry = defineModel({ id: 'far-reach/wind-vane', name: STRINGS.vane, category: 'props', pipeline: ['hunyuan', 'code'], file: FILE,
  defaults: {}, build: () => vane().group });
