// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without a generated product.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve a virtual metadata consumer without writing a source module.
import { resolve } from 'node:path';
import ts from '@typescript/typescript6';
import { expect, test } from 'vitest';

test('item declarations bound data without erasing the exact JSON Schema bridge objects', () => {
  const emitted = ts.transpileDeclaration(readFileSync('src/format/items.ts', 'utf8'), {
    fileName: 'items.ts', reportDiagnostics: true,
    compilerOptions: { isolatedDeclarations: true, strict: true, exactOptionalPropertyTypes: true },
  });
  expect(emitted.diagnostics).toEqual([]);
  expect(emitted.outputText.length).toBeLessThan(30_000);
  expect(emitted.outputText).toContain('v.InferOutput<typeof WeaponProfileSchema>');
  expect(emitted.outputText).toContain('v.InferInput<typeof NativeLoadoutRowSchema>');
});

test('weapon and tool bridge paths retain namespaced identifiers, tags and nullable unwrapping', () => {
  const consumer = resolve('src/format/t4-item-consumer.ts');
  const options: ts.CompilerOptions = { strict: true, exactOptionalPropertyTypes: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, types: [],
    declaration: true, emitDeclarationOnly: true };
  const source = `import * as v from 'valibot';
    import { ItemsSchema, type ShardItems } from './items';
    const rows = ItemsSchema.pipe[2].entries.rows.pipe[0].item;
    const weapon = rows.options[0], tool = rows.options[1];
    export const tags = v.array(weapon.entries.light.entries.tags.pipe[0].item);
    export const effect = weapon.entries.light.entries.effect.wrapped;
    export const action = tool.entries.action.wrapped;
    export const identifier: v.InferOutput<typeof weapon.entries.id> = 'weapon.sword';
    export const toolId: v.InferOutput<typeof tool.entries.id> = 'tool.torch';
    export const slot: v.InferOutput<typeof weapon.entries.slot> = 'declared.weapon.sword';
    export const names: v.InferOutput<typeof tags> = ['creature.herd'];
    export const effectName: v.InferOutput<typeof effect> = 'effect.burn';
    export const actionName: v.InferOutput<typeof action> = 'tool.light';
    export const contract: v.GenericSchema<unknown, ShardItems> = ItemsSchema;`;
  const host = ts.createCompilerHost(options), read = host.readFile.bind(host), exists = host.fileExists.bind(host);
  host.fileExists = file => file === consumer || exists(file);
  host.readFile = file => file === consumer ? source : read(file);
  host.writeFile = () => undefined;
  const program = ts.createProgram([consumer], options, host), file = program.getSourceFile(consumer);
  if (file === undefined) throw new Error('Missing virtual item consumer');
  expect(program.getSemanticDiagnostics(file).map(row => row.code)).toEqual([]);
  expect(program.getDeclarationDiagnostics(file).map(row => row.code)).toEqual([]);
  const invalid = source.replace("= 'effect.burn';", "= 'burn';");
  host.readFile = path => path === consumer ? invalid : read(path);
  const broken = ts.createProgram([consumer], options, host), brokenFile = broken.getSourceFile(consumer);
  if (brokenFile === undefined) throw new Error('Missing invalid item consumer');
  expect(broken.getSemanticDiagnostics(brokenFile).map(row => row.code)).toContain(2322);
});
