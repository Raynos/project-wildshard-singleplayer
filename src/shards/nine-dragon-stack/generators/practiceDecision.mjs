import { buildCourseProgram } from '@wildshard/commons/practiceCourse';
import { readFileSync,writeFileSync } from 'node:fs';

/** Build-only room law; the emitted course rows carry the admitted stateless guest. */
export function buildPracticeDecision() { return buildCourseProgram('checkpoints'); }

const target=new URL('../behaviour/practice.generated.json',import.meta.url);
const bytes=`${JSON.stringify(await buildPracticeDecision(),null,2)}\n`;
if(process.argv.includes('--check')) {
  if(readFileSync(target,'utf8')!==bytes)throw new Error('Practice decision program is stale');
} else writeFileSync(target,bytes);
console.info('nine-practice: compiled course rules with the standard 256-line author ceiling');
