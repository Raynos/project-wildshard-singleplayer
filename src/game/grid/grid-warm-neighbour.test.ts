// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real regional physics and traveller transfer.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { isDev, setDev } from '@wildshard/engine/core/devMode';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { buildYield } from '@wildshard/engine/core/workSlice';
import { loadRapier } from '@wildshard/engine/physics/rapier';
import { createSimHost, type SimLevel } from '@wildshard/engine/sim';
import { GridAssembly } from './assembly';
import { LiveGridHost } from './live';
import { PageResidency } from './pageResidency';

// G663 remains the opaque/over-budget fallback. G723 opts in isolated factories only: a kept source plus one incoming
// world may fit, but the source retires before destination entry; a U-turn reuses it and abandons the incoming guess.
const level: SimLevel = { version: 1, id: 'platform', seed: 1, ground: { size: 500, height: 0 },
  player: { at: { x: 0, y: 0, z: 0 }, yaw: 0, speed: 30 }, entities: [], quests: [],
  weapon: { id: 'none', shape: { kind: 'point', radius: 0 }, windup: 0, active: 0, recover: 0, cooldown: 0, range: 0, damage: 0, tags: [] } };

// a 1 m step along (dx, dz) ending at the player's position
function travel(live: LiveGridHost, at: { x: number; z: number }, dx: number, dz: number): void {
  at.x -= dx; at.z -= dz; live.beforeFixed();
  at.x += dx; at.z += dz; live.beforeFixed();
}

async function fixture(options: { paired?: boolean; loading?: number; isolation?: boolean; allNeighbours?: boolean; horizonSeconds?: number } = {}) {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const assembly = new GridAssembly({ developer: false, devserver: false }), home = assembly.cell('driftwood-isle');
  const east = assembly.cells.find(cell => cell.origin.x === assembly.pitch && cell.origin.z === 0);
  const north = assembly.cells.find(cell => cell.origin.x === 0 && cell.origin.z === -assembly.pitch);
  if (east === undefined || north === undefined) throw new Error('Missing neighbours');
  const page = createSimHost(level, { rapier }), residency = new PageResidency(), events: string[] = [];
  const allocated: { instance: string; owners: string[] }[] = [];
  const admissions: string[] = [], runtimes: string[] = [], cancelled: string[] = [];
  const control: { dispose: boolean; holdIncoming: boolean; finish: (() => void) | undefined; reject: ((error: Error) => void) | undefined; aborted: string[]; ownedYield: boolean; yielding: boolean } = {
    dispose: true, holdIncoming: false, finish: undefined, reject: undefined, aborted: [], ownedYield: false, yielding: false,
  };
  const budget = { playing: 1_200_000_000, loading: options.loading ?? 1_800_000_000 };
  const player = { position: page.player.position, yaw: -Math.PI / 2, health: page.player.health, owner: page.player, motor: page.releasePlayerMotor() };
  const live = new LiveGridHost(assembly, {
    home: { mode: 'owned', instance: home.instance, bytes: 1000, residency: residency.admitHome(home.instance, 1000) },
    player, allocator: residency.allocator, continuations: 'durable', save: () => true,
    bindFrame: frame => { events.push(`frame:${frame.instance ?? 'road'}`); }, gameplayReady: () => true,
    ...(options.paired === true ? { preparationBudget: budget } : {}),
    highway: { bytes: 1000, create: () => ({ physics: page.physics, dispose: () => undefined }) },
    prefetchable: cell => options.allNeighbours === true || [home.instance, east.instance, north.instance].includes(cell.instance),
    // a large world: its readiness reach starts well inside the source
    readiness: { link: { speed: 30, linkBitsPerSecond: 5_000_000, requestLatencySeconds: 0.25, maxStallSeconds: 3 },
      bundle: () => ({ criticalWireBytes: 1000, hybridWireBytes: 1000, decodeSeconds: 0, runtimeParseSeconds: options.horizonSeconds ?? 10 }) },
    admit: cell => { admissions.push(cell.instance); return Promise.resolve({ bytes: 1000, exclusiveRuntime: true, reloadsCheckpoint: true,
      prepareRuntime: () => { runtimes.push(cell.instance); return Promise.resolve(); }, cancel: () => { cancelled.push(cell.instance); },
      ...(options.paired === true && options.isolation !== false ? { isolatedPreparation: true } : {}),
      create: (_saved, _claim, signal) => {
        signal?.addEventListener('abort', () => { control.aborted.push(cell.instance); }, { once: true });
        allocated.push({ instance: cell.instance, owners: [...residency.allocator.claims()].map(row => row.owner) });
        events.push(`create:${cell.instance}`);
        const host = createSimHost(level, { rapier, playerBody: false, ground: false });
        const region = { host, checkpoint: () => true, dispose: () => { events.push(`disposed:${cell.instance}`); host.dispose(); }, *retire() {
          events.push(`retire:${cell.instance}`);
          yield { scope: cell.instance, kind: 'disposers' } as const;
          if (cell.instance === home.instance && !control.dispose) throw new Error('kept disposal refused');
          host.dispose(); events.push(`disposed:${cell.instance}`);
        } };
        if (cell.instance === east.instance && control.ownedYield) return (async () => {
          const cancel = (): void => { host.scope.dispose(); };
          signal?.addEventListener('abort', cancel, { once: true });
          try { control.yielding = true; await buildYield(host.scope); return region; }
          catch (error) { region.dispose(); throw error; }
          finally { signal?.removeEventListener('abort', cancel); }
        })();
        return cell.instance === east.instance && control.holdIncoming
          ? new Promise<typeof region>((resolve, reject) => {
            control.finish = () => { resolve(region); }; control.reject = error => { region.dispose(); reject(error); };
          }) : Promise.resolve(region);
      } }); },
  });
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 20; i++) { live.beforeFixed(); await new Promise(resolve => { setTimeout(resolve, 2); }); }
  };
  const enterHome = async (): Promise<void> => { const enter = await live.prepare(null, home.instance); enter.commit(); };
  const approachEast = async (): Promise<void> => {
    // Isolation and cost come from admitted metadata, not from an unverified heading guess.
    await live.prefetch([east.instance]);
    player.position.x = CHUNK_HALF + .5; player.position.z = 0;
    travel(live, player.position, 1, 0); await settle();
  };
  const cross = async (from: string, to: string): Promise<void> => {
    const leave = await live.prepare(from, null); leave.commit();
    const enter = await live.prepare(null, to); enter.commit();
  };
  return { live, home, east, north, player, events, allocated, admissions, runtimes, cancelled, control, budget, settle, enterHome, approachEast, cross,
    claims: () => [...residency.allocator.claims()],
    entries: () => residency.allocator.entries(),
    created: () => events.filter(event => event.startsWith('create:')).map(event => event.slice(7)),
    close: () => { control.dispose = true; live.dispose(); player.motor.dispose(); page.dispose(); residency.dispose(); } };
}

test('G723: prefetch reuses a consumed admission while its constructor is pending', async () => {
  const f = await fixture({ paired: true });
  try {
    await f.enterHome(); const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    f.control.holdIncoming = true; await f.approachEast();
    await f.live.prefetch([f.east.instance, f.east.instance, f.north.instance]);
    expect(f.admissions.filter(id => id === f.east.instance)).toHaveLength(1);
    expect(f.runtimes.filter(id => id === f.east.instance)).toHaveLength(1);
    expect(f.admissions.filter(id => id === f.north.instance)).toHaveLength(1);
    expect(f.live.ready(f.east.instance)).toBe(false);
    expect(f.live.state().residents).toEqual([f.home.instance]);
    expect(f.live.state().pending).toContain(f.east.instance);
    if (f.control.finish === undefined) throw new Error('Missing held constructor');
    f.control.finish(); await f.settle();
    await f.live.prefetch([f.east.instance]);
    expect(f.admissions.filter(id => id === f.east.instance)).toHaveLength(1);
    expect(f.live.ready(f.east.instance)).toBe(true);
    const enter = await f.live.prepare(null, f.east.instance); enter.commit();
    expect(f.live.current()).toBe(f.east.instance);
    expect(f.events.indexOf(`disposed:${f.home.instance}`)).toBeLessThan(f.events.indexOf(`frame:${f.east.instance}`));
    expect(f.live.state().issues).toEqual({});
  } finally { f.control.finish?.(); await f.settle(); f.close(); }
});

test('G723: failed construction keeps its original refusal and admits afresh only after retry', async () => {
  const f = await fixture({ paired: true }), failure = new Error('incoming constructor refused');
  try {
    await f.enterHome(); const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    f.control.holdIncoming = true; await f.approachEast();
    await f.live.prefetch([f.east.instance]);
    expect(f.admissions.filter(id => id === f.east.instance)).toHaveLength(1);
    if (f.control.reject === undefined) throw new Error('Missing held constructor');
    f.control.reject(failure); await f.settle();
    expect(f.live.refusal(f.east.instance)).toBe(failure);
    expect(f.live.ready(f.east.instance)).toBe(false);
    expect(f.cancelled.filter(id => id === f.east.instance)).toHaveLength(1);
    expect(f.claims().some(row => row.owner === f.east.instance)).toBe(false);
    await expect(f.live.prefetch([f.east.instance])).rejects.toThrow('incoming constructor refused');
    expect(f.admissions.filter(id => id === f.east.instance)).toHaveLength(1);
    f.live.retry(f.east.instance); f.control.holdIncoming = false;
    await f.live.prefetch([f.east.instance]);
    const enter = await f.live.prepare(null, f.east.instance); enter.commit(); await f.settle();
    expect(f.admissions.filter(id => id === f.east.instance)).toHaveLength(2);
    expect(f.live.ready(f.east.instance)).toBe(true);
    expect(f.live.state().issues).toEqual({});
  } finally { f.control.finish?.(); await f.settle(); f.close(); }
});

test('G723: a queued destination still prefetches metadata before the previous constructor settles', async () => {
  const f = await fixture({ paired: true });
  try {
    await f.enterHome(); const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    f.control.holdIncoming = true; await f.approachEast();
    const entering = f.live.prepare(null, f.north.instance);
    await f.live.prefetch([f.north.instance]);
    expect(f.admissions.filter(id => id === f.north.instance)).toHaveLength(1);
    expect(f.runtimes.filter(id => id === f.north.instance)).toHaveLength(1);
    expect(f.created()).not.toContain(f.north.instance);
    expect(f.live.ready(f.north.instance)).toBe(false);
    if (f.control.finish === undefined) throw new Error('Missing held constructor');
    f.control.finish(); const enter = await entering; enter.commit();
    expect(f.live.current()).toBe(f.north.instance);
    expect(f.admissions.filter(id => id === f.north.instance)).toHaveLength(1);
    expect(f.cancelled.filter(id => id === f.east.instance)).toHaveLength(1);
    expect(f.claims().some(row => row.owner === f.east.instance)).toBe(false);
    expect(f.live.state().issues).toEqual({});
  } finally { f.control.finish?.(); await f.settle(); f.close(); }
});

test('G723: disposal still refuses prefetch while a consumed constructor settles', async () => {
  const f = await fixture({ paired: true });
  try {
    await f.enterHome(); const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    f.control.holdIncoming = true; await f.approachEast(); f.live.dispose();
    expect(() => f.live.prefetch([f.east.instance])).toThrow('Live grid is disposed');
    if (f.control.finish === undefined) throw new Error('Missing held constructor');
    f.control.finish(); await f.settle();
    expect(f.live.ready(f.east.instance)).toBe(false);
    expect(f.claims().some(row => row.owner === f.east.instance)).toBe(false);
  } finally { f.control.finish?.(); await f.settle(); f.close(); }
});

test.each([true, false])('G723: admission timings keep one bounded phase per cell across re-entry (Developer=%s)', async developer => {
  const previous = isDev(), f = await fixture({ paired: true });
  const names = [
    ...['admission', 'runtime'].map(phase => `wildshard.prepare:${f.east.slug}:grid.product:${f.east.instance}.${phase}`),
    ...['queue', 'metadata', 'create'].map(phase => `wildshard.prepare:${f.east.slug}:grid.prepare:${f.east.instance}.${phase}`),
  ];
  try {
    setDev(developer); await f.enterHome();
    await f.live.prefetch([f.east.instance]);
    await f.cross(f.home.instance, f.east.instance);
    await f.cross(f.east.instance, f.home.instance);
    await f.cross(f.home.instance, f.east.instance);
    expect(f.live.current()).toBe(f.east.instance); expect(f.live.state().issues).toEqual({});
    for (const name of names) {
      const spans = performance.getEntriesByName(name), span = spans[0];
      expect(spans).toHaveLength(developer ? 1 : 0);
      if (developer) {
        if (span === undefined) throw new Error('Missing grid admission phase');
        const detail: unknown = Reflect.get(span, 'detail');
        expect(detail).toEqual(expect.objectContaining({ calls: 1, failures: 0 }));
      }
    }
  } finally { setDev(previous); f.close(); for (const name of names) performance.clearMeasures(name); }
});

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

test('G723: explicitly isolated preparation keeps two charged worlds before the edge, then retires before entry', async () => {
  const f = await fixture({ paired: true });
  try {
    await f.enterHome();
    const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    await f.approachEast();
    expect(f.live.state().residents).toEqual([f.home.instance, f.east.instance].sort());
    expect(f.live.ready(f.east.instance)).toBe(true);
    expect(f.events).not.toContain(`retire:${f.home.instance}`);
    expect(f.allocated.find(row => row.instance === f.east.instance)?.owners).toContain(f.home.instance);
    const enter = await f.live.prepare(null, f.east.instance);
    expect(f.events).toContain(`disposed:${f.home.instance}`);
    expect(f.claims().some(row => row.owner === f.home.instance)).toBe(false);
    enter.commit();
    expect(f.events.indexOf(`disposed:${f.home.instance}`)).toBeLessThan(f.events.indexOf(`frame:${f.east.instance}`));
    expect(f.live.state().residents).toEqual([f.east.instance]);
  } finally { f.close(); }
});

test('G723: isolated preparation uses a direct heading inside the source without transferring its traveller', async () => {
  const f = await fixture({ paired: true });
  try {
    await f.enterHome(); await f.live.prefetch([f.east.instance]);
    const sourceFrames = f.events.filter(event => event.startsWith('frame:'));
    f.player.position.x = CHUNK_HALF - 30; travel(f.live, f.player.position, 1, 0); await f.settle();
    expect(f.live.current()).toBe(f.home.instance);
    expect(f.live.state().residents).toEqual([f.home.instance, f.east.instance].sort());
    expect(f.live.ready(f.east.instance)).toBe(true);
    expect(f.events.filter(event => event.startsWith('frame:'))).toEqual(sourceFrames);
    expect(f.events).not.toContain(`retire:${f.home.instance}`);
    expect(f.allocated.find(row => row.instance === f.east.instance)?.owners).toContain(f.home.instance);
    await f.cross(f.home.instance, f.east.instance);
    expect(f.events.indexOf(`disposed:${f.home.instance}`)).toBeLessThan(f.events.indexOf(`frame:${f.east.instance}`));
    expect(f.live.state().residents).toEqual([f.east.instance]);
  } finally { f.close(); }
});

test('G723: an active source keeps its ordinary ordering when isolation or the pair budget refuses', async () => {
  for (const options of [{ paired: true, isolation: false }, { paired: true, loading: 1 }]) {
    const f = await fixture(options);
    try {
      await f.enterHome(); await f.live.prefetch([f.east.instance]);
      f.player.position.x = CHUNK_HALF - 30; travel(f.live, f.player.position, 1, 0); await f.settle();
      expect(f.created()).toEqual([f.home.instance]);
      expect(f.live.current()).toBe(f.home.instance);
      await f.cross(f.home.instance, f.east.instance);
      expect(f.events.indexOf(`disposed:${f.home.instance}`)).toBeLessThan(f.events.indexOf(`create:${f.east.instance}`));
      expect(f.live.state().issues).toEqual({});
    } finally { f.close(); }
  }
});

test('G723: source-side preparation rechecks its budget after admission and keeps an immediate return', async () => {
  const f = await fixture({ paired: true });
  try {
    await f.enterHome(); await f.live.prefetch([f.east.instance]);
    f.player.position.x = CHUNK_HALF - 30; travel(f.live, f.player.position, 1, 0);
    expect(f.live.state().pending).toContain(f.east.instance);
    f.budget.loading = 1; await f.settle();
    expect(f.created()).toEqual([f.home.instance]);
    expect(f.live.state().issues).toEqual({});
    f.budget.loading = 1_800_000_000; travel(f.live, f.player.position, 1, 0); await f.settle();
    expect(f.live.ready(f.east.instance)).toBe(true);
    const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    const back = await f.live.prepare(null, f.home.instance); back.commit(); await f.settle();
    expect(f.created().filter(id => id === f.home.instance)).toHaveLength(1);
    expect(f.live.state().residents).toEqual([f.home.instance]);
    expect(f.events).toContain(`disposed:${f.east.instance}`);
    expect(f.events).not.toContain(`retire:${f.home.instance}`);
  } finally { f.close(); }
});

test('G723: standing inside a source never guesses its isolated neighbour', async () => {
  const f = await fixture({ paired: true });
  try {
    await f.enterHome(); await f.live.prefetch([f.east.instance]);
    f.player.position.x = CHUNK_HALF - 1; await f.settle();
    expect(f.created()).toEqual([f.home.instance]);
    expect(f.live.current()).toBe(f.home.instance);
  } finally { f.close(); }
});

test('G723: committing the initial spawn does not turn its placement into a neighbour heading', async () => {
  const f = await fixture({ paired: true });
  try {
    f.live.beforeFixed();
    const enter = await f.live.prepare(null, f.home.instance);
    f.player.position.x = CHUNK_HALF - 30; enter.commit();
    await f.live.prefetch([f.east.instance]); await f.settle();
    expect(f.live.current()).toBe(f.home.instance);
    expect(f.created()).toEqual([f.home.instance]);
    travel(f.live, f.player.position, 1, 0); await f.settle();
    expect(f.live.ready(f.east.instance)).toBe(true);
    expect(f.live.current()).toBe(f.home.instance);
  } finally { f.close(); }
});

test('G723: a source pose jump resets the heading before the next genuine movement', async () => {
  const f = await fixture({ paired: true });
  try {
    await f.enterHome(); await f.live.prefetch([f.east.instance]); f.live.beforeFixed();
    f.player.position.x = CHUNK_HALF - 30; f.live.beforeFixed(); await f.settle();
    expect(f.created()).toEqual([f.home.instance]);
    travel(f.live, f.player.position, 1, 0); await f.settle();
    expect(f.live.ready(f.east.instance)).toBe(true);
    expect(f.live.state().residents).toEqual([f.home.instance, f.east.instance].sort());
  } finally { f.close(); }
});

test('G723: a road pose jump is not a boulevard prediction and the following drive still prepares', async () => {
  const f = await fixture({ paired: true });
  try {
    await f.enterHome(); const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    await f.live.prefetch([f.east.instance]);
    f.player.position.x = f.east.origin.x / 2; f.player.position.z = -300; f.live.beforeFixed();
    f.player.position.z = -100; f.live.beforeFixed(); await f.settle();
    expect(f.created()).toEqual([f.home.instance]);
    travel(f.live, f.player.position, 0, 1); await f.settle();
    expect(f.live.ready(f.east.instance)).toBe(true);
    expect(f.live.state().residents).toEqual([f.home.instance, f.east.instance].sort());
  } finally { f.close(); }
});

test('G723: filtering a pose heading never suppresses ordinary readiness at the destination wall', async () => {
  const f = await fixture({ paired: true });
  try {
    await f.enterHome(); const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    await f.live.prefetch([f.east.instance]);
    f.player.position.x = f.east.origin.x - CHUNK_HALF - .5; f.player.position.z = 0;
    f.live.beforeFixed(); await f.settle();
    expect(f.live.current()).toBe(null);
    expect(f.live.ready(f.east.instance)).toBe(true);
    expect(f.live.state().residents).toEqual([f.home.instance, f.east.instance].sort());
    expect(f.events).not.toContain(`retire:${f.home.instance}`);
  } finally { f.close(); }
});

test('G723: a U-turn retires an already prepared guess and reuses the kept source', async () => {
  const f = await fixture({ paired: true });
  try {
    await f.enterHome(); const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    await f.approachEast();
    expect(f.live.ready(f.east.instance)).toBe(true);
    const back = await f.live.prepare(null, f.home.instance); back.commit(); await f.settle();
    expect(f.created().filter(id => id === f.home.instance)).toHaveLength(1);
    expect(f.live.state().residents).toEqual([f.home.instance]);
    expect(f.events).not.toContain(`retire:${f.home.instance}`);
    expect(f.events).toContain(`disposed:${f.east.instance}`);
  } finally { f.close(); }
});

test('G723: a budget refusal keeps the old retire-before-allocation crossing without an issue', async () => {
  const f = await fixture({ paired: true, loading: 1 });
  try {
    await f.enterHome(); const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    await f.approachEast();
    expect(f.created()).toEqual([f.home.instance]);
    const enter = await f.live.prepare(null, f.east.instance); enter.commit();
    expect(f.events.indexOf(`disposed:${f.home.instance}`)).toBeLessThan(f.events.indexOf(`create:${f.east.instance}`));
    expect(f.live.state().issues).toEqual({});
  } finally { f.close(); }
});

test('G723: a budget port alone never treats an opaque factory as isolated', async () => {
  const f = await fixture({ paired: true, isolation: false });
  try {
    await f.enterHome(); const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    await f.approachEast();
    expect(f.created()).toEqual([f.home.instance]);
    const enter = await f.live.prepare(null, f.east.instance); enter.commit();
    expect(f.events.indexOf(`disposed:${f.home.instance}`)).toBeLessThan(f.events.indexOf(`create:${f.east.instance}`));
  } finally { f.close(); }
});

test('G723: the budget is rechecked after queuing, retaining metadata for a safe later attempt', async () => {
  const f = await fixture({ paired: true });
  try {
    await f.enterHome(); const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    await f.live.prefetch([f.east.instance]);
    f.player.position.x = CHUNK_HALF + .5; travel(f.live, f.player.position, 1, 0);
    expect(f.live.state().pending).toContain(f.east.instance);
    f.budget.loading = 1; await f.settle();
    expect(f.created()).toEqual([f.home.instance]);
    expect(f.live.state().issues).toEqual({});
    expect(f.live.ready(f.east.instance)).toBe(false);
    f.budget.loading = 1_800_000_000;
    travel(f.live, f.player.position, 1, 0); await f.settle();
    expect(f.live.ready(f.east.instance)).toBe(true);
    expect(f.created()).toEqual([f.home.instance, f.east.instance]);
  } finally { f.close(); }
});

test('G723: a unique isolated boulevard destination prepares before the traveller turns into its mouth', async () => {
  const f = await fixture({ paired: true });
  try {
    await f.enterHome(); const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    await f.live.prefetch([f.east.instance]);
    f.player.position.x = f.east.origin.x / 2; f.player.position.z = -100;
    travel(f.live, f.player.position, 0, 1); await f.settle();
    expect(f.live.current()).toBe(null);
    expect(f.live.ready(f.east.instance)).toBe(true);
    expect(f.live.state().residents).toEqual([f.home.instance, f.east.instance].sort());
    expect(f.events).not.toContain(`retire:${f.home.instance}`);
  } finally { f.close(); }
});

test('G723: changing the prepared prediction never allocates a third world', async () => {
  const f = await fixture({ paired: true });
  try {
    await f.enterHome(); const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    await f.approachEast();
    expect(f.live.ready(f.east.instance)).toBe(true);
    const next = await f.live.prepare(null, f.north.instance); next.commit();
    expect(f.events.indexOf(`disposed:${f.east.instance}`)).toBeLessThan(f.events.indexOf(`create:${f.north.instance}`));
    expect(f.allocated.every(row => row.owners.filter(owner => [f.home.instance, f.east.instance, f.north.instance].includes(owner)).length <= 2)).toBe(true);
    expect(f.live.state().residents).toEqual([f.north.instance]);
  } finally { f.close(); }
});

test('G723: a changed road prediction replaces only the incoming world, keeping the immediate return', async () => {
  const f = await fixture({ paired: true });
  try {
    await f.enterHome(); const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    await f.approachEast();
    await f.live.prefetch([f.north.instance]);
    f.player.position.x = 0; f.player.position.z = -(CHUNK_HALF + .5);
    travel(f.live, f.player.position, 0, -1); await f.settle();
    expect(f.live.state().residents).toEqual([f.home.instance, f.north.instance].sort());
    expect(f.events).not.toContain(`retire:${f.home.instance}`);
    expect(f.events.indexOf(`disposed:${f.east.instance}`)).toBeLessThan(f.events.indexOf(`create:${f.north.instance}`));
    expect(f.allocated.every(row => row.owners.filter(owner => [f.home.instance, f.east.instance, f.north.instance].includes(owner)).length <= 2)).toBe(true);
  } finally { f.close(); }
});

test('G723: a late build that ignores its abort is disposed after a U-turn, never published', async () => {
  const f = await fixture({ paired: true });
  try {
    await f.enterHome(); const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    f.control.holdIncoming = true;
    await f.approachEast();
    expect(f.live.state().pending).toContain(f.east.instance);
    const back = await f.live.prepare(null, f.home.instance); back.commit();
    if (f.control.finish === undefined) throw new Error('Missing incoming build');
    f.control.finish(); await f.settle();
    expect(f.live.state().residents).toEqual([f.home.instance]);
    expect(f.claims().some(row => row.owner === f.east.instance)).toBe(false);
    expect(f.events).toContain(`disposed:${f.east.instance}`);
    expect(f.live.state().issues).toEqual({});
  } finally { f.control.finish?.(); f.close(); }
});

test('G743: a sustained redirect cancels the old guess but cleanup still owns the queue', async () => {
  const f = await fixture({ paired: true });
  try {
    await f.enterHome(); const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    f.control.holdIncoming = true; await f.approachEast();
    await f.live.prefetch([f.north.instance]);
    f.player.position.x = 0; f.player.position.z = -(CHUNK_HALF + .5);
    travel(f.live, f.player.position, 0, -1); await f.settle();
    expect(f.control.aborted).toEqual([]);
    f.player.position.z -= 1; f.live.beforeFixed();
    expect(f.control.aborted).toEqual([]);
    f.player.position.z -= 1; f.live.beforeFixed(); await f.settle();
    expect(f.control.aborted).toEqual([f.east.instance]);
    expect(f.live.state().pending).toEqual([f.east.instance]);
    expect(f.created()).toEqual([f.home.instance, f.east.instance]);
    expect(f.live.state().residents).toEqual([f.home.instance]);
    expect(f.events).not.toContain(`retire:${f.home.instance}`);
    const back = await f.live.prepare(null, f.home.instance); back.commit();
    if (f.control.finish === undefined) throw new Error('Missing held preparation');
    f.control.finish(); await f.settle();
    expect(f.live.state().residents).toEqual([f.home.instance]);
    expect(f.live.state().issues).toEqual({});
  } finally { f.control.finish?.(); f.close(); }
});

test('G723: actual owned yield cancellation releases the claim and unblocks the committed destination', async () => {
  const f = await fixture({ paired: true });
  try {
    await f.enterHome(); const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    await f.live.prefetch([f.east.instance]); f.control.ownedYield = true;
    f.player.position.x = CHUNK_HALF + .5; travel(f.live, f.player.position, 1, 0);
    // Reach the real scoped timer without firing it. The committed crossing cancels this owner mid-yield.
    for (let i = 0; i < 20 && !f.control.yielding; i++) await Promise.resolve();
    expect(f.control.yielding).toBe(true);
    expect(f.claims().some(row => row.owner === f.east.instance)).toBe(true);
    const enter = await f.live.prepare(null, f.north.instance); enter.commit();
    expect(f.live.current()).toBe(f.north.instance);
    expect(f.claims().some(row => row.owner === f.east.instance)).toBe(false);
    expect(f.events).toContain(`disposed:${f.east.instance}`);
    expect(f.live.state().pending).toEqual([]);
    expect(f.live.state().issues).toEqual({});
  } finally { f.close(); }
});

test('G723: failed source retirement blocks entry even when the destination was prepared', async () => {
  const f = await fixture({ paired: true });
  try {
    await f.enterHome(); const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    await f.approachEast();
    expect(f.live.ready(f.east.instance)).toBe(true);
    f.control.dispose = false;
    await expect(f.live.prepare(null, f.east.instance)).rejects.toThrow('successful disposal');
    expect(f.live.current()).toBe(null);
    expect(f.claims().filter(row => [f.home.instance, f.east.instance].includes(row.owner))).toHaveLength(2);
    expect(f.live.state().issues[`cleanup:${f.home.instance}`]).toContain('kept disposal refused');
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
    expect(f.live.ready(null)).toBe(true);
    expect(f.live.ready(f.home.instance)).toBe(false);
    await f.enterHome();
    expect(f.live.ready(f.home.instance)).toBe(true);
    f.control.dispose = false;
    await expect(f.cross(f.home.instance, f.east.instance)).rejects.toThrow('successful disposal');
    expect(f.created()).toEqual([f.home.instance]);
    expect(f.claims().some(row => row.owner === f.home.instance && row.bytes === 1000)).toBe(true);
    expect(f.claims().some(row => row.owner === f.east.instance)).toBe(false);
    expect(f.live.state().issues[`cleanup:${f.home.instance}`]).toContain('kept disposal refused');
    expect(f.live.ready(f.home.instance)).toBe(false);
    expect(f.live.ready(f.east.instance)).toBe(false);
  } finally { f.close(); }
  expect(f.live.ready(null)).toBe(false);
  expect(f.live.ready(f.home.instance)).toBe(false);
});

test('prepared eviction closes readiness until its original abort restores it', async () => {
  const f = await fixture();
  try {
    await f.enterHome();
    const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    expect(f.live.ready(f.home.instance)).toBe(true);
    const eviction = f.live.prepareUnload(f.home.instance);
    if (eviction === null) throw new Error('Missing prepared eviction');
    expect(f.live.ready(f.home.instance)).toBe(false);
    eviction.abort();
    expect(f.live.ready(f.home.instance)).toBe(true);
  } finally { f.close(); }
});

test('T7: without a kept source a committed crossing abandons a road guess and builds the destination at once', async () => {
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
    // Cold road-start: no entered source needs protection. A kept source is covered by G724 below.
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

test('G724: road prediction preserves the last entered cell for a real U-turn', async () => {
  const f = await fixture();
  try {
    await f.enterHome();
    const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    f.player.position.x = CHUNK_HALF + .5; f.player.position.z = 0;
    travel(f.live, f.player.position, 1, 0); await f.settle();
    expect(f.live.state().residents).toEqual([f.home.instance]);
    expect(f.created()).toEqual([f.home.instance]);
    expect(f.events.filter(event => event.startsWith('retire:'))).toEqual([]);
    const back = await f.live.prepare(null, f.home.instance); back.commit();
    expect(f.live.current()).toBe(f.home.instance);
    expect(f.created()).toEqual([f.home.instance]);
  } finally { f.close(); }
});

test('G724: a long road excursion keeps exactly the last entered source warm', async () => {
  const f = await fixture();
  try {
    await f.enterHome();
    const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    f.player.position.x = f.east.origin.x * 4;
    f.player.position.z = f.east.origin.x * 4;
    for (let tick = 0; tick < 600; tick++) f.live.beforeFixed();
    await f.settle();
    expect(f.live.state().residents).toEqual([f.home.instance]);
    expect(f.created()).toEqual([f.home.instance]);
    expect(f.entries().find(row => row.owner === f.home.instance)?.needed).toBe(true);
  } finally { f.close(); }
});


test('G743: later boulevard junctions do not delay the nearest isolated turn', async () => {
  const f = await fixture({ paired: true, allNeighbours: true, horizonSeconds: 30 });
  try {
    await f.enterHome(); const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    const assembly = new GridAssembly({ developer: false, devserver: false });
    const later = assembly.cells.find(cell => cell.origin.x === f.east.origin.x && cell.origin.z === assembly.pitch);
    if (later === undefined) throw new Error('Missing later junction');
    await f.live.prefetch([f.east.instance, later.instance]);
    f.player.position.x = f.east.origin.x / 2; f.player.position.z = -100;
    travel(f.live, f.player.position, 0, 1); await f.settle();
    expect(f.live.ready(f.east.instance)).toBe(true);
    expect(f.created()).toEqual([f.home.instance, f.east.instance]);
    expect(f.live.state().residents).toEqual([f.home.instance, f.east.instance].sort());
  } finally { f.close(); }
});

test('G743: straight travel keeps equal turn choices cold until lateral movement names a side', async () => {
  const f = await fixture({ paired: true, allNeighbours: true });
  try {
    await f.enterHome(); await f.cross(f.home.instance, f.north.instance);
    const leave = await f.live.prepare(f.north.instance, null); leave.commit();
    await f.live.prefetch([f.home.instance, f.east.instance]);
    f.player.position.x = f.east.origin.x / 2; f.player.position.z = -100;
    travel(f.live, f.player.position, 0, 1); await f.settle();
    expect(f.live.ready(f.east.instance)).toBe(false);
    expect(f.live.ready(f.home.instance)).toBe(false);
    travel(f.live, f.player.position, .01, 1); await f.settle();
    expect(f.live.ready(f.east.instance)).toBe(false);
    travel(f.live, f.player.position, .1, 1); await f.settle();
    expect(f.live.ready(f.east.instance)).toBe(true);
    expect(f.live.current()).toBe(null);
    expect(f.live.state().residents).toEqual([f.north.instance, f.east.instance].sort());
    expect(f.events).not.toContain(`retire:${f.north.instance}`);
  } finally { f.close(); }
});

test('G743: redirected preparation starts only after the obsolete constructor releases its claim', async () => {
  const f = await fixture({ paired: true });
  try {
    await f.enterHome(); const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    f.control.holdIncoming = true; await f.approachEast();
    await f.live.prefetch([f.north.instance]);
    f.player.position.x = 0; f.player.position.z = -(CHUNK_HALF + .5);
    travel(f.live, f.player.position, 0, -1);
    f.player.position.z -= 1; f.live.beforeFixed();
    f.player.position.z -= 1; f.live.beforeFixed(); await f.settle();
    expect(f.control.aborted).toEqual([f.east.instance]);
    expect(f.created()).toEqual([f.home.instance, f.east.instance]);
    expect(f.live.ready(f.north.instance)).toBe(false);
    expect(f.claims().some(row => row.owner === f.east.instance)).toBe(true);
    if (f.control.reject === undefined) throw new Error('Missing constructor safe point');
    f.control.reject(new Error('Stopped at constructor safe point')); await f.settle();
    expect(f.claims().some(row => row.owner === f.east.instance)).toBe(false);
    travel(f.live, f.player.position, 0, -1); await f.settle();
    expect(f.live.ready(f.north.instance)).toBe(true);
    expect(f.created()).toEqual([f.home.instance, f.east.instance, f.north.instance]);
    expect(f.live.state().residents).toEqual([f.home.instance, f.north.instance].sort());
    expect(f.events).not.toContain(`retire:${f.home.instance}`);
    expect(f.live.state().issues).toEqual({});
    expect(f.allocated.at(-1)?.owners).not.toContain(f.east.instance);
  } finally { f.control.finish?.(); f.close(); }
});


test('G743: an actual crossing demand cannot be cancelled by a later speculative heading', async () => {
  const f = await fixture({ paired: true });
  try {
    await f.enterHome(); const leave = await f.live.prepare(f.home.instance, null); leave.commit();
    f.control.holdIncoming = true; await f.approachEast();
    await f.live.prefetch([f.north.instance]);
    const demanded = f.live.prepare(null, f.east.instance); void demanded.catch(() => undefined);
    f.player.position.x = 0; f.player.position.z = -(CHUNK_HALF + .5);
    travel(f.live, f.player.position, 0, -1);
    for (let step = 0; step < 4; step++) { f.player.position.z -= 1; f.live.beforeFixed(); }
    expect(f.control.aborted).toEqual([]);
    expect(f.created()).toEqual([f.home.instance, f.east.instance]);
    if (f.control.finish === undefined) throw new Error('Missing demanded constructor');
    f.control.finish(); const prepared = await demanded; prepared.cancel();
    expect(f.live.ready(f.east.instance)).toBe(true);
    expect(f.live.state().issues).toEqual({});
  } finally { f.control.finish?.(); f.close(); }
});
