// oxlint-disable-next-line import/no-nodejs-modules -- The fixture owns only temporary build outputs.
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the fixture's output under ./tmp.
import {join, resolve} from 'node:path';
import {expect, test} from 'vitest';
import {carryPreviousDeploy} from '../scripts/app-build/previousDeploy.mjs';

test('a deploy carries its predecessor JS/CSS unchanged, but never a grandparent or maps', async () => {
  mkdirSync('tmp', {recursive: true}); const root = mkdtempSync(resolve('tmp/previous-deploy-'));
  const output = (name: string, code: string): string => {
    const dir = join(root, name); mkdirSync(join(dir, 'assets'), {recursive: true});
    writeFileSync(join(dir, 'version.json'), JSON.stringify({build: name}));
    writeFileSync(join(dir, `assets/main-${name.repeat(8)}.js`), code);
    writeFileSync(join(dir, `assets/main-${name.repeat(8)}.css`), `.${name}{color:red}`);
    writeFileSync(join(dir, `assets/main-${name.repeat(8)}.js.map`), 'private'); return dir;
  };
  try {
    const a = output('a', 'export const title="A";'); await carryPreviousDeploy(a);
    const b = output('b', 'export const title="B";');
    expect(await carryPreviousDeploy(b, {previousDirectory: a})).toMatchObject({current: 2, carried: 2});
    for (const ext of ['js', 'css']) expect(readFileSync(join(b, `assets/main-aaaaaaaa.${ext}`))).toEqual(readFileSync(join(a, `assets/main-aaaaaaaa.${ext}`)));
    expect(existsSync(join(b, 'assets/main-aaaaaaaa.js.map'))).toBe(false);
    const manifest: unknown = JSON.parse(readFileSync(join(b, 'deploy-chunks.json'), 'utf8'));
    expect(manifest).toEqual({format: 1, build: 'b', files: [
      {path: 'assets/main-bbbbbbbb.css', bytes: 13}, {path: 'assets/main-bbbbbbbb.js', bytes: 23},
    ]});
    const c = output('c', 'export const title="C";'); await carryPreviousDeploy(c, {previousDirectory: b});
    expect(existsSync(join(c, 'assets/main-bbbbbbbb.js'))).toBe(true);
    expect(existsSync(join(c, 'assets/main-aaaaaaaa.js'))).toBe(false);
    expect(readFileSync(join(c, 'assets/main-cccccccc.js'), 'utf8')).toBe('export const title="C";');
  } finally {rmSync(root, {recursive: true, force: true});}
});

test('untrusted predecessor paths and missing bytes refuse instead of publishing a broken graph', async () => {
  mkdirSync('tmp', {recursive: true}); const root = mkdtempSync(resolve('tmp/previous-deploy-refusal-'));
  try {
    const current = join(root, 'new'), previous = join(root, 'old'); mkdirSync(current); mkdirSync(previous);
    writeFileSync(join(current, 'version.json'), '{"build":"new"}');
    for (const path of ['../outside-aaaaaaaa.js', 'assets/../outside-aaaaaaaa.js', 'https://other.test/main-aaaaaaaa.js', 'assets/main.js']) {
      writeFileSync(join(previous, 'deploy-chunks.json'), JSON.stringify({format: 1, build: 'old', files: [{path, bytes: 1}]}));
      await expect(carryPreviousDeploy(current, {previousDirectory: previous})).rejects.toThrow('Invalid previous deploy chunk row');
    }
    writeFileSync(join(previous, 'deploy-chunks.json'), JSON.stringify({format: 1, build: 'old', files: [{path: 'assets/main-aaaaaaaa.js', bytes: 1}]}));
    await expect(carryPreviousDeploy(current, {previousDirectory: previous})).rejects.toThrow();
    expect(existsSync(join(current, 'deploy-chunks.json'))).toBe(false);
  } finally {rmSync(root, {recursive: true, force: true});}
});
