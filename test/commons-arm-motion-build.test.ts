// oxlint-disable-next-line import/no-nodejs-modules -- Use the same Node executable for the retained generator.
import process from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Run the retained real pack generator before the pure bundled config.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture owns two complete author projects and their emitted products.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolate the author projects from shipped sources.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the committed recordings and temporary project files.
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { starterArmMotionPack } from '@wildshard/commons/packs/arms';
import { createCatalogue } from '../src/commons/catalogue';
import { buildProject } from '../src/sdk/project';

it('the real author compiler emits identical original arm motion hashes for two shard products, without runtime commons code', async () => {
  const root = mkdtempSync(join(tmpdir(), 'commons-arm-motion-')), sourceFile = resolve('public/assets/nine-dragon/viewmodel/fp-rig.glb');
  const catalogue = createCatalogue([await starterArmMotionPack(readFileSync(sourceFile), { credit: 'Wildshard', licence: 'First-party' })]);
  try {
    const products = [];
    for (const slug of ['driftwood-isle', 'nine-dragon-stack']) {
      const project = join(root, slug); mkdirSync(project); symlinkSync(resolve('node_modules'), join(project, 'node_modules'));
      // Retained generation owns filesystem access; the bundled config imports only its pinned metadata.
      writeFileSync(join(project, 'generate.mjs'), `import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {commonsRequirements} from '@wildshard/sdk/commons';
import {createCatalogue} from '@wildshard/commons/catalogue';
import {starterArmMotionPack} from '@wildshard/commons/packs/arms';
const commons=createCatalogue([await starterArmMotionPack(readFileSync(${JSON.stringify(sourceFile)}),
{credit:'Wildshard',licence:'First-party'})]);
mkdirSync('commons',{recursive:true});mkdirSync('data',{recursive:true});
for(const [hash,bytes] of commons.assets)writeFileSync('commons/'+hash,bytes);
writeFileSync('data/commons-requirements.json',JSON.stringify(commonsRequirements(commons,commons.catalogue.entries.map(row=>row.id))));
`);
      execFileSync(process.execPath, ['--experimental-transform-types', '--import', resolve('scripts/sim-node-loader.mjs'), join(project, 'generate.mjs')], { cwd: project, stdio: 'pipe' });
      writeFileSync(join(project, 'shard.config.ts'), `import {emptyShardfile} from '@wildshard/sdk/author';
import requirements from './data/commons-requirements.json' with {type:'json'};
const shard=emptyShardfile({slug:${JSON.stringify(slug)},name:${JSON.stringify(slug)},author:'Wildshard',seed:1,revision:1});
shard.requires={...shard.requires,...requirements};
shard.library=shard.requires.commons.map(hash=>'commons:'+hash);
export default shard;
`);
      const output = join(project, 'product'), source = await buildProject(project, output, { client: null }); products.push(source);
      expect(readdirSync(output).sort()).toEqual([...catalogue.assets.keys(), 'shard.json', 'validation.json'].sort());
      for (const [hash, bytes] of catalogue.assets) expect(Uint8Array.from(readFileSync(join(output, hash)))).toEqual(bytes);
      const receipt: unknown = JSON.parse(readFileSync(join(output, 'validation.json'), 'utf8'));
      expect(receipt).toHaveProperty('sourceHash');
    }
    expect(products[0]?.requires).toEqual(products[1]?.requires);
    expect(products[0]?.requires.commonsCosts).toEqual(Object.fromEntries(catalogue.catalogue.entries.map(row => [row.hash, row.cost])));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
