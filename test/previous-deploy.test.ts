// oxlint-disable-next-line import/no-nodejs-modules -- The fixture owns only temporary build outputs.
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the fixture's output under ./tmp.
import {join, resolve as resolvePath} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the production manifest/body HTTP path locally.
import {createServer} from 'node:http';
import {expect, test} from 'vitest';
import {carryPreviousDeploy} from '../scripts/app-build/previousDeploy.mjs';

test('a deploy carries its predecessor JS/CSS unchanged, but never a grandparent or maps', async () => {
  mkdirSync('tmp', {recursive: true}); const root = mkdtempSync(resolvePath('tmp/previous-deploy-'));
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
  mkdirSync('tmp', {recursive: true}); const root = mkdtempSync(resolvePath('tmp/previous-deploy-refusal-'));
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


test('the production HTTP carry preserves old JS/CSS and refuses a truncated body', async () => {
  mkdirSync('tmp', {recursive: true}); const root = mkdtempSync(resolvePath('tmp/previous-deploy-http-'));
  const bodies = new Map([['assets/old-aaaaaaaa.js', 'export const old=1;'], ['assets/old-bbbbbbbb.css', 'body{color:red}']]);
  const manifest = {format: 1, build: 'previous', files: [...bodies].map(([path, body]) => ({path, bytes: Buffer.byteLength(body)}))};
  let truncate = false;
  const requests: string[] = [];
  const server = createServer((request, response) => {
    const path = (request.url ?? '/').slice(1); requests.push(path);
    if (path === 'deploy-chunks.json') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(manifest)); return; }
    const body = bodies.get(path);
    if (body === undefined) {response.writeHead(404); response.end(); return;}
    response.setHeader('Content-Type', path.endsWith('.css') ? 'text/css' : 'text/javascript');
    response.end(truncate ? body.slice(1) : body);
  });
  await new Promise<void>(resolve => {server.listen(0, '127.0.0.1', resolve);});
  try {
    const address = server.address(); if (address === null || typeof address === 'string') throw new Error('No fixture port');
    const options = {previousOrigin: `http://127.0.0.1:${address.port}`};
    writeFileSync(join(root, 'version.json'), '{"build":"new"}');
    expect(await carryPreviousDeploy(root, options)).toMatchObject({current: 0, carried: 2});
    expect(requests).toEqual(['deploy-chunks.json', ...bodies.keys()]);
    for (const [path, body] of bodies) expect(readFileSync(join(root, path), 'utf8')).toBe(body);
    truncate = true;
    const failed = join(root, 'failed'); mkdirSync(failed); writeFileSync(join(failed, 'version.json'), '{"build":"failed"}');
    await expect(carryPreviousDeploy(failed, options)).rejects.toThrow('Previous deploy chunk length differs');
  } finally {
    await new Promise<void>((resolve, reject) => {server.close(error => {if (error === undefined) resolve(); else reject(error);});});
    rmSync(root, {recursive: true, force: true});
  }
});
