// oxlint-disable-next-line import/no-nodejs-modules -- Source-only weighted evidence reads pinned local fixtures.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Bone, Matrix4, Vector3, Skeleton, SkinnedMesh, MeshBasicMaterial } from 'three';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import type { AnimalRigContext } from '../../../../../src/engine/entities/animalRig';
import { packedCreatureBodies } from '../../../../../src/game/plugin/geometry';
import { numericCreaturePose } from '../../../../../src/game/plugin/channelPrograms';
import { colossusNativeClips } from './colossusDeathFoldClips';
import { colossusNativeClips as baselineClips } from './motion2-baseline';

const destination = 'art/driftwood-isle/lowpoly-colossus/motion-studies/death-fold1/';
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const tracePath = 'docs/reviews/colossus-native-motion2-build3/render-trace.json';
const sourcePath = 'src/shards/driftwood-isle/generators/colossusNativeClips.ts';
const framesSchema = v.array(v.object({ frame: v.number(), gameTime: v.number(), deathT: v.number(), alive: v.boolean(),
  stage: v.number(), clock: v.number(), flinch: v.number(), world: v.array(v.number()), bones: v.record(v.string(), v.array(v.number())) }));

async function rig() {
  const base = 'art/driftwood-isle/lowpoly-colossus/runtime-admission/';
  const metadata: unknown = JSON.parse(readFileSync(`${base}arena-candidate2/metadata.json`, 'utf8'));
  const bytes = new Uint8Array(readFileSync(`${base}v4-skin1/payload.bin`));
  const bodies = packedCreatureBodies(metadata, undefined, () => Promise.resolve(bytes)); await bodies.preload();
  const body = bodies.copy('tideRootColossus', 'tide-root-colossus');
  const bones: Record<string, Bone> = {};
  for (const def of body.bones) {
    const joint = new Bone(); joint.position.fromArray(def.pos); joint.name = def.name;
    if (def.parent !== null) {
      const parent = bones[def.parent], rest = body.bones.find(row => row.name === def.parent);
      if (parent === undefined || rest === undefined) throw new Error('Missing parent');
      joint.position.sub(new Vector3(...rest.pos)); parent.add(joint);
    }
    bones[def.name] = joint;
  }
  const root = bones['body']; if (root === undefined) throw new Error('Missing body');
  root.updateMatrixWorld(true); const ordered = Object.values(bones), skeleton = new Skeleton(ordered), material = new MeshBasicMaterial();
  const meshes = body.hardParts.map(geometry => { const mesh = new SkinnedMesh(geometry, material); mesh.bind(skeleton); return mesh; });
  const inverses = ordered.map(joint => joint.matrixWorld.clone().invert());
  const position = new Vector3(), mem = {};
  const context: AnimalRigContext = { bones, dims: body.dims, dt: 1 / 60, t: 0, seed: .7, scale: 1, speed: 0, strafe: 0,
    phase: 0, state: 'stalk', alive: true, deathT: -1, flinch: 0, brace: 0, attack: -1,
    lookTarget: new Vector3(), lookWeight: 0, position, yaw: 0, mem, animal: { mem, position, yOffset: 0 } };
  return { bones, root, ordered, skeleton, material, meshes, inverses, context };
}
const snapshot = (bones: Record<string, Bone>) => Object.values(bones).flatMap(bone => [...bone.position, ...bone.quaternion, ...bone.scale]);
const maxDifference = (a: number[], b: number[]) => Math.max(...a.map((x, i) => Math.abs(x - (b[i] ?? Infinity))));

test('compile complete data clips; preserve living source-native transforms and continuously hold the new death curve', async () => {
  expect(hash(sourcePath)).toBe('d08b8c09adfd8148d6562ac26c8a830d2e9d737e0b4af36e484ab481c8d7ec45');
  const candidate = await rig(), baseline = await rig();
  const animate = numericCreaturePose(colossusNativeClips()), old = numericCreaturePose(baselineClips());
  let livingError = 0, maxSmallStep = 0;
  for (const stage of [0, 1, 2, 3]) for (let i = 0; i <= 160; i++) {
    for (const c of [candidate.context, baseline.context]) { c.t = i / 32; c.mem['tg-state'] = stage; c.mem['tg-clock'] = i / 50; c.flinch = i % 2 ? .6 : 0; }
    animate(candidate.context); old(baseline.context);
    livingError = Math.max(livingError, maxDifference(snapshot(candidate.bones), snapshot(baseline.bones)));
  }
  expect(livingError).toBe(0);
  const c = candidate.context; c.mem['tg-state'] = 6; c.mem['tg-clock'] = 0; c.alive = false; c.flinch = 0;
  let previous: number[] | undefined;
  for (let i = 0; i <= 1000; i++) {
    c.deathT = i / 1000; animate(c); const pose = snapshot(candidate.bones);
    expect(pose.every(Number.isFinite)).toBe(true);
    if (previous) maxSmallStep = Math.max(maxSmallStep, maxDifference(previous, pose)); previous = pose;
  }
  expect(maxSmallStep).toBeLessThan(.008);
  const held = snapshot(candidate.bones);
  for (const time of [10, 100, 1000]) { c.t = time; c.flinch = .5; c.mem['tg-state'] = 3; c.mem['tg-clock'] = .9; animate(c); expect(snapshot(candidate.bones)).toEqual(held); }
  writeFileSync(`${destination}source-checks.json`, JSON.stringify({ livingSamples: 644, livingError, deathSamples: 1001, maxSmallStep, finalHoldExact: true,
    curveContinuityIsNotInterruptedLethalContinuity: true, candidatePrograms: colossusNativeClips().programs.length }, null, 2));
  writeFileSync(`${destination}clips.json`, JSON.stringify(colossusNativeClips(), null, 2));
  for (const r of [candidate, baseline]) { r.meshes.forEach(m => m.geometry.dispose()); r.material.dispose(); r.skeleton.dispose(); }
});

test('record exact all-weight world replay and fail promotion if any recorded frame penetrates', async () => {
  const r = await rig(), animate = numericCreaturePose(colossusNativeClips());
  const trace = v.parse(framesSchema, JSON.parse(readFileSync(tracePath, 'utf8')));
  const point = new Vector3(), expected = new Vector3(), term = new Vector3();
  let count = 0, multiweight = 0, oracleError = 0;
  for (const mesh of r.meshes) { const weights = mesh.geometry.getAttribute('skinWeight'); count += weights.count; for (let i = 0; i < weights.count; i++) if (weights.getY(i) > 0) multiweight++; }
  expect(count).toBe(15600); expect(multiweight).toBe(4384);
  const evidence: { frame: number; deathT: number; baselineMin: number; candidateMin: number; below: number; worstPart: number }[] = [];
  for (const frame of trace.filter(row => !row.alive)) {
    const world = new Matrix4().fromArray(frame.world);
    for (const [name, bone] of Object.entries(r.bones)) { const values = frame.bones[name]; if (values?.length !== 10) throw new Error('Missing captured joint'); bone.position.fromArray(values); bone.quaternion.fromArray(values, 3); bone.scale.fromArray(values, 7); }
    const measure = () => {
      r.root.updateMatrixWorld(true); r.skeleton.update();
      const matrices = r.ordered.map((joint, i) => { const inverse = r.inverses[i]; if (inverse === undefined) throw new Error('Missing inverse'); return world.clone().multiply(joint.matrixWorld).multiply(inverse); });
      let min = Infinity, below = 0, worstPart = -1;
      for (const [part, mesh] of r.meshes.entries()) {
        const pos = mesh.geometry.getAttribute('position'), weights = mesh.geometry.getAttribute('skinWeight'), indices = mesh.geometry.getAttribute('skinIndex');
        for (let i = 0; i < pos.count; i++) {
          point.fromBufferAttribute(pos, i); expected.set(0, 0, 0);
          for (let component = 0; component < 4; component++) { const matrix = matrices[indices.getComponent(i, component)]; if (matrix === undefined) throw new Error('Missing skin matrix'); expected.addScaledVector(term.copy(point).applyMatrix4(matrix), weights.getComponent(i, component)); }
          mesh.applyBoneTransform(i, point).applyMatrix4(world); oracleError = Math.max(oracleError, point.distanceTo(expected));
          const height = point.y - 900; if (height < min) { min = height; worstPart = part; } if (height < -.005) below++;
        }
      }
      return { min, below, worstPart };
    };
    const baseline = measure();
    const c = r.context; c.t = frame.gameTime; c.deathT = frame.deathT; c.alive = false; c.flinch = frame.flinch; c.mem['tg-state'] = frame.stage; c.mem['tg-clock'] = frame.clock;
    animate(c); const candidate = measure(); evidence.push({ frame: frame.frame, deathT: frame.deathT, baselineMin: baseline.min, candidateMin: candidate.min, below: candidate.below, worstPart: candidate.worstPart });
  }
  const summary = { frames: evidence.length, vertices: count, multiweight, oracleError,
    baselineMin: Math.min(...evidence.map(row => row.baselineMin)), candidateMin: Math.min(...evidence.map(row => row.candidateMin)),
    framesBelow: evidence.filter(row => row.below > 0).length };
  writeFileSync(`${destination}world-replay.json`, JSON.stringify({ sourceTrace: tracePath, traceSha256: hash(tracePath), actualNewCapture: false,
    method: 'Captured motion2 mesh-world trajectory; baseline captured 22 local TRS versus full candidate numeric evaluator. All 15600 source-native vertices and four weights. Three SkinnedMesh versus independent weighted matrices. Geometry floor test only; changed pose does not change existing rigid box.', summary, evidence }, null, 2));
  r.meshes.forEach(m => m.geometry.dispose()); r.material.dispose(); r.skeleton.dispose();
  expect(oracleError).toBeLessThan(.0001); expect(summary.baselineMin).toBeCloseTo(.018563022, 6);
  expect(summary.framesBelow, 'Promotion gate: any weighted geometry below floor rejects candidate').toBe(0);
});

test('retain the active-lethal onset failure caused by resetting stage/clock', async () => {
  const r = await rig(), animate = numericCreaturePose(colossusNativeClips()), c = r.context;
  const evidence: { stage: number; clock: number; transformJump: number; retainedInputJump: number }[] = [];
  for (const [stage, clock] of [[1, .72], [2, .72], [3, .88], [3, 1.2]]) {
    if (stage === undefined || clock === undefined) throw new Error('Missing test input');
    c.alive = true; c.deathT = -1; c.t = 0; c.flinch = .3; c.mem['tg-state'] = stage; c.mem['tg-clock'] = clock; animate(c); const before = snapshot(r.bones);
    c.alive = false; c.deathT = 0; animate(c); const retainedInputJump = maxDifference(before, snapshot(r.bones));
    c.mem['tg-state'] = 6; c.mem['tg-clock'] = 0; animate(c);
    evidence.push({ stage, clock, transformJump: maxDifference(before, snapshot(r.bones)), retainedInputJump });
  }
  writeFileSync(`${destination}onset-failure.json`, JSON.stringify({ method: 'Same-time exact lethal limit: living stage/clock then deathT=0; compare retained inputs and actual handler reset6/0. Not a rendered simulation.', evidence }, null, 2));
  r.meshes.forEach(m => m.geometry.dispose()); r.material.dispose(); r.skeleton.dispose();
  expect(evidence.every(row => row.retainedInputJump === 0)).toBe(true);
  expect(Math.max(...evidence.map(row => row.transformJump)), 'Promotion gate: lethal onset must retain the interrupted pose').toBeLessThan(.001);
});
