// oxlint-disable-next-line import/no-nodejs-modules -- Own isolated typed fixture trees and read the committed coupling ratchet.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture roots live outside the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture modules on every platform.
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { compareCoupling, compareWeaponTransfers, WEAPON_TRANSFER_BOOTSTRAP, WEAPON_TRANSFER_LIST, shardCoupling, type ShardCoupling } from '../scripts/shard-coupling.mjs';
import { comparePlatformList } from '../scripts/check-platform-ratchets.mjs';

const roots: string[] = [];
afterAll(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'shard-coupling-')); roots.push(root);
  function put(file: string, source: string): void { const target = join(root, file); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, source); }
  put('tsconfig.json', JSON.stringify({ compilerOptions: { strict: true, target: 'ES2022', module: 'ESNext' } }));
  put('src/engine/combat/Weapon.ts', 'export class Weapon { hit(): void {} }');
  put('src/engine/app/app.ts', 'export class App { tick(): void {} }');
  put('src/game/shard/context.ts', "import type { App } from '../../engine/app/app'; export interface GameServices { runtime: { tick: () => void } } export interface ShardContext { app: App; game: GameServices; title: string; act: () => void }");
  put('src/game/wrapped.ts', "import { Weapon } from '../engine/combat/Weapon'; export class Wrapped extends Weapon {}");
  put('src/shards/alpha/plugin.ts', `import type { ShardContext } from '../../game/shard/context';
import { Wrapped as Blade } from '../../game/wrapped';
// ctx.app and ctx.game.runtime in comments buy no allowance.
export const label = 'ctx.app';
export function use(context: ShardContext): void {
  void context.app; void context['app']; const { app: service, game } = context;
  void service; void context.game.runtime; void game.runtime; context.act(); void context.title;
}
export class Sword extends Blade {}
class Local {}
export class Unrelated extends Local {}
`);
  return root;
}

describe('SF2 measured shard coupling', () => {
  it('resolves aliases, bracket accesses, destructuring and inherited engine classes; ignores text and pure data', () => {
    const rows = shardCoupling(fixture());
    expect(rows['alpha']?.counts).toEqual({
      'ctx.app': 3, 'ctx.game': 2, 'ctx.game.runtime': 2, engineSubclasses: 1,
      'context.app': 3, 'context.game': 2, 'context.act': 1, 'subclass.Weapon': 1,
    });
    expect(rows['alpha']?.sites['ctx.app']).toHaveLength(3);
  });
  // This real type-aware scan resolves all seven shard roots and their imported type closure
  // in one shared program. The coverage-instrumented GitHub runner needs more than 20 s.
  it('holds the seven real shards below their recorded counts', () => {
    const recorded = JSON.parse(readFileSync('lint/shard-coupling.json', 'utf8')) as { shards: Record<string, ShardCoupling> };
    expect(compareCoupling(recorded.shards, shardCoupling())).toEqual([]);
    expect(Object.keys(recorded.shards)).toHaveLength(7);
  }, 60_000);
  it('keeps repeated shared data pure and rejects recursive context types after caching', () => {
    const root = fixture();
    writeFileSync(join(root, 'src/game/shard/context.ts'), `interface Shared { value: string }
interface Recursive { next: Recursive | null }
export interface ShardContext { data: { left: Shared; right: Shared }; recursive: Recursive }
`);
    writeFileSync(join(root, 'src/shards/alpha/plugin.ts'), `import type { ShardContext } from '../../game/shard/context';
export function use(ctx: ShardContext): void {
  void ctx.data; void ctx['data']; const { data } = ctx; void data.left.value;
  void ctx.recursive; void ctx['recursive']; const { recursive } = ctx; void recursive.next;
  const unrelated = { data: { value: 'pure' }, recursive: () => 1 }; void unrelated.data; unrelated.recursive();
}
`);
    const rows = shardCoupling(root);
    expect(rows['alpha']?.counts).toEqual({ 'ctx.app': 0, 'ctx.game': 0, 'ctx.game.runtime': 0, engineSubclasses: 0, 'context.recursive': 3 });
    expect(rows['alpha']?.sites['context.recursive']).toEqual(['src/shards/alpha/plugin.ts:4:8', 'src/shards/alpha/plugin.ts:4:28', 'src/shards/alpha/plugin.ts:4:54']);
  });
  it('refuses a rise even when code and candidate allowances rise together, with explicit prior measurements', () => {
    const before = { alpha: { counts: { 'ctx.app': 1 }, sites: {} } };
    const raised = { alpha: { counts: { 'ctx.app': 2 }, sites: {} } };
    expect(compareCoupling(before, raised)).toEqual(['alpha: ctx.app rose 1 → 2']);
    expect(compareCoupling(before, { alpha: { counts: { 'ctx.app': 0 }, sites: {} } })).toEqual([]);
    expect(compareCoupling(before, { beta: { counts: { 'ctx.app': 1 }, sites: {} } })).toEqual(['beta: ctx.app rose 0 → 1']);
    expect(compareCoupling(before, { alpha: { counts: { 'context.new': 1 }, sites: {} } })).toEqual(['alpha: context.new rose 0 → 1']);
  });
});

describe('SF54 exact kit weapon transfers', () => {
  function put(root: string, file: string, source: string): void {
    const target = join(root, file); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, source);
  }
  function transferred(): string {
    const root = fixture();
    put(root, WEAPON_TRANSFER_LIST, JSON.stringify({ transfers: WEAPON_TRANSFER_BOOTSTRAP }));
    put(root, 'src/shards/nalati-grasslands/weapons/Rifle.ts', "import { Weapon } from '../../../engine/combat/Weapon'; export class Rifle extends Weapon {}");
    put(root, 'src/shards/pine-hollow/weapons/crossbow/Crossbow.ts', "import { Weapon } from '../../../../engine/combat/Weapon'; export class Crossbow extends Weapon {}");
    return root;
  }
  it('attributes only the two existing kit classes and still counts an extra subclass at the same site', () => {
    const root = transferred(), before = shardCoupling(root);
    expect(before['nalati-grasslands']?.counts.engineSubclasses).toBe(0);
    expect(before['pine-hollow']?.counts.engineSubclasses).toBe(0);
    expect(before['nalati-grasslands']?.transfers).toHaveLength(1);
    expect(before['pine-hollow']?.transfers).toHaveLength(1);
    put(root, 'src/shards/nalati-grasslands/weapons/Rifle.ts', "import { Weapon } from '../../../engine/combat/Weapon'; export class Rifle extends Weapon {} export class Extra extends Weapon {}");
    expect(compareCoupling(before, shardCoupling(root)).join(',')).toContain('engineSubclasses rose 0 → 1');
  });
  it('refuses a surviving kit copy, a reused class entitlement and a namesake from another platform module', () => {
    const copied = transferred(); put(copied, 'src/kit/weapons/firearm/Rifle.ts', 'export class Rifle {}');
    expect(() => shardCoupling(copied)).toThrow('kit source still exists');
    const duplicate = transferred();
    put(duplicate, 'src/shards/nalati-grasslands/weapons/Rifle.ts', "import { Weapon } from '../../../engine/combat/Weapon'; export class Rifle extends Weapon {} export namespace Duplicate { export class Rifle extends Weapon {} }");
    expect(() => shardCoupling(duplicate)).toThrow('transfer reused');
    const namesake = transferred(); put(namesake, 'src/engine/combat/Other.ts', 'export class Weapon {}');
    put(namesake, 'src/shards/nalati-grasslands/weapons/Rifle.ts', "import { Weapon } from '../../../engine/combat/Other'; export class Rifle extends Weapon {}");
    expect(() => shardCoupling(namesake)).toThrow('platform base changed');
  });
  it('keeps typed Weapon coupling stable through a defining platform family', () => {
    const root = fixture();
    put(root, 'src/engine/combat/Firearm.ts', "import { Weapon } from './Weapon'; export class Firearm extends Weapon {}");
    put(root, 'src/shards/alpha/plugin.ts', "import { Firearm } from '../../engine/combat/Firearm'; export class Custom extends Firearm {}");
    expect(shardCoupling(root)['alpha']?.counts).toEqual({ 'ctx.app': 0, 'ctx.game': 0, 'ctx.game.runtime': 0, engineSubclasses: 1, 'subclass.Weapon': 1 });
  });
  it('permits only removal and preserves exact historical metadata, including at bootstrap', () => {
    expect(compareWeaponTransfers(WEAPON_TRANSFER_BOOTSTRAP, {})).toEqual([]);
    const file = 'src/shards/nalati-grasslands/weapons/Rifle.ts', item = WEAPON_TRANSFER_BOOTSTRAP[file];
    if (item === undefined) throw new Error('Missing reviewed transfer');
    for (const after of [
      { newSite: item }, { [file]: { ...item, owner: 'SF99' } },
      { [file]: { ...item, class: 'Extra' } }, { [file]: { ...item, runtime: 'src/shards/other/runtime/Extra.ts' } },
    ]) expect(compareWeaponTransfers(WEAPON_TRANSFER_BOOTSTRAP, after).length).toBeGreaterThan(0);
    const root = fixture(), before = join(root, 'absent.json'), after = join(root, 'candidate.json');
    writeFileSync(after, JSON.stringify({ transfers: WEAPON_TRANSFER_BOOTSTRAP }));
    expect(comparePlatformList(WEAPON_TRANSFER_LIST, before, after)).toEqual([]);
    writeFileSync(before, JSON.stringify({ transfers: { [file]: item } }));
    expect(comparePlatformList(WEAPON_TRANSFER_LIST, before, after).join(',')).toContain('new weapon transfer');
    writeFileSync(after, JSON.stringify({ transfers: {} }));
    expect(comparePlatformList(WEAPON_TRANSFER_LIST, before, after)).toEqual([]);
  });
});
