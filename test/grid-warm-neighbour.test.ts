// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real regional physics and traveller transfer.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { CHUNK_HALF } from '../src/engine/core/config';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost, type SimLevel } from '../src/engine/sim';
import { GridAssembly } from '../src/game/grid/assembly';
import { LiveGridHost } from '../src/game/grid/live';
import { PageResidency } from '../src/game/grid/pageResidency';

// G663 (tile streaming T7): a neighbour is never built whole beside a source, whichever way the traveller heads. A
// committed crossing into another cell retires the source just left before the destination's world allocates; a U-turn
// back into that source re-activates it.
const level: SimLevel = { version: 1, id: 'platform', seed: 1, ground: { size: 500, height: 0 },
  player: { at: { x: 0, y: 0, z: 0 }, yaw: 0, speed: 30 }, entities: [], quests: [],
  weapon: { id: 'none', shape: { kind: 'point', radius: 0 }, windup: 0, active: 0, recover: 0, cooldown: 0, range: 0, damage: 0, tags: [] } };

// a 1 m step along (dx, dz) ending at the player's position
function travel(live: LiveGridHost, at: { x: number; z: number }, dx: number, dz: number): void {
  at.x -= dx; at.z -= dz; live.beforeFixed();
  at.x += dx; at.z += dz; live.beforeFixed();
}

async function fixture() {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const assembly = new GridAssembly({ developer: false, devserver: false }), home = assembly.cell('driftwood-isle');
  const east = assembly.cells.find(cell => cell.origin.x === assembly.pitch && cell.origin.z === 0);
  const north = assembly.cells.find(cell => cell.origin.x === 0 && cell.origin.z === -assembly.pitch);
  if (east === undefined || north === undefined) throw new Error('Missing neighbours');
  const page = createSimHost(level, { rapier }), residency = new PageResidency(), events: string[] = [];
  const allocated: { instance: string; owners: string[] }[] = [], control = { dispose: true };
  const player = { position: page.player.position, yaw: -Math.PI / 2, health: page.player.health, owner: page.player, motor: page.releasePlayerMotor() };
  const live = new LiveGridHost(assembly, {
    home: { mode: 'owned', instance: home.instance, bytes: 1000, residency: residency.admitHome(home.instance, 1000) },
    player, allocator: residency.allocator, continuations: 'durable', save: () => true,
    bindFrame: () => undefined, gameplayReady: () => true,
    highway: { bytes: 1000, create: () => ({ physics: page.physics, dispose: () => undefined }) },
    prefetchable: cell => [home.instance, east.instance, north.instance].includes(cell.instance),
    // a large world: its readiness reach starts well inside the source
    readiness: { link: { speed: 30, linkBitsPerSecond: 5_000_000, requestLatencySeconds: 0.25, maxStallSeconds: 3 },
      bundle: () => ({ criticalWireBytes: 1000, hybridWireBytes: 1000, decodeSeconds: 0, runtimeParseSeconds: 10 }) },
    admit: cell => Promise.resolve({ bytes: 1000, exclusiveRuntime: true, reloadsCheckpoint: true, prepareRuntime: () => Promise.resolve(),
      create: () => {
        allocated.push({ instance: cell.instance, owners: [...residency.allocator.claims()].map(row => row.owner) });
        events.push(`create:${cell.instance}`);
        const host = createSimHost(level, { rapier, playerBody: false, ground: false });
        return Promise.resolve({ host, checkpoint: () => true, dispose: () => { host.dispose(); }, *retire() {
          events.push(`retire:${cell.instance}`);
          yield { scope: cell.instance, kind: 'disposers' } as const;
          if (cell.instance === home.instance && !control.dispose) throw new Error('kept disposal refused');
          host.dispose(); events.push(`disposed:${cell.instance}`);
        } });
      } }),
  });
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 20; i++) { live.beforeFixed(); await new Promise(resolve => { setTimeout(resolve, 2); }); }
  };
  const enterHome = async (): Promise<void> => { const enter = await live.prepare(null, home.instance); enter.commit(); };
  const cross = async (from: string, to: string): Promise<void> => {
    const leave = await live.prepare(from, null); leave.commit();
    const enter = await live.prepare(null, to); enter.commit();
  };
  return { live, home, east, north, player, events, allocated, control, settle, enterHome, cross,
    claims: () => [...residency.allocator.claims()],
    created: () => events.filter(event => event.startsWith('create:')).map(event => event.slice(7)),
    close: () => { control.dispose = true; live.dispose(); player.motor.dispose(); page.dispose(); residency.dispose(); } };
}

test('G663: in a source no neighbour builds, whichever way the traveller heads, stands or teleports', async () => {
  const f = await fixture();
  try {
    await f.enterHome();
    f.player.position.x = CHUNK_HALF - 20; travel(f.live, f.player.position, 1, 0); await f.settle();
    f.player.position.x = CHUNK_HALF - 30; f.player.position.z = -(CHUNK_HALF - 20); travel(f.live, f.player.position, 0, -1); await f.settle();
    for (let tick = 0; tick < 30; tick++) { f.player.yaw = tick * 0.01; f.live.beforeFixed(); }
    f.player.position.x = CHUNK_HALF - 5; f.player.position.z = 0; f.live.beforeFixed(); await f.settle();
    expect(f.created()).toEqual([f.home.instance]);
    expect(f.live.state().residents).toEqual([f.home.instance]);
    expect(f.live.state().issues).toEqual({});
  } finally { f.close(); }
});

test('G663: a crossing retires the source just left before the destination allocates', async () => {
  const f = await fixture();
  try {
    await f.enterHome();
    await f.cross(f.home.instance, f.east.instance);
    expect(f.live.state().current).toBe(f.east.instance);
    expect(f.live.state().residents).toEqual([f.east.instance]);
    expect(f.events.indexOf(`disposed:${f.home.instance}`)).toBeGreaterThan(-1);
    expect(f.events.indexOf(`disposed:${f.home.instance}`)).toBeLessThan(f.events.indexOf(`create:${f.east.instance}`));
    expect(f.allocated.find(row => row.instance === f.east.instance)?.owners).not.toContain(f.home.instance);
    expect(f.live.state().issues).toEqual({});
  } finally { f.close(); }
});

test('G663: a U-turn back into the source just left re-activates it', async () => {
  const f = await fixture();
  try {
    await f.enterHome();
    await f.cross(f.home.instance, f.home.instance);
    expect(f.live.state().current).toBe(f.home.instance);
    expect(f.created()).toEqual([f.home.instance]);
    expect(f.events.filter(event => event.startsWith('retire:'))).toEqual([]);
  } finally { f.close(); }
});

test('a throwing source disposal stays fully charged and prevents the destination allocating', async () => {
  const f = await fixture();
  try {
    await f.enterHome();
    f.control.dispose = false;
    await expect(f.cross(f.home.instance, f.east.instance)).rejects.toThrow('successful disposal');
    expect(f.created()).toEqual([f.home.instance]);
    expect(f.claims().some(row => row.owner === f.home.instance && row.bytes === 1000)).toBe(true);
    expect(f.claims().some(row => row.owner === f.east.instance)).toBe(false);
    expect(f.live.state().issues[`cleanup:${f.home.instance}`]).toContain('kept disposal refused');
  } finally { f.close(); }
});

test('T7: a committed crossing into another cell abandons a road-approach guess and builds the destination at once', async () => {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const assembly = new GridAssembly({ developer: false, devserver: false });
  const home = assembly.cell('driftwood-isle');
  const east = assembly.cells.find(cell => cell.origin.x === assembly.pitch && cell.origin.z === 0);
  const north = assembly.cells.find(cell => cell.origin.x === 0 && cell.origin.z === -assembly.pitch);
  if (east === undefined || north === undefined) throw new Error('Missing neighbours');
  const page = createSimHost(level, { rapier }), residency = new PageResidency(), created: string[] = [], abandoned: string[] = [];
  const player = { position: page.player.position, yaw: -Math.PI / 2, health: page.player.health, owner: page.player, motor: page.releasePlayerMotor() };
  const live = new LiveGridHost(assembly, {
    home: { mode: 'owned', instance: home.instance, bytes: 1000, residency: residency.admitHome(home.instance, 1000) },
    player, allocator: residency.allocator, continuations: 'durable', save: () => true,
    bindFrame: () => undefined, gameplayReady: () => true,
    highway: { bytes: 1000, create: () => ({ physics: page.physics, dispose: () => undefined }) },
    prefetchable: cell => cell.instance === east.instance || cell.instance === north.instance,
    readiness: { link: { speed: 30, linkBitsPerSecond: 5_000_000, requestLatencySeconds: 0.25, maxStallSeconds: 3 },
      bundle: () => ({ criticalWireBytes: 1000, hybridWireBytes: 1000, decodeSeconds: 0, runtimeParseSeconds: 10 }) },
    admit: cell => Promise.resolve({ bytes: 1000, exclusiveRuntime: true, reloadsCheckpoint: true, prepareRuntime: () => Promise.resolve(),
      create: (_saved, _claim, signal) => {
        created.push(cell.instance);
        // the east world builds until abandoned (a world that would take seconds)
        if (cell.instance === east.instance && abandoned.length === 0) return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => { abandoned.push(cell.instance); reject(new Error('stopped')); }, { once: true });
        });
        const host = createSimHost(level, { rapier, playerBody: false, ground: false });
        return Promise.resolve({ host, dispose: () => { host.dispose(); } });
      } }),
  });
  try {
    const enter = await live.prepare(null, home.instance); enter.commit();
    const leave = await live.prepare(home.instance, null); leave.commit();
    // on the road, heading straight at the east cell's mouth: the approach guesses east and starts its world
    player.position.x = CHUNK_HALF + 0.5; player.position.z = 0; travel(live, player.position, 1, 0);
    for (let i = 0; i < 4; i++) await new Promise(resolve => { setTimeout(resolve, 5); });
    expect(live.state().pending).toContain(east.instance);
    // the traveller turns and commits north instead: the east guess is abandoned at its next safe point, north builds
    player.position.x = 0; player.position.z = -(CHUNK_HALF + 0.5); live.beforeFixed();
    const north1 = await live.prepare(null, north.instance); north1.commit();
    expect(abandoned).toEqual([east.instance]);
    expect(live.state().current).toBe(north.instance);
    expect(live.state().residents).toEqual([north.instance]);
    expect(live.state().issues).toEqual({}); // no issue: east builds again when the traveller heads for it
  } finally { live.dispose(); player.motor.dispose(); page.dispose(); residency.dispose(); }
});
