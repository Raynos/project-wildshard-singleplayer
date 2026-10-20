import { Matrix4, Vector3 } from 'three';
import { packedCreatureBodies } from '../../../../src/game/plugin/geometry';
import { NativeCreaturePose, type NativeCreaturePoseRecipe } from '../../../../src/game/plugin/animation';
import { numericCreaturePose } from '../../../../src/game/plugin/channelPrograms';
import { AnimalSim, type AnimalSimPorts } from '../../../../src/engine/entities/AnimalSim';
import { BurstFlyerBrain } from '../../../../src/engine/ai/burstFlyer';
import { strikeFromData } from '../../../../src/engine/ai/strikeRows';
import { numericCorpseTransforms } from '../../../../src/engine/physics/rigidCorpse';
import { MEDUSA_FLIGHT, MEDUSA_SCALE, MEDUSA_STRIKE, medusaBrain } from '../medusaBehavior';
import { medusaNativeClips } from './medusaNativeClips';

type Parts = ReturnType<ReturnType<typeof packedCreatureBodies>['copy']>;
/** Actual packed source, never a replacement fixture or a duplicated binary. Caller owns geometries. */
export async function loadMedusaNativeSource(metadata: unknown, bytes: Uint8Array): Promise<Parts> {
  const loader = packedCreatureBodies(metadata, undefined, () => Promise.resolve(bytes));
  await loader.preload();
  return loader.copy('pearlglass-medusa', 'pearlglass-medusa');
}

/** Pure conversion of the real absolute binds to the native local hierarchy. No height adjustment. */
export function medusaNativeRecipe(parts: Parts): NativeCreaturePoseRecipe {
  return { practice: true, custom: true, deathSplay: false,
    joints: parts.bones.map((row, index) => {
      const parent = row.parent === null ? -1 : parts.bones.findIndex(other => other.name === row.parent);
      const ancestor = parts.bones[parent];
      if (parent >= index || row.parent !== null && ancestor === undefined) throw new Error('Invalid Medusa bind order');
      return { name: row.name, parent, order: 'XYZ', scale: [1, 1, 1],
        position: [row.pos[0] - (ancestor?.pos[0] ?? 0), row.pos[1] - (ancestor?.pos[1] ?? 0), row.pos[2] - (ancestor?.pos[2] ?? 0)] };
    }) };
}

/** Source-only real native actor/pose/brain assembly. NOT a Practice owner or gameplay admission.
 * The future borrowed owner must schedule these exactly once and supply its trusted burst ports.
 * No corpse is fabricated here: the complete selected source has no admitted collision recipe. */
export function createMedusaNativeSource(parts: Parts, ports: AnimalSimPorts,
  home = { x: 0, z: 0, r: 3, y: 1.6 }) {
  const actor = new AnimalSim({ kind: 'pearlglass-medusa', label: 'Pearlglass Medusa', variant: 'pearlglass-medusa',
    rarity: 'common', hp: 60, aggressive: true, dims: parts.dims, flight: { ...MEDUSA_FLIGHT },
    mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 25, relentless: false } }, 17, MEDUSA_SCALE,
  'practice.pearlglass-medusa', ports);
  actor.place(home.x, home.z, 0, home.y);
  const recipe = medusaNativeRecipe(parts);
  const clips = medusaNativeClips(recipe.joints.map(joint => joint.name));
  const pose = new NativeCreaturePose(actor, recipe, numericCreaturePose(clips));
  actor.bindVolumes(pose); pose.sampleTerrain(); pose.initializePractice();
  const behavior = medusaBrain(home);
  if (behavior.pattern !== 'burst') throw new Error('Medusa requires its actual burst policy');
  const brain = new BurstFlyerBrain(actor, behavior, home, strikeFromData(MEDUSA_STRIKE));
  return { actor, pose, brain, clips, recipe };
}

/** Exact weighted vertices in actor-local coordinates for source/contact design.
 * No convex approximation, dominant-bone collapse, support lift or physical allocation.
 * These points are a geometry oracle, not an admitted collider or render proof. */
export function medusaWeightedVertices(parts: Parts, pose: NativeCreaturePose): Vector3[][] {
  const transforms = numericCorpseTransforms(pose.corpseJoints(), 1);
  const matrices = transforms.map((row, index) => {
    const bind = parts.bones[index];
    if (bind === undefined || bind.name !== row.bone) throw new Error('Medusa source and pose identity differ');
    return new Matrix4().compose(row.position, row.rotation, new Vector3(1, 1, 1))
      .multiply(new Matrix4().makeTranslation(-bind.pos[0], -bind.pos[1], -bind.pos[2]));
  });
  return parts.hardParts.map(geometry => {
    const positions = geometry.getAttribute('position'), indices = geometry.getAttribute('skinIndex'), weights = geometry.getAttribute('skinWeight');
    return Array.from({ length: positions.count }, (_, index) => {
      const point = new Vector3().fromBufferAttribute(positions, index), out = new Vector3();
      const ids = [indices.getX(index), indices.getY(index), indices.getZ(index), indices.getW(index)];
      const values = [weights.getX(index), weights.getY(index), weights.getZ(index), weights.getW(index)];
      ids.forEach((bone, slot) => {
        const weight = values[slot]; if (weight === undefined || weight === 0) return;
        const matrix = matrices[bone]; if (matrix === undefined) throw new Error('Missing Medusa influence');
        out.addScaledVector(point.clone().applyMatrix4(matrix), weight);
      });
      return out;
    });
  });
}
