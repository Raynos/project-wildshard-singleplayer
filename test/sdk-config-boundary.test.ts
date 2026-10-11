// oxlint-disable-next-line import/no-nodejs-modules -- The test owns its disposable author project.
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Disposable fixture root.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Absolute fixture paths.
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { canonicalJson, readProject } from '../src/sdk/project';
import { synthProject } from '../src/sdk/synth';
import { compileBehaviourModule } from '../src/sdk/buildBehaviour';
import { generateScriptModule } from '../src/sdk/directorAbi';

const declaration = () => emptyShardfile({ slug: 'config-boundary', name: 'Config boundary', author: 'Fixture', revision: 1, seed: 1 });
it.each(['node:fs', 'node:fs/promises'])('diagnoses config file writes before they execute: %s', async name => {
  const root = mkdtempSync(join(tmpdir(), 'config-boundary-')), marker = join(root, 'marker');
  try {
    writeFileSync(join(root, 'shard.config.ts'), `import * as files from '${name}'; await files.writeFile${name.endsWith('promises') ? '' : 'Sync'}(${JSON.stringify(marker)}, 'wrong'); export default ${canonicalJson(declaration())};`);
    await expect(readProject(root)).rejects.toThrow('belong in generate.ts before config loads');
    await expect(synthProject(root)).rejects.toThrow('belong in generate.ts before config loads');
    expect(existsSync(marker)).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
it('diagnoses compiler use in bundled config rather than a data-URL resolution failure', async () => {
  const root = mkdtempSync(join(tmpdir(), 'config-compiler-'));
  try {
    const compiler = resolve('src/sdk/compileScript.ts');
    writeFileSync(join(root, 'shard.config.ts'), `import { compileScript } from ${JSON.stringify(compiler)}; await compileScript(''); export default ${canonicalJson(declaration())};`);
    await expect(readProject(root)).rejects.toThrow('script compilation belong in generate.ts');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
it('loads generated JSON and compiled immutable assets after the Node generator finishes', async () => {
  const root = mkdtempSync(join(tmpdir(), 'config-generated-'));
  try {
    const source = declaration(), typed = generateScriptModule(source.state, ''), compiled = await compileBehaviourModule(typed.source, 1);
    mkdirSync(join(root, 'assets')); writeFileSync(join(root, 'assets', compiled.module), compiled.bytes);
    writeFileSync(join(root, 'generated.json'), JSON.stringify({ hash: compiled.module, bytes: compiled.bytes.length }));
    writeFileSync(join(root, 'shard.config.ts'), `import generated from './generated.json'; const declaration = ${canonicalJson(source)}; declaration.identity.revision = generated.bytes; export default declaration;`);
    const loaded = await readProject(root); expect(loaded.identity.revision).toBe(compiled.bytes.length);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
