// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real Node report process and exit status.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The test owns a small isolated product tree.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths stay under the repository's ignored tmp/.
import { dirname, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the fixture receipt to emitted bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Launch the isolated Node proof with this runtime.
import process from 'node:process';
import { afterEach, expect, it } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { outputSectionPayloads } from '../src/format/outputIndex';
import { structuralGridEvidence } from '../src/format/gridReadiness';
import { MILESTONE_SHARDS } from '../scripts/shard-milestones.mjs';
import { buildShardfiles } from '../scripts/build-shardfiles.mjs';
import { readRuler } from '../scripts/admin-data/ruler.mjs';
import { platformOutput } from './fixtures/platformOutputs';

const owned: string[] = [];
afterEach(() => { for (const root of owned.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture(): string {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/ruler-product-failure-')); owned.push(root);
  const put = (path: string, value: unknown): void => {
    const file = resolve(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(value));
  };
  put('scripts/generation-jobs.json', { schema: 'generation-jobs/1', notice: 'DO NOT EDIT: fixture', jobs: [] });
  put('lint/ratchet.json', { allow: {}, budgets: {} });
  put('src/format/memoryGates.json', { explorerMB: 1200, loadingMB: 1800 });
  put('lint/legacy-shards.json', { version: 1, sealed: true, shards: Object.fromEntries(MILESTONE_SHARDS.map(primary => [`${primary}-legacy`, {
    primary, source: 'a'.repeat(40), files: { 'manifest.ts': 'b'.repeat(64), 'plugin.ts': 'b'.repeat(64) },
  }])) });
  put('lint/legacy-line-basis.json', { schema: 'legacy-line-basis/1', revision: 'a'.repeat(40), shards: Object.fromEntries(MILESTONE_SHARDS.map(slug => [slug, {
    source: 'a'.repeat(40), excluded: [], files: { 'plugin.ts': 100 },
  }])) });
  for (const slug of MILESTONE_SHARDS) {
    const source = emptyShardfile({ slug, name: slug, author: 'Test', revision: 1, seed: 1 });
    platformOutput(root, slug, { 'runtime/index.ts': `export const value = '${slug}';` },
      Object.fromEntries([...outputSectionPayloads(source)].map(([name, value]) => [name, JSON.stringify(value)])));
    writeFileSync(resolve(root, `src/shards/${slug}/shard.config.ts`), 'export default {};\n');
    put(`src/shards/${slug}/look/map.json`, { why: 'Fixture has no data-map painter' });
    const bytes = readFileSync(resolve(root, `out/${slug}/shard.json`));
    put(`out/${slug}/validation.json`, { indexHash: createHash('sha256').update(bytes).digest('hex'), revision: 'fixture',
      sourceHash: '0'.repeat(64), gridReady: structuralGridEvidence(source) });
  }
  cpSync(resolve(root, 'out'), resolve(root, 'prepared'), { recursive: true });
  return root;
}

it('writes every ruler row and exits zero after one fixture product fails', () => {
  const root = fixture();
  const program = `
    import {cpSync,writeFileSync} from 'node:fs';
    import {basename,resolve} from 'node:path';
    import {outputReport} from './scripts/shard-output-report.mjs';
    import {nextRuler,readRuler} from './scripts/admin-data/ruler.mjs';
    import {portSharesText} from './scripts/gen-port-shares.mjs';
    const emit=console.log;console.log=console.error;console.info=console.error;
    const root=${JSON.stringify(root)},calls=[];
    const report=await outputReport(root,{reportOnly:true,sourceProgress:true,buildProduct:async args=>{
      const [,project,destination]=args,slug=basename(project);calls.push(slug);
      if(slug==='driftwood-isle')throw new Error('Deliberate fixture product failure');
      cpSync(resolve(root,'prepared',slug),destination,{recursive:true});
    }});
    const raw={...report.rows,_summary:{metric:'source-progress',progress:report.progress,netLines:report.netLines,
      measurementError:report.measurementError,productFailures:report.productFailures}};
    const ruler=readRuler(nextRuler(raw,null,{revision:'b'.repeat(40),committedAt:'2026-10-20T12:00:00Z',now:'2026-10-20T12:01:00Z'}));
    writeFileSync(resolve(root,'ruler.json'),JSON.stringify(ruler));
    emit(JSON.stringify({ruler,calls,shares:JSON.parse(portSharesText(JSON.stringify(ruler)))}));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', program], {
    cwd: resolve('.'), encoding: 'utf8', timeout: 60_000, env: { ...process.env, WILDSHARD_SHARDFILE_CACHE: resolve(root, 'cache') },
  });
  expect(result.status, result.stderr).toBe(0);
  const written = readRuler(JSON.parse(readFileSync(resolve(root, 'ruler.json'), 'utf8')));
  expect(written.shards).toHaveLength(6);
  expect(written.productFailures).toEqual({ 'driftwood-isle': 'Deliberate fixture product failure' });
  expect(written.m3).toEqual({ cut: null, mustGo: null, fraction: null });
  expect(written.plan.upper).toBeGreaterThan(written.plan.lower);
  expect(written.history.at(-1)?.shards).toEqual({});
  expect(written.wave.pct).toBe(null);
  expect(written.waves.every(wave => wave.endedAt === null)).toBe(true);
  expect(() => readRuler({ ...written, m3: { cut: 0, mustGo: 1, fraction: 0 } })).toThrow('cannot grant M3 credit');
  for (const row of written.shards) {
    expect(row.custom).toBe(null); expect(row.pct).toBe(null);
    expect(row.measurementError).toContain('driftwood-isle: Deliberate fixture product failure');
    if (row.slug === 'driftwood-isle') {
      expect(row.grid).toBe('fail'); expect(row.criteria['productBuild']).toBe('fail');
      expect(row.frameFloor?.evidence).toContain('Deliberate fixture product failure');
    } else expect(row.criteria['fourEntryways']).toBe('pass');
  }
  expect(existsSync(resolve(root, 'out/driftwood-isle/shard.json'))).toBe(false);
  const receipt = JSON.parse(result.stdout) as { calls: string[]; shares: { shares: Record<string, number> } };
  expect(receipt.calls.sort()).toEqual([...MILESTONE_SHARDS].sort());
  expect(receipt.shares.shares).toEqual({});
});

it('keeps ordinary, strict and catalogue builds hard on failure', async () => {
  const root = fixture(), build = (): Promise<void> => Promise.reject(new Error('Strict fixture refused'));
  await expect(buildShardfiles(root, { strict: false, build })).rejects.toThrow('Strict fixture refused');
  const onFailure = (): void => { throw new Error('Must never collect strict failures'); };
  await expect(buildShardfiles(root, { strict: true, onFailure })).rejects.toThrow('report-only');
  await expect(buildShardfiles(root, { strict: false, catalog: true, onFailure })).rejects.toThrow('report-only');
});

it('collects generation discovery failures within each report product boundary',async()=>{
  const root=fixture(),failures:string[]=[];
  writeFileSync(resolve(root,'scripts/generation-jobs.json'),'{}');
  const build=():Promise<void>=>Promise.resolve();
  expect(await buildShardfiles(root,{strict:false,build,onFailure:slug=>{failures.push(slug);}})).toBe(0);
  expect(failures.sort()).toEqual([...MILESTONE_SHARDS].sort());
  await expect(buildShardfiles(root,{strict:false,build})).rejects.toThrow();
});
