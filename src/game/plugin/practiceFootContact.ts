import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import * as v from 'valibot';
import type { AnimalRigJoint } from '@wildshard/engine/entities/animalRig';

const finite = v.pipe(v.number(), v.finite());
const positive = v.pipe(finite, v.minValue(Number.EPSILON));
const vector = v.tuple([finite, finite, finite]);
const name = v.pipe(v.string(), v.regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/u));
const chain = v.strictObject({ joints: v.tuple([name, name, name]), pole: vector,
  nominal: vector, sole: v.pipe(v.array(vector), v.minLength(3), v.maxLength(32)),
  lengths: v.tuple([positive, positive]),
  limits: v.tuple([v.tuple([vector, vector]), v.tuple([vector, vector]), v.tuple([vector, vector])]) });
/** Exactly two rigid three-joint chains. Bounds describe a diagnostic domain, not gameplay admission. */
export const PracticeFootContactSchema = v.strictObject({ version: v.literal(1),
  // Exact compressed loader-input payload SHA-256; model JSON has a separate source receipt.
  source: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)),
  feet: v.tuple([chain, chain]), ancestors: v.pipe(v.array(name), v.minLength(1), v.maxLength(26)),
  swingTicks: v.pipe(v.number(), v.integer(), v.minValue(2), v.maxValue(120)),
  lift: positive, releaseDistance: positive, releaseYaw: positive,
  maxRootStep: positive, maxRootTurn: positive, minScale: positive, maxScale: positive,
  geometry: v.pipe(v.array(v.strictObject({ joint: name,
    points: v.pipe(v.array(vector), v.minLength(4), v.maxLength(128)) })), v.minLength(1), v.maxLength(8)),
});
export type PracticeFootContactRecipe = v.InferOutput<typeof PracticeFootContactSchema>;
export interface PracticeContactSurface {
  readonly id: string; readonly revision: number; readonly active: boolean;
  readonly y: number; readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number;
}
export interface ContactJointDefinition {
  readonly name: string; readonly parent: number; readonly position: readonly [number, number, number];
  readonly order: string; readonly scale: readonly [number, number, number];
}
const frameSchema = v.strictObject({ position: vector, yaw: finite });
type Frame = v.InferOutput<typeof frameSchema>;
const footSchema = v.strictObject({ mode: v.picklist(['stance', 'swing', 'released']),
  plant: frameSchema, start: frameSchema, target: frameSchema,
  elapsed: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(120)),
  step: v.pipe(v.number(), v.safeInteger(), v.minValue(0)) });
export const PracticeContactStateSchema = v.strictObject({ version: v.literal(1), source: v.string(),
  surface: v.string(), revision: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  tick: v.pipe(v.number(), v.safeInteger(), v.minValue(0)), next: v.picklist([0, 1]),
  feet: v.tuple([footSchema, footSchema]),
  failures: v.pipe(v.array(v.pipe(v.string(), v.maxLength(160))), v.maxLength(32)),
});
export type PracticeContactState = v.InferOutput<typeof PracticeContactStateSchema>;
export type PracticeContactSolution = Readonly<{ rotations: Readonly<Record<string, readonly [number, number, number]>>;
  frames: readonly Frame[]; failures: readonly string[] }>;
const point = (a: readonly number[]): Vector3 => new Vector3(a[0], a[1], a[2]);
const tuple = (a: Vector3): [number, number, number] => [a.x, a.y, a.z];
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const matrix = (root: AnimalRigJoint): Matrix4 => new Matrix4().compose(root.position, new Quaternion().setFromEuler(root.rotation), root.scale);
/** Arithmetic tolerance only: 1e-10 metres at the bounded 900 m Arena origin, not collision skin. */
export const CONTACT_ARITHMETIC_BOUND = 1e-10;
function surfaceValid(surface: PracticeContactSurface): boolean {
  return surface.active && surface.id.length > 0 && Number.isSafeInteger(surface.revision) && surface.revision >= 0
    && [surface.y, surface.minX, surface.maxX, surface.minZ, surface.maxZ].every(Number.isFinite)
    && surface.minX < surface.maxX && surface.minZ < surface.maxZ;
}
function scaleOf(root: AnimalRigJoint, recipe: PracticeFootContactRecipe): number {
  const scale = root.scale.x;
  if (!Number.isFinite(scale) || scale !== root.scale.y || scale !== root.scale.z || scale < recipe.minScale || scale > recipe.maxScale)
    throw new Error('Contact requires admitted positive uniform scale');
  return scale;
}
function absolute(defs: readonly ContactJointDefinition[], index: number): Vector3 {
  const out = new Vector3(); let cursor = index;
  for (let n = 0; n < 32 && cursor >= 0; n++) {
    const row = defs[cursor]; if (row === undefined || row.parent >= cursor) throw new Error('Invalid contact hierarchy');
    out.add(point(row.position)); cursor = row.parent;
  }
  if (cursor >= 0) throw new Error('Invalid contact hierarchy');
  return out;
}
/** Compile against the actual instantiated bind chain; never trust copied lengths alone. */
export function validatePracticeContact(recipe: PracticeFootContactRecipe, defs: readonly ContactJointDefinition[]): void {
  const joints = recipe.feet.flatMap(foot => foot.joints);
  if (new Set(joints).size !== 6 || recipe.geometry.reduce((n, row) => n + row.points.length, 0) > 512
    || recipe.minScale > recipe.maxScale) throw new Error('Invalid bounded contact declaration');
  for (const foot of recipe.feet) {
    const indices = foot.joints.map(joint => defs.findIndex(row => row.name === joint));
    const [hip, knee, ankle] = indices;
    if (hip === undefined || knee === undefined || ankle === undefined || hip < 0 || knee < 0 || ankle < 0
      || defs[knee]?.parent !== hip || defs[ankle]?.parent !== knee) throw new Error('Invalid contact chain');
    for (const index of indices) {
      const row = defs[index];
      if (row?.order !== 'XYZ' || row.scale.some(value => value !== 1)) throw new Error('Contact requires rigid XYZ bind joints');
    }
    const h = absolute(defs, hip), k = absolute(defs, knee), a = absolute(defs, ankle);
    if (Math.abs(h.distanceTo(k) - foot.lengths[0]) > 1e-12 || Math.abs(k.distanceTo(a) - foot.lengths[1]) > 1e-12
      || a.distanceTo(point(foot.nominal)) > 1e-12 || point(foot.pole).length() < 1e-8) throw new Error('Contact bind identity mismatch');
    if (foot.sole.some(p => Math.abs(p[1] + foot.nominal[1]) > 1e-12)) throw new Error('Contact requires a horizontal rigid sole');
    const area = foot.sole.reduce((sum, p, i) => { const q = foot.sole[(i + 1) % foot.sole.length]; return sum + (q === undefined ? 0 : p[0] * q[2] - q[0] * p[2]); }, 0);
    if (Math.abs(area) < 1e-8 || foot.limits.some(([lo, hi]) => lo.some((value, i) => value >= (hi[i] ?? value) || value > 0 || (hi[i] ?? 0) < 0)))
      throw new Error('Invalid contact sole or visible joint limits');
    let ancestor = defs[hip]?.parent ?? -1;
    while (ancestor >= 0) {
      const row = defs[ancestor]; if (row === undefined || row.scale.some(value => value !== 1)) throw new Error('Nonrigid contact ancestor');
      if (!recipe.ancestors.includes(row.name)) throw new Error('Undeclared fixed contact ancestor');
      ancestor = row.parent;
    }
  }
  if (recipe.geometry.some(part => !defs.some(row => row.name === part.joint))) throw new Error('Unknown contact geometry owner');
}
function nominal(recipe: PracticeFootContactRecipe, index: number, root: AnimalRigJoint, surface: PracticeContactSurface): Frame {
  const foot = recipe.feet[index]; if (foot === undefined) throw new Error('Missing contact foot');
  const at = point(foot.nominal).applyMatrix4(matrix(root));
  at.y = surface.y + foot.nominal[1] * scaleOf(root, recipe);
  const forward = new Vector3(0, 0, 1).applyQuaternion(new Quaternion().setFromEuler(root.rotation));
  return { position: tuple(at), yaw: Math.atan2(forward.x, forward.z) };
}
function footAt(foot: PracticeContactState['feet'][number], phase: number, recipe: PracticeFootContactRecipe): Frame {
  if (foot.mode !== 'swing' && phase >= 1) return structuredClone(foot.plant);
  const u = Math.max(0, Math.min(1, phase)), s = u * u * u * (10 + u * (-15 + 6 * u));
  const at = point(foot.start.position).lerp(point(foot.target.position), s);
  at.y += recipe.lift * 64 * u * u * u * (1 - u) ** 3;
  return { position: tuple(at), yaw: foot.start.yaw + wrap(foot.target.yaw - foot.start.yaw) * s };
}
function orientation(axis: Vector3, normal: Vector3): Quaternion {
  const x = axis.clone().normalize(), z = normal.clone().normalize(), y = new Vector3().crossVectors(z, x).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
}
/** Pure actual-bind two-bone IK. The ankle cancels hip/knee rotation to retain the world sole frame. */
export function solvePracticeContacts(recipe: PracticeFootContactRecipe, defs: readonly ContactJointDefinition[],
  root: AnimalRigJoint, surface: PracticeContactSurface, frames: readonly Frame[]): PracticeContactSolution {
  const failures: string[] = [], rotations: Record<string, [number, number, number]> = {};
  const scale = scaleOf(root, recipe), rootMatrix = matrix(root), inverse = rootMatrix.clone().invert();
  const rootQ = new Quaternion().setFromEuler(root.rotation);
  if (!surfaceValid(surface)) failures.push('surface absent or inactive');
  for (const [index, foot] of recipe.feet.entries()) {
    const frame = frames[index]; if (frame === undefined) throw new Error('Missing contact frame');
    const indices = foot.joints.map(joint => defs.findIndex(row => row.name === joint));
    const [hi, ki, ai] = indices; if (hi === undefined || ki === undefined || ai === undefined) throw new Error('Missing contact chain');
    const h = absolute(defs, hi), kb = absolute(defs, ki), ab = absolute(defs, ai);
    const a = point(frame.position).applyMatrix4(inverse), u = a.clone().sub(h), d = u.length();
    const [l1, l2] = foot.lengths;
    if (!(d > Math.abs(l1 - l2) + 1e-8 && d < l1 + l2 - 1e-8)) { failures.push(`foot ${index}: unreachable or singular`); continue; }
    u.multiplyScalar(1 / d);
    const pole = point(foot.pole), bend = pole.addScaledVector(u, -pole.dot(u));
    if (bend.length() < 1e-8) { failures.push(`foot ${index}: singular pole`); continue; }
    const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d), height2 = l1 * l1 - along * along;
    if (!(height2 > 0)) { failures.push(`foot ${index}: invalid bend`); continue; }
    const k = h.clone().addScaledVector(u, along).addScaledVector(bend.normalize(), Math.sqrt(height2));
    const b1 = kb.clone().sub(h), b2 = ab.clone().sub(kb), n0 = new Vector3().crossVectors(b1, b2).normalize();
    const t1 = k.clone().sub(h), t2 = a.clone().sub(k), n1 = new Vector3().crossVectors(t1, t2).normalize();
    const q1 = orientation(t1, n1).multiply(orientation(b1, n0).invert());
    const q2 = orientation(t2, n1).multiply(orientation(b2, n0).invert());
    const qa = rootQ.clone().invert().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), frame.yaw));
    const qs = [q1, q1.clone().invert().multiply(q2), q2.clone().invert().multiply(qa)];
    for (const [jointIndex, joint] of foot.joints.entries()) {
      const q = qs[jointIndex], limit = foot.limits[jointIndex]; if (q === undefined || limit === undefined) throw new Error('Missing contact rotation');
      const e = new Euler().setFromQuaternion(q, 'XYZ'), values: [number, number, number] = [e.x, e.y, e.z];
      if (values.some((value, axis) => value < (limit[0][axis] ?? 0) || value > (limit[1][axis] ?? 0))) failures.push(`foot ${index}: joint limit ${joint}`);
      rotations[joint] = values;
    }
    const soleQ = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), frame.yaw);
    for (const p of foot.sole) {
      const world = point(p).multiplyScalar(scale).applyQuaternion(soleQ).add(point(frame.position));
      if (world.y < surface.y - CONTACT_ARITHMETIC_BOUND || world.x <= surface.minX || world.x >= surface.maxX
        || world.z <= surface.minZ || world.z >= surface.maxZ) { failures.push(`foot ${index}: sole outside support`); break; }
    }
  }
  return { rotations, frames: structuredClone(frames), failures };
}
/** Validate every retained rigid hull extremum under actual complete joint transforms, not ankle rays. */
export function practiceContactClearance(recipe: PracticeFootContactRecipe, defs: readonly ContactJointDefinition[],
  root: AnimalRigJoint, bones: Readonly<Record<string, AnimalRigJoint>>, surface: PracticeContactSurface): string[] {
  const matrices: Matrix4[] = [], failures: string[] = [];
  for (const def of defs) {
    const joint = bones[def.name]; if (joint === undefined) throw new Error('Missing clearance joint');
    const parent = def.parent < 0 ? matrix(root) : matrices[def.parent]; if (parent === undefined) throw new Error('Missing clearance parent');
    matrices.push(parent.clone().multiply(matrix(joint)));
  }
  for (const part of recipe.geometry) {
    const transform = matrices[defs.findIndex(def => def.name === part.joint)]; if (transform === undefined) throw new Error('Missing clearance owner');
    for (const p of part.points) {
      const world = point(p).applyMatrix4(transform);
      if (world.y < surface.y - CONTACT_ARITHMETIC_BOUND || world.x <= surface.minX || world.x >= surface.maxX
        || world.z <= surface.minZ || world.z >= surface.maxZ) { failures.push(`source clearance: ${part.joint}`); break; }
    }
  }
  return failures;
}
export function initialPracticeContacts(recipe: PracticeFootContactRecipe, root: AnimalRigJoint, surface: PracticeContactSurface): PracticeContactState {
  if (!surfaceValid(surface)) throw new Error('Contact requires active finite Arena support');
  const make = (index: number): PracticeContactState['feet'][number] => {
    const plant = nominal(recipe, index, root, surface);
    return { mode: 'stance', plant, start: structuredClone(plant), target: structuredClone(plant), elapsed: 0, step: 0 };
  };
  return { version: 1, source: recipe.source, surface: surface.id, revision: surface.revision, tick: 0, next: 0,
    feet: [make(0), make(1)], failures: [] };
}
/** Only NativeCreaturePose calls this once after the actual fixed body move. No queries, RNG or clocks. */
export function advancePracticeContacts(recipe: PracticeFootContactRecipe, prior: PracticeContactState,
  previousRoot: AnimalRigJoint, root: AnimalRigJoint, surface: PracticeContactSurface): PracticeContactState {
  const state = structuredClone(prior); state.tick++;
  if (!Number.isSafeInteger(state.tick)) throw new Error('Contact tick exhausted');
  if (!surfaceValid(surface) || surface.id !== state.surface || surface.revision !== state.revision) state.failures.push('surface identity or lifetime lost');
  const turn = new Quaternion().setFromEuler(previousRoot.rotation).angleTo(new Quaternion().setFromEuler(root.rotation));
  if (root.position.distanceTo(previousRoot.position) > recipe.maxRootStep || turn > recipe.maxRootTurn) state.failures.push('actual root movement outside declared contact domain');
  if (state.failures.length > 0) return releasePracticeContacts(state, state.failures);
  // A landing consumes this tick; another foot cannot release on that same endpoint.
  const swinging = state.feet.find(foot => foot.mode === 'swing');
  if (swinging !== undefined) {
    swinging.elapsed++;
    if (swinging.elapsed === recipe.swingTicks) { swinging.plant = structuredClone(swinging.target); swinging.mode = 'stance'; }
    return state;
  }
  const margins = state.feet.map((foot, index) => {
    const desired = nominal(recipe, index, root, surface);
    return Math.max(point(foot.plant.position).distanceTo(point(desired.position)) / recipe.releaseDistance,
      Math.abs(wrap(foot.plant.yaw - desired.yaw)) / recipe.releaseYaw);
  });
  const first = margins[0] ?? 0, second = margins[1] ?? 0;
  if (Math.max(first, second) > 1) {
    const index = first === second ? state.next : first > second ? 0 : 1, foot = state.feet[index];
    foot.start = structuredClone(foot.plant); foot.target = nominal(recipe, index, root, surface);
    foot.elapsed = 1; foot.step++; foot.mode = 'swing'; state.next = index === 0 ? 1 : 0;
  }
  return state;
}
export function releasePracticeContacts(state: PracticeContactState, failures: readonly string[]): PracticeContactState {
  const next = structuredClone(state); next.failures = [...new Set(failures)].slice(0, 32);
  for (const foot of next.feet) foot.mode = 'released';
  return next;
}
/** Canonical current interval retains release and landing segment identities. Out-of-order reads are pure. */
export function samplePracticeContactFrames(recipe: PracticeFootContactRecipe, previous: PracticeContactState,
  current: PracticeContactState, alpha: number): readonly Frame[] {
  return current.feet.map((foot, index) => {
    const before = previous.feet[index]; if (before === undefined) throw new Error('Missing previous contact');
    if (foot.mode === 'released') return structuredClone(foot.plant);
    if (current.tick === previous.tick) return foot.mode === 'swing' ? footAt(foot, foot.elapsed / recipe.swingTicks, recipe) : structuredClone(foot.plant);
    if (foot.mode === 'stance' && before.mode !== 'swing') return structuredClone(foot.plant);
    const start = before.step === foot.step ? before.elapsed : 0;
    const elapsed = start + (foot.elapsed - start) * alpha;
    return footAt(foot, elapsed / recipe.swingTicks, recipe);
  });
}
