import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { StrikeSpec } from '@wildshard/engine/ai/strikes';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { AnimalSpecies } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { Color, Float32BufferAttribute, BufferGeometry, Uint16BufferAttribute, Vector3 } from 'three';
import { DECK } from '../layout';
import { STRINGS } from '../strings';
import { bindRigid, fit, skyMesh } from '../world/meshes';

/** The dive: a 3-D sphere contact around the ray, tested against the player's chest (ENGINE §19 "Short flyer"). */
export const DIVE: StrikeSpec = { id: 'far.ray.dive', shape: { kind: 'sphere', radius: 1.9 }, windup: 1.1, active: 1.1, recover: 0.6, cooldown: 5,
  range: 14, damage: 10, tags: ['creature.driftRay'], units: 'world', weight: () => 1 };
/** How the ray flies: its circle speed, how high it hangs over the player before the dive, its dive speed, its rest after one. */
export const RAY = { circleSpeed: 8, hang: 9, stalkSpeed: 10, diveSpeed: 16, rest: 6, notice: 40, giveUp: 60 } as const;
export const DRIFT_RAY: SpeciesRow = { id: 'far.creature.driftRay', kind: 'driftRay', label: STRINGS.ray, aggressive: true, blood: false,
  flight: { altitude: DECK + 14, above: 'world', climbRate: 6, diveRate: 20, lockRange: 32 },
  variants: [{ id: 'dusk', label: STRINGS.ray, weight: 1, rarity: 'common', scale: [1, 1], hp: 50 }] };

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
/** Where a fin starts (metres off the centre line): outboard of it a facet rides its wing bone. */
const RAY_WING_ROOT = 0.85;
/**
 * The generated ray (C6: Hunyuan3D-2 from `art/far-reach/round-7-models/ref-manta.jpg`): 5.4 m fin to fin, its middle at
 * the body bone. Facets outboard of the fin roots ride the wings; the back of the centre line (the whip) rides the tail.
 */
function rayMesh(source: BufferGeometry): AnimalSpecies {
  const g = fit(source, { size: 5.4, by: 'span', middle: 0.3 }), p = g.getAttribute('position');
  let z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) < RAY_WING_ROOT) { z0 = Math.min(z0, p.getZ(i)); z1 = Math.max(z1, p.getZ(i)); }
  const len = Math.max(0.5, z1 - z0), head = z1 - len * 0.18, tail = z0 + len * 0.45;
  bindRigid(g, (x, _y, z) => x > RAY_WING_ROOT ? WING_L : x < -RAY_WING_ROOT ? WING_R : z > head ? HEAD : z < tail ? TAIL : BODY);
  paleRay(g, tail);
  return { bones: [{ name: 'body', parent: null, pos: [0, 0.3, 0] }, { name: 'head', parent: 'body', pos: [0, 0.3, head] },
    { name: 'wingL', parent: 'body', pos: [RAY_WING_ROOT, 0.3, 0] }, { name: 'wingR', parent: 'body', pos: [-RAY_WING_ROOT, 0.3, 0] }, { name: 'tail', parent: 'body', pos: [0, 0.3, tail] }],
    furParts: [], hardParts: [g], eyeParts: [],
    dims: { bodyY: 0.3, bodyHalfLen: 1.4, bodyRadius: 0.9, headRadius: 0.4, legLen: 0.1, feet: [], halfWidth: 2.7 } };
}
/**
 * The mockup's manta (review item 9): pale sky blue on top, near-white below, the whip tail a brighter cyan. The generated
 * model's own shading (its baked value) is kept as the shade, its hue replaced.
 */
const RAY_PALE = { back: new Color(0x8fb4d6), belly: new Color(0xeef3f8), tail: new Color(0x9fe6f2) } as const;
function paleRay(g: BufferGeometry, tailZ: number): void {
  if (!g.hasAttribute('color')) return;
  const c = g.getAttribute('color'), p = g.getAttribute('position'), n = g.hasAttribute('normal') ? g.getAttribute('normal') : null;
  const out = new Color();
  for (let i = 0; i < c.count; i++) {
    const value = Math.min(1, 0.35 + 0.9 * (0.2126 * c.getX(i) + 0.7152 * c.getY(i) + 0.0722 * c.getZ(i)));
    const up = n === null ? 1 : n.getY(i);
    out.copy(up < -0.2 ? RAY_PALE.belly : RAY_PALE.back);
    if (p.getZ(i) < tailZ && Math.abs(p.getX(i)) < RAY_WING_ROOT) out.copy(RAY_PALE.tail);
    out.multiplyScalar(value);
    c.setXYZ(i, out.r, out.g, out.b);
  }
  c.needsUpdate = true;
}
/** The body: the generated model when it loaded, else the code one. */
export const rayBody = (): AnimalSpecies => { const g = skyMesh('drift-ray'); return g ? rayMesh(g) : rayCode(); };
export const DRIFT_RAY_LOOK: SpeciesLook = { id: 'far.look.driftRay', species: DRIFT_RAY.id, kind: 'driftRay', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'far.driftRay', sockets: ['body', 'head', 'wingL', 'wingR', 'tail'], clips: ['idle', 'fly', 'attack', 'hit', 'die'] },
  build: () => rayBody(),
  animate: ({ bones, t, alive }) => {
    const flap = alive ? Math.sin(t * 2.3) * 0.38 : 0.6;
    const left = bones['wingL'], right = bones['wingR'], tail = bones['tail'];
    if (left) left.rotation.z = flap; if (right) right.rotation.z = -flap; if (tail) tail.rotation.y = alive ? Math.sin(t * 1.4) * 0.25 : 0;
  },
};
