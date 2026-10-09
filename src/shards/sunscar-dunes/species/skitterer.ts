import { SKITTERER_DATA, SkittererBrain } from '../runtime/species/skitterer';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { BoxGeometry, ConeGeometry, IcosahedronGeometry } from 'three';
import { placed, skinParts } from './skin';

const SHELL: [number, number, number] = [0.2, 0.09, 0.05], BELLY: [number, number, number] = [0.32, 0.17, 0.09], LEG: [number, number, number] = [0.12, 0.06, 0.04];
const brains = new WeakMap<Animal, SkittererBrain>();
const brain = (a: Animal): SkittererBrain => { let value = brains.get(a); if (!value) { value = new SkittererBrain(a); brains.set(a, value); } return value; };

export const SAND_SKITTERER: SpeciesRow = { ...SKITTERER_DATA, think: (a, ctx) => { brain(a).think(ctx); }, act: (a, ctx) => { brain(a).act(ctx); } };

/** A low sand beetle: a domed shell, a wedge head with mandibles, three legs a side, a short barbed tail. */
export function skittererGeometry(): ReturnType<typeof skinParts> {
  const parts = [
    { geometry: placed(new IcosahedronGeometry(0.34, 1), 0, 0.26, 0, [1, 0.5, 1.35]), color: SHELL, bone: 0 },
    { geometry: placed(new BoxGeometry(0.4, 0.1, 0.6), 0, 0.14, 0), color: BELLY, bone: 0 },
    { geometry: placed(new IcosahedronGeometry(0.17, 0), 0, 0.22, 0.5, [1.1, 0.7, 1]), color: SHELL, bone: 1 },
    { geometry: placed(new ConeGeometry(0.04, 0.24, 4), 0.09, 0.18, 0.66, [1, 1, 1], [Math.PI / 2, 0, 0.3]), color: BELLY, bone: 1 },
    { geometry: placed(new ConeGeometry(0.04, 0.24, 4), -0.09, 0.18, 0.66, [1, 1, 1], [Math.PI / 2, 0, -0.3]), color: BELLY, bone: 1 },
    { geometry: placed(new ConeGeometry(0.06, 0.5, 4), 0, 0.3, -0.62, [1, 1, 1], [-Math.PI / 2 - 0.5, 0, 0]), color: SHELL, bone: 4 },
  ];
  for (const side of [-1, 1]) for (const z of [-0.22, 0, 0.22]) {
    parts.push({ geometry: placed(new BoxGeometry(0.42, 0.04, 0.04), side * 0.36, 0.12, z, [1, 1, 1], [0, 0, side * -0.5]), color: LEG, bone: side < 0 ? 2 : 3 });
  }
  return skinParts(parts);
}
const bones = (): { name: string; parent: string | null; pos: [number, number, number] }[] => [
  { name: 'body', parent: null, pos: [0, 0.22, 0] }, { name: 'head', parent: 'body', pos: [0, 0.22, 0.42] },
  { name: 'legsL', parent: 'body', pos: [-0.18, 0.14, 0] }, { name: 'legsR', parent: 'body', pos: [0.18, 0.14, 0] }, { name: 'tail', parent: 'body', pos: [0, 0.26, -0.45] },
];
export const SAND_SKITTERER_LOOK: SpeciesLook = { id: 'sunscar.look.sandSkitterer', species: SAND_SKITTERER.id, kind: 'sandSkitterer', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'sunscar.sandSkitterer', sockets: ['body', 'head', 'legsL', 'legsR', 'tail'], clips: ['idle', 'walk', 'attack', 'hit', 'die'] },
  build: () => ({ bones: bones(), furParts: [], hardParts: [skittererGeometry()], eyeParts: [],
    dims: { bodyY: 0.22, bodyHalfLen: 0.45, bodyRadius: 0.3, headRadius: 0.17, legLen: 0.2, feet: [], halfWidth: 0.45 } }),
  animate: ({ bones: b, t, alive, deathT, speed, attack, mem }) => {
    const body = b['body'], head = b['head'], left = b['legsL'], right = b['legsR'], tail = b['tail'];
    const burrow = mem['burrow'] ?? 0, scurry = Math.min(1, Math.abs(speed) / 3) * Math.sin(t * 26);
    if (body) {
      // The bind height is kept in `mem` on the first frame: the burrow and the rear move the bone from it.
      const base = mem['bodyY'] ?? body.position.y; mem['bodyY'] = base;
      body.position.y = base - burrow * 0.62 + (attack >= 0 ? attack * 0.12 : 0);
      body.rotation.x = attack >= 0 ? -attack * 0.45 : 0;
      body.rotation.z = alive ? 0 : Math.PI * Math.min(1, Math.max(0, deathT));
    }
    if (left) left.rotation.y = alive ? scurry * 0.5 : 0.6;
    if (right) right.rotation.y = alive ? -scurry * 0.5 : -0.6;
    if (head) head.rotation.y = alive ? Math.sin(t * 9) * 0.08 : 0;
    if (tail) tail.rotation.x = alive ? -0.3 - (attack >= 0 ? attack * 0.5 : 0) : 0;
  },
};
