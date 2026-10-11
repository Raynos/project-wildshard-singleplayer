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
      // This retained TypeScript is the source of the product, including its actual shared pack generator.
      writeFileSync(join(project, 'shard.config.ts'), `import {readFileSync} from 'node:fs';
import {emptyShardfile} from '@wildshard/sdk/author';
import {commonsRequirements} from '@wildshard/sdk/commons';
import {createCatalogue} from '@wildshard/commons/catalogue';
import {starterArmMotionPack} from '@wildshard/commons/packs/arms';
export const commons=createCatalogue([await starterArmMotionPack(readFileSync(${JSON.stringify(sourceFile)}),
{credit:'Wildshard',licence:'First-party'})]);
const shard=emptyShardfile({slug:${JSON.stringify(slug)},name:${JSON.stringify(slug)},author:'Wildshard',seed:1,revision:1});
shard.requires={...shard.requires,...commonsRequirements(commons,commons.catalogue.entries.map(row=>row.id))};
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
