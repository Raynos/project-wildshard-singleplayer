// oxlint-disable-next-line import/no-nodejs-modules -- Project fixtures use real immutable Git blobs.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove only a tiny fixture repository.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve owned fixture files.
import { dirname, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Do not inherit the enclosing commit's temporary Git index.
import { env } from 'node:process';
import { expect, test } from 'vitest';
import { stagedProjectFailures } from '../scripts/precommit-projects.mjs';

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
  } finally { rmSync(root, { recursive: true, force: true }); }
});
