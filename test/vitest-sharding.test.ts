import { expect, test } from 'vitest';
import { packShards,readDurations,selectTestCohort } from '../scripts/vitest-shard';
import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the actual workflow covers every discovered test partition.
import {readdirSync,readFileSync} from 'node:fs';

test('duration partitions retain every file once, including unmeasured files', () => {
  const paths = Array.from({ length: 137 }, (_, i) => `test/fixture-${i}.test.ts`);
  const durations = new Map(paths.slice(0, 120).map((path, i) => [path, i % 9]));
  for (const count of [1, 10, 16]) {
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

test('cohorts separate real product consumers before duration or fallback sharding',()=>{
 const registry={'test/product.test.ts':['pine-hollow'],'test/declared-pure.test.ts':[]};
 const files=['test/new.test.ts','test/product.test.ts','test/declared-pure.test.ts'];
 expect(selectTestCohort(files,registry,undefined)).toEqual(files);
 expect(selectTestCohort(files,registry,'product-free')).toEqual(['test/new.test.ts','test/declared-pure.test.ts']);
 expect(selectTestCohort(files,registry,'products')).toEqual(['test/product.test.ts']);
 expect(()=>selectTestCohort(files,registry,'typo')).toThrow('Unknown test cohort');
});

test('both CI cohorts cover every discovered test once and keep exact-run producer gates',()=>{
 const workflow=readFileSync('.github/workflows/deploy.yml','utf8');
 const registry=v.parse(v.record(v.string(),v.array(v.string())),JSON.parse(readFileSync('scripts/test-products.json','utf8')));
 const paths=['src','test','admin/test','drafts/test'].flatMap(root=>readdirSync(root,{recursive:true,encoding:'utf8'})
  .filter(file=>file.endsWith('.test.ts')).map(file=>`${root}/${file.replaceAll('\\','/')}`));
 const selected:string[]=[];
 for(const [id,cohort,producer,total] of [['behaviour','product-free','generated-inputs',16],['behaviour-products','products','products',4]] as const){
  const job=workflow.split(`\n  ${id}:\n`)[1]?.split(/\n {2}[a-z][\w-]*:\n/u)[0];
  if(job===undefined)throw new Error(`Missing ${id} job`);
  expect(job).toContain(`needs: ${producer}`);
  expect(job).toContain(`WS_TEST_COHORT: ${cohort}`);
  expect(job).toContain('fail-fast: false');
  expect(job).toContain(`vitest run --shard=\${{ matrix.shard }}/${total} --bail=1`);
  const matrix=/^\s+shard: \[([\d, ]+)\]/mu.exec(job)?.[1]?.split(',').map(Number);
  expect(matrix).toEqual(Array.from({length:total},(_,i)=>i+1));
  if(cohort==='products'){
   expect(job).toContain(`WS_TEST_PRODUCTS_SHA: \${{ github.sha }}`);
   expect(job).toContain('python3 scripts/ci-products.py unpack\n');
  }else{
   expect(job).not.toContain('WS_TEST_PRODUCTS_SHA');
   expect(job).not.toContain('name: test-products');
   expect(job).toContain('python3 scripts/ci-products.py unpack-generated');
  }
  const subset=selectTestCohort(paths,registry,cohort);
  const parts=packShards(subset,readDurations('.')??new Map(),total);
  selected.push(...(matrix??[]).flatMap(index=>parts[index-1]??[]));
 }
 expect(selected.length).toBeGreaterThan(0);
 expect(selected.sort()).toEqual([...paths].sort());
 expect(new Set(selected).size).toBe(paths.length);
 for(const [file,products] of Object.entries(registry))if(products.length>0)expect(paths).toContain(file);
 // New imports of the real-product fixture cannot silently join the early job.
 for(const file of paths)if(/from\s+['"][^'"]*fixtures\/builtProduct['"]/u.test(readFileSync(file,'utf8')))
  expect(registry[file]?.length,`${file} must declare its product dependencies`).toBeGreaterThan(0);
 const dispatch=workflow.split('\n  dispatch-boot-smoke:\n')[1];
 expect(dispatch).toContain('products, behaviour, behaviour-products]');
});
