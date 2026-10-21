/** Root uses this only after writers settle. Produces a proposal, never build permission. */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sourceSnapshot, digest, retainedCandidateProducts, ACCEPTANCE } from './candidate-inputs.mjs';

const [hostRoot, output] = process.argv.slice(2);
if (process.argv.length !== 4) throw new Error('Usage: candidate-freeze.mjs <retained-host-root> <NEW snapshot.json>');
retainedCandidateProducts(resolve('.'), hostRoot);
const snapshot = sourceSnapshot(resolve('.'));
writeFileSync(output, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx' });
console.info(JSON.stringify({ sourceSnapshotSha256: digest(Buffer.from(JSON.stringify(snapshot))), buildAllowed: false, admitted: false, acceptance: ACCEPTANCE, conchDeltas: snapshot.conchDeltas, note: 'Source proposal only. Root must review exact bytes and issue a separate bounded candidate-permission.v1 before any build.' }, null, 2));
