import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute } from 'node:path';
import { CLOSED_ANATOMY_INPUT, resolveClosedAnatomyInput } from './puffer-closed-anatomy-admission.mjs';

export const V23_PREVIEW_INPUT = Object.freeze({ candidate: 'V23',
  source: 'art/driftwood-isle/approved-puffer/unaccepted-native-v23.json',
  sourceSha256: '18e8847e87e9e6d9546000572e1775cced8b20b78c0317e2a0599b5fb3a4fd68' });
export const previewHash = bytes => createHash('sha256').update(bytes).digest('hex');

/** Explicit pinned identity. Optional descriptors never mutate the preserved V23 default. */
export function resolvePufferPreviewInput(root, descriptor, dimensions) {
  const legacy = descriptor === undefined || descriptor === null;
  const descriptorBytes = legacy ? null : readFileSync(descriptor);
  const input = descriptorBytes === null ? V23_PREVIEW_INPUT : JSON.parse(descriptorBytes.toString('utf8'));
  if (descriptorBytes !== null && input?.schema === CLOSED_ANATOMY_INPUT.schema)
    return resolveClosedAnatomyInput(root, descriptorBytes, dimensions);
  if (input === null || typeof input !== 'object' || !/^V[0-9]+$/u.test(input.candidate)
    || typeof input.source !== 'string' || !/^[a-f0-9]{64}$/u.test(input.sourceSha256)) throw new Error('Invalid native candidate descriptor');
  const source = resolve(root, input.source), sourceRelative = relative(root, source);
  if (sourceRelative.startsWith('..') || isAbsolute(sourceRelative)) throw new Error('Native source must be inside this project');
  const sourceBytes = readFileSync(source), dimensionBytes = readFileSync(dimensions);
  if (previewHash(sourceBytes) !== input.sourceSha256) throw new Error('Pinned native source hash mismatch');
  let measurementSha256 = null;
  if (!legacy) {
    if (typeof input.measurement !== 'string') throw new Error('New candidates require a measured dimension receipt');
    const receiptPath = resolve(root, input.measurement), receiptRelative = relative(root, receiptPath);
    if (receiptRelative.startsWith('..') || isAbsolute(receiptRelative)) throw new Error('Measurement must be inside this project');
    const bytes = readFileSync(receiptPath), receipt = JSON.parse(bytes.toString('utf8'));
    if (receipt.sourceSha256 !== input.sourceSha256 || receipt.dimensionsSha256 !== previewHash(dimensionBytes)
      || receipt.colliderAcceptance !== false || receipt.visualAcceptance !== false) throw new Error('Native dimension receipt mismatch');
    measurementSha256 = previewHash(bytes);
  }
  return { candidate: input.candidate, source, sourceRelative, sourceBytes, dimensionBytes, measurementSha256 };
}
