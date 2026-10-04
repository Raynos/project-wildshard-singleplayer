// oxlint-disable-next-line import/no-nodejs-modules -- Contract fixtures own and remove isolated manifests.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary manifest roots stay outside the shared tree.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the isolated source paths.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { manifestContract } from '../scripts/gen-shards.mjs';
import { checkShardLayout } from '../scripts/check-shards.mjs';

it('data manifests use the SDK project layout while legacy and forged descriptors still require a plugin', () => {
  const config = { requiredFiles: ['manifest.ts', 'plugin.ts', 'README.md'], allowedFiles: ['shard.config.ts'],
    shardfileRequiredFiles: ['shard.config.ts', 'README.md'], folders: [], legacy: {} };
  const files = { author: ['manifest.ts', 'shard.config.ts', 'README.md'] };
  expect(checkShardLayout(files, config, () => "export const m={slug:'author',shardfile:'/shardfiles/author/shard.json'}; export default m;")).toEqual([]);
  for (const extra of ["load:()=>import('./plugin')", "card:{shardfile:'/shardfiles/author/shard.json'}", "shardfile:'https://foreign.test/shard.json'", "shardfile:'/shardfiles/author/shard.json',load:()=>import('./plugin')"]) {
    expect(checkShardLayout(files, config, () => `export default {slug:'author',${extra}};`)).toContain('author: missing required plugin.ts');
  }
});

it('admits canonical built data descriptors and refuses forged, mixed or unbuildable sources', () => {
  const root = mkdtempSync(join(tmpdir(), 'shard-descriptors-'));
  const put = (slug: string, source: string, config = true): void => {
    const directory = join(root, 'src/shards', slug); mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'manifest.ts'), source);
    if (config) writeFileSync(join(directory, 'shard.config.ts'), 'export default {};');
  };
  try {
    put('good', "export const data = { shardfile: '/shardfiles/good/shard.json' }; export default data;");
    put('_template', "export default { shardfile: '/shardfiles/_template/shard.json' };");
    put('foreign', "export default { shardfile: 'https://foreign.test/shard.json' };");
    put('mixed', "export default { shardfile: '/shardfiles/mixed/shard.json', load: () => import('./plugin') };");
    put('missing', "export default { shardfile: '/shardfiles/missing/shard.json' };", false);
    put('nested', "export default { card: { shardfile: '/shardfiles/nested/shard.json' } };");
    put('comment', "// shardfile: '/shardfiles/comment/shard.json'\nexport default {};");
    const failures = manifestContract(root, {});
    expect(failures.filter((row) => row.includes('/good/') || row.includes('/_template/'))).toEqual([]);
    expect(failures).toHaveLength(5);
    expect(failures.some((row) => row.includes('/foreign/') && row.includes('literal canonical'))).toBe(true);
    expect(failures.some((row) => row.includes('/mixed/') && row.includes('runtime plugin'))).toBe(true);
    expect(failures.some((row) => row.includes('/missing/') && row.includes('shard.config.ts'))).toBe(true);
    expect(failures.filter((row) => /\/(nested|comment)\//u.test(row)).every((row) => row.includes('load must'))).toBe(true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
