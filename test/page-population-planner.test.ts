import { setTerrainHeight, setTerrainPlacement } from '../src/engine/world/terrainHeight';
import { afterEach, expect, test } from 'vitest';
import { Vector3 } from 'three';
import { PagePopulationPlanner } from '../src/game/population/pageGroups';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { Rng } from '../src/engine/core/rng';
import type { Animal } from '../src/engine/entities/AnimalView';
import type { AnimalManager } from '../src/engine/entities/AnimalManager';
import { legacyDouble } from './fake/FakeGame';
import admission from '../src/shards/nalati-grasslands/behaviour/admission.generated.json' with { type: 'json' };

afterEach(() => { setTerrainHeight(() => 0); setTerrainPlacement(() => [0, 1, 0], () => -1000); });

test('an unrelated marsh roster uses guest member plans and preserves group allocation order', () => {
  setTerrainHeight(() => 2); setTerrainPlacement(() => [0, 1, 0], () => 0);
  const bodies: Animal[] = [], herds: AnimalManager['herds'] = [];
  const manager = legacyDouble<AnimalManager>({ animals: bodies, herds, wetAt: () => false,
    addHerd: (kind, x, z) => { herds.push({ kind, cx: x, cz: z, members: [] }); return herds.length - 1; },
    spawn: (kind, x, z, yaw, variant) => {
      if (typeof variant !== 'string') throw new Error('Expected a declared variant');
      const position = new Vector3(x, 2, z);
      const body = legacyDouble<Animal>({ kind, variant, position, yaw, herd: -1,
        place: (px, pz, heading) => { position.set(px, 2, pz); body.yaw = heading; } }); bodies.push(body); return body;
    } });
  const random = new Rng(90), planner = new PagePopulationPlanner(manager, ReturnProgram.page(admission), random,
    { begin: 'begin', spot: 'spot', accept: 'accept', yaw: 'yaw' });
  const result = planner.planned({ kind: 'marsh-deer', x: 12, z: 18, variants: ['reed', 'russet', 'fawn', 'pale-fawn', 'antlered'],
    observations: { mares: 2, foals: 1, stallion: 1, coats: 2 }, start: 'herdStart', member: 'herdMember', offset: 'foal' });
  expect(result.every((body, index) => body === bodies[index])).toBe(true); expect(result).toHaveLength(4);
  expect(herds[0]?.members.every((body, index) => body === result[index])).toBe(true);
  expect(result.every(body => body.herd === 0)).toBe(true);
  expect(result[2]?.variant).toBe('fawn'); expect(result[3]?.variant).toBe('antlered');
  expect(result[3]?.position).toEqual(new Vector3(28, 2, 22));
  const younger = result[2], parent = result[0]; if (younger === undefined || parent === undefined) throw new Error('Missing family');
  expect(Math.abs(younger.position.x - parent.position.x)).toBeLessThanOrEqual(2);
  const scattered = planner.scatter({ kind: 'marsh-crane', x: -30, z: 20, radius: 5, variants: ['grey', 'white'] });
  expect(scattered.map(body => body.variant)).toEqual(['grey', 'white']); expect(scattered.every(body => body.herd === 1)).toBe(true);
});
