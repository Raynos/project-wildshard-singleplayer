import { beforeAll, expect, it } from 'vitest';
import { Scene, Group, PerspectiveCamera } from 'three';
import * as v from 'valibot';
import { LadderModeSchema, parseModes, type LadderMode } from '@wildshard/format/modes';
import { Ladder } from '../src/sdk/modes';
import { readScene } from '../src/sdk/scene';
import { restoreSceneGraph } from '../src/sdk/sceneGraph';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { emptyShardfile } from '../src/sdk/author';
import { parseShardfile, shardfileRules } from '@wildshard/format/shardSchema';
import { HeadlessSimulation } from '../src/sdk/headless';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { loadRapier } from '../src/engine/physics/rapier';
import { groups } from '../src/engine/physics/groups';
import { createShardfileSim } from '../src/game/plugin/simulation';
import { installLadders, LadderDriver, type LadderCommand } from '../src/game/shardfile/ladder';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { Player } from '../src/engine/player/Player';
import { playerModes } from '../src/engine/player/modes';
import { Physics } from '../src/engine/physics/Physics';
import { Scope } from '../src/engine/app/scope';
import { app } from '../src/engine/app/runtime';
import { legacyDouble } from './fake/FakeGame';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const row: LadderMode = v.parse(LadderModeSchema, { kind: 'ladder', id: 'tower', bottom: { x: 0, y: 0, z: 0 },
  top: { x: 0, y: 3, z: 0 }, exit: { x: 0, y: 3, z: -1 }, normal: { x: 0, z: 1 } });
const level = { ...SIM_LEVEL, entities: [] };
const up = { moveX: 0, moveZ: -1, yaw: 0 }, down = { moveX: 0, moveZ: 1, yaw: 0 };
let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });
function install(host: SimHost, restoring = false): void {
  installLadders(host, [row]);
  if (!restoring) {
    // Real tower wall and upper deck stay behind the capsule corridor; the ladder does not invent them.
    host.physics.world.createCollider(rapier.ColliderDesc.cuboid(1, 1.5, 0.1).setTranslation(0, 1.5, -0.7).setCollisionGroups(groups('WORLD')));
    host.physics.world.createCollider(rapier.ColliderDesc.cuboid(1, 0.1, 1).setTranslation(0, 2.9, -1.6).setCollisionGroups(groups('WORLD')));
  }
}

it('admits only finite vertical rows, with a real authored upper landing and no native-runtime requirement', () => {
  const shard = emptyShardfile({ slug: 'ladder-fixture', name: 'Ladder', author: 'Fixture', seed: 1, revision: 1 });
  shard.modes = parseModes({ traverse: [row] }); expect(parseShardfile(shard).runtime).toBeNull();
  const native = { ...shard, runtime: { entry: 'runtime/index.ts', binds: ['modes' as const] } };
  expect(shardfileRules(native)).toContain('ladder traversal requires the data-only player owner');
  expect(() => parseShardfile(native)).toThrow();
  for (const bad of [{ ...row, normal: { x: 0, z: 0 } }, { ...row, speed: Infinity }, { ...row, reach: 2 },
    { ...row, top: row.bottom }, { ...row, top: { ...row.top, x: 1 } }, { ...row, exit: { ...row.exit, y: 4 } },
    { ...row, exit: { x: 0, y: 3, z: 3 } }, { ...row, teleport: true }]) expect(() => parseModes({ traverse: [bad] })).toThrow();
  expect(() => parseModes({ traverse: [row, row] })).toThrow('unique');
});

it('reads and losslessly restores transformed Ladder scene objects without creating colliders or runtime callbacks', () => {
  const scene = new Scene(), group = new Group(); group.position.set(10, 2, -20); group.rotation.y = Math.PI / 2; group.scale.setScalar(2);
  const ladder = new Ladder(); ladder.name = 'watchtower'; group.add(ladder); scene.add(group);
  const read = readScene(scene); expect(read.modes?.traverse[0]).toMatchObject({ kind: 'ladder', bottom: { x: 10, y: 2, z: -20 }, top: { x: 10, y: 8, z: -20 } });
  expect(read.colliders).toHaveLength(0);
  expect(encodeCanonicalJson(readScene(restoreSceneGraph(read)))).toBe(encodeCanonicalJson(read));
  const copy = ladder.clone(); copy.bottom.y = 1; copy.options.speed = 3; expect(ladder.bottom.y).toBe(0); expect(ladder.options.speed).toBeUndefined();
  ladder.rotation.x = 0.1; expect(() => ladder.toModeData()).toThrow('horizontal');
});

it('climbs the real capsule to an authored deck, never teleports, and stands down for ordinary movement after exit', () => {
  const host = createSimHost(level, { rapier });
  try {
    install(host); let previous = host.player.position.clone(); const start = previous.clone(); let stuck = 0;
    for (let i = 0; i < 125; i++) {
      host.step(up); expect(host.player.position.distanceTo(previous)).toBeLessThan(0.08); previous = host.player.position.clone();
      if (i === 119 && host.player.position.distanceTo(start) < 0.3) stuck++;
    }
    expect(stuck).toBe(0); expect(host.player.position.y).toBeCloseTo(3, 1); expect(host.player.position.z).toBeLessThan(-0.9);
    expect(host.playerMode).toBe('foot');
    const x = host.player.position.x; host.step({ moveX: 1, moveZ: 0, yaw: 0 }); expect(host.player.position.x).toBeGreaterThan(x);
  } finally { host.dispose(); }
});

it('restores a mid-climb and descent exactly, preserves ledger state, and refuses unowned or malformed continuation', () => {
  const host = createSimHost(level, { rapier }); let restored: SimHost | undefined;
  try {
    install(host); for (let i = 0; i < 45; i++) host.step(up);
    expect(host.playerMode).toBe('climb'); const saved = snapshotSimHost(host);
    restored = restoreSimHost(level, { rapier }, saved, fresh => { install(fresh, true); });
    expect(snapshotSimHost(restored)).toEqual(saved);
    for (let i = 0; i < 80; i++) { host.step(down); restored.step(down); }
    expect(snapshotSimHost(restored)).toEqual(snapshotSimHost(host)); expect(host.playerMode).toBe('foot');
    expect(host.player.position.y).toBeCloseTo(0, 1); expect(host.slots).toEqual(restored.slots);
    const driver = new LadderDriver([row]); const prior = driver.snapshot();
    const changed = new LadderDriver([{ ...row, speed: 3 }]); expect(() => changed.restore(prior)).toThrow('continuation');
    expect(() => driver.restore({ ...prior, route: 'missing', exit: false, latched: false })).toThrow(); expect(driver.snapshot()).toEqual(prior);
    expect(() => driver.restore({ ...prior, route: row.id, exit: false, latched: true })).toThrow(); expect(driver.snapshot()).toEqual(prior);
  } finally { restored?.dispose(); host.dispose(); }
});

it('honors ceiling collisions, release controls, earlier traversals and scope disposal', () => {
  const host = createSimHost(level, { rapier });
  try {
    install(host);
    const ceiling = host.physics.world.createCollider(rapier.ColliderDesc.cuboid(1, 0.1, 1).setTranslation(0, 2.2, 0).setCollisionGroups(groups('WORLD')));
    for (let i = 0; i < 60; i++) host.step(up);
    expect(host.player.position.y).toBeLessThan(0.6); expect(host.playerMode).toBe('climb');
    host.step({ ...up, jump: true }); expect(host.playerMode).toBe('foot');
    host.physics.world.removeCollider(ceiling, false); host.step({ moveX: 0, moveZ: 0, yaw: 0 });
    const before = host.player.position.clone(); host.events.answer('player.traversal', () => true, host.scope, { order: -1 });
    host.step(up); expect(host.player.position).toEqual(before);
  } finally { host.dispose(); }
});

it('uses the actual borrowed page registry and motor without installing a second player driver', () => {
  const owner = createSimHost(level, { rapier });
  const borrowed = createSimHost(level, { rapier, physics: owner.physics, player: owner.player, scope: owner.scope.child('client'),
    events: owner.events, clock: owner.clock, combat: owner.combat, fixedStep: () => () => undefined });
  let command: LadderCommand = { x: 0, z: -1, release: false }; let enabled = false;
  try {
    expect(() => installLadders(borrowed, [row])).toThrow('real player controls');
    // The page owner supplies its registry, controls and fall-state cleanup; no fake motor/physics is used.
    installLadders(borrowed, [row], { modes: owner.modes, enabled: () => enabled, command: () => command, claimed: () => { owner.playerFall.vy = 0; owner.playerFall.grounded = false; } });
    owner.step({ moveX: 0, moveZ: 0, yaw: 0 }); expect(owner.playerMode).toBe('foot');
    enabled = true; command = { x: 0, z: 0, release: false }; owner.step({ moveX: 0, moveZ: 0, yaw: 0 });
    command = { x: 0, z: -1, release: false };
    const startY = owner.player.position.y; for (let i = 0; i < 30; i++) owner.step(up);
    expect(owner.player.position.y).toBeCloseTo(startY + 1, 4); expect(owner.playerMode).toBe('climb');
    borrowed.dispose(); command = { x: 0, z: -1, release: false }; const y = owner.player.position.y; owner.step(up);
    expect(owner.playerMode).toBe('foot'); expect(owner.player.position.y).toBeLessThan(y);
  } finally { borrowed.dispose(); owner.dispose(); }
});

it('installs authored rows automatically in the real SDK worker and replays its mid-climb checkpoint byte-exactly', async () => {
  const shard = emptyShardfile({ slug: 'ladder-fixture', name: 'Ladder', author: 'Fixture', seed: 1, revision: 1 }); shard.modes = { traverse: [row] };
  const local = createShardfileSim(shard, new Map(), { rapier });
  const worker = await HeadlessSimulation.create(shard, new Map(), undefined, { deadline: 'advisory' }); let restored: HeadlessSimulation | undefined;
  try {
    for (let i = 0; i < 30; i++) { local.host.step(up); await worker.step([{ source: 'player', commands: [{ kind: 'player', ...up }] }]); }
    const checkpoint = worker.checkpoint; if (checkpoint === undefined) throw new Error('Worker did not commit');
    restored = await HeadlessSimulation.create(shard, new Map(), checkpoint.snapshot, { deadline: 'advisory' });
    for (let i = 0; i < 40; i++) {
      const sources = [{ source: 'player', commands: [{ kind: 'player' as const, ...down }] }];
      const a = await worker.step(sources), b = await restored.step(sources); expect(b).toEqual(a);
    }
  } finally { await restored?.dispose(); await worker.dispose(); local.dispose(); }
}, 20_000);

it('keeps no-ladder native payloads byte-identical and allocates no traversal continuation', () => {
  const a = createSimHost(level, { rapier }), b = createSimHost(level, { rapier });
  try { installLadders(b, []); for (let i = 0; i < 60; i++) { a.step(up); b.step(up); } expect(snapshotSimHost(a)).toEqual(snapshotSimHost(b)); }
  finally { b.dispose(); a.dispose(); }
});


it('uses the real page Player fixed-step input once and clears it even when a traversal refuses', () => {
  const physics = new Physics(rapier), scope = new Scope('page-ladder');
  const player = new Player(new PerspectiveCamera(), physics, legacyDouble<HTMLCanvasElement>({}), { waterLine: { update: () => undefined, setHint: () => undefined } });
  const driver = new LadderDriver([row]), controls: LadderCommand = { x: 0, z: -1, release: false };
  const input = { moveX: 0, moveY: 1, yaw: 0, pitch: 0, crouch: false, sprint: false, jump: false, dodge: false, dive: false, surface: false,
    aim: { origin: { x: 0, y: 1.68, z: 0 }, direction: { x: 0, y: 0, z: -1 } } };
  player.traversalEvents = app.events;
  try {
    let recorded = 0;
    player.recordCommand = () => { recorded++; };
    playerModes(player).register({ id: 'climb', hud: 'none', traverse: dt => {
      expect(player.traversalCommand).toBe(input);
      return driver.step(dt, controls, player.position, player.motor);
    } }, scope, { events: app.events });
    for (let i = 0; i < 30; i++) { physics.step(); player.step(1 / 60, input); expect(player.traversalCommand).toBeNull(); }
    expect(recorded).toBe(30); expect(player.position.y).toBeCloseTo(1, 4);
    app.events.answer('player.traversal', () => { throw new Error('Refused traversal'); }, scope, { order: -1 });
    expect(() => player.step(1 / 60, input)).toThrow('Refused traversal'); expect(player.traversalCommand).toBeNull();
  } finally { scope.dispose(); player.motor.dispose(); physics.dispose(); }
});
