import { Bone, Vector3 } from 'three';
import { setTerrainHeight } from '../src/engine/world/terrainHeight';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { animateGoldenKing } from '../src/shards/nalati-grasslands/species/rows';
import { animateKing } from './fixtures/nalati-king-pose';

const names = ['body', 'spine', 'chest', 'head', 'crown', 'cape', ...['L', 'R'].flatMap(side =>
  ['sh', 'el', 'hand'].map(joint => `arm${side}_${joint}`).concat(['hip', 'knee', 'foot'].map(joint => `leg${side}_${joint}`)))];
function context(): AnimalRigContext {
  const mem: Record<string, number> = {}, position = new Vector3(3, 140, 8);
  return { bones: Object.fromEntries(names.map(name => [name, new Bone()])), dims: { bodyY: 1, bodyHalfLen: 1, bodyRadius: .4, headRadius: .3, legLen: 1, feet: [], halfWidth: .4 },
    dt: 1 / 30, t: 1, seed: .7, scale: 1, speed: .4, strafe: .2, phase: .3, state: 'alert', alive: true,
    deathT: -1, flinch: .3, brace: .4, attack: -1, lookTarget: new Vector3(6, 142, 10), lookWeight: .7, position, yaw: .2, mem,
    animal: { mem, position, yOffset: 0 } };
}
function transforms(c: AnimalRigContext): number[] { return Object.values(c.bones).flatMap(b => [b.position.x, b.position.y, b.position.z, b.rotation.x, b.rotation.y, b.rotation.z, b.scale.x, b.scale.y, b.scale.z]); }

test('King pose rows retain every joint through the full fight and its reset', () => {
  setTerrainHeight(() => 0);
  const actual = context(), expected = context();
  for (const pose of [0, 1, 2]) for (const act of [0, 1, 2, 3, 4]) for (const strike of [0, 1, 2, 3])
    for (const attack of [-1, 0, .2, .55, .62, .72, .78, .88, 1]) for (const deathT of [-1, 0, .4, 1]) {
      for (const c of [actual, expected]) {
        Object.assign(c.mem, { pose, act, strike, floorY: 140, rise: .43, lift: .12, kneel: act === 3 ? 1 : 0,
          raise: act === 2 ? 1 : 0, cape: act === 4 ? .001 : 1, crown: strike === 3 ? 0 : 1 });
        c.attack = attack; c.deathT = deathT; c.alive = deathT < 0;
        c.t += .037; c.phase = (c.phase + .117) % 1; c.speed = Math.sin(c.t) * 2.4;
      }
      animateKing(expected); animateGoldenKing(actual);
      const wanted = transforms(expected);
      transforms(actual).forEach((value, i) => expect(value, `${pose}/${act}/${strike}/${attack}/${deathT} scalar ${i}`).toBeCloseTo(wanted[i] ?? Number.NaN, 12));
      expect(actual.animal.yOffset).toBe(expected.animal.yOffset);
      for (const key of ['floorS', 'kneelS', 'raiseS', 'deadT']) expect(actual.mem[key]).toBe(expected.mem[key]);
    }
});
