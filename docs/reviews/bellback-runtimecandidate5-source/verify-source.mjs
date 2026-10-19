/** Read-only source closure verification. Does not build, regenerate or promote a product. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { admitBellbackCaptured, bellbackHash, BELLBACK_CAPTURED_REQUIRED, BELLBACK_CAPTURED_CANDIDATE } from '../../../scripts/bellback-captured-admission.mjs';
const root = resolve(import.meta.dirname, '../../..');
const manifest = JSON.parse(readFileSync(resolve(root, 'docs/reviews/bellback-runtimecandidate5-source/manifest.json')));
const { receipt, metadata, payload } = admitBellbackCaptured(root);
const expected = [...BELLBACK_CAPTURED_REQUIRED, `${BELLBACK_CAPTURED_CANDIDATE}/admission.json`].sort();
if (JSON.stringify(manifest.files.map(row => row.path).sort()) !== JSON.stringify(expected)) throw new Error('Incomplete source freeze');
for (const row of manifest.files) {
  const bytes = readFileSync(resolve(root, row.path));
  if (bytes.length !== row.bytes || bellbackHash(bytes) !== row.sha256) throw new Error(`Source freeze mismatch: ${row.path}`);
}
console.info(JSON.stringify({ candidate: receipt.candidate, files: manifest.files.length,
  posePolicy: metadata.bodies[0].dims.rigidCorpse.posePolicy, payloadSha256: bellbackHash(payload),
  runtimeAcceptance: false, contactAcceptance: false }));
