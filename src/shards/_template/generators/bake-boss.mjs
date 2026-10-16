// Compile through the public declared-handler compiler; scenarios consume these built bytes.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDecisionScripts } from '@wildshard/sdk/buildDecisionScripts';
import { bossDecision, BOSS_REGISTRIES } from '../data/bossDecision.ts';
import { BUILD_OPTIONS } from './buildOptions.ts';

const project = resolve(import.meta.dirname, '..');
const built = await buildDecisionScripts(project, [bossDecision(`blobs/wasm/${'0'.repeat(64)}.wasm`)], BOSS_REGISTRIES, BUILD_OPTIONS);
const blob = built.blobs.find(row => row.file.name === 'behaviour/template.boss.decision.wasm'); if (blob === undefined) throw new Error('Missing compiled Template boss');
mkdirSync(resolve(project, 'assets'), { recursive: true });
writeFileSync(resolve(project, 'assets', blob.file.hash), blob.bytes);
writeFileSync(resolve(project, 'behaviour/boss.json'), `${JSON.stringify({ hash: blob.file.hash, compressed: blob.bytes.length }, null, 2)}\n`);
console.info(`template decision: ${blob.bytes.length} admitted bytes, ${built.lines}/${built.ceiling} authored AS lines`);
