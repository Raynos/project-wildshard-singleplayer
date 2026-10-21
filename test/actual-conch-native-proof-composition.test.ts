// oxlint-disable-next-line import/no-nodejs-modules -- Read exact source fixtures and own tiny disposable resolver fixture only.
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolver fixture uses explicit repository-relative temporary paths.
import { dirname, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Exact authored byte hashes, not structural admission.
import { createHash } from 'node:crypto';
import { build } from 'vite';
import { expect, test } from 'vitest';
import { createActualConchProofOutput, createActualConchProofSource } from '../src/shards/driftwood-isle/generators/actualConchProof';
import { ACTUAL_CONCH_TABLES, actualConchProofComposition, assertActualConchProofComposition } from '../scripts/actual-conch-native-proof-composition';
import type { PlatformDataSectionName } from '../src/format/platformDataSections';
import { emitPlatformSections } from '../src/sdk/platformSections';
import { DRIFTWOOD_REGULAR_DECISIONS, DRIFTWOOD_REGULAR_STRIKES, DRIFTWOOD_REGULAR_MOVES } from '../src/shards/driftwood-isle/generators/driftwoodRegularCombat';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import motion from './proof/conch-articulated-complete-motion/motion.json' with { type: 'json' };
import contact from './proof/conch-grounded-source/motion.json' with { type: 'json' };

const metadata = readFileSync('test/proof/conch-grounded-source/metadata.json');
const motionBytes = readFileSync('test/proof/conch-articulated-complete-motion/motion.json');
const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

test('actual diagnostic emits byte-exact original metadata and all 21 actual programs without synthetic hull or pose substitutions', () => {
  const output = createActualConchProofOutput(metadata, motionBytes);
  for (const [name, bytes] of [['practice/bodies.json', metadata], ['poses/conch-articulated-complete1.json', motionBytes]] as const) {
    const row = output.namedFiles?.find(file => file.name === name);
    if (row === undefined) throw new Error('Missing exact actual source file');
    expect(row.hash).toBe(hash(bytes)); expect(output.assets?.get(row.hash)).toEqual(Uint8Array.from(bytes));
  }
  expect(hash(metadata)).toBe('6905f20ced953176fb0e316a8d18287735eef0fb996cd58af43ae918b8f87989');
  expect(hash(motionBytes)).toBe('494d35c49765df3623a6943b9834ecc7d244ae6ba0ba3b53a9ffe6f4e09d9596');
  expect(motion.programs).toHaveLength(21); expect(motion.programs.slice(0, 18)).toEqual(contact.programs);
  expect(motion.footContact).toEqual(contact.footContact); expect(() => numericCreaturePose(motion)).not.toThrow();
  expect(output.namedFiles?.some(file => file.name === 'poses/native-proof.json')).toBe(false);
});

test('private source contains only actual Conch catalogue and no world placements', () => {
  const source = createActualConchProofSource();
  expect(source.runtime?.spawns?.homes).toEqual([]); expect(source.runtime?.spawns?.bosses).toEqual([]);
  expect(source.identity.name).toBe('Private unadmitted actual Conch diagnostic');
});

async function bundle(pre: boolean): Promise<{ code: string; files: Record<string, string> }> {
  const root = mkdtempSync(resolve('tmp/actual-conch-resolver-')), files: Record<string, string> = {};
  const write = (path: string, text: string): void => { const absolute = resolve(root, path); mkdirSync(dirname(absolute), { recursive: true }); writeFileSync(absolute, text); };
  try {
    write('src/actualConchProof.ts', `export const load = () => import('./actualConchProofBoot');\n${ACTUAL_CONCH_TABLES.map((path, i) => `export { value as table${i} } from './${path.slice(4)}';`).join('\n')}`);
    write('src/actualConchProofBoot.ts', "export const boot = 'ACTUAL-CONCH-BOOT';");
    for (const path of ACTUAL_CONCH_TABLES) write(`${path}.ts`, "export const value = 'GLOBAL-TABLE';");
    const tables = new Map(ACTUAL_CONCH_TABLES.map(path => [resolve(root, path), `export const value = 'PRIVATE-${path}';`]));
    const plugin = actualConchProofComposition(root, tables); if (!pre) delete plugin.enforce;
    const result = await build({ root, configFile: false, publicDir: false, logLevel: 'silent',
      plugins: [plugin, { name: 'actual-conch-resolved-fixture', load(id) {
        if (id.startsWith(`${root}/`)) files[id.slice(root.length + 1)] = 'exact-hash'; return null;
      } }], build: { write: false, minify: false, lib: { entry: resolve(root, 'src/actualConchProof.ts'), formats: ['es'] } } });
    const output = Array.isArray(result) ? result[0] : result;
    if (output === undefined || !('output' in output)) throw new Error('Missing resolver fixture output');
    return { code: output.output.filter(row => row.type === 'chunk').map(row => row.code).join('\n'), files };
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const expected = { 'src/actualConchProof.ts': 'exact-hash', 'src/actualConchProofBoot.ts': 'exact-hash' } as const;
test('actual Vite fixture exposes and refuses ordinary resolver ordering', async () => {
  const result = await bundle(false); expect(result.code).toContain('GLOBAL-TABLE');
  expect(() => assertActualConchProofComposition(result.files, expected)).toThrow('Unexpected actual Conch build input');
});
test('actual Vite fixture keeps exact private boot and replaces every generated table before filesystem resolution', async () => {
  const result = await bundle(true); expect(result.code).toContain('ACTUAL-CONCH-BOOT'); expect(result.code).not.toContain('GLOBAL-TABLE');
  for (const path of ACTUAL_CONCH_TABLES) expect(result.code).toContain(`PRIVATE-${path}`);
  expect(() => assertActualConchProofComposition(result.files, expected)).not.toThrow();
  for (const path of Object.keys(expected)) expect(() => assertActualConchProofComposition({ ...result.files, [path]: 'wrong' }, expected)).toThrow('Missing exact');
  for (const path of ['src/practice.ts', 'src/practiceBoot.ts', 'src/nativeOwnerProofBoot.ts', ...ACTUAL_CONCH_TABLES.map(table => `${table}.ts`)])
    expect(() => assertActualConchProofComposition({ ...result.files, [path]: 'wrong' }, expected)).toThrow('Unexpected');
});
test('incomplete or extra private table maps fail closed', () => {
  expect(() => actualConchProofComposition('/repo', new Map())).toThrow('exactly four');
  const tables = new Map(ACTUAL_CONCH_TABLES.map(path => [resolve('/repo', path), 'export {};']));
  tables.set('/repo/foreign', 'export {};'); expect(() => actualConchProofComposition('/repo', tables)).toThrow('exactly four');
});

test('direct author refuses metadata or numeric-program substitution before emission', () => {
  const altered = Uint8Array.from(motionBytes); altered[20] = (altered[20] ?? 0) ^ 1;
  expect(() => createActualConchProofOutput(metadata, altered)).toThrow('exact actual Conch');
  expect(() => createActualConchProofOutput(new TextEncoder().encode('{}'), motionBytes)).toThrow('exact actual Conch');
});

test('actual diagnostic retains real Conch decision, strikes and movement declarations', () => {
  const output = createActualConchProofOutput(metadata, motionBytes);
  const expectedSections = emitPlatformSections(new Map<PlatformDataSectionName, unknown>([
    ['sim/scripts', DRIFTWOOD_REGULAR_DECISIONS.filter(row => row.id === 'driftwood.conch-duelist.decision')],
    ['actors/strikes', DRIFTWOOD_REGULAR_STRIKES.filter(row => row.id.startsWith('strike.conch-duelist.'))],
    ['actors/moves', DRIFTWOOD_REGULAR_MOVES.filter(row => row.id === 'conch-duelist.stalk')],
  ]));
  for (const [path, bytes] of expectedSections.files) expect(output.platform?.files.get(path)).toEqual(bytes);
});
