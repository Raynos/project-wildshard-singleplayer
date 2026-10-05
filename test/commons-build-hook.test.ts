// oxlint-disable-next-line import/no-nodejs-modules -- Own temporary SDK author projects and their products.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary author project ownership.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture project and workspace dependencies.
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { buildProject, contentHash } from '../src/sdk/project';

it('compiles build-only packs once into deterministic hash-named product bytes without commons runtime code', async () => {
  const root = mkdtempSync(join(tmpdir(), 'commons-hook-'));
  try {
    const project = join(root, 'project'); mkdirSync(project); symlinkSync(resolve('node_modules'), join(project, 'node_modules'));
    writeFileSync(join(project, 'shard.config.ts'), `import {emptyShardfile} from '@wildshard/sdk/author';
import {createCatalogue} from '@wildshard/commons/catalogue';
import {commonsRequirements} from '@wildshard/sdk/commons';
export const commons=createCatalogue([{id:'bridges',version:'1.0.0',entries:[
{id:'deck',kind:'binary',bytes:new Uint8Array([1,2,3]),credit:'Fixture',licence:'CC0-1.0'},
{id:'alias',kind:'binary',bytes:new Uint8Array([1,2,3]),credit:'Fixture',licence:'CC0-1.0'},
{id:'unused',kind:'binary',bytes:new Uint8Array([9]),credit:'Fixture',licence:'CC0-1.0'}]}]);
const shard=emptyShardfile({slug:'hook-test',name:'Hook',author:'Fixture',seed:1,revision:1});
shard.requires={...shard.requires,...commonsRequirements(commons,['bridges/deck','bridges/alias'])};
shard.library=shard.requires.commons.map(hash=>'commons:'+hash);
export default shard;
`);
    const first = await buildProject(project, join(root, 'one'), { client: null }), second = await buildProject(project, join(root, 'two'), { client: null });
    const hash = contentHash(new Uint8Array([1, 2, 3]));
    expect(first.requires.commons).toEqual([hash]); expect(first.requires.commonsCosts[hash]?.decoded).toBe(3);
    expect(first).toEqual(second); expect(readFileSync(join(root, 'one/shard.json'))).toEqual(readFileSync(join(root, 'two/shard.json')));
    expect(readdirSync(join(root, 'one')).sort()).toEqual([hash, 'shard.json'].sort());
    expect([...readFileSync(join(root, 'one', hash))]).toEqual([1, 2, 3]);
    const config = readFileSync(join(project, 'shard.config.ts'), 'utf8').replace('export const commons=', 'const commons=');
    for (const [label, assets] of [['missing', 'new Map()'], ['changed', `new Map([['${hash}',new Uint8Array([3,2,1])]])`]] as const) {
      writeFileSync(join(project, 'shard.config.ts'), `${config}\nexport {commons as original};\nexport const commonsPinned={...commons,assets:${assets}};\nexport {commonsPinned as commons};\n`);
      const output = join(root, label);
      await expect(buildProject(project, output, { client: null })).rejects.toThrow('Pinned commons export misses or changes a required asset');
      expect(existsSync(output)).toBe(false);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 30_000);
