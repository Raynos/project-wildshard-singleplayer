import type { SpeciesDef } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { engineString } from '@wildshard/engine/strings';



import { buildCanid, canidPostPose, SHEEPDOG_VARIANTS } from './wolf';
import { thinkSheepdog } from '../creatures/sheepdogBrain';

/**
 * The camp's sheepdog (Nalati, row B4): a black-and-white collie on the wolf's canid build (species/wolf.ts, trait
 * `dog`: softer ears, shorter muzzle, a feathered white-tipped tail), 0.55 m at the shoulder. Its AI is the flock's
 * (`thinkSheepdog` in src/shards/nalati-grasslands/creatures/sheepdogBrain.ts — `flock.setDog(dog)`): circles the flock, fetches stragglers, stands
 * between the sheep and a wolf barking. Not hostile; not a quarry.
 */
export const SHEEPDOG_SPECIES: SpeciesDef = {
  rigContract: { skeleton: 'sheepdog.v1', clips: [], sockets: ['body', 'head'] },
  kind: 'sheepdog',
  label: engineString('s_062ffea0e911'),
  fur: NO_FUR,
  aggressive: false,
  walkSpeed: 1.4,
  sounds: { call: 'dog_bark', hurt: 'dog_yelp', callEvery: [40, 120] },
  pose: { grazeNeck: 0.5, gallopTail: 0.2 },
  gait: { trot: 1.6, gallop: 5.0 },
  variants: SHEEPDOG_VARIANTS,
  build: buildCanid,
  postPose: canidPostPose,
  tick: 'ai',
  think: thinkSheepdog,
};
