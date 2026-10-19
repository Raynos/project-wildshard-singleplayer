// oxlint-disable-next-line import/no-nodejs-modules -- Read the protected native fixture for a renderer-free weighted sweep.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { Bone, Matrix4, Vector3, Skeleton, SkinnedMesh, MeshBasicMaterial } from 'three';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { packedCreatureBodies } from '../src/game/plugin/geometry';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { colossusNativeClips } from '../src/shards/driftwood-isle/generators/colossusNativeClips';

test('death fold clears exact recorded world trajectories with all four skin weights and independent matrix oracle', async () => {
  const base = 'art/driftwood-isle/lowpoly-colossus/runtime-admission/';
  const metadata: unknown = JSON.parse(readFileSync(`${base}arena-candidate1/metadata.json`, 'utf8'));
  const bytes = new Uint8Array(readFileSync(`${base}v4-skin1/payload.bin`));
  const bodies = packedCreatureBodies(metadata, undefined, () => Promise.resolve(bytes)); await bodies.preload();
  const body = bodies.copy('tideRootColossus', 'tide-root-colossus');
  const bones: Record<string, Bone> = {};
  for (const def of body.bones) {
    const joint = new Bone(); joint.position.fromArray(def.pos); joint.name = def.name;
    if (def.parent !== null) {
      const parent = bones[def.parent], rest = body.bones.find(row => row.name === def.parent);
      if (parent === undefined || rest === undefined) throw new Error('Missing bind parent');
      joint.position.sub(new Vector3(...rest.pos)); parent.add(joint);
    }
    bones[def.name] = joint;
  }
  const root = bones['body']; if (root === undefined) throw new Error('Missing body');
  root.updateMatrixWorld(true); const ordered = Object.values(bones), skeleton = new Skeleton(ordered), material = new MeshBasicMaterial();
  const meshes = body.hardParts.map(geometry => { const mesh = new SkinnedMesh(geometry, material); mesh.bind(skeleton); return mesh; });
  const inverses = ordered.map(joint => joint.matrixWorld.clone().invert());
  const position = new Vector3(), mem = {};
  const context: AnimalRigContext = { bones, dims: body.dims,
    dt: 1 / 60, t: 0, seed: .7, scale: 1, speed: 0, strafe: 0, phase: 0, state: 'stalk', alive: true, deathT: -1, flinch: 0, brace: 0, attack: -1,
    lookTarget: new Vector3(), lookWeight: 0, position, yaw: 0, mem, animal: { mem, position, yOffset: 0 } };
  const animate = numericCreaturePose(colossusNativeClips()), point = new Vector3(), term = new Vector3(), expected = new Vector3();
  const frameSchema = v.object({ frame: v.number(), gameTime: v.number(), deathT: v.number(), alive: v.boolean(),
    world: v.array(v.number()), bones: v.record(v.string(), v.array(v.number())) });
  const evidence: unknown[] = [];
  let count = 0, weightedVertices = 0;
  for (const mesh of meshes) { const weights = mesh.geometry.getAttribute('skinWeight'); count += weights.count;
    for (let i = 0; i < weights.count; i++) if (weights.getY(i) > 0) weightedVertices++; }
  expect(count).toBe(15600); expect(weightedVertices).toBe(4384);
  for (const tracePath of ['art/driftwood-isle/lowpoly-colossus/runtime-admission/arena-candidate1/evidence/observer-run1-trace.json',
    'docs/reviews/colossus-native-lifecycle-build2/render-trace.json']) {
    const trace = v.parse(v.array(frameSchema), JSON.parse(readFileSync(tracePath, 'utf8')));
    let baselineMin = Infinity, candidateMin = Infinity, maxOracleError = 0, framesBelow = 0;
    const minima: { frame: number; min: number }[] = [];
    for (const frame of trace.filter(row => !row.alive)) {
      const world = new Matrix4().fromArray(frame.world);
      // Evaluate the actual numeric source; only the six new channels differ from the captured pose.
      context.deathT = frame.deathT; context.alive = false; animate(context);
      const fold = new Map(Object.entries(bones).map(([name, joint]) => [name, joint.rotation.x]));
      const evaluate = (candidate: boolean) => {
        for (const [name, joint] of Object.entries(bones)) {
          const values = frame.bones[name]; if (values?.length !== 10) throw new Error('Invalid captured joint');
          joint.position.fromArray(values); joint.quaternion.fromArray(values, 3); joint.scale.fromArray(values, 7);
          if (candidate && /^(leg|shin|foot)-?1$/u.test(name)) joint.rotation.x = fold.get(name) ?? 0;
        }
        root.updateMatrixWorld(true); skeleton.update();
        const matrices = ordered.map((joint, i) => { const inverse = inverses[i]; if (inverse === undefined) throw new Error('Missing inverse'); return world.clone().multiply(joint.matrixWorld).multiply(inverse); });
        let minimum = Infinity;
        for (const mesh of meshes) {
          const positions = mesh.geometry.getAttribute('position'), weights = mesh.geometry.getAttribute('skinWeight'), indices = mesh.geometry.getAttribute('skinIndex');
          for (let i = 0; i < positions.count; i++) {
            point.fromBufferAttribute(positions, i); expected.set(0, 0, 0);
            for (let component = 0; component < 4; component++) {
              const matrix = matrices[indices.getComponent(i, component)]; if (matrix === undefined) throw new Error('Missing weighted joint');
              expected.addScaledVector(term.copy(point).applyMatrix4(matrix), weights.getComponent(i, component));
            }
            mesh.applyBoneTransform(i, point).applyMatrix4(world);
            maxOracleError = Math.max(maxOracleError, point.distanceTo(expected)); minimum = Math.min(minimum, point.y - 900);
          }
        }
        return minimum;
      };
      baselineMin = Math.min(baselineMin, evaluate(false));
      const min = evaluate(true); candidateMin = Math.min(candidateMin, min); if (min < -.005) framesBelow++;
      minima.push({ frame: frame.frame, min });
    }
    expect(baselineMin).toBeLessThan(-.19); expect(candidateMin).toBeGreaterThan(0);
    expect(framesBelow).toBe(0); expect(maxOracleError).toBeLessThan(.0001);
    evidence.push({ tracePath, frames: minima.length, baselineMin, candidateMin, maxOracleError, framesBelow, minima });
  }
  mkdirSync('tmp/colossus-corpse2', { recursive: true });
  writeFileSync('tmp/colossus-corpse2/trajectory-test.json', JSON.stringify({ candidate: 'motion2', actualNewCapture: false,
    method: 'Replay captured mesh matrices and 22 bone transforms; actual new six numeric pose channels replace only lower-chain x rotations. Three SkinnedMesh oracle versus independent four-weight world matrices.', count, weightedVertices, evidence }, null, 2));
  meshes.forEach(mesh => mesh.geometry.dispose()); material.dispose(); skeleton.dispose();
});
