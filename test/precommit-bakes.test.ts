// oxlint-disable-next-line import/no-nodejs-modules -- Locate the installed fixture dependency without browser globals.
import process from 'node:process';
import { expect, it } from 'vitest';
import { NATIVE_BAKES, nativeBakePlan, regenerateCheapBakes, refreshRecordedCommitInputs, refreshCommitMeasurements } from '../scripts/precommit-bakes.mjs';
// oxlint-disable-next-line import/no-nodejs-modules -- Measure fixture input maps using the shipping digest law.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Own all fixture files and remove them in finally.
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Place producer fixtures outside the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only fixture-owned directories.
import { join } from 'node:path';

it('skips exact inputs and rebakes every affected shard plus spots when a shared input changes', async () => {
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
    expect(outputs).toHaveLength(8);
    expect(await nativeBakePlan(root)).toEqual([]);
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
    expect(await refreshCommitMeasurements(root,['src/staged.ts','scripts/other.mjs'])).toEqual(['lint/ratchet.json','scripts/README.md']);
    expect(await refreshCommitMeasurements(root,['src/staged.ts'])).toEqual([]);
  } finally {rmSync(root,{recursive:true,force:true});}
});
