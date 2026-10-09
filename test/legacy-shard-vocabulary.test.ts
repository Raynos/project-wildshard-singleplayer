// oxlint-disable-next-line import/no-nodejs-modules -- Exercise immutable source discovery in an owned temporary fixture.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture never touches the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Construct literal fixture paths.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { shardWordData } from '../scripts/gen-shard-words.mjs';
import { slugSource } from '../scripts/gen-shards.mjs';

it('discovers exact inventoried copies as primary vocabulary aliases, including scoped generation, without suffix privilege', () => {
  const root = mkdtempSync(join(tmpdir(), 'legacy-vocabulary-'));
  const manifest = (slug: string): void => {
    const dir = join(root, 'src/shards', slug); mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'manifest.ts'), `export const manifest = { slug: '${slug}', name: 'Coast', debugOptions: ['wind'], assetGlobs: ['public/assets/coast/**'] };`);
    writeFileSync(join(dir, 'plugin.ts'), "const ctx = {}; ctx.rows.weapon({id:'coast.sword'}); ctx.debugRow({id:'wind'});");
  };
  try {
    manifest('coast'); const before = shardWordData(root);
    manifest('coast-legacy'); mkdirSync(join(root, 'lint'));
    const inventory = { version: 1, sealed: true, shards: { 'coast-legacy': { primary: 'coast', source: 'a'.repeat(40),
      files: { 'manifest.ts': 'b'.repeat(64), 'plugin.ts': 'c'.repeat(64) } } } };
    writeFileSync(join(root, 'lint/legacy-shards.json'), JSON.stringify(inventory));
    expect(shardWordData(root)).toEqual(before);
    // Vocabulary aliases never erase the separately saved, validated built-in identity.
    expect(slugSource(root)).toContain('"coast" | "coast-legacy"');
    expect(shardWordData(root, 'coast-legacy')).toEqual(shardWordData(root, 'coast'));
    writeFileSync(join(root, 'lint/legacy-shards.json'), JSON.stringify({ version: 1, sealed: true, shards: {} }));
    expect(shardWordData(root).slugs).toContain('coast-legacy');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
