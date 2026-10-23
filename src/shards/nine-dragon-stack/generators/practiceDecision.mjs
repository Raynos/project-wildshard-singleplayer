import { buildCourseProgram } from '@wildshard/commons/practiceCourse';
import { readFileSync,writeFileSync } from 'node:fs';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';

/** Build-only room law; the emitted course rows carry the admitted stateless guest. */
export function buildPracticeDecision() { return buildCourseProgram('checkpoints',{},true); }

const target=new URL('../behaviour/practice.generated.json',import.meta.url);
const {binary,...program}=await buildPracticeDecision();
if(binary===undefined)throw new Error('Missing original compiled course binary');
const wasm=new URL('../behaviour/practice.generated.wasm',import.meta.url),hash=hashImmutableBytes(binary);
if(program.script.module!==`blobs/wasm/${hash}.wasm`)throw new Error('Practice module hash differs');
const bytes=`${JSON.stringify({...program,compiled:{source:'behaviour/practice.generated.wasm',bytes:binary.length,hash}},null,2)}\n`;
if(process.argv.includes('--check')) {
  if(readFileSync(target,'utf8')!==bytes)throw new Error('Practice decision program is stale');
  if(!readFileSync(wasm).equals(Buffer.from(binary)))throw new Error('Practice decision binary is stale');
} else {writeFileSync(wasm,binary);writeFileSync(target,bytes);}
console.info('nine-practice: compiled course rules with the standard 256-line author ceiling');
