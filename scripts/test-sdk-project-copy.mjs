#!/usr/bin/env node
// SF55: the same authored project emits identical products inside the repo and from an installed SDK tarball alone.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..'), project = resolve(root, process.argv[2] ?? 'src/shards/blender-template');
const scratch = mkdtempSync(join(tmpdir(), 'sf55-project-copy-'));
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const hashes = directory => readdirSync(directory).sort().map(name => [name, createHash('sha256').update(readFileSync(join(directory, name))).digest('hex')]);
try {
  run('pnpm', ['--dir', 'src/sdk', 'pack', '--pack-destination', scratch]);
  const consumer = join(scratch, 'consumer'); mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { '@wildshard/sdk': `file:${join(scratch, 'wildshard-sdk-0.0.0.tgz')}` } }));
  run('pnpm', ['install', '--ignore-scripts', '--config.enableGlobalVirtualStore=false'], consumer);
  const outside = join(consumer, 'project'); cpSync(project, outside, { recursive: true });
  const insideOutput = join(scratch, 'inside'), outsideOutput = join(scratch, 'outside');
  run(process.execPath, ['scripts/wildshard.mjs', 'build', project, insideOutput, '--product-only']);
  run(join(consumer, 'node_modules/.bin/wildshard'), ['build', outside, outsideOutput, '--product-only'], consumer);
  const inside = hashes(insideOutput), external = hashes(outsideOutput);
  if (JSON.stringify(inside) !== JSON.stringify(external)) throw new Error(`Outside SDK project differs: ${JSON.stringify(inside.filter(row => !external.some(other => JSON.stringify(row) === JSON.stringify(other))))}`);
  const validation = run(join(consumer, 'node_modules/.bin/wildshard'), ['validate', join(outsideOutput, 'shard.json')], consumer);
  if (!validation.includes('92 edge lanes')) throw new Error('External project did not prove all entry lanes');
  const receipt = { pass: true, project: project.slice(root.length + 1), transport: 'SDK tarball alone, Node', identicalProducts: 2, files: external.length, hashes: external, validation: validation.trim() };
  if (process.argv.length > 3) {
    const output = process.argv[3]; mkdirSync(resolve(output, '..'), { recursive: true }); writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
  }
  console.log(JSON.stringify(receipt, null, 2));
} catch (error) {
  if (error !== null && typeof error === 'object' && 'stdout' in error) process.stderr.write(String(error.stdout));
  if (error !== null && typeof error === 'object' && 'stderr' in error) process.stderr.write(String(error.stderr));
  throw error;
} finally { rmSync(scratch, { recursive: true, force: true }); }
