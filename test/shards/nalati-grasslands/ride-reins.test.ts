// oxlint-disable-next-line import/no-nodejs-modules -- Authenticate the frozen shipping input law.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Authenticate the shipping source body.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { MountedReins, type ReinsFrame } from '../../../src/shards/nalati-grasslands/runtime/rideReins';
import { ShippingReins } from '../../fixtures/nalati-reins-oracle/shipping';
import source from '../../fixtures/nalati-reins-oracle/source.json' with { type: 'json' };

const speeds = { walk: 1.8, trot: 4.5, canter: 8.5, gallop: 13 };
const stateKeys = ['steed', 'winded', 'breaking', 'heading', 'speed', 'wUp', 'grounded', 'target', 'rateIn', 'turnIn', 'sector',
  'galloping', 'drawing', 'jumpWas', 'jumpQueued', 'cruise', 'gallopWas', 'tapQueued', 'clock', 'lastPhase', 'strideHz',
  'sectorWas', 'skidT', 'panicT', 'panicRear', 'panicYaw', 'jolt', 'onRoad', 'beat', 'spurFlash'] as const;
it('preserves the exact shipping reins law through keyboard, touch, rhythm, panic, skid, road and water inputs', () => {
  const frozen = readFileSync('test/fixtures/nalati-reins-oracle/shipping.txt', 'utf8');
  const oracle = readFileSync('test/fixtures/nalati-reins-oracle/shipping.ts', 'utf8');
  const inputBody = oracle.split('// BEGIN SHIPPING REINS\n')[1]?.split('// END SHIPPING REINS')[0];
  expect(inputBody).toBe(frozen.split('  maxRate(): number {')[0]);
  const rateBody = oracle.split('  maxRate(): number {')[1]?.split('\n}\n')[0]?.replace('\n    const HORSE_SPEED = this.HORSE_SPEED;', '');
  expect(`  maxRate(): number {${rateBody}`).toBe(frozen.slice(frozen.indexOf('  maxRate(): number {')));
  expect(createHash('sha256').update(frozen).digest('hex')).toBe(source.sha256);
  let inside = true, refuse = false;
  const frame: { -readonly [K in keyof ReinsFrame]: ReinsFrame[K] } = { forward: 0, turn: 0, touchX: 0, touchY: 0, gallop: false, jump: false, drawing: false, moveScale: 1,
    phase: 0, feet: { x: 0, z: 30 }, roads: [[[0, 0], [0, 100], [60, 160]]] as const,
    inBounds: () => inside, refuses: () => refuse, wet: false };
  const current = new MountedReins(speeds), old = new ShippingReins(frame, speeds);
  let roads = 0, skids = 0, backwards = 0, goodSpurs = 0;
  for (let tick = 0; tick < 4800; tick++) {
    const stage = Math.floor(tick / 40) % 12;
    frame.forward = stage === 0 ? 1 : stage === 4 ? -1 : 0;
    frame.turn = stage === 6 ? 1 : stage === 7 ? -1 : 0;
    frame.touchX = stage === 3 ? 0.8 : 0;
    frame.touchY = stage === 1 ? 0.4 : stage === 2 ? 0.7 : stage === 3 ? 0.9 : stage === 5 ? -0.9 : 0;
    frame.gallop = tick % 30 === 0 || stage === 8;
    frame.jump = tick % 137 < 3; frame.phase = (tick % 30) / 30;
    frame.drawing = tick % 90 < 20; frame.moveScale = stage === 11 ? 0 : 1;
    frame.wet = stage === 9; inside = stage !== 10; refuse = tick % 101 < 9;
    for (const law of [current, old]) {
      law.speed = stage === 5 || (stage === 4 && tick % 40 === 0) ? 10 : stage === 4 ? 0.1 : 7 + Math.sin(tick / 9) * 6;
      law.steed = tick % 240 < 20 ? 0 : tick % 240 < 40 ? 20 : 70;
      law.breaking = tick % 311 < 7; law.grounded = tick % 71 < 60;
      if (tick % 263 === 0) { law.panicT = 1.5; law.panicRear = 0.5; law.panicYaw = 0.4; }
      law.tapQueued = tick % 90 === 0;
    }
    current.read(1 / 60, frame); old.read(1 / 60);
    expect(current.turnLead).toBe(old.turnLead);
    for (const key of stateKeys) expect(current[key], `${String(tick)}:${key}`).toBe(old[key]);
    expect(current.maxRate()).toBe(old.maxRate());
    expect([current.spur.streak, current.spur.latchT, current.spur.good, current.spur.latched, current.spur.boost])
      .toEqual([old.spur.streak, old.spur.latchT, old.spur.good, old.spur.latched, old.spur.boost]);
    if (current.onRoad) roads++; if (current.skidT > 0) skids++; if (current.target < 0) backwards++;
    goodSpurs = current.spur.good;
  }
  expect(roads).toBeGreaterThan(100); expect(skids).toBeGreaterThan(1);
  expect(backwards).toBeGreaterThan(10); expect(goodSpurs).toBeGreaterThan(1);
});
it('restores every queued edge and rhythm clock, refusing malformed records before changing state', () => {
  const frame: { -readonly [K in keyof ReinsFrame]: ReinsFrame[K] } = { forward: 1, turn: 1, touchX: 0, touchY: 0, gallop: true, jump: true,
    drawing: true, moveScale: 1, phase: 0, feet: { x: 0, z: 30 }, roads: undefined, inBounds: () => true, refuses: () => false, wet: false };
  const a = new MountedReins(speeds), b = new MountedReins(speeds);
  a.speed = 10; a.read(1 / 60, frame);
  a.panicT = 1.5; a.panicRear = 0.5; a.panicYaw = 1; a.tapQueued = true;
  const saved = a.snapshot();
  const text = JSON.stringify(saved), decoded: unknown = JSON.parse(text); b.restore(decoded);
  expect(b.snapshot()).toEqual(saved);
  for (const bad of [{ ...saved, extra: 1 }, { ...saved, version: 2 }, { ...saved, clock: Infinity }, { ...saved, sector: 3 },
    { ...saved, spur: { ...saved.spur, lastTap: Number.NaN } }, { ...saved, spur: { ...saved.spur, lastTap: saved.clock + 1 } },
    { ...saved, spur: { ...saved.spur, extra: 1 } }]) {
    expect(() => b.restore(bad)).toThrow(); expect(b.snapshot()).toEqual(saved);
  }
  for (let tick = 0; tick < 600; tick++) {
    frame.gallop = tick % 30 === 0; frame.jump = tick % 79 < 3;
    frame.phase = (tick % 30) / 30; frame.forward = tick % 90 < 30 ? -1 : 1;
    frame.drawing = tick % 70 < 20; frame.wet = tick % 200 < 50;
    a.read(1 / 60, frame); b.read(1 / 60, frame);
    expect(b.snapshot()).toEqual(a.snapshot());
  }
});
