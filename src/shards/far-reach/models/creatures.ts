import type { AnimalSpecies } from '@wildshard/engine/entities/species/registry';
import { defineModel } from '@wildshard/engine/models/model';
import { Group, Mesh } from 'three';
import { rocBody } from '../species/stormRoc';
import { goatBody } from '../species/skyGoat';
import { rayBody } from '../species/driftRay';
import { flat, vane } from '../world/shapes';
import { STRINGS } from '../data/strings';

const FILE = 'src/shards/far-reach/models/creatures.ts';
const CLIPS = ['idle', 'fly', 'attack', 'hit', 'die'] as const;
/** A creature's specimen: its look's bind pose, flat vertex colours (the live copies are the species rig's). */
const specimen = (body: () => AnimalSpecies): Group => {
  const group = new Group(), built = body();
  for (const g of built.hardParts) group.add(new Mesh(g, flat(0xffffff, { vertexColors: true })));
  return group;
};

/** The Storm Roc (C6): Hunyuan3D-2 from `art/far-reach/round-7-models/ref-roc.jpg`, the code Roc as its stand-in. */
export const rocEntry = defineModel({ id: 'far-reach/storm-roc', name: STRINGS.roc, category: 'creatures', pipeline: ['hunyuan', 'code'], file: FILE,
  defaults: {}, rig: { clips: CLIPS, species: 'stormRoc' }, build: () => specimen(rocBody) });
/** The sky goat (C6): Hunyuan3D-2 from `ref-goat.jpg`. */
export const goatEntry = defineModel({ id: 'far-reach/sky-goat', name: STRINGS.goat, category: 'creatures', pipeline: ['hunyuan', 'code'], file: FILE,
  defaults: {}, rig: { clips: ['idle', 'walk', 'attack', 'hit', 'die'], species: 'skyGoat' }, build: () => specimen(goatBody) });
/** The drift ray (C6): Hunyuan3D-2 from `ref-manta.jpg`. */
export const rayEntry = defineModel({ id: 'far-reach/drift-ray', name: STRINGS.ray, category: 'creatures', pipeline: ['hunyuan', 'code'], file: FILE,
  defaults: {}, rig: { clips: CLIPS, species: 'driftRay' }, build: () => specimen(rayBody) });
/** The wind vane shrine (C6): Hunyuan3D-2 from `ref-vane.jpg`, its rotor split off to spin. */
export const vaneEntry = defineModel({ id: 'far-reach/wind-vane', name: STRINGS.vane, category: 'props', pipeline: ['hunyuan', 'code'], file: FILE,
  defaults: {}, build: () => vane().group });
