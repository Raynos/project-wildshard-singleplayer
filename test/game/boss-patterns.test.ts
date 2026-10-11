// oxlint-disable-next-line import/no-nodejs-modules -- Hash complete native traces and initialize real Rapier.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the shipped physics binary.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../../src/engine/sim';
import type { AnimalSim } from '../../src/engine/entities/AnimalSim';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { bossFight, type BossFightProfile, type SpawnedBossFight, type HeldBossFight, type HeldBossBrain, type SpawnedBossPorts, type HeldBossPorts } from '../../src/game/plugin/bossPhase';
import { markedBossFight as shippingSpawned } from '../fixtures/species-oracle/markedBossFight';
import { heldBossFight as shippingHeld } from '../fixtures/species-oracle/heldBossFight';
import { ROC_BOSS_PROFILE } from '../../src/shards/far-reach/data/rocFight';
import { MATRIARCH_BOSS_PROFILE } from '../../src/shards/sunscar-dunes/data/matriarchBoss';
import { SIM_LEVEL } from '../fixtures/sim-level/level';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const recipe = SIM_LEVEL.entities[0];
if (recipe?.spec === undefined) throw new Error('Missing native recipe');
const native = recipe.spec;
const level = { ...SIM_LEVEL, entities: [], quests: [] };
const spawnedProfile = { kind: 'boss', pattern: 'spawned', fight: { arena: { x: 1, z: 2, r: 17 }, hpShares: [1, 0.66, 0.33], riseSeconds: 2.8, stormPhases: [1, 2], stormFade: 1.7, fields: { fight: 'fight', rise: 'rise', phase: 'phase' } } } as const satisfies BossFightProfile;
const heldProfile = { kind: 'boss', pattern: 'held', fight: { arena: { x: 1, z: 2, r: 17, floor: 3 }, hpShares: [1, 0.66, 0.33], rewardPoint: { x: 1, y: 4, z: 2 }, respawn: { x: 3, y: 4, z: 7, yaw: 0.6 } } } as const satisfies BossFightProfile;
interface Run { host: SimHost; fight: SpawnedBossFight<AnimalSim> | HeldBossFight; body: () => AnimalSim | null; events: unknown[]; brain: HeldBossBrain | null }
const ids = new WeakMap<AnimalSim,string>();
function idOf(body: AnimalSim): string { const id = ids.get(body); if (id === undefined) throw new Error('Missing native actor identity'); return id; }
function spawn(host: SimHost, serial: number): AnimalSim {
  const id = `boss.${String(serial)}`, body = host.spawn({ id, spec: native, seed: 7, scale: 1, at: { x: 1, y: 4, z: 2 }, yaw: 0 });
  ids.set(body,id); return body;
}
function make(pattern: 'spawned'|'held', version: 'frozen'|'preset'|'profile', selected?: Extract<BossFightProfile, {pattern:'spawned'|'held'}>): Run {
  const host = createSimHost(level, { rapier }), events: unknown[] = [];
  if (pattern === 'spawned') {
    const profile = selected ?? spawnedProfile;
    if (profile.pattern !== 'spawned') throw new Error('Wrong body pattern');
    let next = 0;
    const ports: SpawnedBossPorts<AnimalSim> = { body: { spawn: previous => { events.push(['spawn',previous === undefined ? null : idOf(previous)]); return spawn(host,next++); }, retire: a => { events.push(['retire',idOf(a)]); host.retire(idOf(a)); } },
      rewardPoint: new Vector3(1,4,2), respawnPoint: () => { events.push(['respawn']); return { pos: new Vector3(3, 4, 7), yaw: 0.6 }; }, victory: () => { events.push(['victory']); }, update: (dt,storm) => { events.push(['weather',dt,storm]); } };
    const fight = version === 'frozen' ? shippingSpawned(profile.fight,ports) : version === 'preset' ? bossFight({kind:'boss',pattern:'spawned',fight:profile.fight},ports) : bossFight(profile,ports);
    return { host, fight, body: fight.body, events, brain: null };
  }
  const profile = selected ?? heldProfile;
  if (profile.pattern !== 'held') throw new Error('Wrong body pattern');
  const body = spawn(host,0), brain = { phase: 0, fighting: false, restart: () => { events.push(['restart',brain.phase,brain.fighting,body.hp,body.alive]); } };
  const victory = (at: Vector3): void => { events.push(['victory',at.toArray()]); };
  const ports: HeldBossPorts<AnimalSim> = { body,brain,victory };
  const fight = version === 'frozen' ? shippingHeld(profile.fight,body,brain,victory) : version === 'preset' ? bossFight({ kind: 'boss', pattern: 'held', fight: profile.fight }, ports) : bossFight(profile,ports);
  return { host, fight, body: () => body, events, brain };
}
function frame(run: Run, tick: number): string {
  const script = run.fight.script, dt = tick % 7 === 0 ? 0.031 : 1/60, phase = Math.floor(tick / 1000) % 4;
  if (tick % 1000 === 0) script.reset(phase);
  if (tick % 1000 === 150) script.begin(phase);
  if (tick % 1000 === 480) script.enterPhase(phase + 1);
  if (tick % 1000 === 650) script.setInvulnerable(true);
  if (tick % 1000 === 700) script.setInvulnerable(false);
  if (tick % 1000 === 710) script.clampHp(0.3);
  const body = run.body();
  if (body !== null && tick % 29 === 0) body.hp -= 0.17;
  if (body !== null && tick % 1000 === 810) body.alive = false;
  if (tick % 1000 === 830) script.victory();
  script.update(dt,tick/60,tick % 1000 >= 150);
  const saved = run.fight.snapshot();
  if (tick % 131 === 0) { if ('weather' in run.fight) run.fight.restore(run.fight.snapshot()); else run.fight.restore(saved); }
  const out = JSON.stringify({ state: saved, intro: script.intro((tick%1000)/60,tick%2===0).toArray(), arena: script.inArena(new Vector3((tick%41)-20,tick%9,tick%37-18)),
    hp: script.hpFrac, dead: script.dead, shield: script.shielded, reward: script.rewardPoint().toArray(), respawn: script.respawnPoint(),
    bodies: [...run.host.entities.values()].map(a => ({id:idOf(a),p:a.position.toArray(),hp:a.hp,alive:a.alive,mem:a.mem})), brain: run.brain === null ? null : {phase:run.brain.phase,fighting:run.brain.fighting}, events: run.events });
  run.events.length = 0; return out;
}
for (const pattern of ['spawned','held'] as const) it(`${pattern} profile and historical preset preserve the complete frozen 10,000-frame native hash`,() => {
  const runs = (['frozen','preset','profile'] as const).map(version => make(pattern,version)), hashes = runs.map(() => createHash('sha256'));
  try {
    for (let tick = 0; tick < 10_000; tick++) {
      const states = runs.map((run,i) => { const value = frame(run,tick); hashes[i]?.update(value); return value; });
      expect(states[1],`preset frame ${String(tick)}`).toBe(states[0]); expect(states[2],`profile frame ${String(tick)}`).toBe(states[0]);
    }
    expect(new Set(hashes.map(hash => hash.digest('hex'))).size).toBe(1);
  } finally { for (const run of runs) run.host.dispose(); }
});
it('retains the held null body/brain policy, finite continuation admission, and performs no hidden spawn',() => {
  const frozen = shippingHeld(heldProfile.fight,null,null,()=>undefined), profile = bossFight(heldProfile,{body:null,brain:null,victory:()=>undefined});
  for (const fight of [frozen,profile]) { fight.script.reset(-2); fight.script.begin(50); fight.script.update(0.2,1,false); fight.script.clampHp(0); }
  expect(profile.snapshot()).toEqual(frozen.snapshot()); expect(profile.script.dead).toBe(frozen.script.dead);
  expect(() => profile.restore({hp:Number.NaN,invulnerable:false})).toThrow();
  expect(() => profile.restore({hp:0,invulnerable:false,extra:true})).toThrow();
});
it('refuses a mismatched host before reads, spawns, randomness or allocation',() => {
  const ports = { body: null, brain: null, victory: (): void => { throw new Error('must not call'); } };
  expect(() => { Reflect.apply(bossFight,undefined,[spawnedProfile,ports]); }).toThrow('Boss row/host policy mismatch');
  expect(() => { Reflect.apply(bossFight,undefined,[{...heldProfile,pattern:'unknown'},ports]); }).toThrow('Boss row/host policy mismatch');
  expect(() => { Reflect.apply(bossFight,undefined,[{...heldProfile,kind:'unknown'},ports]); }).toThrow('Unknown boss row kind');
});

for (const [name, row] of [['Sky', ROC_BOSS_PROFILE], ['Signal', MATRIARCH_BOSS_PROFILE]] as const) it(`${name}: the authored profile retains the frozen complete 10,000-frame fight hash`, () => {
  const runs = (['frozen', 'profile'] as const).map(version => make(row.pattern, version, row)), hashes = runs.map(() => createHash('sha256'));
  try {
    for (let tick = 0; tick < 10_000; tick++) {
      const states = runs.map((run, i) => { const value = frame(run, tick); hashes[i]?.update(value); return value; });
      expect(states[1], `authored frame ${String(tick)}`).toBe(states[0]);
    }
    expect(new Set(hashes.map(hash => hash.digest('hex'))).size).toBe(1);
  } finally { for (const run of runs) run.host.dispose(); }
});
