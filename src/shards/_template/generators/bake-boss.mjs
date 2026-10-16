// Compile the reference encounter; gate scenarios consume built bytes, never the compiler.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileScript } from '@wildshard/sdk/compileScript';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { bossGlue } from './bossGlue.ts';

const project = resolve(import.meta.dirname, '..');
const bytes = await compileScript(readFileSync(resolve(project, 'behaviour/boss.as'), 'utf8'), {
  abi: 1, maximumPages: 1, sources: { 'ws.ts': bossGlue() },
});
const hash = hashImmutableBytes(bytes);
mkdirSync(resolve(project, 'assets'), { recursive: true });
writeFileSync(resolve(project, 'assets', hash), bytes);
writeFileSync(resolve(project, 'behaviour/boss.json'), `${JSON.stringify({ hash, compressed: bytes.length }, null, 2)}\n`);
console.info(`template behaviour: boss, ${String(bytes.length)} immutable ABI-v1 bytes`);
