// oxlint-disable-next-line import/no-nodejs-modules -- Locate the installed fixture dependency without browser globals.
import process from 'node:process';
import { expect, it } from 'vitest';
import { NATIVE_BAKES, nativeBakePlan, regenerateCheapBakes, refreshRecordedCommitInputs, refreshCommitMeasurements } from '../scripts/precommit-bakes.mjs';
// oxlint-disable-next-line import/no-nodejs-modules -- Measure fixture input maps using the shipping digest law.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Own all fixture files and remove them in finally.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Place producer fixtures outside the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only fixture-owned directories.
import { dirname, join } from 'node:path';
import { mapPixelHash, mapTilesHash } from '../scripts/map-hash.mjs';

it('plans changed native inputs but never stages cheap build outputs at commit', async () => {
  const root = mkdtempSync(join(tmpdir(), 'precommit-native-'));
  try {
    mkdirSync(join(root, 'scripts')); mkdirSync(join(root, 'lint'));
    writeFileSync(join(root, 'lint/legacy-shards.json'), '{"version":1,"sealed":false,"shards":{}}');
    writeFileSync(join(root, 'scripts/bake-loader.mjs'), '');
    const inputs = { 'src/game/shared.ts': 'before' };
    writeFileSync(join(root, 'input.json'), JSON.stringify(inputs));
    for (const [slug = '', name = ''] of NATIVE_BAKES) {
      const folder = `src/shards/${slug}`;
      for (const dir of ['runtime', 'generators']) mkdirSync(join(root, folder, dir), { recursive: true });
      const collector = `import{readFileSync}from'node:fs';import{join}from'node:path';export function ${name}PhysicsInputs(root){return JSON.parse(readFileSync(join(root,'input.json'),'utf8'));}`;
      writeFileSync(join(root, `scripts/${name}-physics-inputs.mjs`), collector);
      if (name === 'driftwood') writeFileSync(join(root, 'scripts/driftwood-spots-inputs.mjs'), collector.replace('driftwoodPhysicsInputs', 'driftwoodSpotsInputs'));
      for (const kind of ['physics', ...(['pine', 'driftwood'].includes(name) ? ['spots'] : [])]) {
        const file = `${folder}/runtime/${kind}.baked.json`;
        const body = `import{readFileSync,writeFileSync}from'node:fs';import{createHash}from'node:crypto';const inputs=JSON.parse(readFileSync('input.json','utf8'));const digest=createHash('sha256').update(JSON.stringify(inputs)).digest('hex');writeFileSync(${JSON.stringify(file)},JSON.stringify({build:'node-'+digest,${name === 'pine' && kind === 'spots' ? '' : 'inputs,'}pieces:[1,2,3]}));`;
        writeFileSync(join(root, `${folder}/generators/bake-${name}-${kind}.mjs`), body);
        const digest = createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
        writeFileSync(join(root, file), JSON.stringify({ build: `node-${digest}`, ...(name === 'pine' && kind === 'spots' ? {} : { inputs }), pieces: [1,2,3] }));
      }
    }
    expect(await nativeBakePlan(root)).toEqual([]);
    writeFileSync(join(root, 'input.json'), JSON.stringify({ 'src/game/shared.ts': 'after' }));
    expect((await nativeBakePlan(root)).map(job => job.file)).toHaveLength(8);
    const outputs = await regenerateCheapBakes(root);
    expect(outputs).toEqual([]);
    expect(await nativeBakePlan(root)).toHaveLength(8);
    for (const file of outputs) expect(JSON.parse(readFileSync(join(root, file), 'utf8'))).toMatchObject({pieces:[1,2,3]});
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('skips recorder workers only for exact successful traced inputs', async () => {
  const root = mkdtempSync(join(tmpdir(),'recorded-commit-')), cache = join(root,'cache');
  try {
    mkdirSync(join(root,'scripts'));
    for (const name of ['precommit-bakes.mjs','map-hash.mjs','bake-input-hashes.mjs','witness-manifests.mjs','witness-checkpoints.mjs','gate-cache.mjs','gate-trace.mjs']) copyFileSync(`scripts/${name}`,join(root,'scripts',name));
    writeFileSync(join(root,'scripts/map-hash.mjs'),'export const mapShards=()=>[];export const mapSettings=()=>({});export const mapTilesHash=()=>"";');
    mkdirSync(join(root,'node_modules'));
    symlinkSync(join(process.cwd(),'node_modules/valibot'),join(root,'node_modules/valibot'));
    writeFileSync(join(root,'scripts/bake-loader.mjs'),'');
    writeFileSync(join(root,'scripts/sim-node-loader.mjs'),'');
    const proof = join(root,'test/proof/fixture'); mkdirSync(join(proof,'checkpoints'),{recursive:true});
    writeFileSync(join(proof,'checkpoints/manifest.json'),'{"inputs":"00"}');
    writeFileSync(join(root,'input.txt'),'before');
    writeFileSync(join(proof,'run.mjs'),`import{readFileSync,appendFileSync}from'node:fs';
const input=readFileSync('input.txt','utf8');appendFileSync('calls.txt','fresh\\n');
if(input==='fail')throw Error('refuse changed outcomes');
console.log(JSON.stringify({status:'fresh',inputs:'00'}));`);
    expect(await refreshRecordedCommitInputs(root,cache)).toEqual([]);
    const first = readFileSync(join(root,'calls.txt'),'utf8');
    expect(await refreshRecordedCommitInputs(root,cache)).toEqual([]);
    expect(readFileSync(join(root,'calls.txt'),'utf8')).toBe(first);
    const receiptFile=join(cache,'commit-recorded-inputs.json');
    const recorded=readFileSync(receiptFile,'utf8');
    expect(recorded).toContain(`"arch":"${process.arch}"`);
    writeFileSync(receiptFile,recorded.replace(`"arch":"${process.arch}"`,'"arch":"another architecture"'));
    await refreshRecordedCommitInputs(root,cache);
    expect(readFileSync(join(root,'calls.txt'),'utf8').length).toBeGreaterThan(first.length);
    writeFileSync(join(root,'input.txt'),'after');
    await refreshRecordedCommitInputs(root,cache);
    expect(readFileSync(join(root,'calls.txt'),'utf8').length).toBeGreaterThan(first.length);
    writeFileSync(join(root,'input.txt'),'fail');
    await expect(refreshRecordedCommitInputs(root,cache)).rejects.toThrow('Recorded commit producer failed');
    await expect(refreshRecordedCommitInputs(root,cache)).rejects.toThrow('Recorded commit producer failed');
  } finally { rmSync(root,{recursive:true,force:true}); }
});

it('measures caller staged paths in a fallback export with no repository', async () => {
  const root=mkdtempSync(join(tmpdir(),'commit-measure-fallback-'));
  try {
    mkdirSync(join(root,'lint'));
    mkdirSync(join(root,'scripts/normalize'),{recursive:true});
    writeFileSync(join(root,'lint/ratchet.json'),'{}');
    writeFileSync(join(root,'scripts/README.md'),'before');
    writeFileSync(join(root,'lint/ratchet.mjs'),`import{readFileSync,writeFileSync}from'node:fs';
const paths=JSON.parse(readFileSync(process.argv.at(-1),'utf8'));
if(JSON.stringify(paths)!=='["src/staged.ts"]')throw Error('wrong staged paths');
writeFileSync('lint/ratchet.json','{"measured":true}');`);
    writeFileSync(join(root,'scripts/normalize/liveness.mjs'),`import{writeFileSync}from'node:fs';writeFileSync('scripts/README.md','after');`);
    await expect(refreshCommitMeasurements(root,undefined)).rejects.toThrow('caller staged paths');
    expect(await refreshCommitMeasurements(root,['src/staged.ts','scripts/other.mjs'])).toEqual(['lint/ratchet.json']);
    expect(await refreshCommitMeasurements(root,['src/staged.ts'])).toEqual([]);
  } finally {rmSync(root,{recursive:true,force:true});}
});


it('refuses stale map-only landings and independently replaced raster pixels', async () => {
  const root = mkdtempSync(join(tmpdir(), 'committed-map-')), slug = 'far-reach';
  const dir = join(root, 'src/shards', slug), image = join(root, 'public/assets', slug, 'map/top.webp');
  try {
    mkdirSync(join(dir, 'look'), { recursive: true }); mkdirSync(join(root, 'public/assets', slug, 'map'), { recursive: true });
    writeFileSync(join(dir, 'shard.config.ts'), 'world-before');
    copyFileSync('public/assets/far-reach/map/top.webp', image);
    const stamp = { tilesHash: mapTilesHash(dir), pixelHash: await mapPixelHash(image) };
    const file = `src/shards/${slug}/look/map.baked.json`;
    writeFileSync(join(root, file), JSON.stringify(stamp));
    expect(await regenerateCheapBakes(root, { stagedPaths: [file] })).toEqual([]);
    writeFileSync(join(dir, 'shard.config.ts'), 'world-after');
    await expect(regenerateCheapBakes(root, { stagedPaths: [file] })).rejects.toThrow('committed map is stale');
    writeFileSync(join(dir, 'shard.config.ts'), 'world-before');
    copyFileSync('public/assets/sunscar-dunes/map/top.webp', image);
    await expect(regenerateCheapBakes(root, { stagedPaths: [`public/assets/${slug}/map/top.webp`] })).rejects.toThrow('decoded pixels differ');
    copyFileSync('public/assets/far-reach/map/top.webp', image);
    mkdirSync(join(dir, 'data')); writeFileSync(join(dir, 'data/productMap.json'), '{}');
    await expect(regenerateCheapBakes(root, { stagedPaths: [file] })).rejects.toThrow('product map differs');
  } finally { rmSync(root, { recursive: true, force: true }); }
});


it('refuses a map stamp whose real product emission misses the committed root pin', async () => {
  const root = mkdtempSync(join(tmpdir(), 'map-product-pin-')), slug = 'far-reach';
  const dir = join(root, 'src/shards', slug), image = join(root, 'public/assets', slug, 'map/top.webp');
  const stampPath = `src/shards/${slug}/look/map.baked.json`, entry = `src/shards/${slug}/generators/product.mjs`;
  const output = `src/shards/${slug}/.wildshard/product/shard.json`;
  const put = (file: string, data: string): void => { mkdirSync(dirname(join(root,file)), {recursive:true}); writeFileSync(join(root,file),data); };
  const hash = (data: string): string => createHash('sha256').update(data).digest('hex');
  const comparisons: Record<string,string> = {[output]:'0'.repeat(64)};
  const job = {id:'sample-product',shard:slug,entry,command:[entry],inputRoots:['package.json',stampPath,entry],outputs:[output],platform:'portable',comparisonOutputs:comparisons};
  const catalogue = (): void => put('scripts/generation-jobs.json', JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT',jobs:[job]}));
  try {
    put('package.json','{"name":"fixture"}');
    mkdirSync(join(root,'node_modules'));
    symlinkSync(join(process.cwd(),'node_modules/valibot'),join(root,'node_modules/valibot'));
    put('src/shards/far-reach/shard.config.ts','immutable world');
    put(entry, `import{readFileSync,writeFileSync}from'node:fs';const map=JSON.parse(readFileSync('${stampPath}','utf8'));writeFileSync('${output}',JSON.stringify({map}));`);
    mkdirSync(dirname(image), {recursive:true}); copyFileSync('public/assets/far-reach/map/top.webp',image);
    const stamp = {tilesHash:mapTilesHash(dir),pixelHash:await mapPixelHash(image)};
    put(stampPath,JSON.stringify(stamp));
    delete job.comparisonOutputs[output]; catalogue();
    await expect(regenerateCheapBakes(root,{stagedPaths:[stampPath]})).rejects.toThrow('one registered root pin');
    job.comparisonOutputs[output]='0'.repeat(64); catalogue();
    await expect(regenerateCheapBakes(root,{stagedPaths:[stampPath]})).rejects.toThrow('Comparison output hash differs');
    expect(existsSync(join(root,output))).toBe(false);
    job.comparisonOutputs[output]=hash(JSON.stringify({map:stamp})); catalogue();
    const retainedCatalogue=readFileSync(join(root,'scripts/generation-jobs.json'),'utf8');
    expect(await regenerateCheapBakes(root,{stagedPaths:[stampPath]})).toEqual([]);
    expect(existsSync(join(root,output))).toBe(false);
    // A stale ignored product is neither evidence nor a historical baseline.
    put(output,'{"unrelated":"old ignored output"}');
    expect(await regenerateCheapBakes(root,{stagedPaths:[stampPath]})).toEqual([]);
    expect(readFileSync(join(root,output),'utf8')).toBe('{"unrelated":"old ignored output"}');
    expect(readFileSync(join(root,'scripts/generation-jobs.json'),'utf8')).toBe(retainedCatalogue);
    // A failed producer cannot become admission merely because a pin exists.
    put(entry,"throw Error('product emission refused');");
    put(stampPath,JSON.stringify({...stamp,tilesHash:mapTilesHash(dir)}));
    await expect(regenerateCheapBakes(root,{stagedPaths:[stampPath]})).rejects.toThrow('Generator exited');
    expect(readFileSync(join(root,output),'utf8')).toBe('{"unrelated":"old ignored output"}');
  } finally {rmSync(root,{recursive:true,force:true});}
});


it('checks only touched map inputs, including additions, deletions, settings and shared generated bytes', async () => {
  const root = mkdtempSync(join(tmpdir(), 'map-input-commit-'));
  const far = 'far-reach', signal = 'sunscar-dunes', shared = 'public/assets/shared/terrain.bin';
  const put = (file: string, data: string): void => { mkdirSync(dirname(join(root,file)), {recursive:true}); writeFileSync(join(root,file),data); };
  const settings = {why:'Exact fixture roots',inputs:['world','data/crownInstances.generated.json',`../../../${shared}`]};
  const stampPath = (slug: string): string => `src/shards/${slug}/look/map.baked.json`;
  const dir = (slug: string): string => join(root,'src/shards',slug);
  const stamp = async (slug: string): Promise<void> => put(stampPath(slug),JSON.stringify({tilesHash:mapTilesHash(dir(slug)),pixelHash:await mapPixelHash(join(root,'public/assets',slug,'map/top.webp'))}));
  const check = (file: string): Promise<string[]> => regenerateCheapBakes(root,{stagedPaths:[file]});
  const world = `src/shards/${far}/world/original.ts`, added = `src/shards/${far}/world/added.ts`;
  try {
    put(shared,'original shared bytes'); put(world,'original world');
    for (const slug of [far,signal]) {
      put(`src/shards/${slug}/shard.config.ts`,'immutable fixture config');
      put(`src/shards/${slug}/look/map.json`,JSON.stringify(slug===far ? settings : {why:'Shared fixture input',inputs:[`../../../${shared}`]}));
      const image=join(root,'public/assets',slug,'map/top.webp'); mkdirSync(dirname(image),{recursive:true});
      copyFileSync(`public/assets/${slug}/map/top.webp`,image); await stamp(slug);
    }
    const oldStamp=readFileSync(join(root,stampPath(far)),'utf8'), oldImage=readFileSync(join(root,'public/assets',far,'map/top.webp'));
    put(world,'changed world');
    // An unrelated commit must not adopt pre-existing foreign map debt.
    expect(await check(`src/shards/${far}/README.md`)).toEqual([]);
    await expect(check(world)).rejects.toThrow(`${far}: committed map is stale`);
    expect(readFileSync(join(root,stampPath(far)),'utf8')).toBe(oldStamp);
    expect(readFileSync(join(root,'public/assets',far,'map/top.webp'))).toEqual(oldImage);
    put(world,'original world'); put(added,'new world input');
    await expect(check(added)).rejects.toThrow('committed map is stale'); rmSync(join(root,added));
    rmSync(join(root,world)); await expect(check(world)).rejects.toThrow('committed map is stale'); put(world,'original world');
    const mapSettingsPath=`src/shards/${far}/look/map.json`, generated=`src/shards/${far}/data/crownInstances.generated.json`;
    put(mapSettingsPath,JSON.stringify({...settings,hide:['new map exclusion']}));
    await expect(check(mapSettingsPath)).rejects.toThrow('committed map is stale'); await stamp(far);
    put(generated,'[{"instance":1}]');
    await expect(check(generated)).rejects.toThrow('committed map is stale'); await stamp(far);
    expect(await check(generated)).toEqual([]);
    // The same declared input can affect multiple shards, outside either folder.
    put(shared,'changed shared bytes');
    await expect(check(shared)).rejects.toThrow(`${far}: committed map is stale`); await stamp(far);
    await expect(check(shared)).rejects.toThrow(`${signal}: committed map is stale`); await stamp(signal);
    expect(await check(shared)).toEqual([]);
  } finally {rmSync(root,{recursive:true,force:true});}
});
