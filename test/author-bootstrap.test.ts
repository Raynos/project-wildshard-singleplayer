// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures own only their disposable author projects.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Every bootstrap test uses an isolated temporary directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures inspect their own retained inputs.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { bootstrapAuthor } from '../scripts/docs/author-project/bootstrap.mjs';

it('bootstraps retained TS generators without replacing installed dependencies or authored inputs', () => {
  const root = mkdtempSync(join(tmpdir(), 'author-bootstrap-'));
  const installed = { name: 'my-outpost', dependencies: { '@wildshard/sdk': 'file:sdk.tgz', '@wildshard/format': 'file:format.tgz', '@wildshard/commons': 'file:commons.tgz', three: '0.186.0' }, scripts: { mine: 'echo retained' } };
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify(installed));
    bootstrapAuthor(root);
    const manifest: unknown = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(manifest).toMatchObject({ ...installed, private: true, type: 'module', scripts: { ...installed.scripts, generate: 'node --experimental-strip-types generate.ts', synth: 'wildshard synth .' } });
    expect(readFileSync(join(root, 'generators/world.ts'), 'utf8')).toContain('new Mesh(new BoxGeometry');
    expect(readFileSync(join(root, 'shard.config.ts'), 'utf8')).toContain('createCatalogue');
    expect(readFileSync(join(root, 'prove-mesa.ts'), 'utf8')).toContain('proveMesaOutpost');
    expect(readFileSync(join(root, 'prove-native.ts'), 'utf8')).toContain('validateSimulation(shard, assets)');
    expect(readFileSync(join(root, 'proof.config.mjs'), 'utf8')).toContain("entryFileNames: '[name].mjs'");
    const before = readFileSync(join(root, 'shard.config.ts'));
    expect(() => bootstrapAuthor(root)).toThrow('Refusing to replace');
    expect(readFileSync(join(root, 'shard.config.ts'))).toEqual(before);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses missing installed packages before copying any author inputs', () => {
  const root = mkdtempSync(join(tmpdir(), 'author-bootstrap-refusal-'));
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { '@wildshard/sdk': 'file:sdk.tgz' } }));
    expect(() => bootstrapAuthor(root)).toThrow('@wildshard/format');
    expect(existsSync(join(root, 'data'))).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
