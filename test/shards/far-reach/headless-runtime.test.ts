// oxlint-disable-next-line import/no-nodejs-modules -- The headless runtime reads the native physics module.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Import the trusted runtime in plain Node with the renderer-denying loader.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the current Node binary for the closure proof.
import { execPath } from 'node:process';
import { Vector3 } from 'three';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import type { HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import source from '../../../src/shards/far-reach/shard.config';
import baked from '../../../src/shards/far-reach/runtime/physics.baked.json';
import { CROWN, GOATS, ROC, VANES } from '../../../src/shards/far-reach/data/layout';
import type { HeadlessCommand, HeadlessEffect } from '../../../src/sdk/tickProtocol';
import { FAN_ACT, FAN_ACTOR, FAN_AIM, FAN_STEP } from '../../../src/shards/far-reach/runtime/fan';
import { FAN_GUST, FAN_ID, FAN_SWING, SKY_ITEMS } from '../../../src/shards/far-reach/data/items';
import { FAN_ROW } from '../../../src/shards/far-reach/weapons/rows';
import { FLAGS, vaneFlag } from '../../../src/shards/far-reach/quest/flags';
import { ROC_STEP } from '../../../src/shards/far-reach/runtime/roc';
import { PHASES } from '../../../src/shards/far-reach/data/rocFight';
import { FLOCK_STEP, SKY_KILL_Y } from '../../../src/shards/far-reach/runtime/flock';
import { SKY_REACH } from '../../../src/shards/far-reach/manifest';
import { prepareHeadlessRuntime } from '../../../src/shards/far-reach/runtime/headless';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';

let rapier: Rapier, plan: HeadlessRuntimePlan;
beforeAll(async () => {
  rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  // the admitted product's files (the islet and bridge mover modules) from their committed bytes
  const assets = new Map(source.files.map(file => [file.hash, Uint8Array.from(readFileSync(`src/shards/far-reach/assets/${file.hash}`))]));
  plan = await prepareHeadlessRuntime({ shard: source, assets, rapier });
});
const noEffects = { commands: () => [], emit: () => { throw new Error('the flock keeper emits no gameplay effects'); } };
interface Effects { commands: () => readonly HeadlessCommand[]; emit: (effect: HeadlessEffect) => void }
const boot = (effects: Effects = noEffects): SimHost => { const host = createSimHost(plan.level, { ...plan.ports, rapier }); plan.install(host, { restoring: false, ...effects }); return host; };
const restore = (saved: string, effects: Effects = noEffects): SimHost => {
  const decoded = decodeSimSnapshot(saved), ports = { ...plan.ports, rapier };
  return restoreSimHost(plan.level, ports, decoded, fresh => { if (ports.heightAt !== undefined) fresh.setHeightQuery(ports.heightAt); plan.install(fresh, { restoring: true, snapshot: decoded, ...effects }); });
};
/** The player's tape: off Sunrest's north rope bridge onto the windmill isle (its goats, the free ray overhead), then wander. */
const route = [new Vector3(0, 0, -30), new Vector3(0, 0, -58), new Vector3(4, 0, -66)];
function step(host: SimHost): void {
  const tick = host.state.tick, goal = route[Math.min(route.length - 1, Math.floor(tick / 900))] ?? new Vector3(), p = host.player.position;
  const dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz);
  host.step(d < 1.5 ? { moveX: Math.sin(tick / 40), moveZ: Math.cos(tick / 40), yaw: 0 } : { moveX: dx / d, moveZ: dz / d, yaw: Math.atan2(dx, dz) });
}
function kill(host: SimHost, id: string): void {
  const actor = host.entities.get(id); if (actor === undefined) throw new Error(`missing ${id}`);
  host.combat.hit({ source: host.player.health, sourceTags: ['actor.player'], target: actor.combatActor(), amount: 10_000, point: actor.position.clone(), dir: new Vector3(0, 0, 1), from: host.player.position.clone(), moveId: 'test.kill' });
}
const order = baked.actors.map(actor => actor.id);

it('keeps the manifest kill height', () => { expect(SKY_KILL_Y).toBe(SKY_REACH.world?.killY); });

it('spawns the eight flyers at install and the five goats on the first fixed step, reproducing every baked seed and scale', () => {
  const host = boot();
  try {
    expect([...host.entities.keys()]).toEqual(order.slice(0, 8));
    // the Roc spawns at its storm altitude over its circle; the armed encounter's reset sets it on its perch (BossBrain.arm)
    expect(snapshotSimHost(host).adapters.find(adapter => adapter.id === 'runtime.actor.far.roc')?.state).toContain(`"y":${String(ROC.y)}`);
    expect(host.entities.get('far.roc')?.position.y).toBeLessThan(ROC.y);
    step(host);
    expect([...host.entities.keys()]).toEqual(order);
    for (const actor of baked.actors) {
      const live = host.entities.get(actor.id);
      expect([actor.id, live?.seed, live?.scale]).toEqual([actor.id, actor.seed, actor.scale]);
    }
    // each goat stands on its island's deck (the first WORLD floor under deck + 2 m), never on the analytic -1000 m floor
    GOATS.forEach((goat, i) => { expect(host.entities.get(`far.goat.${String(i)}`)?.position.y).toBeCloseTo(goat.isle.y, 1); });
  } finally { host.dispose(); }
});

it('runs on the page\'s distance bands: the creature manager\'s legacy rate and the page capsule only within 45 m', () => {
  const host = boot();
  try {
    expect(host.bodyBands).toEqual({ physics: true });
    for (let i = 0; i < 120; i++) step(host);
    const bands = host.bodyBandState(), p = host.player.position;
    if (bands === undefined) throw new Error('Sky runs on body bands');
    expect(new Set(bands.rows.map(row => row.rate))).toEqual(new Set(['legacy']));
    // every body moved this tick at any distance (the Roc's perch is ~190 m out, where the 'ai' rate pauses a body)
    for (const row of bands.rows) expect([row.id, row.body.tickFrame]).toEqual([row.id, bands.frame]);
    expect(Math.hypot(...['x', 'y', 'z'].map(k => (host.entities.get('far.roc')?.position[k as 'x'] ?? 0) - p[k as 'x']))).toBeGreaterThan(160);
    // decisions at 10 Hz: each brain clock's last decision is at most six ticks old
    for (const row of bands.rows) expect(bands.frame - row.brain.tickFrame).toBeLessThan(6);
    for (const [id, actor] of host.entities) {
      const d = Math.hypot(actor.position.x - p.x, actor.position.z - p.z);
      if (actor.alive && d < 45) expect([id, actor.motor !== null]).toEqual([id, true]);
      if (d > 55) expect([id, actor.motor]).toEqual([id, null]);
    }
  } finally { host.dispose(); }
});

it('runs 10k ticks of the shipping policies: real contacts hurt the player, a fall below the kill height kills', () => {
  const host = boot(), seen = new Set<string>();
  let lowest = host.player.health.attributes.health;
  try {
    for (let tick = 0; tick < 10_000; tick++) {
      if (tick === 3000) { const goat = host.entities.get('far.goat.4'); goat?.place(goat.position.x + 40, goat.position.z, 0, goat.position.y); }
      step(host);
      for (const actor of host.entities.values()) seen.add(`${actor.kind}:${actor.state}`);
      lowest = Math.min(lowest, host.player.health.attributes.health);
    }
    expect(host.state.tick).toBe(10_000);
    expect(lowest).toBeLessThan(host.player.health.attributes.maxHealth);
    // the goat set down over the void falls past the death plane and dies by the fall pipeline
    const fallen = host.entities.get('far.goat.4');
    expect(fallen?.alive).toBe(false); expect(fallen?.position.y).toBeLessThan(SKY_KILL_Y + 1);
    expect([...host.entities.values()].every(a => [a.position.x, a.position.y, a.position.z].every(Number.isFinite))).toBe(true);
    expect(seen.size).toBeGreaterThan(3);
  } finally { host.dispose(); }
}, 300_000);

it('restores before and after the goats land, mid-fight, exactly, reinstalling the saved roster before restore', () => {
  for (const checkpoint of [0, 1, 700, 2600]) {
    const original = boot(); let restored: SimHost | undefined;
    try {
      for (let tick = 0; tick < checkpoint; tick++) step(original);
      const saved = serializeSimSnapshot(snapshotSimHost(original));
      restored = restore(saved);
      expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
      for (let tick = 0; tick < 900; tick++) {
        if (tick === 120) { kill(original, 'far.ray.0'); kill(restored, 'far.ray.0'); }
        step(original); step(restored);
      }
      expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
      expect(snapshotSimHost(original).adapters.some(adapter => adapter.id === FLOCK_STEP)).toBe(true);
    } finally { restored?.dispose(); original.dispose(); }
  }
}, 300_000);

it('shoves the player through the host impulse when a wisp bursts on them', () => {
  const host = boot();
  try {
    step(host);
    const wisp = host.entities.get('far.wisp.0'); if (wisp === undefined) throw new Error('missing wisp');
    // stand under the keeper isle's wisp, facing nothing: its burst claims, darts and contacts within a few seconds
    host.player.position.set(wisp.position.x, wisp.position.y - 2, wisp.position.z);
    let shoved = false;
    for (let tick = 0; tick < 600 && !shoved; tick++) { host.step(); shoved = host.playerImpulse.lengthSq() > 0; }
    expect(shoved).toBe(true);
  } finally { host.dispose(); }
});

/** The tick's commands, read by the runtime's adapters (context.commands) exactly as the worker hands them over. */
let tape: HeadlessCommand[] = [];
const fed = (into?: HeadlessEffect[]): Effects => ({ commands: () => tape, emit: effect => { if (into === undefined) throw new Error('unexpected gameplay effect'); into.push(effect); } });
/** One worker tick: the player command (if any) steps the host, every command reaches the adapters. */
function run(host: SimHost, commands: HeadlessCommand[]): void {
  tape = commands;
  const player = commands.find(command => command.kind === 'player');
  host.step(player?.kind === 'player' ? { moveX: player.moveX, moveZ: player.moveZ, yaw: player.yaw, ...(player.attack === undefined ? {} : { attack: player.attack }) } : undefined);
  tape = [];
}
/** The fight's player stays this far inside the crown's rim (CROWN.r 20: its kerb stands at the edge). */
const CROWN_REACH = 17;
/**
 * Real War Fan play, and nothing else: the player starts on the crown (this test only: reaching it over the raised winch
 * bridge is the whole-shard witness's), faces the Roc, aims at it and every tick
 * asks for a light SWING at it and a GUST at its pitch (the fan's own cooldowns gate both). While the Roc flies the player
 * holds the crown's middle, so its gale-wall stand-off (14 m) stays over the crown; while it hangs still (a gale wall's
 * long active hold) or walks the dais the player goes under it, never past CROWN_REACH. Every point of damage the Roc
 * takes is a fan contact (the encounter test counts them).
 */
function crownFight(host: SimHost, at: number): void {
  if (at === 0) host.player.position.set(CROWN.x, CROWN.y, CROWN.z + 6);
  const roc = host.entities.get('far.roc'), p = host.player.position;
  if (roc === undefined) throw new Error('missing Roc');
  const rx = roc.position.x - CROWN.x, rz = roc.position.z - CROWN.z, out = Math.hypot(rx, rz);
  const grounded = roc.position.y < CROWN.y + 3, follow = grounded || roc.speed < 0.5, k = !follow ? 0 : out > CROWN_REACH ? CROWN_REACH / out : 1;
  const gx = CROWN.x + rx * k - p.x, gz = CROWN.z + rz * k - p.z, g = Math.hypot(gx, gz), near = grounded ? 2 : 1;
  const moveX = g > near ? gx / g : 0, moveZ = g > near ? gz / g : 0;
  const yaw = Math.atan2(p.x - roc.position.x, p.z - roc.position.z);
  const pitch = Math.atan2(roc.position.y - (p.y + 1.68), Math.hypot(roc.position.x - p.x, roc.position.z - p.z));
  run(host, [{ kind: 'player', moveX, moveZ, yaw, attack: { targetId: 'far.roc' } }, { kind: 'script', actorId: FAN_AIM, value: pitch }, { kind: 'script', actorId: FAN_ACTOR, value: FAN_ACT.gust }]);
}
it('runs the Storm Roc encounter: intro on the crown, phases at 66 % and 33 %, one fact and purse on its first fall', () => {
  const effects: HeadlessEffect[] = [], host = boot(fed(effects)), states = new Set<string>(), phases = new Set<number>();
  let lowest = host.player.health.attributes.health, fanOnRoc = 0, fanInIntro = 0, current = 'armed', rocDamage = 0, fanDamage = 0;
  const fanMoves = new Set<string>();
  host.events.on('damage.dealt', ({ req, dealt }) => {
    if (req.target !== host.entities.get('far.roc')?.combatActor()) return;
    rocDamage += dealt; if (req.weaponId !== FAN_ID) return;
    // the phase a contact lands in, from the Roc's HP before it (the encounter's thresholds, 66 % and 33 %)
    const roc = host.entities.get('far.roc'), before = roc === undefined ? 0 : (roc.hp + dealt) / roc.maxHp;
    fanOnRoc++; fanDamage += dealt; fanMoves.add(`${before > PHASES[1] ? '0' : before > PHASES[2] ? '1' : '2'}:${req.moveId ?? ''}`); if (current === 'intro') fanInIntro++;
  }, host.scope);
  try {
    step(host);
    expect(snapshotSimHost(host).adapters.find(adapter => adapter.id === ROC_STEP)?.state).toContain('"state":"armed"'); // armed at install, waiting at the crown
    let ticks = 0;
    for (; ticks < 45_000 && !host.flags.has(FLAGS.roc); ticks++) {
      crownFight(host, ticks);
      // the encounter's state every tick through its intro, then every 15th (a beat holds 1.5 s; victory ends the loop)
      const encounter = ticks < 200 || ticks % 15 === 0 || host.flags.has(FLAGS.roc) ? snapshotSimHost(host).adapters.find(adapter => adapter.id === ROC_STEP)?.state : undefined;
      if (typeof encounter === 'string') { const parsed: unknown = JSON.parse(encounter); if (typeof parsed === 'object' && parsed !== null && 'boss' in parsed && typeof parsed.boss === 'object' && parsed.boss !== null && 'state' in parsed.boss && 'phase' in parsed.boss) { current = String(parsed.boss.state); states.add(current); phases.add(Number(parsed.boss.phase)); } }
      lowest = Math.min(lowest, host.player.health.attributes.health);
      expect(host.player.position.y).toBeGreaterThan(CROWN.y - 1); // the gale walls never shove the player off the crown
    }
    expect(host.flags.has(FLAGS.roc)).toBe(true);
    expect([...states]).toEqual(expect.arrayContaining(['intro', 'fight', 'beat', 'victory']));
    expect([...phases]).toEqual(expect.arrayContaining([0, 1, 2]));
    expect(lowest).toBeLessThan(host.player.health.attributes.maxHealth); // the Roc's own strikes landed through the fight
    expect(effects).toEqual([{ kind: 'fact', name: 'far-reach.roc', actorId: 'far.roc' }, { kind: 'coins', amount: 25, actorId: 'far.roc' }]);
    // every point of the Roc's 420 HP fell to the War Fan, in all three phases (its swings as it stoops, its gusts at the
    // gale-wall hover and on the dais), never through the intro
    expect(fanDamage).toBe(rocDamage); expect(rocDamage).toBeGreaterThanOrEqual(420); expect(fanInIntro).toBe(0);
    expect([...fanMoves]).toEqual(expect.arrayContaining(['0:far.fan.light', '1:far.fan.gust', '2:far.fan.gust']));
    expect(ticks).toBeGreaterThan(fanOnRoc);
  } finally { host.dispose(); }
}, 900_000);

it('restores the Roc encounter mid-fight exactly, its victory paying once on the restored host', () => {
  for (const checkpoint of [900, 2000]) {
    const paidOriginal: HeadlessEffect[] = [], resumed: HeadlessEffect[] = [], original = boot(fed(paidOriginal));
    let restored: SimHost | undefined;
    try {
      step(original);
      for (let tick = 0; tick < checkpoint; tick++) crownFight(original, tick);
      restored = restore(serializeSimSnapshot(snapshotSimHost(original)), fed(resumed));
      const paid = paidOriginal.length;
      for (let tick = checkpoint; tick < checkpoint + 3000; tick++) { crownFight(original, tick); crownFight(restored, tick); }
      expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
      expect(resumed).toEqual(paidOriginal.slice(paid));
    } finally { restored?.dispose(); original.dispose(); }
  }
}, 300_000);

it('declares the War Fan as its row: the item, the browser row and the shared recipe agree', () => {
  expect([FAN_ROW.id, SKY_ITEMS.rows[0]?.id, SKY_ITEMS.loadout.primary]).toEqual([FAN_ID, FAN_ID, FAN_ID]);
  expect(SKY_ITEMS.rows[0]?.light).toMatchObject({ damage: FAN_SWING.light, cooldown: FAN_SWING.cooldown, range: FAN_SWING.reach });
  expect(SKY_ITEMS.rows[0]?.heavy).toMatchObject({ damage: FAN_SWING.heavy, cooldown: FAN_SWING.heavyCooldown, range: FAN_SWING.reach });
});

it('swings the War Fan on player attacks: the row\'s light contact, gated by its cooldown, only within its arc', () => {
  const host = boot(fed());
  try {
    run(host, []); // the goats land
    const goat = host.entities.get('far.goat.0'); if (goat === undefined) throw new Error('missing goat');
    host.player.position.set(goat.position.x, goat.position.y, goat.position.z + 2.5);
    const hp = goat.hp, swing = (): void => { run(host, [{ kind: 'player', moveX: 0, moveZ: 0, yaw: 0, attack: { targetId: 'far.goat.0' } }]); };
    swing(); expect(goat.hp).toBe(hp - FAN_SWING.light);
    for (let i = 0; i < Math.floor(FAN_SWING.cooldown * 60) - 2; i++) swing();
    expect(goat.hp).toBe(hp - FAN_SWING.light); // still cooling down
    for (let i = 0; i < 4; i++) swing();
    expect(goat.hp).toBe(hp - 2 * FAN_SWING.light);
    // a target out of reach takes nothing
    const far = host.entities.get('far.goat.1'), before = far?.hp;
    for (let i = 0; i < 60; i++) run(host, [{ kind: 'player', moveX: 0, moveZ: 0, yaw: 0, attack: { targetId: 'far.goat.1' } }]);
    expect(far?.hp).toBe(before);
  } finally { host.dispose(); }
});

it('GUSTs along the yaw: the cone pushes and nicks a creature, and turns the vanes only once the notes are read', () => {
  const host = boot(fed());
  try {
    run(host, []);
    const goat = host.entities.get('far.goat.0'); if (goat === undefined) throw new Error('missing goat');
    host.player.position.set(goat.position.x, goat.position.y, goat.position.z + 4); // facing -z (yaw 0) at the goat
    const hp = goat.hp, gust = (): void => { run(host, [{ kind: 'script', actorId: FAN_ACTOR, value: FAN_ACT.gust }]); };
    gust();
    expect(goat.hp).toBe(hp - FAN_GUST.damage); expect(goat.hasImpulse).toBe(true);
    const vane = VANES[0]; if (vane === undefined) throw new Error('missing vane');
    const toVane = (): void => { host.player.position.set(vane.x, vane.y, vane.z + 6); host.player.yaw = 0; };
    for (let i = 0; i < FAN_GUST.cooldown * 60; i++) run(host, []);
    toVane(); gust(); expect(host.flags.has(vaneFlag(vane.id))).toBe(false); // the notes are unread
    host.flags.set(FLAGS.notes);
    for (let i = 0; i < FAN_GUST.cooldown * 60; i++) run(host, []);
    toVane(); gust(); expect(host.flags.has(vaneFlag(vane.id))).toBe(true);
  } finally { host.dispose(); }
});

it('restores the fan\'s cooldowns exactly', () => {
  const original = boot(fed()); let restored: SimHost | undefined;
  try {
    run(original, []);
    const goat = original.entities.get('far.goat.0'); if (goat === undefined) throw new Error('missing goat');
    original.player.position.set(goat.position.x, goat.position.y, goat.position.z + 2.5);
    run(original, [{ kind: 'player', moveX: 0, moveZ: 0, yaw: 0, attack: { targetId: 'far.goat.0' } }, { kind: 'script', actorId: FAN_ACTOR, value: FAN_ACT.gust }]);
    const saved = serializeSimSnapshot(snapshotSimHost(original));
    expect(snapshotSimHost(original).adapters.find(adapter => adapter.id === FAN_STEP)?.state).toEqual({ cooldown: FAN_SWING.cooldown, gustCooldown: FAN_GUST.cooldown });
    restored = restore(saved, fed());
    for (let i = 0; i < 120; i++) {
      const commands: HeadlessCommand[] = [{ kind: 'player', moveX: 0, moveZ: 0, yaw: 0, attack: { targetId: 'far.goat.0' } }];
      run(original, commands); run(restored, commands);
    }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
  } finally { restored?.dispose(); original.dispose(); }
});

it('refuses a saved roster whose recipe no longer matches the baked spec', () => {
  const host = boot();
  try {
    for (let tick = 0; tick < 60; tick++) step(host);
    const saved = snapshotSimHost(host);
    const actor = saved.adapters.find(adapter => adapter.id === 'runtime.actor.far.goat.1');
    if (actor === undefined || typeof actor.state !== 'string') throw new Error('missing saved goat recipe');
    actor.state = actor.state.replace('"hp":40', '"hp":41');
    expect(() => restore(serializeSimSnapshot(saved))).toThrow('Incompatible dynamic simulation actor recipe');
  } finally { host.dispose(); }
});

it('imports the trusted headless runtime without DOM or renderer modules', () => {
  const result = spawnSync(execPath, ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e',
    "const m = await import('./src/shards/far-reach/runtime/headless.ts'); if (typeof m.prepareHeadlessRuntime !== 'function') throw new Error('no factory'); if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('DOM present');"], { encoding: 'utf8', timeout: 20000 });
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
});

it('proves all four Rising Islet entries on the trusted world: a real capsule boards, rides, walks on and the road gates close', () => {
  const proof = plan.proveEntries?.(boot());
  expect(proof).toMatchObject({ lanes: 92, liftRides: 8, liftCalls: 8 });
  expect(proof?.steps).toBeGreaterThan(1000);
}, 120_000);
