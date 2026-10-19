// oxlint-disable-next-line import/no-nodejs-modules -- Read the protected native fixture for a renderer-free weighted sweep.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { Bone, Matrix4, Vector3, Skeleton, SkinnedMesh, MeshBasicMaterial } from 'three';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { packedCreatureBodies } from '../src/game/plugin/geometry';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { colossusNativeClips, COLOSSUS_NATIVE_JOINTS } from '../src/shards/driftwood-isle/generators/colossusNativeClips';

test('all weighted vertices, foliage and joints retain finite motion; measure local floor and reach without rigid-part shortcuts', async () => {
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
  const results: Record<string, { minY: number; maxY: number; maxReach: number; belowFloor: number; frames: number; maxOracleError: number }> = {};
  const motion = new Set<string>(); let weightedVertices = 0;
  for (const mesh of meshes) { const weights = mesh.geometry.getAttribute('skinWeight'); for (let i = 0; i < weights.count; i++) if (weights.getY(i) > 0) weightedVertices++; }
  expect(weightedVertices).toBeGreaterThan(0);
  for (const [name, stage, end] of [['idle', 0, 5], ['left', 1, 1.5], ['right', 2, 1.5], ['slam', 3, 2.78], ['hit', 0, 1], ['death', 6, 1]] as const) {
    const result = { minY: Infinity, maxY: -Infinity, maxReach: 0, belowFloor: 0, frames: 0, maxOracleError: 0 }; results[name] = result;
    const steps = name === 'death' ? 1000 : 60;
    for (let sample = 0; sample <= steps; sample++) {
      const fraction = sample / steps;
      context.mem['tg-state'] = stage; context.mem['tg-clock'] = fraction * end; context.t = name === 'idle' ? fraction * end : 0;
      context.flinch = name === 'hit' ? 1 - fraction : 0; context.deathT = name === 'death' ? fraction : -1; context.alive = name !== 'death';
      animate(context); root.updateMatrixWorld(true); skeleton.update(); result.frames++;
      for (const joint of ordered) if (Math.abs(joint.rotation.x) + Math.abs(joint.rotation.y) + Math.abs(joint.rotation.z) > 1e-5) motion.add(joint.name);
      const matrices = ordered.map((joint, i) => { const inverse = inverses[i]; if (inverse === undefined) throw new Error('Missing inverse'); return new Matrix4().multiplyMatrices(joint.matrixWorld, inverse); });
      for (const mesh of meshes) {
        const positions = mesh.geometry.getAttribute('position'), weights = mesh.geometry.getAttribute('skinWeight'), indices = mesh.geometry.getAttribute('skinIndex');
        for (let i = 0; i < positions.count; i++) {
          point.fromBufferAttribute(positions, i); expected.set(0, 0, 0);
          for (let component = 0; component < 4; component++) {
            const matrix = matrices[indices.getComponent(i, component)]; if (matrix === undefined) throw new Error('Missing weighted joint');
            expected.addScaledVector(term.copy(point).applyMatrix4(matrix), weights.getComponent(i, component));
          }
          mesh.applyBoneTransform(i, point);
          if (![point.x, point.y, point.z].every(Number.isFinite)) throw new Error('Nonfinite skin');
          result.maxOracleError = Math.max(result.maxOracleError, point.distanceTo(expected));
          result.minY = Math.min(result.minY, point.y); result.maxY = Math.max(result.maxY, point.y); result.maxReach = Math.max(result.maxReach, Math.hypot(point.x, point.z));
          if (point.y < -.005) result.belowFloor++;
        }
      }
    }
  }
  mkdirSync('tmp/colossus-native-measurement', { recursive: true });
  writeFileSync('tmp/colossus-native-measurement/envelope.json', JSON.stringify({ localOnly: true, attachmentVisualAcceptance: false, worldCorpseContactAccepted: false, weightedVertices, results }, null, 2));
  expect([...motion].sort()).toEqual([...COLOSSUS_NATIVE_JOINTS].sort());
  for (const row of Object.values(results)) { expect(row.maxOracleError).toBeLessThan(2e-6); expect(row.belowFloor).toBe(0); }
  meshes.forEach(mesh => mesh.geometry.dispose()); material.dispose(); skeleton.dispose();
});
