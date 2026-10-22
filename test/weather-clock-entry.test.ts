import { expect, test, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { DayCycle, type DayCycleClock } from '../src/engine/world/dayCycle';
import { overrideSetting, setting } from '../src/engine/ui/Settings';
import { ShardPlugin, type ShardContext } from '../src/game/plugin/context';
import { RetainedRuntimeHooks } from '../src/game/shard/retainedHooks';
import { declaredRuntimeEntry } from '../src/game/shard/declaredEntry';
import { installWeatherClock, type ForestWeatherRig } from '../src/game/weather/forest';
import type { PaintedSky } from '../src/game/looks/keyedSky';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { entryOwner, publishEntryOwner } from '../src/game/shardfile/entryOwners';
import { installClientPhase, admitClientPlan } from '../src/game/shardfile/clientPlan';
import { parseClientPlan } from '../src/format/clientPlan';
import { emptyShardfile } from '../src/sdk/author';
import { emitPlatformSections } from '../src/sdk/platformSections';
import { legacyDouble } from './fake/FakeGame';

const row = { kind: 'weather.clock', weather: 'meadow.weather' } as const;
function fixture(parameter = false) {
  const scope = new Scope('clock entry'), active = new Map<Scope, DayCycleClock>();
  const clock = new DayCycle({ units: 'hour', start: 13, sun: { maxElevation: 60, azimuthOffset: 0 },
    schedule: [{ phase: 'day', from: 0, to: 24, minutes: 12 }],
    fixed: { midday: 12, golden: 17, sunset: 18, night: 22 }, presets: { dawn: 6, noon: 12, dusk: 18, night: 22 } });
  const rig = legacyDouble<ForestWeatherRig>({ sky: legacyDouble<PaintedSky>({ clock }) });
  const world = legacyDouble<NonNullable<ShardRuntime['world']>>({ params: new URLSearchParams(parameter ? 'time=13' : ''),
    game: legacyDouble<NonNullable<ShardRuntime['world']>['game']>({ levelScope: scope }) });
  const runtime = legacyDouble<ShardRuntime>({ world });
  const register = vi.fn<ShardContext['app']['registerDayCycle']>((value, owner) => {
    if (value !== null) active.set(owner, value);
    owner.onDispose(() => { active.delete(owner); });
  });
  const app = legacyDouble<ShardContext['app']>({ registerDayCycle: register,
    input: legacyDouble<ShardContext['app']['input']>({ refresh: () => undefined, repaint: () => undefined }) });
  const source = emptyShardfile({ slug: 'clock-meadow', name: 'Clock meadow', author: 'Fixture', revision: 1, seed: 2 });
  const read = vi.fn(() => Promise.reject(new Error('Clock wiring never reads content')));
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source,
    sections: new Map([['client/plan', { version: 1, features: [row] }]]), files: new Map(), read });
  const ctx = legacyDouble<ShardContext>({ scope, app, product, game: legacyDouble<ShardContext['game']>({ runtime }) });
  return { scope, clock, rig, ctx, active, register, read, world };
}

test('clock entry borrows the original weather clock and applies the same Settings pick once', async () => {
  const f = fixture(), time = vi.spyOn(f.clock, 'setTime');
  publishEntryOwner(f.scope, 'world-weather', row.weather, f.rig);
  try {
    await installClientPhase(f.ctx, admitClientPlan(f.ctx.product.section('client/plan'), f.ctx.product), 'world-bindings', f.scope);
    expect(f.register).toHaveBeenCalledExactlyOnceWith(f.clock, f.scope);
    expect(f.active.get(f.scope) === f.clock).toBe(true);
    expect(time).toHaveBeenCalledExactlyOnceWith(setting('time'));
    expect(entryOwner(f.scope, 'world-weather', row.weather) === f.rig).toBe(true);
    expect(f.read).not.toHaveBeenCalled();
    expect(() => installWeatherClock(f.ctx, row.weather)).toThrow('already installed');
    f.scope.dispose(); expect(f.active.size).toBe(0);
  } finally { time.mockRestore(); f.scope.dispose(); }
});

test('an existing world time parameter preserves the exact native clock snapshot', () => {
  const f = fixture(true), time = vi.spyOn(f.clock, 'setTime');
  f.clock.scale = 0.6; f.clock.paused = true;
  const saved = f.clock.snapshot(); publishEntryOwner(f.scope, 'world-weather', row.weather, f.rig);
  try {
    installWeatherClock(f.ctx, row.weather);
    expect(time).not.toHaveBeenCalled(); expect(f.clock.snapshot()).toEqual(saved);
    expect(f.active.get(f.scope) === f.clock).toBe(true);
  } finally { time.mockRestore(); f.scope.dispose(); }
});

test('retained clock services leave and replay without duplicating or resetting the resident clock', () => {
  const f = fixture(true), time = vi.spyOn(f.clock, 'setTime'), hooks = new RetainedRuntimeHooks(f.ctx);
  publishEntryOwner(f.scope, 'world-weather', row.weather, f.rig);
  try {
    installWeatherClock(hooks.context, row.weather);
    expect(f.active.size).toBe(1); expect([...f.active.values()]).toEqual([f.clock]);
    expect(time).not.toHaveBeenCalled();
    overrideSetting('time', 'golden'); expect(time).toHaveBeenCalledOnce();
    hooks.deactivate(); expect(f.active.size).toBe(0);
    const saved = f.clock.snapshot();
    overrideSetting('time', 'night'); expect(time).toHaveBeenCalledOnce();
    hooks.activate(); expect(f.active.size).toBe(1); expect([...f.active.values()]).toEqual([f.clock]);
    expect(time).toHaveBeenCalledOnce(); expect(f.clock.snapshot()).toEqual(saved);
    overrideSetting('time', 'midday'); expect(time).toHaveBeenCalledTimes(2);
    hooks.deactivate(); expect(f.active.size).toBe(0);
  } finally { f.scope.dispose(); time.mockRestore(); overrideSetting('time', null); }
});

test('missing and clockless weather refuse before app registration', () => {
  const f = fixture();
  try {
    expect(() => installWeatherClock(f.ctx, row.weather)).toThrow('Missing live entry owner');
    publishEntryOwner(f.scope, 'world-weather', row.weather, legacyDouble<ForestWeatherRig>({ sky: null }));
    expect(() => installWeatherClock(f.ctx, row.weather)).toThrow('painted sky');
    expect(f.register).not.toHaveBeenCalled(); expect(f.read).not.toHaveBeenCalled();
  } finally { f.scope.dispose(); }
});

test('a real ancestor retirement prevents late clock registration', () => {
  const f = fixture(), child = f.scope.child('still-open clock');
  publishEntryOwner(child, 'world-weather', row.weather, f.rig);
  f.scope.onDispose(() => undefined); const retirement = f.scope.disposeSteps(); retirement.next();
  try {
    expect(child.disposed).toBe(false); expect(child.disposing).toBe(true);
    expect(() => installWeatherClock({ ...f.ctx, scope: child }, row.weather)).toThrow('live world');
    expect(f.register).not.toHaveBeenCalled();
  } finally { for (const _step of retirement) { /* Complete actual ancestor retirement. */ } }
});

test('an independently retired native world cannot register its clock through a live context', () => {
  const f = fixture(), native = new Scope('retired native world');
  publishEntryOwner(f.scope, 'world-weather', row.weather, f.rig);
  Object.assign(f.world.game, { levelScope: native }); native.dispose();
  try {
    expect(f.scope.disposed).toBe(false);
    expect(() => installWeatherClock(f.ctx, row.weather)).toThrow('live world');
    expect(f.register).not.toHaveBeenCalled();
  } finally { f.scope.dispose(); }
});

test('the native transition binds the clock after the original world and before kit', async () => {
  const f = fixture(true), order: string[] = [];
  class Native extends ShardPlugin {
    override world(ctx: ShardContext): void { order.push('world'); publishEntryOwner(ctx.scope, 'world-weather', row.weather, f.rig); }
    override kit(): void { order.push('kit'); expect(f.active.size).toBe(1); }
  }
  const Entry = declaredRuntimeEntry(Native, Native, { entry: 'runtime/index.ts', retainHomeRuntime: true, stagesOwner: 'declared',
    nativePlan: { phases: ['world-bindings'], features: ['weather.clock'] } }).default;
  const plugin = new Entry(undefined, undefined, () => false);
  try {
    await plugin.world(f.ctx); await plugin.kit(f.ctx);
    expect(order).toEqual(['world', 'kit']); expect(f.register).toHaveBeenCalledOnce();
  } finally { f.scope.dispose(); }
});

test('clock wire names only the original concrete weather owner', () => {
  const emitted = emitPlatformSections(new Map([['client/plan', { version: 1, features: [row] }]]));
  const bytes = emitted.files.get('sections/client/plan.json');
  if (bytes === undefined) throw new Error('Missing emitted clock plan');
  expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual({ version: 1, features: [row] });
  for (const bad of [{ ...row, file: 'ignored.json' }, { ...row, clock: 'other' }, { ...row, weather: () => 'other' }])
    expect(() => parseClientPlan({ version: 1, features: [bad] })).toThrow();
});
