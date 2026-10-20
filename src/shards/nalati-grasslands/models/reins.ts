import { reinSpecimen } from '@wildshard/game/riding/presentation';

/** The Explorer owns its own straps and preparation, separate from the rider. */
export const reins = reinSpecimen({
  id: 'nalati-grasslands/reins', name: 'Reins', file: 'src/shards/nalati-grasslands/models/reins.ts',
  product: { slug: 'nalati-grasslands', path: 'ride/rules.json' },
  crest: [0, -.5, -1.05], head: [0, -.55, -1.75], muzzle: [0, -1, -2.1], fov: 70, aspect: 9 / 19.5,
});
