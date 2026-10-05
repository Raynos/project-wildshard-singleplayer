#!/usr/bin/env node
// SF8b: prove the packed SDK works without any repository workspace links.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const scratch = mkdtempSync(join(tmpdir(), 'wildshard-sdk-proof-'));
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const hashes = (directory, prefix = '') => readdirSync(join(directory, prefix)).sort().flatMap((name) => {
  const path = join(prefix, name), absolute = join(directory, path);
  return statSync(absolute).isDirectory() ? hashes(directory, path) : [[path, createHash('sha256').update(readFileSync(absolute)).digest('hex')]];
});
try {
  run('pnpm', ['--dir', 'src/sdk', 'pack', '--pack-destination', scratch]);
  const tarball = join(scratch, 'wildshard-sdk-0.0.0.tgz');
  const consumer = join(scratch, 'consumer'); mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { '@wildshard/sdk': `file:${tarball}` } }));
  run('pnpm', ['install', '--ignore-scripts', '--config.enableGlobalVirtualStore=false'], consumer);
  const cli = join(consumer, 'node_modules/.bin/wildshard'), project = join(consumer, 'outside');
  run(cli, ['new', project], consumer);
  run(cli, ['build', project, join(project, 'one')], consumer);
  run(cli, ['build', project, join(project, 'two')], consumer);
  run(cli, ['validate', join(project, 'one/shard.json')], consumer);
  const one = hashes(join(project, 'one')), two = hashes(join(project, 'two'));
  if (JSON.stringify(one) !== JSON.stringify(two)) throw new Error('Packed SDK clean builds differ');
  const html = readFileSync(join(project, 'one/index.html'), 'utf8');
  if (!html.includes('id="ws-shardfile"') || !html.includes('"slug":"outside"')) throw new Error('Prebuilt normal client is missing the outside source');
  const installed = JSON.parse(readFileSync(join(consumer, 'node_modules/@wildshard/sdk/package.json'), 'utf8'));
  if (!installed.exports['./shardfile'].types.startsWith('./dist/')) throw new Error('Packed types still point to workspace sources');
  const modules = Object.keys(installed.exports);
  const imports = modules.map((name, i) => `import * as public${i} from '@wildshard/sdk/${name.slice(2)}';`);
  writeFileSync(join(consumer, 'typecheck.ts'), `${imports.join('\n')}\nconsole.log(${modules.map((_name, i) => `public${i}`).join(',')});\n`);
  // Rapier's public declarations use the standard disposable symbols available in the supported Node versions.
  run(join(root, 'node_modules/.bin/tsc'), ['--noEmit', '--strict', '--module', 'esnext', '--moduleResolution', 'bundler', '--target', 'es2022', '--lib', 'es2022,dom,esnext.disposable', 'typecheck.ts'], consumer);
  console.log(JSON.stringify({ pass: true, tarballBytes: statSync(tarball).size, files: one.length, identicalBuilds: 2, installedBy: 'file:', standaloneTypes: true, publicModules: modules.length, normalClient: true }));
  if (process.argv.includes('--keep')) { console.log(`kept ${scratch}`); }
  else rmSync(scratch, { recursive: true, force: true });
} catch (error) {
  rmSync(scratch, { recursive: true, force: true });
  if (error && typeof error === 'object' && 'stdout' in error) process.stderr.write(String(error.stdout));
  if (error && typeof error === 'object' && 'stderr' in error) process.stderr.write(String(error.stderr));
  throw error;
}
