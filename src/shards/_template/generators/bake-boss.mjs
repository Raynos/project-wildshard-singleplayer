// Compile through the public declared-handler compiler; scenarios consume these built bytes.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDecisionScripts } from '@wildshard/sdk/buildDecisionScripts';
import { buildDecisionRegistries } from '@wildshard/format/decisionBindings';
import { parseActorMoves } from '@wildshard/format/actorMoves';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseRows } from '@wildshard/sdk/rows';
import { CreaturesSchema } from '@wildshard/format/creatures';
import { parse } from 'valibot';
import decision from '../data/bossDecision.json' with { type: 'json' };
import moves from '../data/moves.json' with { type: 'json' };
import creatures from '../data/creatures.json' with { type: 'json' };
import rows from '../data/rows.json' with { type: 'json' };
import { BUILD_OPTIONS } from './buildOptions.ts';

const project = resolve(import.meta.dirname, '..');
const source = { ...emptyShardfile({ slug: 'template', name: 'Template shard', author: 'Wildshard', revision: 2, seed: 357 }), creatures: parse(CreaturesSchema, creatures), rows: parseRows(rows) };
const registries = buildDecisionRegistries(source, parseActorMoves(moves));
const built = await buildDecisionScripts(project, [decision], registries, BUILD_OPTIONS);
const blob = built.blobs.find(row => row.file.name === 'behaviour/template.boss.decision.wasm'); if (blob === undefined) throw new Error('Missing compiled Template boss');
mkdirSync(resolve(project, 'assets'), { recursive: true });
writeFileSync(resolve(project, 'assets', blob.file.hash), blob.bytes);
writeFileSync(resolve(project, 'behaviour/boss.json'), `${JSON.stringify({ hash: blob.file.hash, compressed: blob.bytes.length }, null, 2)}\n`);
console.info(`template decision: ${blob.bytes.length} admitted bytes, ${built.lines}/${built.ceiling} authored AS lines`);
