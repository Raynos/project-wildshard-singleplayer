// oxlint-disable-next-line import/no-nodejs-modules -- Freeze the exact shipping decision body as a replay oracle.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Check that the archived shipping body was not edited.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { Rng } from '../../../src/engine/core/rng';
import { HORSE_SPEED } from '../../../src/shards/nalati-grasslands/species/horse';
import { shepherdMotion, type ShepherdBody, type ShepherdMotion, type ShepherdState } from '../../../src/shards/nalati-grasslands/creatures/shepherdRule';
import { shippingShepherd } from '../../fixtures/nalati-shepherd-oracle/shipping';
import source from '../../fixtures/nalati-shepherd-oracle/source.json' with { type: 'json' };

const body = readFileSync('test/fixtures/nalati-shepherd-oracle/shipping.txt', 'utf8');
const oracleBody = readFileSync('test/fixtures/nalati-shepherd-oracle/shipping.ts', 'utf8').split('// BEGIN SHIPPING BODY\n')[1]?.split('// END SHIPPING BODY')[0];

it('matches the frozen shipping ring, return, rest, guard, whip and exact shared AI draw order', () => {
  expect(oracleBody).toBe(body);
  expect(createHash('sha256').update(body).digest('hex')).toBe(source.sha256);
  const expectedRng = new Rng(0x4a1a), actualRng = new Rng(0x4a1a), flock = { cx: 0, cz: 0 };
  const state: ShepherdState = { crackCd: 0, patrolA: 0, restT: 0 };
  const old = { ...state, ctx: { wildlife: { livingWolves: [] as ShepherdBody[] } }, lastCrack: null as ShepherdMotion<ShepherdBody>['crack'],
    crack(wolf: ShepherdBody, dx: number, dz: number): void { this.crackCd = 1.3; this.lastCrack = { wolf, dx, dz }; } };
  let rests = 0, cracks = 0;
  for (let tick = 0; tick < 20_000; tick++) {
    const horse = { alive: true, yaw: tick / 30, position: { x: tick % 100 < 20 ? 60 : 12, z: 16 } };
    const near = tick % 800 > 600;
    const wolves = near ? [{ alive: true, yaw: 0, position: { x: 12.3, z: 16.2 } }, { alive: true, yaw: 0, position: { x: 12.3, z: 16.2 } }] : [];
    old.ctx.wildlife.livingWolves = wolves; old.lastCrack = null;
    const expected = shippingShepherd.call(old, 1 / 60, horse, flock, { rng: { stream: () => expectedRng } }, HORSE_SPEED);
    const actual = shepherdMotion(state, 1 / 60, horse, flock, wolves, () => actualRng.next());
    expect(actual).toEqual(expected); expect(state).toEqual({ crackCd: old.crackCd, patrolA: old.patrolA, restT: old.restT });
    expect(actualRng.snapshot()).toEqual(expectedRng.snapshot());
    if (actual?.speed === 0) rests++; if (actual?.crack !== null && actual?.crack !== undefined) cracks++;
  }
  expect(rests).toBeGreaterThan(0); expect(cracks).toBeGreaterThan(0);
});

it('does nothing for an absent flock or dead/absent shepherd, including no draw and no clock mutation', () => {
  const state = { crackCd: 1.3, patrolA: 1, restT: 5 }, saved = { ...state };
  const ai = (): never => { throw new Error('unexpected RNG draw'); }, f = { cx: 0, cz: 0 };
  expect(shepherdMotion(state, 1, null, f, [], ai)).toBeNull();
  const h = { alive: false, yaw: 0, position: { x: 12, z: 16 } };
  expect(shepherdMotion(state, 1, h, f, [], ai)).toBeNull();
  expect(shepherdMotion(state, 1, { ...h, alive: true }, null, [], ai)).toBeNull(); expect(state).toEqual(saved);
});
