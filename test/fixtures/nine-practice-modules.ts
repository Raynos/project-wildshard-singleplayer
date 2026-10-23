// oxlint-disable-next-line import/no-nodejs-modules -- Borrow the normal producer's actual raw module.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { parseDecisionScripts } from '../../src/format/decisionScripts';
import type { Scope } from '../../src/engine/app/scope';
import { ReturnProgram } from '../../src/game/population/returnProgram';
import { hashImmutableBytes } from '../../src/sdk/immutable';

const input=v.parse(v.strictObject({script:v.unknown(),bytes:v.string(),compiled:v.strictObject({source:v.literal('behaviour/practice.generated.wasm'),
  bytes:v.pipe(v.number(),v.safeInteger(),v.minValue(1)),hash:v.pipe(v.string(),v.regex(/^[a-f0-9]{64}$/u))})}),
  JSON.parse(readFileSync('src/shards/nine-dragon-stack/behaviour/practice.generated.json','utf8')));
const script=parseDecisionScripts([input.script])[0];if(script===undefined)throw new Error('Missing actual practice contract');
export const ninePracticeRows={script,bytes:input.bytes};
export const ninePracticeBytes=new Uint8Array(readFileSync(`src/shards/nine-dragon-stack/${input.compiled.source}`));
if(ninePracticeBytes.byteLength!==input.compiled.bytes||hashImmutableBytes(ninePracticeBytes)!==input.compiled.hash||script.module!==`blobs/wasm/${input.compiled.hash}.wasm`)throw new Error('Actual practice module differs');
const assets=new Map([[input.compiled.hash,ninePracticeBytes]]);
/** The same admitted byte map lent to the test's actual existing native owner. */
export function lendNinePractice(owner:Scope):void {ReturnProgram.lendModules(owner,assets,[ninePracticeRows.script]);}
