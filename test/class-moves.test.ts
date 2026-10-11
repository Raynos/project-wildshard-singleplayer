// oxlint-disable-next-line import/no-nodejs-modules -- Isolated immutable source-tree fixtures.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary fixture roots.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths are portable.
import { dirname, join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { CLASS_MOVE_LIST, classMoveSites, compareCoupling, shardCoupling } from '../scripts/shard-coupling.mjs';
import { comparePlatformList } from '../scripts/check-platform-ratchets.mjs';

const roots: string[] = [];
afterAll(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });
function put(root: string, file: string, text: string): void {
  const path = join(root, file); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text);
}
function tree(): string {
  const root = mkdtempSync(join(tmpdir(), 'class-move-')); roots.push(root);
  put(root, 'tsconfig.json', JSON.stringify({ compilerOptions: { strict: true, target: 'ES2022', module: 'ESNext' } }));
  put(root, 'src/engine/combat/Weapon.ts', 'export class Weapon {}');
  return root;
}
const from = 'src/game/weapon.ts', to = 'src/shards/alpha/runtime/weapon.ts';
const body = 'export class Blade extends Weapon { hit(): number { return 7; } }';
function moved(): { before: string; after: string; moves: Record<string, { from: string; to: string; hash: string; name: string; base: string; baseFile: string }> } {
  const before = tree(), after = tree();
  const old = `import { Weapon } from '../engine/combat/Weapon';\n${body}`;
  put(before, from, old); put(after, to, `import { Weapon } from '../../../engine/combat/Weapon';\n${body}`);
  const site = classMoveSites(old, from, before)[0];
  if (site?.baseFile === undefined || site.baseFile === null) throw new Error('Missing exact fixture class');
  const moves = { [`${to}:${site.hash}`]: { from, to, hash: site.hash, name: site.name, base: 'Weapon', baseFile: site.baseFile } };
  put(after, CLASS_MOVE_LIST, JSON.stringify({ version: 1, moves }));
  return { before, after, moves };
}
function compare(before: string, after: string): string[] {
  return comparePlatformList(CLASS_MOVE_LIST, join(before, CLASS_MOVE_LIST), join(after, CLASS_MOVE_LIST), { baselineRoot: before, candidateRoot: after });
}

it('proves a removed class, keeps raw typed counts, and preserves the effective ceiling', () => {
  const { before, after } = moved(); expect(compare(before, after)).toEqual([]);
  const row = shardCoupling(after)['alpha'];
  expect(row?.counts['engineSubclasses']).toBe(1); expect(row?.counts['subclass.Weapon']).toBe(1);
  expect(row?.verbatimMoves).toHaveLength(1);
  expect(compareCoupling({ alpha: { counts: { engineSubclasses: 0, 'subclass.Weapon': 0 }, sites: {} } }, shardCoupling(after))).toEqual([]);
  put(after, 'src/shards/alpha/runtime/extra.ts', "import { Weapon } from '../../../engine/combat/Weapon'; export class Extra extends Weapon {}");
  expect(compareCoupling({ alpha: { counts: {}, sites: {} } }, shardCoupling(after))).toContain('alpha: engineSubclasses rose 0 → 1');
});

it('refuses body edits, copies, and reuse of one predecessor class', () => {
  for (const change of ['body', 'copy', 'reuse']) {
    const { before, after, moves } = moved();
    if (change === 'body') put(after, to, `import { Weapon } from '../../../engine/combat/Weapon';\n${body.replace('7', '8')}`);
    if (change === 'copy') put(after, from, `import { Weapon } from '../engine/combat/Weapon';\n${body}`);
    if (change === 'reuse') {
      const second = 'src/shards/alpha/runtime/second.ts', item = Object.values(moves)[0];
      if (item === undefined) throw new Error('Missing move');
      put(after, second, `import { Weapon } from '../../../engine/combat/Weapon';\n${body}`);
      put(after, CLASS_MOVE_LIST, JSON.stringify({ version: 1, moves: { ...moves, [`${second}:${item.hash}`]: { ...item, to: second } } }));
    }
    expect(compare(before, after).length).toBeGreaterThan(0);
  }
});

it('fences namesake bases and fails closed when a recorded implementation changes', () => {
  const { before, after } = moved();
  put(after, 'src/engine/combat/Other.ts', 'export class Weapon {}');
  put(after, to, `import { Weapon } from '../../../engine/combat/Other';\n${body}`);
  expect(compare(before, after).length).toBeGreaterThan(0);
  expect(() => shardCoupling(after)).toThrow('Invalid verbatim class move');
  put(after, to, `import { Weapon } from '../../../engine/combat/Weapon';\n${body.replace('7', '8')}`);
  expect(() => shardCoupling(after)).toThrow('Unmatched verbatim class move');
});
