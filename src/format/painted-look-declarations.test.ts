// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without a generated product.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve a virtual look consumer without a source module.
import { resolve } from 'node:path';
import ts from '@typescript/typescript6';
import { expect, test } from 'vitest';

test('painted look declarations bound visual data and retain the defining curve contract', () => {
  const emitted = ts.transpileDeclaration(readFileSync('src/format/paintedLook.ts', 'utf8'), {
    fileName: 'paintedLook.ts', reportDiagnostics: true,
    compilerOptions: { isolatedDeclarations: true, strict: true, exactOptionalPropertyTypes: true },
  });
  expect(emitted.diagnostics).toEqual([]);
  expect(emitted.outputText.length).toBeLessThan(10_000);
  expect(emitted.outputText).toContain('v.InferOutput<typeof CurveSchema>');
});

test('painted look outputs retain defaulted image maps, draw poses and exact clock units', () => {
  const consumer = resolve('src/format/t4-painted-look-consumer.ts');
  const options: ts.CompilerOptions = { strict: true, exactOptionalPropertyTypes: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, types: [],
    declaration: true, emitDeclarationOnly: true };
  const source = `import * as v from 'valibot';
    import { PaintedNumbersSchema, PaintedLookSchema, type PaintedNumbers, type PaintedLookRow } from './paintedLook';
    export function numbers(row: v.InferOutput<typeof PaintedNumbersSchema>): PaintedNumbers { return row; }
    export function admitted(row: v.InferOutput<typeof PaintedLookSchema>): PaintedLookRow { return row; }
    export function images(row: PaintedLookRow): Record<string, unknown> { return row.images; }
    export function positions(row: PaintedLookRow): [number, number, number][] {
      return (row.dressing?.draws ?? []).map(draw => draw.at);
    }
    export const unit: PaintedNumbers['clock']['units'] = 'hour';`;
  const host = ts.createCompilerHost(options), read = host.readFile.bind(host), exists = host.fileExists.bind(host);
  host.fileExists = file => file === consumer || exists(file);
  host.readFile = file => file === consumer ? source : read(file);
  host.writeFile = () => undefined;
  const program = ts.createProgram([consumer], options, host), file = program.getSourceFile(consumer);
  if (file === undefined) throw new Error('Missing virtual painted-look consumer');
  expect(program.getSemanticDiagnostics(file).map(row => row.code)).toEqual([]);
  expect(program.getDeclarationDiagnostics(file).map(row => row.code)).toEqual([]);
  const invalid = source.replace("= 'hour';", "= 'seconds';");
  host.readFile = path => path === consumer ? invalid : read(path);
  const broken = ts.createProgram([consumer], options, host), brokenFile = broken.getSourceFile(consumer);
  if (brokenFile === undefined) throw new Error('Missing invalid painted-clock consumer');
  expect(broken.getSemanticDiagnostics(brokenFile).map(row => row.code)).toContain(2322);
});
