// oxlint-disable-next-line import/no-nodejs-modules -- Immutable predecessor/candidate trees test the policy proof.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolated fixtures never touch the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Portable fixture paths.
import { dirname, join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { classMoveSites, CLASS_MOVE_LIST } from '../scripts/shard-coupling.mjs';
import { comparePlatformList } from '../scripts/check-platform-ratchets.mjs';

const roots: string[] = [], file = 'src/shards/alpha/runtime/rifle.ts', list = 'lint/shard-coupling.json';
afterAll(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });
function put(root: string, path: string, source: string): void {
  const target = join(root, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, source);
}
const shipping = "import { Weapon } from '../../../engine/combat/Weapon'; export class Rifle extends Weapon { close(): number { return 5; } }";
function fixture(): { before: string; after: string; compare: () => string[]; raise: (count: number, metric?: string) => void; key: string; move: { from: string; to: string; hash: string; name: string; baseFile: string; base: string } } {
  const before = mkdtempSync(join(tmpdir(), 'retired-class-before-')), after = mkdtempSync(join(tmpdir(), 'retired-class-after-')); roots.push(before, after);
  for (const root of [before, after]) {
    put(root, 'src/engine/combat/Weapon.ts', 'export class Weapon {}');
    put(root, file, shipping);
  }
  const site = classMoveSites(shipping, file, before)[0]; if (site?.baseFile === null || site === undefined) throw new Error('Missing shipping class');
  const move = { from: 'src/game/rifle.ts', to: file, hash: site.hash, name: site.name, baseFile: site.baseFile, base: 'Weapon' }, key = `${file}:${site.hash}`;
  put(before, CLASS_MOVE_LIST, JSON.stringify({ version: 1, moves: { [key]: move } }));
  put(after, CLASS_MOVE_LIST, JSON.stringify({ version: 1, moves: {} }));
  put(before, list, JSON.stringify({ shards: { alpha: { counts: { engineSubclasses: 0, 'subclass.Weapon': 0, 'ctx.app': 0 }, sites: {} } } }));
  const raise = (count: number, metric = 'subclass.Weapon'): void => {
    put(after, list, JSON.stringify({ shards: { alpha: { counts: { engineSubclasses: count, [metric]: count, 'ctx.app': 0 }, sites: {} } } }));
  };
  raise(1); put(after, file, shipping.replace('return 5', 'return 7'));
  return { before, after, raise, key, move, compare: () => comparePlatformList(list, join(before, list), join(after, list), { baselineRoot: before, candidateRoot: after }) };
}
it('admits exactly the existing class after its exact move hash retires and its resolved inheritance stays unchanged', () => {
  const f = fixture(); expect(f.compare()).toEqual([]);
  expect(comparePlatformList(list, join(f.before, list), join(f.after, list))).toHaveLength(2);
});
it('refuses a retained, stale, untouched or missing class record rather than allowing a +1 receipt', () => {
  for (const mode of ['retained', 'stale', 'untouched', 'missing']) {
    const f = fixture();
    if (mode === 'retained') put(f.after, CLASS_MOVE_LIST, JSON.stringify({ version: 1, moves: { [f.key]: f.move } }));
    if (mode === 'stale') put(f.before, CLASS_MOVE_LIST, JSON.stringify({ version: 1, moves: { [f.key]: { ...f.move, hash: '0'.repeat(64) } } }));
    if (mode === 'untouched') put(f.after, file, shipping);
    if (mode === 'missing') put(f.before, CLASS_MOVE_LIST, JSON.stringify({ version: 1, moves: {} }));
    expect(f.compare(), mode).toHaveLength(2);
  }
});
it('refuses changed ancestry, namesake bases, new subclasses and moved class identities', () => {
  for (const mode of ['ancestry', 'namesake', 'new', 'name']) {
    const f = fixture();
    if (mode === 'ancestry') put(f.after, file, shipping.replace('extends Weapon', 'extends Weapon implements Extra').replace('return 5', 'return 7'));
    if (mode === 'namesake') { put(f.after, 'src/engine/combat/Other.ts', 'export class Weapon {}'); put(f.after, file, shipping.replace('/Weapon', '/Other').replace('return 5', 'return 7')); }
    if (mode === 'new') put(f.after, 'src/shards/alpha/runtime/new.ts', "import { Weapon } from '../../../engine/combat/Weapon'; export class Extra extends Weapon {}");
    if (mode === 'name') put(f.after, file, shipping.replace('class Rifle', 'class Other').replace('return 5', 'return 7'));
    expect(f.compare(), mode).toHaveLength(2);
  }
});
it('cannot spend one retirement on +2, another metric or another shard', () => {
  const f = fixture(); f.raise(2); expect(f.compare()).toHaveLength(2);
  f.raise(1, 'subclass.Animal'); expect(f.compare().join(',')).toContain('subclass.Animal rose 0 → 1');
  put(f.after, list, JSON.stringify({ shards: { beta: { counts: { engineSubclasses: 1, 'subclass.Weapon': 1 }, sites: {} } } }));
  expect(f.compare()).toHaveLength(2);
});
