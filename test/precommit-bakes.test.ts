import { expect, it } from 'vitest';
import { NATIVE_BAKES, nativeBakePlan, regenerateCheapBakes } from '../scripts/precommit-bakes.mjs';
// oxlint-disable-next-line import/no-nodejs-modules -- Measure fixture input maps using the shipping digest law.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Own all fixture files and remove them in finally.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
