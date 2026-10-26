// oxlint-disable-next-line import/no-nodejs-modules -- Project fixtures use real immutable Git blobs.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove only a tiny fixture repository.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve owned fixture files.
import { dirname, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Do not inherit the enclosing commit's temporary Git index.
import { env } from 'node:process';
import { expect, test } from 'vitest';
import ts from '@typescript/typescript6';
import { stagedProjectFailures } from '../scripts/precommit-projects.mjs';

test.each([
  ['.d.ts', '.js', '.ts'],
  ['.d.mts', '.mjs', '.mts'],
  ['.d.cts', '.cjs', '.cts'],
])('project membership follows compiler declaration ownership for %s', (declaration, imported, implementation) => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/cf1-declarations-'));
  const environment = Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args: string[]): void => { execFileSync('git', args, { cwd: root, env: environment }); };
  const put = (name: string, text: string): void => { mkdirSync(dirname(resolve(root, name)), { recursive: true }); writeFileSync(resolve(root, name), text); };
  try {
    git('init', '-q');
    put('tsconfig.sdk.json', '{"compilerOptions":{"composite":true,"strict":true,"moduleResolution":"bundler","module":"esnext","noEmit":true},"include":["src/sdk/**/*.ts"]}');
    put(`types/contract${declaration}`, 'export function contract(): string;');
    put('src/sdk/subject.ts', `import {contract} from '../../types/contract${imported}';export const value: string = contract();`);
    git('add', '.');
    const config = ts.readConfigFile(resolve(root, 'tsconfig.sdk.json'), file => ts.sys.readFile(file));
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
    const diagnostics = (): readonly ts.Diagnostic[] => ts.getPreEmitDiagnostics(ts.createProgram(parsed.fileNames, parsed.options));
    expect(diagnostics()).toEqual([]);
    expect(stagedProjectFailures(root, ['src/sdk/subject.ts'])).toEqual([]);
    put(`types/implementation${implementation}`, 'export function contract(): string {return "value";}');
    put('src/sdk/subject.ts', `import {contract} from '../../types/implementation${imported}';export const value: string = contract();`);
    git('add', '.');
    expect(diagnostics().some(diagnostic => diagnostic.code === 6307)).toBe(true);
    expect(stagedProjectFailures(root, ['src/sdk/subject.ts'])).toHaveLength(1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('staged project membership keeps includes, excludes, type imports and references exact', () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/cf1-project-'));
  const environment = Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: root, env: environment, encoding: 'utf8' }).trim();
  const put = (name: string, text: string): void => { mkdirSync(dirname(resolve(root, name)), { recursive: true }); writeFileSync(resolve(root, name), text); };
  try {
    git('init', '-q');
    put('tsconfig.json', '{"compilerOptions":{"moduleResolution":"bundler","module":"esnext"},"include":["src","test"]}');
    put('tsconfig.engine.json', '{"extends":"./tsconfig.json","include":["src/engine"],"exclude":["src/engine/excluded.ts"],"references":[{"path":"./tsconfig.format.json"}]}');
    put('tsconfig.format.json', '{"extends":"./tsconfig.json","include":["src/format"]}');
    put('src/format/valid.ts', 'export interface Valid {value:number}\n');
    put('src/engine/own.ts', 'export interface Own {value:number}\n');
    put('src/engine/excluded.ts', 'export interface Excluded {value:number}\n');
    put('test/fake.ts', 'export interface Fake {value:number}\n');
    put('src/game/package.json', '{"exports":{"./up":"./up.ts"}}');
    put('src/game/up.ts', 'export interface Up {value:number}\n');
    const file = 'src/engine/subject.test.ts';
    for (const source of ['import type {Fake} from "../../test/fake";', 'type Fake = import("../../test/fake").Fake;',
      'export type {Fake} from "../../test/fake";', 'import type {Excluded} from "./excluded.js";',
      'import type {Up} from "@wildshard/game/up";']) {
      put(file, source); git('add', '.');
      put(file, 'import type {Own} from "./own";');
      expect(stagedProjectFailures(root, [file])).toHaveLength(1);
    }
    put(file, 'import type {Own} from "./own.js";import type {Valid} from "../format/valid";'); git('add', file);
    expect(stagedProjectFailures(root, [file])).toEqual([]);
    put('tsconfig.app.json', '{"extends":"./tsconfig.json","include":["src/*.ts"],"references":[{"path":"./tsconfig.format.json"}]}');
    put('src/entry.ts', 'import type {Fake} from "../test/fake";'); git('add', '.');
    expect(stagedProjectFailures(root, ['src/entry.ts'])).toHaveLength(1);
    put('src/entry.ts', 'import type {Valid} from "./format/valid";'); git('add', 'src/entry.ts');
    expect(stagedProjectFailures(root, ['src/entry.ts'])).toEqual([]);
    put('tsconfig.app.json', '{"extends":"./tsconfig.json","include":["src/*.ts"],"exclude":["src/*.test.ts"],"references":[{"path":"./tsconfig.format.json"}]}');
    put('src/tsconfig.test.json', '{"extends":"../tsconfig.json","include":["*.test.ts"],"references":[{"path":"../tsconfig.app.json"}]}');
    put('src/entry.test.ts', 'import type {Valid} from "./format/valid";'); git('add', '.');
    expect(stagedProjectFailures(root, ['src/entry.test.ts'])).toEqual([]);
    put('src/entry.test.ts', 'import type {Fake} from "../test/fake";'); git('add', 'src/entry.test.ts');
    expect(stagedProjectFailures(root, ['src/entry.test.ts'])).toHaveLength(1);
    put('src/engine/tsconfig.test.json', '{"extends":"../../tsconfig.json","include":["**/*.test.ts","test/**/*.ts"],"references":[{"path":"../../tsconfig.engine.json"}]}');
    put('tsconfig.engine.json', '{"extends":"./tsconfig.json","include":["src/engine"],"exclude":["**/*.test.ts","src/engine/test","src/engine/excluded.ts"],"references":[{"path":"./tsconfig.format.json"}]}');
    put(file, 'import type {Own} from "./own";'); git('add', '.');
    expect(stagedProjectFailures(root, [file])).toEqual([]);
    put(file, 'import type {Fake} from "../../test/fake";'); git('add', file);
    expect(stagedProjectFailures(root, [file])).toHaveLength(1);
    put('src/engine/own.ts', 'import type {Subject} from "./subject.test";'); git('add', 'src/engine/own.ts');
    expect(stagedProjectFailures(root, ['src/engine/own.ts'])).toHaveLength(1);
    put('src/engine/test/helper.ts', 'import type {Own} from "../own";'); git('add', '.');
    expect(stagedProjectFailures(root, ['src/engine/test/helper.ts'])).toEqual([]);
    put('src/game/tsconfig.test.json', '{"extends":"../../tsconfig.json","include":["**/*.test.ts"],"references":[{"path":"../../tsconfig.engine.json"}]}');
    put('src/game/fixture.test.ts', 'import type {Helper} from "../engine/test/helper";'); git('add', '.');
    expect(stagedProjectFailures(root, ['src/game/fixture.test.ts'])).toHaveLength(1);
    put('src/game/tsconfig.test.json', '{"extends":"../../tsconfig.json","include":["**/*.test.ts"],"references":[{"path":"../../tsconfig.engine.json"},{"path":"../engine/tsconfig.test.json"}]}'); git('add', '.');
    expect(stagedProjectFailures(root, ['src/game/fixture.test.ts'])).toEqual([]);
    put('tsconfig.sdk.json', '{"extends":"./tsconfig.json","include":["src/sdk"],"exclude":["**/*.test.ts"],"references":[{"path":"./tsconfig.engine.json"}]}');
    put('src/sdk/tsconfig.test.json', '{"extends":"../../tsconfig.json","include":["**/*.test.ts"],"references":[{"path":"../../tsconfig.sdk.json"}]}');
    put('src/sdk/fixture.test.ts', 'import type {Helper} from "../engine/test/helper";'); git('add', '.');
    expect(stagedProjectFailures(root, ['src/sdk/fixture.test.ts'])).toHaveLength(1);
    put('src/sdk/tsconfig.test.json', '{"extends":"../../tsconfig.json","include":["**/*.test.ts"],"references":[{"path":"../../tsconfig.sdk.json"},{"path":"../engine/tsconfig.test.json"}]}'); git('add', '.');
    expect(stagedProjectFailures(root, ['src/sdk/fixture.test.ts'])).toEqual([]);
    put('src/sdk/own.ts', 'import type {Helper} from "../engine/test/helper";'); git('add', '.');
    expect(stagedProjectFailures(root, ['src/sdk/own.ts'])).toHaveLength(1);
    put('src/engine/own.ts', 'import type {Helper} from "./test/helper";'); git('add', 'src/engine/own.ts');
    expect(stagedProjectFailures(root, ['src/engine/own.ts'])).toHaveLength(1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
