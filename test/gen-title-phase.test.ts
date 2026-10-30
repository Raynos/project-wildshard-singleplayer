// oxlint-disable-next-line import/no-nodejs-modules -- Every generated input/output belongs to an isolated fixture.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths stay beneath repository tmp.
import { dirname, resolve } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { genShardInputs, genShards } from '../scripts/gen-shards.mjs';

const owned: string[] = [];
afterEach(() => { for (const root of owned.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture(): { root: string; write: (path: string, source: string) => void; boot: () => void } {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/gen-title-phase-')); owned.push(root);
  const write = (path: string, source: string): void => {
    const file = resolve(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, source);
  };
  write('tsconfig.json', JSON.stringify({ compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler' }, include: ['src'] }));
  write('src/shards/island/manifest.ts', "import '../../game/boot/late.generated'; export default {slug:'island',name:'Island'};");
  write('scripts/bake-loader.mjs', '// The title child needs no transforms for this plain-JS fixture.');
  write('scripts/title-catalogue.mjs', String.raw`
    import {appendFileSync,existsSync} from 'node:fs';
    if(!existsSync('boot-ready'))throw new Error('Title ran before boot');
    appendFileSync('title-calls','once\n');
    process.stdout.write('TITLE-CATALOGUE '+JSON.stringify('import image from "/src/shards/island/card.webp";\nexport const TITLE_MANIFESTS=[{slug:"island",card:image}];\n')+'\n');
    process.stdout.write('TITLE-SELECTION '+JSON.stringify('export const LEGACY_CONTENT_IDENTITIES={};\nexport const SHARD_LOADERS={"island":()=>import("/src/shards/island/manifest.ts")};\n')+'\n');
  `);
  return { root, write, boot: () => {
    write('src/game/boot/late.generated.ts', 'export const ready=true;'); write('boot-ready', 'ready');
  } };
}

test('boot inputs defer title publication, then final generation retains the complete closure and output bytes', () => {
  const staged = fixture();
  genShardInputs(staged.root);
  expect(existsSync(resolve(staged.root, 'src/shards.generated.ts'))).toBe(true);
  expect(existsSync(resolve(staged.root, 'title-calls'))).toBe(false);
  expect(existsSync(resolve(staged.root, 'out/.app/titleCatalogue.generated.ts'))).toBe(false);
  staged.boot(); genShards(staged.root);
  expect(readFileSync(resolve(staged.root, 'title-calls'), 'utf8')).toBe('once\n');
  const closure = JSON.parse(readFileSync(resolve(staged.root, 'src/game/shard/manifest-closure.generated.json'), 'utf8')) as Record<string, string[]>;
  expect(closure['island']).toContain('src/game/boot/late.generated.ts');
  const direct = fixture(); direct.boot(); genShards(direct.root);
  for (const path of ['src/shards.generated.ts', 'src/game/shard/slugs.generated.ts',
    'src/game/shard/manifest-closure.generated.json', 'out/.app/titleCatalogue.generated.ts', 'out/.app/shardSelection.generated.ts']) {
    expect(readFileSync(resolve(staged.root, path), 'utf8')).toBe(readFileSync(resolve(direct.root, path), 'utf8'));
  }
  staged.write('out/.app/titleCatalogue.generated.ts', 'corrupt title');
  expect(() => genShards(staged.root, true)).toThrow('stale out/.app/titleCatalogue.generated.ts');
});

test('the standalone full generator still runs and propagates its title failure', () => {
  const source = fixture();
  expect(() => genShards(source.root)).toThrow('Title ran before boot');
  expect(existsSync(resolve(source.root, 'title-calls'))).toBe(false);
});
