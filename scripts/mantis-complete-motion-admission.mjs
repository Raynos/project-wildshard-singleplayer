import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { admitMantisPrecontact } from './mantis-precontact-admission.mjs';

const receiptPath = 'docs/reviews/mantis-complete-motion-plan/source-freeze.json';
const receiptSha256 = '04109946cd9439e075b69ba911fc34067b5fcb23de021243c6bce3ca90bda420';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
/** Source-evidence admission only. This does not admit a product, replacement host or visual quality. */
export function admitMantisCompleteMotionSource(root) {
  const original = admitMantisPrecontact(root), bytes = readFileSync(resolve(root, receiptPath));
  if (hash(bytes) !== receiptSha256) throw new Error('Mantis complete motion exact source receipt mismatch');
  const receipt = JSON.parse(bytes.toString('utf8'));
  if (receipt.schema !== 'wildshard.mantis.complete-motion.source.v1' || receipt.productBuilt !== false
    || receipt.visualAcceptance !== false || receipt.runtimeAcceptance !== false || receipt.colliderAcceptance !== false || receipt.sourceMotionAcceptance !== false)
    throw new Error('Mantis complete motion source scope mismatch');
  for (const [path, expected] of Object.entries(receipt.files)) {
    if (path.startsWith('/') || path.split('/').includes('..') || hash(readFileSync(resolve(root,path))) !== expected)
      throw new Error(`Mantis complete motion source tuple mismatch: ${path}`);
  }
  return { receipt, original };
}
