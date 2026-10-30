import { expect, test } from 'vitest';
import { packShards,readDurations,selectTestCohort,PURE_TESTS } from '../scripts/vitest-shard';
import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the actual workflow covers every discovered test partition.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Inspect actual Vitest discovery without collecting or executing suites.
import {spawnSync} from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Match discovery paths to the repository-relative duration registry.
import {relative,resolve} from 'node:path';

test('duration partitions retain every file once, including unmeasured files', () => {
  const paths = Array.from({ length: 137 }, (_, i) => `test/fixture-${i}.test.ts`);
  const durations = new Map(paths.slice(0, 120).map((path, i) => [path, i % 9]));
  for (const count of [1, 10, 16, 32]) {
    const parts = packShards(paths, durations, count);
    expect(parts).toHaveLength(count);
    expect(parts.flat().sort()).toEqual([...paths].sort());
    expect(new Set(parts.flat()).size).toBe(paths.length);
    expect(packShards([...paths].reverse(), durations, count)).toEqual(parts);
  }
});

test('measured long tests get separate partitions instead of sharing a fallback weight', () => {
  const paths = ['long-a', 'long-b', 'long-c', ...Array.from({ length: 100 }, (_, i) => `short-${i}`)];
  const durations = new Map(paths.map(path => [path, path.startsWith('long-') ? 100 : 1]));
  const parts = packShards(paths, durations, 10);
  expect(parts.filter(files => files.some(path => path.startsWith('long-')))).toHaveLength(3);
  for (const part of parts) expect(part.filter(path => path.startsWith('long-')).length).toBeLessThanOrEqual(1);
});

test('isolated setup cost balances short-file tails against long test bodies', () => {
  const paths = [...Array.from({ length: 4 }, (_, i) => `long-${i}`),
    ...Array.from({ length: 160 }, (_, i) => `short-${i}`)];
  const durations = new Map(paths.map(path => [path, path.startsWith('long-') ? 100 : .001]));
  const parts = packShards(paths, durations, 8);
  // The observed six-second setup belongs to each file, including tiny bodies.
  const wall = parts.map(files => files.reduce((sum, path) => sum + (durations.get(path) ?? 0) + 6, 0));
  expect(Math.max(...wall) - Math.min(...wall)).toBeLessThanOrEqual(6.01);
  expect(Math.max(...parts.map(files => files.length))).toBeLessThan(40);
  expect(parts.flat().sort()).toEqual([...paths].sort());
});

test('cohorts separate real product consumers before duration or fallback sharding',()=>{
 const registry={'test/product.test.ts':['pine-hollow'],'test/declared-pure.test.ts':[]};
 const files=['test/new.test.ts','test/product.test.ts','test/declared-pure.test.ts'];
 expect(selectTestCohort(files,registry,undefined)).toEqual(files);
 expect(selectTestCohort(files,registry,'product-free')).toEqual(['test/new.test.ts','test/declared-pure.test.ts']);
 expect(selectTestCohort(files,registry,'products')).toEqual(['test/product.test.ts']);
 expect(()=>selectTestCohort(files,registry,'typo')).toThrow('Unknown test cohort');
});

test('one CI matrix discovers every existing file exactly once across both isolation modes',()=>{
 const workflow=readFileSync('.github/workflows/deploy.yml','utf8');
 const job=workflow.split('\n  behaviour:\n')[1]?.split(/\n {2}[a-z][\w-]*:\n/u)[0];
 if(job===undefined)throw new Error('Missing behavior wave');
 expect(workflow).not.toContain('\n  behaviour-products:');
 expect(job).toContain('needs: prepare');
 expect(job).toContain(`WS_TEST_PRODUCTS_SHA: \${{ github.sha }}`);
 expect(job).not.toContain('WS_TEST_COHORT:');
 expect(job).toContain('fail-fast: false');
 expect(job).toContain(`--config scripts/vitest-ci.config.ts --shard=\${{ matrix.shard }}/12 --bail=1`);
 expect(job).toContain('python3 scripts/ci-products.py unpack');
 const matrix=/^\s+shard: \[([\d, ]+)\]/mu.exec(job)?.[1]?.split(',').map(Number);
 expect(matrix).toEqual(Array.from({length:12},(_,i)=>i+1));
 const list=(config?:string):{file:string;projectName?:string}[]=>{
  const result=spawnSync(process.execPath,[resolve('node_modules/vitest/vitest.mjs'),'list','--filesOnly','--json',
   ...(config===undefined?[]:['--config',config])],{encoding:'utf8',timeout:10000});
  expect(result.status,result.stderr).toBe(0);
  return v.parse(v.array(v.object({file:v.string(),projectName:v.exactOptional(v.string())})),JSON.parse(result.stdout));
 };
 const normal=list(),ci=list('scripts/vitest-ci.config.ts');
 const paths=normal.map(row=>relative('.',row.file));
 const actual=ci.map(row=>relative('.',row.file));
 expect(actual.length).toBeGreaterThan(0);
 expect([...actual].sort()).toEqual([...paths].sort());
 expect(new Set(actual).size).toBe(actual.length);
 expect(ci.filter(row=>row.projectName==='pure').map(row=>relative('.',row.file)).sort()).toEqual([...PURE_TESTS].sort());
 const parts=packShards(paths,readDurations('.')??new Map(),12);
 const selected=(matrix??[]).flatMap(index=>parts[index-1]??[]);
 expect(selected.sort()).toEqual([...paths].sort());
 expect(new Set(selected).size).toBe(paths.length);
 const registry=v.parse(v.record(v.string(),v.array(v.string())),JSON.parse(readFileSync('scripts/test-products.json','utf8')));
 for(const [file,products] of Object.entries(registry))if(products.length>0)expect(paths).toContain(file);
 const dispatch=workflow.split('\n  dispatch-boot-smoke:\n')[1];
 expect(dispatch).toContain('prepare, typecheck-lint, derived-docs, behaviour]');
});

test('shared workers admit only reviewed format suites without host or import-state mutation',()=>{
 for(const file of PURE_TESTS){
  const source=readFileSync(file,'utf8');
  expect(source,file).not.toMatch(/vi\.(?:mock|doMock|resetModules|stubGlobal|useFakeTimers|spyOn)|globalThis|process\.env|@vitest-environment|beforeAll|afterAll/u);
  expect(source,file).not.toMatch(/from ['"](?:node:|[^'"]*(?:engine|game|shards)\/)/u);
 }
});

test('native source suites start with verified inputs and never wait for a product', () => {
  const registry = v.parse(v.record(v.string(), v.array(v.string())), JSON.parse(readFileSync('scripts/test-products.json', 'utf8')));
  const native = ['nalati-dressing-inputs', 'nalati-dressing-placement-program', 'nalati-dressing-source',
    'nalati-native-dressing-reader', 'nalati-place-construction', 'nalati-places-program'].map(name => `test/${name}.test.ts`);
  expect(selectTestCohort(native, registry, 'product-free')).toEqual(native);
  expect(selectTestCohort(native, registry, 'products')).toEqual([]);
  for (const path of native) {
    const source = readFileSync(path, 'utf8');
    expect(source).not.toMatch(/fixtures\/builtProduct|readBuiltShardfile/u);
    expect(source).not.toContain('authoring-shard.mjs');
  }
});

test('one preparation owns the source cache, generation and complete admission', () => {
  const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
  const prepare = workflow.split('\n  prepare:\n')[1]?.split('\n  behaviour:\n')[0];
  if (prepare === undefined) throw new Error('Missing preparation owner');
  for (const path of ['~/.cache/wildshard/shardfiles', '~/.cache/wildshard/gen', '~/.cache/wildshard/basis'])
    expect(prepare).toContain(path);
  const key = /^ {10}key: (.+)$/mu.exec(prepare)?.[1];
  expect(key).toContain(`\${{ steps.inputs.outputs.tree }}`);
  expect(key).toContain(`\${{ runner.arch }}`);
  expect(prepare).not.toMatch(/^ {4}needs:/mu);
  expect(prepare).not.toContain('actions/download-artifact');
  const generation = prepare.indexOf('node scripts/gen.mjs --inputs-only');
  const build = prepare.indexOf('node scripts/build-shardfiles.mjs --reuse');
  const pack = prepare.indexOf('python3 scripts/ci-products.py pack\n');
  expect(generation).toBeGreaterThan(prepare.indexOf('uses: actions/cache@v4'));
  expect(build).toBeGreaterThan(generation);
  expect(pack).toBeGreaterThan(build);
  expect(prepare.indexOf('node scripts/check-closed-components.mjs')).toBeGreaterThan(build);
  expect(prepare.indexOf('node scripts/ci-product-cache.mjs')).toBeGreaterThan(build);
  expect(prepare.indexOf('scripts/ci-checks.mjs --prepared')).toBeGreaterThan(pack);
});


test('every former quarantine owner remains in exactly one blocking product cohort', () => {
 const files=['test/nalati-creature-views.test.ts','test/shard-headless.test.ts','test/heavy-lane.test.ts'];
 const registry=v.parse(v.record(v.string(),v.array(v.string())),JSON.parse(readFileSync('scripts/test-products.json','utf8')));
 const selected=[...selectTestCohort(files,registry,'product-free'),...selectTestCohort(files,registry,'products')];
 expect(selected.sort()).toEqual([...files].sort());
 expect(new Set(selected).size).toBe(files.length);
 expect(() => selectTestCohort(files,registry,'quarantine')).toThrow('Unknown test cohort');
});
