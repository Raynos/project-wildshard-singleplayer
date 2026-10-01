import { engineString, type SpeciesDef, NO_FUR } from '#engine';



import { buildCanid, canidPostPose, COLLIE_TINT } from './wolf';
import { thinkSheepdog } from '../creatures/flock';

/**
 * The camp's sheepdog (Nalati, row B4): a black-and-white collie on the wolf's canid build (species/wolf.ts, trait
 * `dog`: softer ears, shorter muzzle, a feathered white-tipped tail), 0.55 m at the shoulder. Its AI is the flock's
 * (`thinkSheepdog` in src/shards/nalati-grasslands/creatures/flock.ts — `flock.setDog(dog)`): circles the flock, fetches stragglers, stands
 * between the sheep and a wolf barking. Not hostile; not a quarry.
 */
export const SHEEPDOG_SPECIES: SpeciesDef = {
  kind: 'sheepdog',
  label: engineString('s_062ffea0e911'),
  fur: NO_FUR,
  aggressive: false,
  walkSpeed: 1.4,
  sounds: { call: 'dog_bark', hurt: 'dog_yelp', callEvery: [40, 120] },
  pose: { grazeNeck: 0.5, gallopTail: 0.2 },
  gait: { trot: 1.6, gallop: 5.0 },
  variants: [{ id: 'collie', label: engineString('s_062ffea0e911'), weight: 1, rarity: 'common', scale: [0.7, 0.72], hp: 60, tint: COLLIE_TINT, traits: { dog: 1, ruff: 1.1 } }],
  build: buildCanid,
  postPose: canidPostPose,
  think: thinkSheepdog,
};
