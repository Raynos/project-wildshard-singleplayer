import { clipAnimate } from '@wildshard/sdk/species/clips';
import { speciesBrains } from '@wildshard/sdk/speciesBrains';
import { MATRIARCH_DATA, MATRIARCH_CLIPS, MAW_DATA, TAIL_SWEEP_DATA, BUFFET_DATA } from '../data/species/matriarch';
import { MATRIARCH_BRAIN } from '../data/brains';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { BufferGeometry } from 'three';
import { DUNE_RAY_LOOK, mantaBody, rayGeometry } from './duneRay';

/** Her species row: her gameplay data and her declared phased-flyer brain (data/brains.ts MATRIARCH_BRAIN, SF27). */
export const DUNE_MATRIARCH: SpeciesRow = { ...MATRIARCH_DATA,
  ...speciesBrains([{ ...MATRIARCH_DATA, brain: MATRIARCH_BRAIN }], [MAW_DATA, TAIL_SWEEP_DATA, BUFFET_DATA]).bind(MATRIARCH_DATA.kind) };

/** Her own body: the generated manta (species/duneRay.ts mantaBody), untinted. */
export const matriarchBody = (): BufferGeometry | null => mantaBody();

/** Her generated body at 3.6× (the code ray's when the file did not load), slower wingbeats; grounded, the wings drape on the sand, the head dips and the tail lifts to sweep. */
export const DUNE_MATRIARCH_LOOK: SpeciesLook = { ...DUNE_RAY_LOOK, id: 'sunscar.look.duneMatriarch', species: DUNE_MATRIARCH.id, kind: 'duneMatriarch',
  rigContract: { ...DUNE_RAY_LOOK.rigContract, skeleton: 'sunscar.duneMatriarch' },
  build: (variant, rng) => ({ ...DUNE_RAY_LOOK.build(variant, rng), hardParts: [matriarchBody() ?? rayGeometry()] }),
  animate: clipAnimate(MATRIARCH_CLIPS),
};
