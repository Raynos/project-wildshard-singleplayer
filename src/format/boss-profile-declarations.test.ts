// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without a generated product.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve a virtual metadata consumer without writing a source module.
import { resolve } from 'node:path';
import ts from '@typescript/typescript6';
import { expect, test } from 'vitest';

test('boss profile declarations bound validator metadata and retain defining script and stage contracts', () => {
  const emitted = ts.transpileDeclaration(readFileSync('src/format/bossProfiles.ts', 'utf8'), {
    fileName: 'bossProfiles.ts', reportDiagnostics: true,
    compilerOptions: { isolatedDeclarations: true, strict: true, exactOptionalPropertyTypes: true },
  });
  expect(emitted.diagnostics).toEqual([]);
  expect(emitted.outputText.length).toBeLessThan(28_000);
  expect(emitted.outputText).toContain('v.InferOutput<typeof EliteScriptSchema>');
  expect(emitted.outputText).toContain('v.InferOutput<typeof DirectorStagesSchema>');
});

test('all five boss patterns and the native-owner subset keep variant and dictionary compatibility', () => {
  const consumer = resolve('src/format/t4-boss-profile-consumer.ts');
  const options: ts.CompilerOptions = { strict: true, exactOptionalPropertyTypes: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, types: [],
    declaration: true, emitDeclarationOnly: true };
  const source = `import * as v from 'valibot';
    import { ArenaBossProfileSchema, RoamingBossProfileSchema, SpawnedBossProfileSchema, HeldBossProfileSchema,
      ScriptBossProfileSchema, type BossProfile } from './bossProfiles';
    export const all = v.variant('pattern', [ArenaBossProfileSchema, RoamingBossProfileSchema,
      SpawnedBossProfileSchema, HeldBossProfileSchema, ScriptBossProfileSchema]);
    export const native = v.variant('pattern', [SpawnedBossProfileSchema, HeldBossProfileSchema]);
    export function complete(row: v.InferOutput<typeof all>): BossProfile { return row; }
    export function subset(row: v.InferOutput<typeof native>): Extract<BossProfile, {pattern: 'spawned' | 'held'}> { return row; }`;
  const host = ts.createCompilerHost(options), read = host.readFile.bind(host), exists = host.fileExists.bind(host);
  host.fileExists = file => file === consumer || exists(file);
  host.readFile = file => file === consumer ? source : read(file);
  host.writeFile = () => undefined;
  const program = ts.createProgram([consumer], options, host), file = program.getSourceFile(consumer);
  if (file === undefined) throw new Error('Missing virtual boss-profile consumer');
  expect(program.getSemanticDiagnostics(file).map(row => row.code)).toEqual([]);
  expect(program.getDeclarationDiagnostics(file).map(row => row.code)).toEqual([]);
  const defining = resolve('src/format/bossProfiles.ts');
  const interfaceProfile = readFileSync(defining, 'utf8').replace(
    'export type HeldBossProfileRows = {', 'export interface HeldBossProfileRows {');
  host.readFile = path => path === consumer ? source : path === defining ? interfaceProfile : read(path);
  const broken = ts.createProgram([consumer], options, host), brokenFile = broken.getSourceFile(consumer);
  if (brokenFile === undefined) throw new Error('Missing interface-profile consumer');
  expect(broken.getSemanticDiagnostics(brokenFile).map(row => row.code)).toContain(2322);
});
