import { clipAnimate } from '@wildshard/sdk/species/clips';
import { DRIFT_RAY_CLIPS } from '../data/creatureClips';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { AnimalSpecies } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { Color, Float32BufferAttribute, BufferGeometry, Uint16BufferAttribute, Vector3 } from 'three';
import { DECK } from '../data/layout';
import { STRINGS } from '../data/strings';
import { DRIFT_RAY_VARIANTS } from '../runtime/variants';
import { skyBody } from './bodies';

/** How the ray flies: its circle speed, how high it hangs over the player before the dive, its dive speed, its rest after one. */
export const RAY = { circleSpeed: 8, hang: 9, stalkSpeed: 10, diveSpeed: 16, rest: 6, notice: 40, giveUp: 60 } as const;
export const DRIFT_RAY: SpeciesRow = { id: 'far.creature.driftRay', kind: 'driftRay', label: STRINGS.ray, aggressive: true, blood: false,
  flight: { altitude: DECK + 14, above: 'world', climbRate: 6, diveRate: 20, lockRange: 32 },
  variants: DRIFT_RAY_VARIANTS };

/** Bone indices in build().bones order. */
const BODY = 0, HEAD = 1, WING_L = 2, WING_R = 3, TAIL = 4;
/** A flat manta: an eight-point outline lofted to a ridge on top and a pale belly, a whip tail. Faces +Z. */
export function rayGeometry(): BufferGeometry {
  const y = 0.3, v = (x: number, yy: number, z: number, bone: number): [Vector3, number] => [new Vector3(x, yy, z), bone];
  const outline = [v(0, y, 1.8, HEAD), v(1.3, y + 0.08, 0.9, BODY), v(2.7, y + 0.06, -0.4, WING_L), v(1, y + 0.03, -0.9, BODY),
    v(0, y, -1.2, BODY), v(-1, y + 0.03, -0.9, BODY), v(-2.7, y + 0.06, -0.4, WING_R), v(-1.3, y + 0.08, 0.9, BODY)];
  const top = v(0, y + 0.42, 0.2, BODY), belly = v(0, y - 0.2, 0.2, BODY);
  const pos: number[] = [], col: number[] = [], bones: number[] = [], c = new Color();
  const face = (corners: [Vector3, number][], color: number, up: boolean): void => {
    const [a, b, d] = corners; if (!a || !b || !d) return;
    const n = b[0].clone().sub(a[0]).cross(d[0].clone().sub(a[0]));
    const ordered = (n.y > 0) === up ? [a, b, d] : [a, d, b]; c.setHex(color);
    for (const [p, bone] of ordered) { pos.push(p.x, p.y, p.z); col.push(c.r, c.g, c.b); bones.push(bone); }
  };
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length]; if (!a || !b) continue;
    face([a, b, top], i % 2 ? 0x3b3550 : 0x463e5e, true); face([a, b, belly], 0xf0e2dc, false);
  }
  const tailRoot = outline[4]?.[0] ?? new Vector3(), tip = v(0, y, -3.4, TAIL);
  face([v(0.1, y, tailRoot.z, BODY), v(-0.1, y, tailRoot.z, BODY), tip], 0x2e2940, true);
  face([v(0.1, y, tailRoot.z, BODY), v(-0.1, y, tailRoot.z, BODY), tip], 0x2e2940, false);
  const g = new BufferGeometry(), count = pos.length / 3;
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
  const index = new Uint16Array(count * 4), weight = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { index[i * 4] = bones[i] ?? BODY; weight[i * 4] = 1; }
  g.setAttribute('skinIndex', new Uint16BufferAttribute(index, 4)); g.setAttribute('skinWeight', new Float32BufferAttribute(weight, 4));
  g.computeVertexNormals(); return g;
}
/** The code ray (the stand-in while the generated model is missing). */
function rayCode(): AnimalSpecies {
  return {
    bones: [{ name: 'body', parent: null, pos: [0, 0.3, 0] }, { name: 'head', parent: 'body', pos: [0, 0.3, 1.5] },
      { name: 'wingL', parent: 'body', pos: [1, 0.3, 0] }, { name: 'wingR', parent: 'body', pos: [-1, 0.3, 0] }, { name: 'tail', parent: 'body', pos: [0, 0.3, -1.2] }],
    furParts: [], hardParts: [rayGeometry()], eyeParts: [],
    dims: { bodyY: 0.3, bodyHalfLen: 1.4, bodyRadius: 0.9, headRadius: 0.4, legLen: 0.1, feet: [], halfWidth: 2.7 } };
}
/**
 * The body: the generated manta (C6, Hunyuan3D-2) in the mockup's pale blues, its fins and whip rigged, baked offline by
 * `generators/creatures.ts`; the code ray when the bake is not loaded (headless, a failed load).
 */
export const rayBody = (): AnimalSpecies => skyBody('drift-ray') ?? rayCode();
export const DRIFT_RAY_LOOK: SpeciesLook = { id: 'far.look.driftRay', species: DRIFT_RAY.id, kind: 'driftRay', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'far.driftRay', sockets: ['body', 'head', 'wingL', 'wingR', 'tail'], clips: ['idle', 'fly', 'attack', 'hit', 'die'] },
  build: () => rayBody(),
  animate: clipAnimate(DRIFT_RAY_CLIPS),
};
