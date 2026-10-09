import { MATRIARCH_DATA, MatriarchBrain } from '../runtime/species/matriarch';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { BufferGeometry } from 'three';
import { mantaBody } from './manta';
import { DUNE_RAY_LOOK, rayGeometry } from './duneRay';

const brains = new WeakMap<Animal, MatriarchBrain>();
const brain = (a: Animal): MatriarchBrain => { let value = brains.get(a); if (!value) { value = new MatriarchBrain(a); brains.set(a, value); } return value; };

export const DUNE_MATRIARCH: SpeciesRow = { ...MATRIARCH_DATA, think: (a, ctx) => { brain(a).think(ctx); }, act: (a, ctx) => { brain(a).act(ctx); } };

/** Her own body: the generated manta (`manta.ts`), untinted. */
export const matriarchBody = (): BufferGeometry | null => mantaBody();

/** Her generated body at 3.6× (the code ray's when the file did not load), slower wingbeats; grounded, the wings drape on the sand, the head dips and the tail lifts to sweep. */
export const DUNE_MATRIARCH_LOOK: SpeciesLook = { ...DUNE_RAY_LOOK, id: 'sunscar.look.duneMatriarch', species: DUNE_MATRIARCH.id, kind: 'duneMatriarch',
  rigContract: { ...DUNE_RAY_LOOK.rigContract, skeleton: 'sunscar.duneMatriarch' },
  build: (variant, rng) => ({ ...DUNE_RAY_LOOK.build(variant, rng), hardParts: [matriarchBody() ?? rayGeometry()] }),
  animate: ({ bones, t, alive, attack, mem }) => {
    const grounded = (mem['phase'] ?? 0) >= 2, flap = !alive ? -0.4 : grounded ? -0.14 + Math.sin(t * 1.1) * 0.06 + (attack >= 0 ? -attack * 0.4 : 0) : Math.sin(t * 1.5) * 0.34;
    const left = bones['wingL'], right = bones['wingR'], tail = bones['tail'], head = bones['head'];
    if (head) head.rotation.x = alive && grounded ? 0.22 : 0;
    if (left) left.rotation.z = -flap; if (right) right.rotation.z = flap;
    if (tail) { tail.rotation.y = alive ? Math.sin(t * (grounded ? 0.9 : 1.2)) * 0.3 : 0; tail.rotation.x = alive && grounded && attack >= 0 ? -attack * 0.7 : 0; }
  },
};
