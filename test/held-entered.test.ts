import { expect, test, vi } from 'vitest';
import { GrappleTool, grappleGuard } from '../src/game/grapple/tool';
import { heldEntry, enteredRows } from './fixtures/nineHeldEntry';
import { admitClientPlan, installClientPhase } from '../src/game/shardfile/clientPlan';
import { bakedLayout } from '../src/shards/nine-dragon-stack/generators/layoutProjection';
import { emitPlatformSections } from '../src/sdk/platformSections';
import type { PlatformDataSectionName } from '../src/format/platformDataSections';
import * as melee from '../src/game/loadout/declaredMelee';
import { ShardPlugin } from '../src/game/shard/plugin';
import { declaredRuntimeEntry } from '../src/game/shard/declaredEntry';
import { App } from '../src/engine/app/app';

async function refusal(run: Promise<unknown>): Promise<unknown> {
  try { await run; return null; } catch (error) { return error; }
}

test('the entered claims feature adopts one Jian and adds its original grapple exactly once', async () => {
  const f = await heldEntry(), install = vi.spyOn(GrappleTool.prototype, 'install').mockImplementation(() => undefined), guard = grappleGuard(f.scope);
  try {
    const features = [{ kind: 'held.claims.prepare', id: 'held.primary' }, { kind: 'held.claims.install', claims: 'held.primary' }, { kind: 'held.claims.enter', claims: 'held.primary', ...enteredRows }];
    const plan = admitClientPlan({ version: 1, features }, f.ctx.product);
    const emission = emitPlatformSections(new Map<PlatformDataSectionName, unknown>([['client/plan', { version: 1, features }]]));
    expect(emission).toBeDefined();
    expect(guard.open()).toBe(false);
    await installClientPhase(f.ctx, plan, 'play', f.scope);
    expect(f.equipment.current === f.primary).toBe(true); expect(install).toHaveBeenCalledOnce(); expect(f.equipment.tools).toHaveLength(1);
    const tool = f.equipment.tools[0];
    if (!(tool instanceof GrappleTool)) throw new Error('Missing original grapple tool');
    const { rows, records } = bakedLayout(), c = rows.counts;
    const start = (c.walkers + c.sitters + c.lanterns + c.acs) * 16;
    expect(tool.hooks).toHaveLength(c.hooks);
    for (const [i, hook] of tool.hooks.entries()) for (const [axis, value] of [hook.x, hook.y, hook.z].entries()) expect(Object.is(value, records[start + i * 3 + axis])).toBe(true);
    await expect(f.held.enter(f.ctx, enteredRows)).rejects.toThrow('already'); expect(install).toHaveBeenCalledOnce();
  } finally { install.mockRestore(); f.dispose(); }
});

test('getter-based held input is refused without reading it or installing a tool', async () => {
  const f = await heldEntry(), get = vi.fn(() => enteredRows.grapple), install = vi.spyOn(GrappleTool.prototype, 'install').mockImplementation(() => undefined);
  const input = Object.defineProperty({}, 'grapple', { enumerable: true, get });
  try {
    await expect(f.held.enter(f.ctx, input)).rejects.toThrow('JSON');
    expect(get).not.toHaveBeenCalled(); expect(install).not.toHaveBeenCalled(); expect(f.equipment.tools).toHaveLength(0);
  } finally { install.mockRestore(); f.dispose(); }
});

test.each(['leave', 'product', 'source', 'app', 'equipment', 'primary', 'profile', 'melee'])('held entry refuses %s replacement during its read before tool effects', async kind => {
  const f = await heldEntry(), install = vi.spyOn(GrappleTool.prototype, 'install').mockImplementation(() => undefined);
  let finish: ((bytes: Uint8Array) => void) | undefined;
  f.pause(new Promise(resolve => { finish = resolve; }));
  const run = refusal(f.held.enter(f.ctx, enteredRows));
  const guard = grappleGuard(f.scope), original = f.installed.primary;
  if (kind === 'leave') f.parent.dispose();
  if (kind === 'product') Object.assign(f.ctx, { product: { ...f.ctx.product } });
  if (kind === 'source') Object.assign(f.ctx.product, { shardfile: { ...f.ctx.product.shardfile } });
  const replacement = kind === 'app' ? new App() : null;
  if (replacement !== null) Object.assign(f.ctx, { app: replacement });
  if (kind === 'equipment') Object.defineProperty(f.app, 'equipment', { value: null });
  if (kind === 'primary') Object.assign(f.installed, { primary: () => ({}) });
  if (kind === 'profile') Object.assign(f.installed, { profile: { ...f.installed.profile } });
  const loan = kind === 'melee' ? vi.spyOn(f.held, 'melee').mockReturnValue({ ...f.installed }) : null;
  if (finish === undefined) throw new Error('Missing read'); finish(f.bytes);
  try {
    expect(await run).toBeInstanceOf(Error); expect(install).not.toHaveBeenCalled(); expect(f.equipment.tools).toHaveLength(0); expect(guard.open()).toBe(false);
  } finally { Object.assign(f.installed, { primary: original }); loan?.mockRestore(); install.mockRestore(); f.dispose(); replacement?.engineScope.dispose(); }
});

test('concurrent entered reads can bind and register only one concrete tool', async () => {
  const f = await heldEntry(), install = vi.spyOn(GrappleTool.prototype, 'install').mockImplementation(() => undefined);
  let finish: ((bytes: Uint8Array) => void) | undefined;
  f.pause(new Promise(resolve => { finish = resolve; }));
  const runs = Promise.allSettled([f.held.enter(f.ctx, enteredRows), f.held.enter(f.ctx, enteredRows)]);
  if (finish === undefined) throw new Error('Missing read'); finish(f.bytes);
  try { const results = await runs; expect(results.filter(row => row.status === 'fulfilled')).toHaveLength(1); expect(results.filter(row => row.status === 'rejected')).toHaveLength(1); expect(install).toHaveBeenCalledOnce(); expect(f.equipment.tools).toHaveLength(1); }
  finally { install.mockRestore(); f.dispose(); }
});

test('native kit and play selection keep the original world once and install the same primary before the grapple', async () => {
  const f = await heldEntry(false), order: string[] = [];
  const install = vi.spyOn(melee, 'installDeclaredMelee').mockImplementation(() => { order.push('primary'); return f.installed; });
  const tool = vi.spyOn(GrappleTool.prototype, 'install').mockImplementation(() => { order.push('grapple'); });
  class Native extends ShardPlugin {
    override world(): void { order.push('world'); }
    override kit(): void { order.push('native-kit'); }
    override play(): void { order.push('native-play'); }
  }
  const Entry = declaredRuntimeEntry(Native, Native, { entry: 'runtime/index.ts', retainHomeRuntime: true, stagesOwner: 'declared', nativePlan: { phases: ['kit', 'play'] } }).default;
  const plugin = new Entry(undefined, undefined, () => false);
  try {
    await plugin.world(f.ctx); f.level.openKit(); await plugin.kit(f.ctx); f.level.closeKit(); await plugin.play(f.ctx);
    expect(order).toEqual(['world', 'native-kit', 'primary', 'native-play', 'grapple']);
    expect(install).toHaveBeenCalledOnce(); expect(tool).toHaveBeenCalledOnce(); expect(f.equipment.current === f.primary).toBe(true); expect(f.equipment.tools).toHaveLength(1);
  } finally { install.mockRestore(); tool.mockRestore(); f.dispose(); }
});
