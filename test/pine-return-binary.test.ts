// oxlint-disable-next-line import/no-nodejs-modules -- Compare the registered producer's original executable oracle.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { Scope } from '../src/engine/app/scope';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { ReturnProgramSchema } from '../src/format/namedJsonContracts';
import { ReturnModulesSchema } from '../src/format/scriptContract';
import { parseDecisionScripts } from '../src/format/decisionScripts';
import { outputPlatformPayloads } from '../src/sdk/outputProduct';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { output } from '../src/shards/pine-hollow/generators/output';

const original = v.parse(ReturnProgramSchema, JSON.parse(readFileSync('src/shards/pine-hollow/behaviour/life.generated.json', 'utf8')));
const script = parseDecisionScripts([original.script])[0];
if (script === undefined) throw new Error('Missing original Pine life script');
const life = { script, bytes: original.bytes };

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
];
function admittedRows() {
  return v.parse(ReturnModulesSchema, outputPlatformPayloads(output.platform, ['actors/return-scripts']).get('actors/return-scripts'));
}

test('Pine life and both quest copies publish descriptors with only admitted binary modules', () => {
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
      for (const draw of [0, .2, 1]) for (const scale of [.5, 1])
        expect(guest.project('arrival', { now: 7, minimum: 18, maximum: 52, draw, scale }))
          .toEqual(oracle.project('arrival', { now: 7, minimum: 18, maximum: 52, draw, scale }));
      for (const distance of [169.99, 170, 170.01]) {
        const fields = { now: 100, kill: 0, arrival: 100, harvest: -1, site: -1, visit: 3, distance, reach: 170, giveUp: 240, present: 1 };
        expect(guest.project('carcass', fields)).toEqual(oracle.project('carcass', fields));
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
