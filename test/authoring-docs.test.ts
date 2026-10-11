// oxlint-disable-next-line import/no-nodejs-modules -- Documentation tests own temporary compiler/synth fixtures and read retained authored inputs.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Disposable example projects are isolated from shipped source.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve exact compiler/example input paths.
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { apiSurface, pages, type ApiSurface } from '../scripts/gen-api.mjs';
import { authoringApiCoverage, authoringExamples, authoringGuide, checkAuthoringExamples } from '../scripts/docs/authoring-reference.mjs';
import { sceneExample } from '../scripts/docs/authoring/scene';
import { synthExample } from '../scripts/docs/authoring/synth';
import { formatExample } from '../scripts/docs/authoring/format';
import { directorsExample } from '../scripts/docs/authoring/directors';
import { directorScriptExample } from '../scripts/docs/authoring/director-script';
import { moversExample } from '../scripts/docs/authoring/movers';
import { modesExample } from '../scripts/docs/authoring/modes';
import { weaponsExample } from '../scripts/docs/authoring/weapons';
import { brainsExample } from '../scripts/docs/authoring/brains';
import { commonsExample } from '../scripts/docs/authoring/commons';
import { readersExample } from '../scripts/docs/authoring/readers';
import { weaponFamilyExample } from '../scripts/docs/authoring/weapon-family';
import { declaredKitItemFamilies } from '@wildshard/game/plugin/weaponFamily';
import { parseDirectorStages } from '@wildshard/format/directorStages';

const examples = {
  scene: sceneExample, synth: synthExample, format: formatExample, directors: directorsExample,
  'director-script': directorScriptExample, movers: moversExample, modes: modesExample,
  weapons: weaponsExample, brains: brainsExample, commons: commonsExample, readers: readersExample,
  'weapon-family': weaponFamilyExample,
};

it('renders every retained example exactly once, with semantic compilation and an executable test binding', () => {
  const sources = authoringExamples(), guide = authoringGuide();
  expect(sources.map(row => row.name).sort()).toEqual(Object.keys(examples).sort());
  for (const row of sources) expect(guide).toContain(`\`\`\`ts\n${row.source.trimEnd()}\n\`\`\``);
  expect(checkAuthoringExamples(resolve('.'))).toEqual([]);
});

it('refuses a broken typed example instead of treating syntax transpilation as compilation', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'authoring-broken-'));
  try {
    const file = resolve(root, 'bad.ts'); writeFileSync(file, 'export const count: number = "wrong";');
    expect(checkAuthoringExamples(resolve('.'), [file])).toEqual([expect.stringContaining("Type 'string' is not assignable to type 'number'")]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses missing, duplicated, orphaned and unchecked inline guide examples', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'authoring-coverage-'));
  const guide = resolve(root, 'authoring-guide.md');
  try {
    mkdirSync(resolve(root, 'authoring'));
    writeFileSync(resolve(root, 'authoring', 'one.ts'), 'export const count = 1;');
    writeFileSync(guide, '<!-- example: one -->');
    expect(authoringExamples(root).map(row => row.name)).toEqual(['one']);
    for (const text of ['<!-- example: missing -->', '<!-- example: one -->\n<!-- example: one -->', '', '```ts\nconst unchecked = 1;\n```']) {
      writeFileSync(guide, text);
      expect(() => authoringExamples(root)).toThrow();
    }
    writeFileSync(guide, '<!-- example: one -->');
    writeFileSync(resolve(root, 'authoring', 'orphan.ts'), 'export const count = 2;');
    expect(() => authoringExamples(root)).toThrow('coverage differs');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

describe('public SDK and format documentation', () => {
  let surface: ApiSurface;
  beforeAll(() => { surface = apiSurface(); });
  it('documents every exported binding and forbids empty doc entries, with zero debt allowance', () => {
    const result = authoringApiCoverage(surface, pages(surface));
    expect(result.failures).toEqual([]);
    for (const layer of ['sdk', 'format']) expect(result.coverage[layer]?.documented).toBe(result.coverage[layer]?.total);
  });
  it('fails missing entries, duplicate entries and a new export with no source documentation', () => {
    const documents = pages(surface), page = documents['docs/api/FORMAT.md'];
    if (page === undefined) throw new Error('Missing format guide');
    const entry = page.split('\n').find(line => line.startsWith('| `'));
    if (entry === undefined) throw new Error('Missing format entry');
    expect(authoringApiCoverage(surface, { ...documents, 'docs/api/FORMAT.md': page.replace(entry, '') }).failures).toContainEqual(expect.stringContaining('Undocumented public binding'));
    expect(authoringApiCoverage(surface, { ...documents, 'docs/api/FORMAT.md': `${page}\n${entry}\n` }).failures).toContainEqual(expect.stringContaining('Duplicate documentation'));
    const sdk = surface.indexes['sdk']; if (sdk === undefined) throw new Error('Missing SDK inventory');
    const added = { ...surface, indexes: { ...surface.indexes, sdk: [...sdk, { name: 'newBinding', from: '@wildshard/sdk/newModule', kind: 'const', doc: '' }] } };
    expect(authoringApiCoverage(added, pages(added)).failures).toContain('Undocumented public binding: @wildshard/sdk/newModule#newBinding');
  });
});

it('transports the Template-style graph exactly, including four entries and real floor collision', () => {
  const { data, restored } = sceneExample();
  expect(restored.nodes).toEqual(data.nodes);
  expect(restored.geometries).toEqual(data.geometries);
  expect(restored.materials).toEqual(data.materials);
  expect(data.entries).toHaveLength(4);
  expect(data.colliders).toHaveLength(1);
});

it('publishes canonical synth bytes and an immutable copy without manufacturing a product', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'authoring-synth-'));
  try {
    const a = synthExample(root), b = synthExample(root);
    expect(b.hash).toBe(a.hash);
    expect(readFileSync(a.path)).toEqual(readFileSync(resolve(root, '.wildshard/cache/template-pilot', a.hash, 'scene.json')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('validates format data, actual Template stages and every documented action, refusing invalid when references', () => {
  expect(formatExample().schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
  const { row, assemblyScript } = directorsExample();
  expect(row.stages.map(stage => stage.id)).toEqual(['door', 'wave', 'complete']);
  expect(assemblyScript).toContain('static get doorOpen(): bool');
  const actions = [{ spawn: 'template.wave' }, { despawn: 'template.wave' }, { flag: { key: 'template.wave-started', value: true } },
    { score: 'template.score' }, { weather: 'template.clear' }, { toast: 'template.tip' }, { reward: 'template.reward' }, { emit: 'template.wave', value: 1 }];
  expect(parseDirectorStages({ ...row, stages: [{ id: 'door', do: actions }, { id: 'wave', when: 'doorOpen && !waveDead' }] }).stages[0]?.do).toEqual(actions);
  expect(() => parseDirectorStages({ ...row, stages: [{ id: 'door' }, { id: 'bad', when: 'missingFlag' }] })).toThrow();
});

it('compiles the documented AssemblyScript against its actual generated inputs module', async () => {
  const compiled = await directorScriptExample();
  expect(WebAssembly.validate(Uint8Array.from(compiled.bytes).buffer)).toBe(true);
  expect(compiled.module).toMatch(/^[a-f0-9]{64}$/u);
});

it('lowers real door clip keys and a clip-free pendulum into admitted mover data', () => {
  const row = moversExample();
  expect(row.door.track?.position).toEqual([[0, 0, 0], [0, 3, 0]]);
  expect(row.door.trigger).toEqual({ kind: 'interact', permission: 0 });
  expect(row.pendulum.driver).toEqual({ kind: 'pendulum', axis: 'z', amplitude: 0.4, period: 3 });
});

it('admits all four authored mode profiles without a mount or grapple target grant', () => {
  const { rows, scene } = modesExample();
  expect(rows.traverse.map(row => row.kind)).toEqual(['zipline', 'updraft']);
  expect(rows.ride).toHaveLength(1); expect(rows.grapple).toHaveLength(1);
  expect(scene.nodes.map(node => node.name)).toEqual(expect.arrayContaining(['template.cable', 'template.wind', 'template.ride', 'template.grapple']));
});

it('admits all four numeric weapon profiles and the real Template pursuit/held-boss examples', () => {
  expect(weaponsExample().map(row => row.family)).toEqual(['melee', 'bow', 'firearm', 'thrown']);
  const row = brainsExample(); expect(row.creatures.spawns[0]?.brain).toBe('blob-pursuit');
  expect(row.boss.pattern).toBe('held');
});

it('resolves both products to the same immutable commons bytes and actual costs', () => {
  const row = commonsExample();
  expect(row.first).toEqual(row.second);
  expect(row.ref).toBe(`commons:${row.first.commons[0]}`);
  expect(row.built.assets.get(row.first.commons[0] ?? '')?.length).toBe(row.first.commonsWire[row.first.commons[0] ?? '']);
});

it('reads a real retained skin and writes/reads its original RGBA pixels exactly in Node', async () => {
  const glb = Uint8Array.from(readFileSync(new URL('../public/assets/pine-hollow/creatures/boar.phone.rigged.glb', import.meta.url)));
  const animationGlb = Uint8Array.from(readFileSync(new URL('../public/assets/models/driftwood-fp/fp-arms.glb', import.meta.url)));
  const row = await readersExample(glb, animationGlb);
  expect(row.bones.length).toBeGreaterThan(0); expect(row.clips.length).toBeGreaterThan(0);
  expect(row.decoded).toEqual(row.image);
});

it('registers an existing runtime family without allocation and rejects duplicate registration', () => {
  const family = declaredKitItemFamilies().get('kit.melee');
  if (family === undefined) throw new Error('Missing existing melee family');
  const registry = weaponFamilyExample(new Map(), family);
  expect(registry.get('template.practice')).toBe(family);
  expect(() => weaponFamilyExample(registry, family)).toThrow('Duplicate weapon family');
});
