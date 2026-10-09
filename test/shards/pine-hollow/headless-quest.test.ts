// oxlint-disable-next-line import/no-nodejs-modules -- The headless runtime reads the native physics module and Pine's native bakes.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import type { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost, type SimSnapshot } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { parseNavmesh } from '../../../src/engine/physics/navmesh';
import type { HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import source from '../../../src/shards/pine-hollow/shard.config';
import { pineBake } from '../../../src/shards/pine-hollow/runtime/baked';
import { installPine, PINE_NAVMESH_ASSET, PINE_TERRAIN_ASSET, pineTerrainGrid, prepareHeadlessRuntime, type PineInstall } from '../../../src/shards/pine-hollow/runtime/headless';
import { PINE_ACT, PINE_INTERACT, QUEST_STEP, pineSpots } from '../../../src/shards/pine-hollow/runtime/quest';
import { PinePackSchema } from '../../../src/shards/pine-hollow/runtime/pack';
import * as v from 'valibot';
import { pineBenchPose } from '../../../src/shards/pine-hollow/quest/benchPose';
import { LEVER_FLAG, PINE_WEAPON } from '../../../src/shards/pine-hollow/runtime/weapons/headlessLoadout';
import { KING_RECORD } from '../../../src/shards/pine-hollow/runtime/king';
import { STAG_PATH } from '../../../src/shards/pine-hollow/quest/stagWalk';
import { QUEST_DONE } from '../../../src/shards/pine-hollow/quest/wardensHollow';
import { PINE_PHASES } from '../../../src/shards/pine-hollow/look/dayKeys';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';

let rapier: Rapier, plan: HeadlessRuntimePlan, basis: Uint8Array;
const assets = new Map([PINE_TERRAIN_ASSET, PINE_NAVMESH_ASSET].map(path => [path, new Uint8Array(readFileSync(path))] as const));
const bake = pineBake(), spots = pineSpots(), EYE = 1.68, still = { moveX: 0, moveZ: 0, yaw: 0 };
const heightAt = (x: number, z: number): number => { const h = plan.ports?.heightAt; if (h === undefined) throw new Error('no height query'); return h(x, z); };
beforeAll(async () => {
  rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  plan = await prepareHeadlessRuntime({ shard: source, assets, rapier });
  const fresh = createSimHost(plan.level, { ...plan.ports, rapier }); plan.install(fresh, { restoring: false, commands: () => [], emit: () => undefined });
  basis = fresh.physics.snapshot(); fresh.dispose();
});

/** The tick's inputs a test holds: its prompt presses and the night it reads; the facts the quest filed. */
interface Tick { press: number[]; night: number; facts: string[] }
function parts(tick: Tick): PineInstall {
  const bytes = readFileSync(PINE_NAVMESH_ASSET), nav = parseNavmesh(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  if (nav === null) throw new Error('navmesh');
  nav.datum = () => 0;
  return { bake, grid: pineTerrainGrid(assets.get(PINE_TERRAIN_ASSET)), nav, heightAt, spawnY: source.spawn.y, night: () => tick.night,
    interact: () => tick.press.map(value => ({ actorId: PINE_INTERACT, value })), fact: (name, entity) => { tick.facts.push(`${name}/${entity}`); } };
}
const boot = (tick: Tick): { host: SimHost } & ReturnType<typeof installPine> => { const host = createSimHost(plan.level, { ...plan.ports, rapier }); return { host, ...installPine(host, parts(tick)) }; };
const restore = (tick: Tick, saved: SimSnapshot): SimHost => {
  const decoded = decodeSimSnapshot(serializeSimSnapshot(saved, basis), basis);
  return restoreSimHost(plan.level, { ...plan.ports, rapier }, decoded, fresh => { fresh.setHeightQuery(heightAt); installPine(fresh, { ...parts(tick), saved: decoded }); });
};
/** Stand the player with their eye on a prompt (a test's placement, not a walk) and press it once. */
function press(host: SimHost, tick: Tick, at: { x: number; y: number; z: number }, value: number, dx = 0.4): void {
  const feet = new Vector3(at.x + dx, at.y - EYE, at.z);
  host.player.motor.resetAt(feet); host.player.position.copy(feet);
  tick.press = [value]; host.step(still); tick.press = [];
}
const row = (id: string): { x: number; y: number; z: number } => { const r = spots.rows.find(s => s.id === id)?.prompt; if (r === undefined || r === null) throw new Error(id); return r; };
const stepN = (host: SimHost, n: number): void => { for (let i = 0; i < n; i++) host.step(still); };
function finishTalk(host: SimHost, tick: Tick, talking: () => boolean): void {
  // The first keyboard advance is held for 150 ms after open; each use then finishes typing or advances one line.
  stepN(host, 10);
  for (let i = 0; i < 16 && talking(); i++) { tick.press = [PINE_ACT.talk]; host.step(still); tick.press = []; }
  expect(talking()).toBe(false);
}

it('uses the captured lookout bench reach and shared page pose, and restores its secret without a second fact', () => {
  const tick: Tick = { press: [], night: 0, facts: [] }, { host } = boot(tick);
  let resumed: SimHost | undefined;
  try {
    const bench = spots.rows.find(spot => spot.id === 'lookout-bench');
    if (bench?.prompt === null || bench?.prompt === undefined) throw new Error('Missing captured bench');
    press(host, tick, bench.prompt, PINE_ACT.bench, 3.1);
    expect(host.flags.has('used:lookout-bench')).toBe(false);
    press(host, tick, bench.prompt, PINE_ACT.bench, 0.4);
    const pose = pineBenchPose(bench, bench.yaw);
    expect(host.player.position.toArray()).toEqual([pose.x, pose.y, pose.z]);
    expect(host.player.yaw).toBe(pose.yaw); expect(host.playerFall.vy).toBe(0);
    expect(host.flags.has('secret:vista')).toBe(true);
    expect(tick.facts.filter(fact => fact === 'pine.feat.secrets/secrets:1')).toHaveLength(1);
    const saved = snapshotSimHost(host), before = tick.facts.length;
    resumed = restore(tick, saved); expectSameSimSnapshot(snapshotSimHost(resumed), saved);
    press(resumed, tick, bench.prompt, PINE_ACT.bench, 0.4);
    expect(resumed.player.position.toArray()).toEqual([pose.x, pose.y, pose.z]);
    expect(tick.facts).toHaveLength(before);
  } finally { resumed?.dispose(); host.dispose(); }
}, 60_000);

it('walks from the actual spawn into resin-1 and restores the take, pack and ledger fact without a second grant', () => {
  const tick: Tick = { press: [], night: 0, facts: [] }, { host, quest } = boot(tick);
  let resumed: SimHost | undefined;
  try {
    const pickup = spots.rows.find(spot => spot.id === 'resin-1');
    if (pickup === undefined) throw new Error('No real resin placement');
    expect(host.player.position.x).toBe(source.spawn.x);
    expect(host.player.position.z).toBe(source.spawn.z);
    expect(quest.pack.count('amber-resin')).toBe(0);
    let ticks = 0;
    for (; ticks < 900 && !host.flags.has('taken:resin-1'); ticks++) {
      const p = host.player.position, dx = pickup.x - p.x, dz = pickup.z - p.z, distance = Math.hypot(dx, dz);
      host.step({ moveX: dx / distance, moveZ: dz / distance, yaw: Math.atan2(-dx, -dz) });
    }
    expect(ticks).toBeLessThan(900);
    expect(host.flags.has('resin:1')).toBe(true);
    expect(quest.pack.snapshot()).toEqual({ counts: { 'amber-resin': 1 }, order: ['amber-resin'] });
    expect(tick.facts).toEqual(['pine.feat.resin/resin:1']);
    const saved = snapshotSimHost(host), before = tick.facts.length;
    resumed = restore(tick, saved);
    expect(tick.facts).toHaveLength(before);
    expectSameSimSnapshot(snapshotSimHost(resumed), saved);
    for (let i = 0; i < 120; i++) { host.step(still); resumed.step(still); }
    expectSameSimSnapshot(snapshotSimHost(resumed), snapshotSimHost(host));
    const state = resumed.adapters.get(QUEST_STEP)?.snapshot();
    const parsed = v.parse(v.object({ pack: PinePackSchema }), state);
    expect(parsed.pack).toEqual(quest.pack.snapshot());
    expect(tick.facts).toHaveLength(before);
  } finally { resumed?.dispose(); host.dispose(); }
}, 60_000);

it('files actual creature deaths and resumes bounded counters without replaying a grant', () => {
  const tick: Tick = { press: [], night: 0, facts: [] }, { host, roster } = boot(tick);
  let resumed: SimHost | undefined;
  try {
    const deer = roster.bodies().find(body => body.kind === 'deer' && !body.scripted)?.actor;
    if (deer === undefined) throw new Error('Missing native deer');
    const kill = (world: SimHost, body: AnimalSim): void => {
      world.combat.hit({ source: world.player.health, sourceTags: ['dmg.melee', 'cover.checked'], target: body.combatActor(),
        amount: body.maxHp * 10, point: body.position.clone(), dir: new Vector3() });
    };
    kill(host, deer); kill(host, deer); host.step(still);
    expect(tick.facts).toContain('pine.feat.deer5/deer5:1');
    expect(tick.facts.filter(fact => fact === 'pine.feat.deer5/deer5:1')).toHaveLength(1);
    const saved = snapshotSimHost(host), before = tick.facts.length;
    resumed = restore(tick, saved);
    expect(tick.facts).toHaveLength(before);
    const second = [...resumed.entities.values()].find(body => body.kind === 'deer' && body.alive && !body.scripted);
    if (second === undefined) throw new Error('Missing second native deer');
    kill(resumed, second); resumed.step(still);
    expect(tick.facts.slice(before)).toEqual(['pine.feat.deer5/deer5:2']);
    const thrall = roster.spawn('boar', host.player.position.x + 8, host.player.position.z, 0, 'thrall');
    kill(host, thrall); host.step(still);
    expect(tick.facts).toContain('pine.feat.boar5/boar5:1');
    expect(tick.facts).toContain('pine.feat.thralls/thralls:1');
  } finally { resumed?.dispose(); host.dispose(); }
}, 60_000);

it('walks the Warden\'s Hollow by its prompts at the page\'s points: Hale, the dam, the glass, the flint, the lanterns, the zipline, the stag after dark, the King\'s record, the dawn', () => {
  const tick: Tick = { press: [], night: 0, facts: [] }, { host, quest } = boot(tick), chapter = quest.quests.quests[0];
  const step = (): string | null => chapter?.current?.id ?? null;
  try {
    press(host, tick, row('dam-log-a'), PINE_ACT.logA);
    expect(host.flags.has('lever:dam-log-a')).toBe(false); // the log is jammed until Hale has spoken
    press(host, tick, spots.talk, PINE_ACT.talk, 1.5);
    expect(host.flags.has('talked:ranger')).toBe(false);
    finishTalk(host, tick, quest.talking);
    expect([host.flags.has('talked:ranger'), step()]).toEqual([true, 'pond']);
    press(host, tick, row('dam-log-a'), PINE_ACT.logA); press(host, tick, row('dam-log-b'), PINE_ACT.logB);
    expect(host.flags.has('open:dam-sluice')).toBe(true); // both logs off: the sluice lifts and latches
    press(host, tick, spots.lanterns.pond, PINE_ACT.pond);
    expect(host.flags.has('lit:pond')).toBe(false); // its glass is in the pool
    press(host, tick, row('pond-glass'), PINE_ACT.glass); press(host, tick, spots.lanterns.pond, PINE_ACT.pond);
    expect([host.flags.has('taken:pond-glass'), host.flags.has('lit:pond'), step()]).toEqual([true, true, 'ridge']);
    press(host, tick, row('ridge-flint'), PINE_ACT.flint); press(host, tick, spots.lanterns.ridge, PINE_ACT.ridge);
    expect(step()).toBe('zip');
    // the zipline: down the wire on ZipRide's law, the weapons stowed, onto the landing in the Hollow
    press(host, tick, spots.zip.prompt, PINE_ACT.zip, 0.2);
    expect(quest.riding()).toBe(true);
    let ticks = 0;
    for (; ticks < 3000 && quest.riding(); ticks++) host.step(still);
    const { landing } = spots.zip, feet = host.player.position;
    expect([host.flags.has('used:ph-zip'), step()]).toEqual([true, 'den']);
    expect(ticks / 60).toBeGreaterThan(12); expect(ticks / 60).toBeLessThan(25); // 197 m at up to 16 m/s
    expect(Math.hypot(feet.x - landing.x, feet.z - landing.z)).toBeLessThan(1.5);
    press(host, tick, spots.lanterns.den, PINE_ACT.den);
    expect(step()).toBe('stag');
    // Hale's watch: his talk now asks the clock for the night, which runs there over 6 s on the host's day clock
    const day = host.dayClock; if (day === undefined) throw new Error('no day clock');
    day.phase = PINE_PHASES.day;
    press(host, tick, spots.talk, PINE_ACT.talk, 1.5);
    finishTalk(host, tick, quest.talking);
    expect(host.flags.has('wait:night')).toBe(false); // the clock consumed the ask
    stepN(host, 6 * 60 + 2);
    expect(day.phase).toBeCloseTo(PINE_PHASES.night, 3);
    // the stag after dark: it stares from each bend until the player comes within 16 m, then trots on and fades
    tick.night = 1;
    for (const [x, z] of STAG_PATH) {
      const at = new Vector3(x - 10, heightAt(x - 10, z) + 0.1, z);
      host.player.motor.resetAt(at); host.player.position.copy(at);
      stepN(host, Math.ceil(60 * (1.3 + 1.1)) + 4);
    }
    expect([host.flags.has('followed:stag'), step()]).toEqual([true, 'king']);
    host.flags.set(KING_RECORD.defeated); // the King's own record (runtime/king.ts raises it on his fall)
    host.step(still);
    expect(step()).toBe('dawn');
    stepN(host, 12 * 60 + 4);
    expect([host.flags.has('seen:dawn'), host.flags.has(QUEST_DONE), chapter?.isComplete]).toEqual([true, true, true]);
    expect(tick.facts).toEqual(['pine.feat.lanterns/lanterns:1', 'pine.feat.lanterns/lanterns:2', 'pine.feat.zipline/zipline:1',
      'pine.feat.lanterns/lanterns:3', 'pine.feat.king/king:1',
      'pine.feat.quest/quest:1', 'pine.feat.quest/wardens-hollow']);
  } finally { host.dispose(); }
}, 30_000);

it('takes the lever-action off the ranger\'s cabin (owned:lever-rifle) and the pickup selects it, as the page\'s drop does', () => {
  const tick: Tick = { press: [], night: 0, facts: [] }, { host, loadout } = boot(tick);
  try {
    press(host, tick, spots.rifle, PINE_ACT.rifle, 0.3);
    expect(host.flags.has(LEVER_FLAG)).toBe(true);
    stepN(host, 32);
    expect([loadout.held(), loadout.swapping()]).toEqual([PINE_WEAPON.lever, false]);
  } finally { host.dispose(); }
}, 30_000);

/** A checkpoint of `host` restored through its string, then both stepped `ticks` more, exactly. */
function exactAfter(tick: Tick, host: SimHost, ticks: number): void {
  const saved = snapshotSimHost(host), restored = restore(tick, saved);
  try {
    expectSameSimSnapshot(snapshotSimHost(restored), saved);
    for (let i = 0; i < ticks; i++) { host.step(still); restored.step(still); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
  } finally { restored.dispose(); }
}

it('restores exactly mid-ride on the zipline', () => {
  const tick: Tick = { press: [], night: 0, facts: [] }, { host, quest } = boot(tick);
  try {
    for (const f of ['talked:ranger', 'lit:pond', 'lit:ridge']) host.flags.set(f);
    press(host, tick, spots.zip.prompt, PINE_ACT.zip, 0.2);
    stepN(host, 240);
    exactAfter(tick, host, 60);
    expect(quest.riding()).toBe(true);
  } finally { host.dispose(); }
}, 30_000);

it('restores exactly mid-dawn, across the sunrise\'s fast-forward and the lanterns at 4 s', () => {
  const tick: Tick = { press: [], night: 0, facts: [] }, { host } = boot(tick);
  try {
    for (const f of ['talked:ranger', 'lit:pond', 'lit:ridge', 'used:ph-zip', 'lit:den', 'followed:stag', KING_RECORD.defeated]) host.flags.set(f);
    stepN(host, 3 * 60);
    exactAfter(tick, host, 4 * 60);
    expect(host.flags.has('seen:dawn')).toBe(false); // the caption holds till 12 s
  } finally { host.dispose(); }
}, 30_000);


it('takes all eight captured carved tokens and restores their flags and ledger without a second grant', () => {
  const tick: Tick = { press: [], night: 0, facts: [] }, { host, quest } = boot(tick);
  let resumed: SimHost | undefined;
  try {
    for (let i = 0; i < 8; i++) {
      const id = `token-${i + 1}`, spot = row(id), command = PINE_ACT.token1 + i;
      press(host, tick, spot, command, 3); // strict reach: an out-of-range use does not take it
      expect(host.flags.has(`taken:${id}`)).toBe(false);
      press(host, tick, spot, command);
      expect(host.flags.has(`taken:${id}`)).toBe(true); expect(host.flags.has(`token:${i + 1}`)).toBe(true);
      const count = tick.facts.length;
      press(host, tick, spot, command); expect(tick.facts).toHaveLength(count);
    }
    expect(host.flags.count('token:')).toBe(8);
    expect(tick.facts.filter(fact => fact.startsWith('pine.feat.tokens/')))
      .toEqual(Array.from({ length: 8 }, (_, i) => `pine.feat.tokens/tokens:${i + 1}`));
    expect(quest.pack.snapshot()).toEqual({ counts: {}, order: [] });
    const saved = snapshotSimHost(host), count = tick.facts.length;
    resumed = restore(tick, saved);
    expect(tick.facts).toHaveLength(count); expectSameSimSnapshot(snapshotSimHost(resumed), saved);
    for (let i = 0; i < 8; i++) press(resumed, tick, row(`token-${i + 1}`), PINE_ACT.token1 + i);
    expect(tick.facts).toHaveLength(count); expect(resumed.flags.count('token:')).toBe(8);
  } finally { resumed?.dispose(); host.dispose(); }
}, 60_000);

it('resumes Hale mid-line silently and keeps use modal until completion or walking away', () => {
  const tick: Tick = { press: [], night: 0, facts: [] }, { host, quest, loadout } = boot(tick);
  let resumed: SimHost | undefined;
  try {
    press(host, tick, spots.talk, PINE_ACT.talk);
    expect(quest.talking()).toBe(true); expect(loadout.live(PINE_WEAPON.crossbow)).toBe(false);
    const begun = snapshotSimHost(host);
    resumed = restore(tick, begun); expectSameSimSnapshot(snapshotSimHost(resumed), begun);
    expect(tick.facts).toEqual([]); expect(resumed.flags.has('talked:ranger')).toBe(false);
    // Every USE is routed to the open modal, even if its named target is a token; the opening press cannot skip text.
    tick.press = [PINE_ACT.token1]; host.step(still); resumed.step(still); tick.press = [];
    expect(host.flags.has('token:1')).toBe(false); expect(host.flags.has('talked:ranger')).toBe(false);
    expectSameSimSnapshot(snapshotSimHost(resumed), snapshotSimHost(host));
    for (let i = 0; i < 10; i++) { host.step(still); resumed.step(still); }
    for (let i = 0; i < 8; i++) { tick.press = [PINE_ACT.talk]; host.step(still); resumed.step(still); tick.press = []; }
    expect(host.flags.has('talked:ranger')).toBe(true); expect(quest.talking()).toBe(false);
    expectSameSimSnapshot(snapshotSimHost(resumed), snapshotSimHost(host));
    expect(loadout.live(PINE_WEAPON.crossbow)).toBe(true);
    host.flags.clear('talked:ranger'); press(host, tick, spots.talk, PINE_ACT.talk);
    press(host, tick, spots.talk, PINE_ACT.cancelTalk); expect(quest.talking()).toBe(false);
    expect(host.flags.has('talked:ranger')).toBe(false);
    press(host, tick, spots.talk, PINE_ACT.talk);
    const feet = new Vector3(spots.talk.x + spots.talk.radius + 3, spots.talk.y - EYE, spots.talk.z);
    host.player.motor.resetAt(feet); host.player.position.copy(feet); host.step(still);
    expect(quest.talking()).toBe(false); expect(host.flags.has('talked:ranger')).toBe(false);
  } finally { resumed?.dispose(); host.dispose(); }
}, 60_000);
