// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Use the shipped Rapier binary for the original transfer.
import { readFileSync } from 'node:fs';
import { afterEach, expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { Physics } from '../src/engine/physics/Physics';
import { CharacterMotor, PLAYER_BODY } from '../src/engine/physics/CharacterMotor';
import { loadRapier } from '../src/engine/physics/rapier';
import { groups } from '../src/engine/physics/groups';
import { tagCollider } from '../src/engine/physics/surface';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardRuntime, ShardPlayHost } from '../src/game/shard/runtime';
import type { ShardWorld } from '../src/game/shard/world';
import type { Progress } from '../src/game/Progress';
import type { LedgerReceipt } from '../src/game/ledger';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { installDeclaredPortalRide, installPortalRide, type PortalPlayer } from '../src/game/shardfile/portalRideBinding';
import * as headless from '../src/game/plugin/headless';
import * as ownership from '../src/engine/ui/ownership';
import source from '../src/shards/nine-dragon-stack/shard.config';
import portalRows from '../src/shards/nine-dragon-stack/data/portals.json' with { type: 'json' };
import { legacyDouble } from './fake/FakeGame';

afterEach(() => { vi.restoreAllMocks(); });

async function refusal(run: Promise<unknown>): Promise<unknown> {
  try { await run; return null; } catch (error) { return error; }
}

function fixture(pending?: Promise<Uint8Array>) {
  const parent = new Scope('portal-parent'), scope = parent.child('portal-entry');
  const bindProgress = vi.fn<Progress['bindLedger']>(), refreshProgress = vi.fn<Progress['refreshLedger']>();
  const progress = legacyDouble<Progress>({ bindLedger: bindProgress, refreshLedger: refreshProgress });
  const play = legacyDouble<ShardPlayHost>({ progress });
  const player = legacyDouble<ShardWorld['player']>({ position: new Vector3(), motor: legacyDouble<CharacterMotor>({}) });
  const world = legacyDouble<ShardWorld>({ player, physics: legacyDouble<Physics>({}) });
  const runtime = legacyDouble<ShardRuntime>({ world, play });
  const file = 'sim/portals.json', bytes = new TextEncoder().encode(JSON.stringify({ portalRide: portalRows }));
  const read = vi.fn(() => pending ?? Promise.resolve(bytes));
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections: new Map(),
    files: new Map([[file, { hash: 'b'.repeat(64), url: '/portal.json' }]]), read });
  const system = vi.fn<ShardContext['system']>();
  const ctx = legacyDouble<ShardContext>({ scope, product, app: legacyDouble<ShardContext['app']>({}), game: legacyDouble<ShardContext['game']>({ runtime }), system });
  return { parent, scope, runtime, play, progress, ctx, world, file, read, system, bindProgress, refreshProgress };
}

function ledger() {
  const facts = Object.assign(vi.fn<(name: string, entity: string) => LedgerReceipt>().mockReturnValue({ id: 'landing', status: 'granted', recorded: true }), { flush: () => true, achievement: () => undefined });
  const bind = vi.spyOn(headless, 'bindRuntimeLedger').mockReturnValue(facts);
  const mount = vi.spyOn(ownership, 'mountUi').mockImplementation((el, scope) => { document.body.append(el); scope.onDispose(() => { el.remove(); }); });
  return { facts, bind, mount };
}

test('a leave or replaced entered owner during the admitted JSON read has no ledger, veil or system effects', async () => {
  let finish: ((bytes: Uint8Array) => void) | undefined;
  const pending = new Promise<Uint8Array>(resolve => { finish = resolve; });
  const { bind, mount } = ledger();
  const fixtures = Array.from({ length: 6 }, () => fixture(pending));
  const results = fixtures.map(f => refusal(installDeclaredPortalRide(f.ctx, f.file)));
  const [leave, product, app, world, play, progress] = fixtures;
  if (leave === undefined || product === undefined || app === undefined || world === undefined || play === undefined || progress === undefined || finish === undefined) throw new Error('Missing owner fixtures');
  leave.parent.dispose();
  Object.assign(product.ctx, { product: { ...product.ctx.product } });
  Object.assign(app.ctx, { app: legacyDouble<ShardContext['app']>({}) });
  world.runtime.world = legacyDouble<ShardWorld>({});
  play.runtime.play = legacyDouble<ShardPlayHost>({ progress: play.progress });
  progress.play.progress = legacyDouble<Progress>({});
  finish(new TextEncoder().encode(JSON.stringify({ portalRide: portalRows })));
  try {
    for (const result of await Promise.all(results)) expect(result).toBeInstanceOf(Error);
    expect(bind).not.toHaveBeenCalled(); expect(mount).not.toHaveBeenCalled();
    for (const f of fixtures) expect(f.system).not.toHaveBeenCalled();
  } finally { for (const f of fixtures) f.parent.dispose(); }
});

test('the final UI module await refuses leave and runtime, world, source, app or progress replacement before effects', async () => {
  const fixtures = Array.from({ length: 7 }, () => fixture()), { bind, mount } = ledger();
  for (const f of fixtures) vi.spyOn(f.ctx.product, 'json').mockResolvedValue({ portalRide: portalRows });
  const results = fixtures.map(f => refusal(installDeclaredPortalRide(f.ctx, f.file)));
  // Resolved JSON resumes first; the real dynamic UI imports and Promise.all still await their own reactions.
  await Promise.resolve();
  expect(bind).not.toHaveBeenCalled(); expect(mount).not.toHaveBeenCalled();
  const [leave, runtime, world, product, app, play, progress] = fixtures;
  if (leave === undefined || runtime === undefined || world === undefined || product === undefined || app === undefined || play === undefined || progress === undefined) throw new Error('Missing import fixtures');
  leave.parent.onDispose(() => undefined); const retirement = leave.parent.disposeSteps(); retirement.next();
  Object.assign(runtime.ctx.game, { runtime: legacyDouble<ShardRuntime>({ world: runtime.world, play: runtime.play }) });
  world.runtime.world = legacyDouble<ShardWorld>({});
  Object.assign(product.ctx.product, { shardfile: { ...source } });
  Object.assign(app.ctx, { app: legacyDouble<ShardContext['app']>({}) });
  play.runtime.play = legacyDouble<ShardPlayHost>({ progress: play.progress });
  progress.play.progress = legacyDouble<Progress>({});
  try {
    for (const result of await Promise.all(results)) expect(result).toBeInstanceOf(Error);
    expect(bind).not.toHaveBeenCalled(); expect(mount).not.toHaveBeenCalled();
    for (const f of fixtures) expect(f.system).not.toHaveBeenCalled();
  } finally { for (const _step of retirement) { /* Complete original retirement. */ } for (const f of fixtures) f.parent.dispose(); }
});

test('invalid directors and finite fade rows allocate no ledger, mounted veil or system', async () => {
  const f = fixture(), { bind, mount } = ledger();
  try {
    await expect(installPortalRide(f.ctx, source, { ...portalRows, director: 'missing' }, () => undefined)).rejects.toThrow('Missing portal director');
    await expect(installPortalRide(f.ctx, source, { ...portalRows, fade: { ...portalRows.fade, out: Infinity } }, () => undefined)).rejects.toThrow();
    expect(bind).not.toHaveBeenCalled(); expect(mount).not.toHaveBeenCalled(); expect(f.system).not.toHaveBeenCalled();
  } finally { f.parent.dispose(); }
});

test('declared page entry retains the real checked transfer and reports its landing fact once', async () => {
  const f = fixture(), { facts, bind, mount } = ledger();
  const R = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm'))), physics = new Physics(R, undefined, f.scope);
  const first = source.entryways.find(row => row.portal !== undefined)?.portal;
  if (first === undefined) throw new Error('Missing portal fixture');
  const nodes = new Map([first.road, first.destination, first.exit].map(row => [row.id, row]));
  for (const node of nodes.values()) {
    const [x, y, z] = node.at;
    const floor = physics.world.createCollider(R.ColliderDesc.cuboid(3, 0.5, 3).setTranslation(x, y - 0.5, z).setCollisionGroups(groups('WORLD')));
    tagCollider(floor, 'stone', node.floor);
  }
  const motor = new CharacterMotor(physics, { radius: 0.3, height: 1.8, step: 0.3, maxClimbDeg: 45, snap: 0.3, ...PLAYER_BODY });
  const position = new Vector3(...first.road.at), spawn = vi.fn<PortalPlayer['spawn']>();
  const player = legacyDouble<ShardWorld['player']>({ position, motor, hover: false, carried: false, setHover: vi.fn<PortalPlayer['setHover']>(), spawn });
  Object.assign(f.world, { physics, player }); motor.resetAt(position);
  try {
    const ride = await installDeclaredPortalRide(f.ctx, f.file);
    expect(bind).toHaveBeenCalledOnce(); expect(mount).toHaveBeenCalledOnce(); expect(f.system).toHaveBeenCalledOnce();
    for (let frame = 0; frame < 90; frame++) ride.step(1 / 60);
    expect(ride.refused()).toEqual([]); expect(ride.rides()).toEqual([{ from: first.road.id, to: first.destination.id, yaw: first.destination.yaw }]);
    expect(position.toArray()).toEqual(first.destination.at); expect(spawn).toHaveBeenCalledOnce();
    expect(facts).toHaveBeenCalledExactlyOnceWith(portalRows.landings.find(row => row.node === first.destination.id)?.fact, first.destination.id);
    expect(f.bindProgress).toHaveBeenCalledOnce(); expect(f.refreshProgress).toHaveBeenCalledOnce();
    f.scope.dispose(); expect(document.body.querySelector(`.${portalRows.veil.cls}`)).toBeNull();
  } finally { f.parent.dispose(); physics.dispose(); }
});
