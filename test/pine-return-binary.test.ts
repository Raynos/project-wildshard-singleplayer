// oxlint-disable-next-line import/no-nodejs-modules -- Compare the registered producer's original executable oracle.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { afterAll, expect, test, vi } from 'vitest';
import * as v from 'valibot';
import { Scope } from '../src/engine/app/scope';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost } from '../src/engine/sim';
import { HerdShelter } from '../src/game/population/shelter';
import { parsePopulationShelter } from '../src/format/herdShelter';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { ReturnProgramSchema } from '../src/format/namedJsonContracts';
import { ReturnModulesSchema } from '../src/format/scriptContract';
import { parseDecisionScripts } from '../src/format/decisionScripts';
import { outputPlatformPayloads } from '../src/sdk/outputProduct';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { prepareOutput } from '../src/shards/pine-hollow/generators/output';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { PINE_SHELTER_ORIGINAL } from './fixtures/pine-shelter';

const cache = mkdtempSync('tmp/pine-return-');
afterAll(() => rmSync(cache, { recursive: true, force: true }));
const context = createProjectGeneration('src/shards/pine-hollow',
  hashImmutableBytes(new TextEncoder().encode('pine-shelter-original-v1')), new Map(), cache);
const output = await prepareOutput(context);

function originalProgram(name: string) {
  const original = v.parse(ReturnProgramSchema, JSON.parse(readFileSync(`src/shards/pine-hollow/behaviour/${name}.generated.json`, 'utf8')));
  const script = parseDecisionScripts([original.script])[0];
  if (script === undefined) throw new Error(`Missing original Pine ${name} script`);
  return { script, bytes: original.bytes };
}
const life = originalProgram('life'), shelter = PINE_SHELTER_ORIGINAL;

function namedJson(name: string): unknown {
  const file = output.namedFiles.find(row => row.name === name);
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (bytes === undefined) throw new Error(`Missing original Pine output ${name}`);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
const programPage = v.object({ program: ReturnProgramSchema });
const cases = [
  { name: 'actors/page-life.json', wasm: 'behaviour/pine.life.wasm', original: life, size: 9133,
    hash: '260eee8839d76af399fadc27a383c92ef8f75a0bbab154bce727d973d24e3594' },
  { name: 'actors/shelter.json', wasm: 'behaviour/pine.shelter.wasm', original: shelter, size: 6664,
    hash: '6005b3f6c02dc65ada9cf9b0a754dad73c44ecebb00e0df13ebc9b5957ce7316' },
];
function admittedRows() {
  return v.parse(ReturnModulesSchema, outputPlatformPayloads(output.platform, ['actors/return-scripts']).get('actors/return-scripts'));
}

test('Pine life, shelter and both quest copies publish descriptors with only admitted binary modules', () => {
  const rows = admittedRows();
  for (const row of cases) {
    const raw = v.parse(programPage, namedJson(row.name)).program;
    expect(raw).toEqual({ script: row.original.script, bytes: '' });
    expect(rows).toContainEqual(row.original.script);
    const file = output.namedFiles.find(entry => entry.name === row.wasm);
    if (file === undefined) throw new Error('Missing original Pine Wasm file');
    const bytes = output.assets.get(file.hash);
    if (bytes === undefined) throw new Error('Missing original Pine Wasm bytes');
    expect(bytes.byteLength).toBe(row.size);
    expect(file.kind).toBe('wasm');
    expect(file.hash).toBe(row.hash);
    expect(hashImmutableBytes(bytes)).toBe(row.hash);
    expect(row.original.script.module).toBe(`blobs/wasm/${file.hash}.wasm`);
    // The authoring oracle remains intact; no imported descriptor is mutated.
    expect(row.original.bytes.length).toBeGreaterThan(0);
  }
  const chapter = v.parse(v.object({ chapter: programPage }), namedJson('quests/page-composition.json')).chapter;
  expect(chapter.program).toEqual({ script: life.script, bytes: '' });
  const section = output.custom.sections.find(row => row.name === 'custom/questRuntime');
  const bytes = section === undefined ? undefined : output.custom.files.get(section.path);
  if (bytes === undefined) throw new Error('Missing original Pine quest runtime');
  const runtime = v.parse(v.object({ lead: programPage }), JSON.parse(new TextDecoder().decode(bytes)));
  expect(runtime.lead.program).toEqual(chapter.program);
});

test('original admitted Pine modules execute through the owning scope and refuse unrelated or retired loans', () => {
  const owner = new Scope('pine.raw'), child = owner.child('entered'), other = new Scope('pine.other');
  try {
    ReturnProgram.lendModules(owner, output.assets, admittedRows());
    for (const row of cases) {
      const raw = v.parse(programPage, namedJson(row.name)).program;
      expect(() => ReturnProgram.page(raw)).toThrow(/owner|loan/u);
      expect(() => ReturnProgram.page(raw, other)).toThrow('loan');
      const guest = ReturnProgram.page(raw, child), oracle = ReturnProgram.page(row.original);
      expect(ReturnProgram.page(structuredClone(raw), child)).toBe(guest);
      if (row.original === life) {
        for (const draw of [0, .2, 1]) for (const scale of [.5, 1])
          expect(guest.project('arrival', { now: 7, minimum: 18, maximum: 52, draw, scale }))
            .toEqual(oracle.project('arrival', { now: 7, minimum: 18, maximum: 52, draw, scale }));
        for (const distance of [169.99, 170, 170.01]) {
          const fields = { now: 100, kill: 0, arrival: 100, harvest: -1, site: -1, visit: 3, distance, reach: 170, giveUp: 240, present: 1 };
          expect(guest.project('carcass', fields)).toEqual(oracle.project('carcass', fields));
        }
      } else {
        for (const rain of [0, .5, 1]) for (const present of [0, 1]) {
          const fields = { present, rain, wet: .5, dry: .2, hold: 60, homeHold: 80, dt: .1 };
          expect(guest.project('shelterStep', fields)).toEqual(oracle.project('shelterStep', fields));
        }
      }
      const changed = { ...raw, script: { ...row.original.script, pages: 2 } };
      expect(() => ReturnProgram.page(changed, child)).toThrow('contract mismatch');
    }
    const programs = cases.map(row => ReturnProgram.page(v.parse(programPage, namedJson(row.name)).program, child));
    owner.dispose();
    for (const guest of programs) expect(() => guest.project('arrival', {})).toThrow('disposed');
  } finally { owner.dispose(); other.dispose(); }
});

test('Pine binary descriptors cannot fall back to encoded bytes on a missing or corrupt admission', () => {
  for (const row of cases) {
    const owner = new Scope('pine.refusal');
    try {
      const raw = v.parse(programPage, namedJson(row.name)).program;
      expect(raw.bytes).toBe('');
      expect(() => ReturnProgram.page(raw, owner)).toThrow('loan');
      const corrupted = new Map(output.assets);
      corrupted.set(row.hash, new Uint8Array([0]));
      expect(() => ReturnProgram.lendModules(owner, corrupted, admittedRows())).toThrow('hash mismatch');
      expect(() => ReturnProgram.page(raw, owner)).toThrow('loan');
    } finally { owner.dispose(); }
  }
});


test('native Pine shelter retains raw-module goals, cadence and saved continuation on a fresh host', async () => {
  const rapier = await loadRapier(new Uint8Array(readFileSync('public/assets/physics/rapier.wasm')));
  const firstHost = createSimHost({ ...SIM_LEVEL, entities: [] }, { rapier });
  const restoredHost = createSimHost({ ...SIM_LEVEL, entities: [] }, { rapier });
  const rows = parsePopulationShelter(namedJson('actors/shelter.json'));
  const trees = [{ x: 0, z: 0, r: 1, height: 25, cover: 1 }];
  const herds = () => [{ kind: 'deer', cx: 10, cz: 0, members: [] }, { kind: 'boar', cx: 200, cz: 0, members: [] }];
  try {
    ReturnProgram.lendModules(firstHost.scope, output.assets, admittedRows());
    const guest = ReturnProgram.native(firstHost, rows.program);
    const calls = vi.spyOn(guest, 'project');
    const actual = new HerdShelter({ herds: herds() }, trees, rows.look, guest);
    const oracle = new HerdShelter({ herds: herds() }, trees, rows.look, ReturnProgram.page(shelter));
    for (const rain of [0, .3, .31, 1]) for (let tick = 0; tick < 120; tick++) {
      actual.update(1 / 60, rain); oracle.update(1 / 60, rain);
      expect(actual.wanderGoal(0, rain)).toEqual(oracle.wanderGoal(0, rain));
    }
    const saved = actual.snapshot();
    expect(saved).toEqual(oracle.snapshot());
    expect(actual.wanderGoal(0, 1)).toEqual({ x: 3.2, z: 0, r: rows.look.spotR });
    expect(calls.mock.calls.filter(([signal]) => signal === 'shelterStep')).toHaveLength(160);
    expect(saved.shelters).toHaveLength(2);
    expect(saved.shelters[0]).not.toBeNull();
    ReturnProgram.lendModules(restoredHost.scope, output.assets, admittedRows());
    const resumedGuest = ReturnProgram.native(restoredHost, rows.program);
    expect(resumedGuest).not.toBe(guest);
    const resumed = new HerdShelter({ herds: herds() }, trees, rows.look, resumedGuest);
    resumed.restore(saved); oracle.restore(saved);
    for (let tick = 0; tick < 1000; tick++) {
      resumed.update(.1, 0); oracle.update(.1, 0);
      expect(resumed.wanderGoal(0, 0)).toEqual(oracle.wanderGoal(0, 0));
    }
    expect(resumed.snapshot()).toEqual(oracle.snapshot());
    expect(resumed.snapshot().shelters).toEqual([null, null]);
    firstHost.dispose();
    expect(() => guest.project('shelterStep', {})).toThrow('disposed');
    expect(() => ReturnProgram.native(firstHost, rows.program)).toThrow('disposed');
    expect(ReturnProgram.native(restoredHost, rows.program)).toBe(resumedGuest);
  } finally { firstHost.dispose(); restoredHost.dispose(); }
});


test('shelter preparation keeps detached cached bytes and refuses a missing compiler', async () => {
  const raw = output.assets.get(cases[1]?.hash ?? '');
  expect(raw).toBeDefined();
  raw?.fill(0);
  const again = await prepareOutput(context);
  expect(hashImmutableBytes(again.assets.get(cases[1]?.hash ?? '') ?? new Uint8Array())).toBe(cases[1]?.hash);
  const { compileDecisionRows: _compiler, ...missing } = context;
  await expect(prepareOutput(missing)).rejects.toThrow('decision-row compilation');
});


test('shelter preparation rejects stale compiler metadata and a substituted cache payload', async () => {
  const compiler = context.compileDecisionRows;
  if (compiler === undefined) throw new Error('Real build compiler is required');
  const cold = { ...context, cached: (_step: Parameters<typeof context.cached>[0], generate: Parameters<typeof context.cached>[1]) =>
    Promise.resolve(generate(new Map([['behaviour/shelter.as', new Uint8Array(readFileSync('src/shards/pine-hollow/behaviour/shelter.as'))]]))) };
  await expect(prepareOutput({ ...cold, compileDecisionRows: async (...args) => {
    const built = await compiler(...args);
    return { ...built, rows: built.rows.map(row => { const changed = structuredClone(row); changed.pages = 2; return changed; }) };
  } })).rejects.toThrow('metadata is stale');
  await expect(prepareOutput({ ...context, cached: () => Promise.resolve(new Map([['shelter.wasm', new Uint8Array([0])]])) })).rejects.toThrow();
});
