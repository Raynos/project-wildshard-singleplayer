// oxlint-disable-next-line import/no-nodejs-modules -- The fixture owns two complete author projects and their emitted products.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolate the author projects from shipped sources.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the committed recordings and temporary project files.
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { scoreStingsPack } from '@wildshard/commons/packs/sounds';
import { createCatalogue } from '../src/commons/catalogue';
import { buildProject, contentHash } from '../src/sdk/project';
import folk from '../public/assets/music/folk/music.json' with { type: 'json' };

it('the real author compiler emits identical original sound hashes for two shard products, without runtime commons code', async () => {
  const root = mkdtempSync(join(tmpdir(), 'commons-score-')), sourceDir = resolve('public/assets/music/folk');
  const catalogue = createCatalogue([await scoreStingsPack('folk', folk, file => Promise.resolve(readFileSync(join(sourceDir, file))),
    { credit: folk.credit, licence: 'MiniMax-Music3 Community' })]);
  try {
    const products = [];
    for (const slug of ['driftwood-isle', 'pine-hollow']) {
      const project = join(root, slug); mkdirSync(project); symlinkSync(resolve('node_modules'), join(project, 'node_modules'));
      // This retained TypeScript is the source of the product, including its actual shared pack generator.
      writeFileSync(join(project, 'shard.config.ts'), `import {readFileSync} from 'node:fs';
import {emptyShardfile} from '@wildshard/sdk/author';
import {commonsRequirements} from '@wildshard/sdk/commons';
import {createCatalogue} from '@wildshard/commons/catalogue';
import {scoreStingsPack} from '@wildshard/commons/packs/sounds';
const source=${JSON.stringify(folk)};
export const commons=createCatalogue([await scoreStingsPack('folk',source,
file=>Promise.resolve(readFileSync(${JSON.stringify(sourceDir)}+'/'+file)),
{credit:source.credit,licence:'MiniMax-Music3 Community'})]);
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

it('owns reader Buffers instead of retaining their shared slice views', async () => {
  const source = readFileSync(resolve('public/assets/music/folk', folk.stings.pickup)), expected = Uint8Array.from(source);
  const pack = await scoreStingsPack('folk', folk, () => Promise.resolve(source), { credit: folk.credit, licence: 'MiniMax-Music3 Community' });
  const built = createCatalogue([{ id: 'borrowed-score', version: '1.0.0', entries: [{ id: 'pickup', kind: 'audio', bytes: source,
    credit: folk.credit, licence: 'MiniMax-Music3 Community' }] }]);
  source.fill(0);
  expect(pack.entries[0]?.bytes).toEqual(expected);
  expect(built.assets.get(contentHash(expected))).toEqual(expected);
});
