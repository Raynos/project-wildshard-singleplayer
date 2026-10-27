// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the plain publisher in an owned isolated root.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep fixtures beneath repository tmp.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { BOOT_PUBLICATION, bootPublicationTableSources, parseBootPublication, publishBootPublication, readBootPublication } from '../scripts/boot-publication.mjs';

const facts = (offset = 0, length = 3, total = 3) => ({
  schema: 'boot-publication/1', bytes: { '/assets/raw.bin': 3 }, versions: { '/assets/raw.bin': '1234abcd' },
  packs: { demo: { phone: { parts: [{ url: '/assets/packs/demo.phone-00000000.bin', bytes: total,
    files: [['/assets/raw.bin', offset, length, 'application/octet-stream']],
  }] } } },
});

function fixture(): { root: string; close: () => void } {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp', 'boot-publication-'));
  mkdirSync(resolve(root, 'scripts'));
  return { root, close: () => rmSync(root, { recursive: true, force: true }) };
}

test('plain transport tables require only the complete published facts', () => {
  const f = fixture();
  try {
    publishBootPublication(f.root, facts());
    const tables = bootPublicationTableSources(f.root);
    expect(Object.keys(tables)).toEqual(['src/game/boot/bytes.generated.ts', 'src/game/boot/versions.generated.ts', 'src/game/boot/packs.generated.ts']);
    expect(tables['src/game/boot/bytes.generated.ts']).toContain('"/assets/raw.bin": 3,');
    expect(tables['src/game/boot/versions.generated.ts']).toContain('"/assets/raw.bin": \'1234abcd\',');
    expect(tables['src/game/boot/packs.generated.ts']).toContain('["/assets/raw.bin",0,3,"application/octet-stream"]');
    expect(tables['src/game/boot/packs.generated.ts']).toContain('/assets/packs/demo.phone-00000000.bin');
    // No outputs, assets, products, discovery modules or tools exist in this root.
    expect(readdirSync(f.root)).toEqual(['scripts']);
    expect(readBootPublication(f.root)).toEqual(parseBootPublication(facts()));
  } finally { f.close(); }
});

test('malformed publication cannot replace the last complete record', () => {
  const f = fixture();
  try {
    const file = resolve(f.root, BOOT_PUBLICATION);
    publishBootPublication(f.root, facts());
    const before = readFileSync(file), inode = statSync(file).ino;
    publishBootPublication(f.root, facts());
    expect(statSync(file).ino).toBe(inode);
    const invalid: unknown[] = [facts(1), facts(0, 4), facts(0, 3, 4), { ...facts(), versions: {} },
      { ...facts(), versions: { '/assets/absent.bin': '1234abcd' } },
      { ...facts(), bytes: { '/assets/../crossed.bin': 3 } },
      { ...facts(), schema: 'other' },
    ];
    for (const value of invalid) {
      expect(() => publishBootPublication(f.root, value)).toThrow();
      expect(readFileSync(file)).toEqual(before); expect(statSync(file).ino).toBe(inode);
    }
    expect(readdirSync(resolve(f.root, 'scripts'))).toEqual(['boot-publication.generated.json']);
    writeFileSync(file, '{}');
    expect(() => bootPublicationTableSources(f.root)).toThrow();
  } finally { f.close(); }
});
