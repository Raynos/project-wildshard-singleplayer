// G320: compile the three retained AssemblyScript sources, preserving their original admitted memory limits.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileScript } from '@wildshard/sdk/compileScript';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';

const project = resolve(import.meta.dirname, '..');
mkdirSync(resolve(project, 'assets'), { recursive: true });
for (const { name, maximumPages } of [{ name: 'door', maximumPages: 2 }, { name: 'items', maximumPages: 64 }, { name: 'idle', maximumPages: 2 }]) {
  const bytes = await compileScript(readFileSync(resolve(project, 'behaviour', `${name}.as`), 'utf8'), { maximumPages });
  const hash = hashImmutableBytes(bytes);
  writeFileSync(resolve(project, 'assets', hash), bytes);
  if (name === 'door') writeFileSync(resolve(project, 'behaviour/door.json'), `${JSON.stringify({ hash, compressed: bytes.length }, null, 2)}\n`);
  console.info(`pastel behaviour: ${name}, ${String(bytes.length)} immutable bytes`);
}
