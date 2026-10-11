// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete ordered command/slot transcripts from real admitted modules.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { Rng } from '../../src/engine/core/rng';
import { EliteScriptLane, moduleBytes } from '../../src/game/plugin/brain';
import { bossFight } from '../../src/game/plugin/bossPhase';
import { IRONHIDE_BRAIN, GHOST_STAG_BRAIN, BLACKPAW_BRAIN, IMPERIAL_BULL_BRAIN, PINE_ELITE_MODULES } from '../../src/shards/pine-hollow/runtime/brains/eliteBrains';
import { qaraBrain, QARA_MODULE } from '../../src/shards/nalati-grasslands/runtime/qaraBrain';

const qara = qaraBrain({x:17,z:-31});
const modules = {...PINE_ELITE_MODULES,[QARA_MODULE.module]:QARA_MODULE.bytes};
for (const row of [IRONHIDE_BRAIN,GHOST_STAG_BRAIN,BLACKPAW_BRAIN,IMPERIAL_BULL_BRAIN,qara]) it(`${row.id}: the boss profile preserves 2,000 complete native AS calls, slots and owned RNG states`, () => {
  const base64 = modules[row.module];
  if (base64 === undefined) throw new Error('Missing authored module');
  const bytes = moduleBytes(base64), streams = [new Rng(435),new Rng(435)] as const;
  const old = new EliteScriptLane(row,bytes,()=>streams[0].next());
  const profile = bossFight({kind:'boss',pattern:'script',fight:row},{bytes,random:()=>streams[1].next()});
  const hashes = [createHash('sha256'),createHash('sha256')] as const;
  expect(profile.data).toEqual(old.data);
  for (let tick = 0; tick < 2_000; tick++) {
    const input = [0, tick % 7 === 0 ? 0.031 : 1/60, tick/60, 1, Math.floor(tick/73)%row.modes.length, (tick%73)/60,
      tick > 1000 ? 1 : 0, (tick%43)+0.1, (tick%17)/13, (tick%23)-11, (tick%37)-19,
      (tick%13)-7, (tick%19)-9, 435, tick%37===0 ? tick/60 : -1e6, 0, tick%4, (tick%17)/60, tick%11===0 ? 1 : 0, tick%4, tick%5];
    const before = old.decide(input), after = profile.decide(input);
    const snapshot = (lane: EliteScriptLane, rng: Rng): string => JSON.stringify({slots:row.slots.map(slot=>lane.slot(slot.field)),rng:rng.snapshot()});
    expect(after).toEqual(before); expect(snapshot(profile,streams[1])).toBe(snapshot(old,streams[0]));
    hashes[0].update(JSON.stringify([before,snapshot(old,streams[0])])); hashes[1].update(JSON.stringify([after,snapshot(profile,streams[1])]));
    if (tick%131===0) for (const slot of row.slots) { const value = old.slot(slot.field); old.setSlot(slot.field,value); profile.setSlot(slot.field,value); }
  }
  expect(hashes[1].digest('hex')).toBe(hashes[0].digest('hex'));
});
it('rejects an unbound AS host, invalid declaration or mismatched bytes before consuming its stream', () => {
  const row = IRONHIDE_BRAIN, base64 = modules[row.module];
  if (base64 === undefined) throw new Error('Missing authored module');
  const bytes = moduleBytes(base64), rng = new Rng(435), before = rng.snapshot(), profile = {kind:'boss',pattern:'script',fight:row} as const;
  expect(() => { Reflect.apply(bossFight,undefined,[profile,{}]); }).toThrow('Boss row/host policy mismatch');
  expect(() => { Reflect.apply(bossFight,undefined,[profile,{bytes,random:{next:()=>rng.next()}}]); }).toThrow('Boss row/host policy mismatch');
  expect(() => bossFight({...profile,fight:{...row,maxSpeed:Infinity}},{bytes,random:()=>rng.next()})).toThrow();
  const tampered = bytes.slice(); tampered[0] = (tampered[0] ?? 0)^1;
  expect(() => bossFight(profile,{bytes:tampered,random:()=>rng.next()})).toThrow('Elite script module hash mismatch');
  expect(rng.snapshot()).toEqual(before);
});
