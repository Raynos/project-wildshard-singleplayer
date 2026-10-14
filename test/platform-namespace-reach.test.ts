import { expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolated filesystem fixtures exercise the source census.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Each census fixture owns a temporary directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Construct confined fixture paths.
import { dirname, join } from 'node:path';
import { shardLines } from '../scripts/shard-platform.mjs';

function charges(loader: string, initialization = ''): string[] {
  const root = mkdtempSync(join(tmpdir(), 'platform-namespace-'));
  const put = (file: string, text: string): void => { const path = join(root, file); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); };
  try {
    put('src/game/package.json', JSON.stringify({ name: '@wildshard/game', exports: { './plugin/ui': './plugin/ui.ts', './model': './model.ts' } }));
    put('src/game/plugin/ui.ts', `export function forestHelper() { return 1; }\nexport function createAmbientLife() { return forestHelper(); }\nexport function borrowedNpcSpecimen() { return 2; }\n${initialization}`);
    put('src/game/model.ts', loader);
    put('src/shards/pine-hollow/runtime.ts', "import { createAmbientLife } from '@wildshard/game/plugin/ui'; export const life = createAmbientLife();");
    put('src/shards/driftwood-isle/runtime.ts', "import { modelCatalogue } from '@wildshard/game/model'; export const model = modelCatalogue;");
    const row = shardLines(root)['pine-hollow'];
    if (row === undefined) throw new Error('Pine measurement absent');
    return row.conversion.gameSystemAttribution.exports.filter(entry => entry.path === 'src/game/plugin/ui.ts').map(entry => entry.name);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('charges private bodies through named static and local dynamic namespace members', () => {
  for (const loader of [
    "import * as ui from './plugin/ui'; export function modelCatalogue() { return ui.borrowedNpcSpecimen(); }",
    "export async function modelCatalogue() { const renderer = await import('./plugin/ui'); return renderer.borrowedNpcSpecimen(); }",
    "export async function modelCatalogue() { const renderer = await import('./plugin/ui'); return renderer['borrowedNpcSpecimen'](); }",
    "export async function modelCatalogue() { const { borrowedNpcSpecimen: borrowed } = await import('./plugin/ui'); return borrowed(); }",
    "export async function modelCatalogue() { return (await import('./plugin/ui')).borrowedNpcSpecimen(); }",
  ]) expect(charges(loader)).toEqual(expect.arrayContaining(['createAmbientLife', 'forestHelper']));
});

it('conservatively reaches all exports when a namespace escapes or its member is unknown', () => {
  for (const body of [
    'return consume(renderer);', 'return {...renderer};', 'return renderer[key];', 'return renderer;',
  ]) expect(charges(`export async function modelCatalogue(consume, key) { const renderer = await import('./plugin/ui'); ${body} }`)).not.toContain('createAmbientLife');
});

it('keeps imported module initialization live without reaching every export', () => {
  const names = charges("export async function modelCatalogue() { const renderer = await import('./plugin/ui'); return 0; }", 'forestHelper();');
  expect(names).toContain('createAmbientLife');
  expect(names).not.toContain('forestHelper');
});

it('keeps an exported dynamic namespace conservative', () => {
  expect(charges("export const modelCatalogue = import('./plugin/ui');")).not.toContain('createAmbientLife');
});

it('keeps rest and unknown-key destructuring conservative', () => {
  for (const pattern of ['{...rest}', '{[key]: value}']) expect(charges(`export async function modelCatalogue(key) { const ${pattern} = await import('./plugin/ui'); }`)).not.toContain('createAmbientLife');
});

it('does not confuse an import promise with the resolved namespace', () => {
  expect(charges("export function modelCatalogue() { const pending = import('./plugin/ui'); return pending.then(module => module); }")).not.toContain('createAmbientLife');
  expect(charges("export function modelCatalogue() { return import('./plugin/ui').then(module => module); }")).not.toContain('createAmbientLife');
});
