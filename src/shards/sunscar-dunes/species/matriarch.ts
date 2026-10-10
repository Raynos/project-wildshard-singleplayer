import { clipAnimate } from '@wildshard/sdk/species/clips';
import { MatriarchBrain } from '../runtime/species/matriarch';
import { MATRIARCH_DATA, MATRIARCH_CLIPS } from '../data/species/matriarch';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { BufferGeometry } from 'three';
import { DUNE_RAY_LOOK, mantaBody, rayGeometry } from './duneRay';

const brains = new WeakMap<Animal, MatriarchBrain>();
const brain = (a: Animal): MatriarchBrain => { let value = brains.get(a); if (!value) { value = new MatriarchBrain(a); brains.set(a, value); } return value; };

export const DUNE_MATRIARCH: SpeciesRow = { ...MATRIARCH_DATA, think: (a, ctx) => { brain(a).think(ctx); }, act: (a, ctx) => { brain(a).act(ctx); } };

/** Her own body: the generated manta (species/duneRay.ts mantaBody), untinted. */
export const matriarchBody = (): BufferGeometry | null => mantaBody();

/** Her generated body at 3.6× (the code ray's when the file did not load), slower wingbeats; grounded, the wings drape on the sand, the head dips and the tail lifts to sweep. */
export const DUNE_MATRIARCH_LOOK: SpeciesLook = { ...DUNE_RAY_LOOK, id: 'sunscar.look.duneMatriarch', species: DUNE_MATRIARCH.id, kind: 'duneMatriarch',
  rigContract: { ...DUNE_RAY_LOOK.rigContract, skeleton: 'sunscar.duneMatriarch' },
  build: (variant, rng) => ({ ...DUNE_RAY_LOOK.build(variant, rng), hardParts: [matriarchBody() ?? rayGeometry()] }),
  animate: clipAnimate(MATRIARCH_CLIPS),
};
