/** Root freezes after writers settle; this proposal never grants build permission. */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { retainedCandidateProducts, digest, ACCEPTANCE } from './candidate-inputs.mjs';
import { prototypeSnapshot, NINE } from './prototype-inputs.mjs';

const [hostRoot, output] = process.argv.slice(2);
if (process.argv.length !== 4) throw new Error('Usage: prototype-freeze.mjs <retained-host-root> <NEW snapshot.json>');
retainedCandidateProducts(resolve('.'), hostRoot);
const snapshot = prototypeSnapshot(resolve('.'));
writeFileSync(output, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx' });
console.info(JSON.stringify({ sourceSnapshotSha256: digest(Buffer.from(JSON.stringify(snapshot))), products: NINE, buildAllowed: false, acceptance: ACCEPTANCE, note: 'Root must issue a separate exact prototype-nine.permission.v1. No runtime/quality/public acceptance.' }, null, 2));
