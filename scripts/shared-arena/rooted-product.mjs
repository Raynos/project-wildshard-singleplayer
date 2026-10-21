import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const PITCHER_IDENTITY = Object.freeze({
  sourceHash: 'fdde16081c2d83ce5a6861ee46107522aaee33404408592ac021a17409fb76d3',
  bodySha256: '70cc84fae55360f410433857685713a2475a0974cf853740f1ccbde725e6957e',
  metadataSha256: 'a1badfcd0a4039ca031356b4d5963450e1f3e472ae1ff427f95276da828cfdfa',
  kind: 'brine-pitcher-matriarch', variant: 'brine-pitcher-matriarch',
});
export const PITCHER_LIFECYCLE_CHECKS = Object.freeze([
  'movement', 'bothAttackPhases', 'attackDamage', 'death', 'loot', 'defeat',
  'retry', 'backRestart', 'reload', 'emptyPersistence', 'faultFreeLifecycle',
]);
function safePath(root, path) {
  if (typeof path !== 'string' || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Unsafe rooted product path');
  let at = resolve(root);
  if (lstatSync(at).isSymbolicLink()) throw new Error('Rooted product symlink');
  for (const part of path.split('/')) { at = join(at, part); if (lstatSync(at).isSymbolicLink()) throw new Error('Rooted product symlink'); }
  return at;
}
function pinned(root, ref) {
  if (!ref || !/^[a-f0-9]{64}$/u.test(ref.sha256)) throw new Error('Missing exact rooted artifact pin');
  const path = safePath(root, ref.path);
  if (!lstatSync(path).isFile()) throw new Error('Rooted artifact is not a file');
  const bytes = readFileSync(path);
  if (sha(bytes) !== ref.sha256) throw new Error(`Rooted artifact mismatch: ${ref.path}`);
  return JSON.parse(bytes);
}
function inventory(root, omitted = new Set()) {
  const result = {};
  const walk = (path, prefix = '') => {
    if (lstatSync(path).isSymbolicLink()) throw new Error('Rooted product symlink');
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const name = prefix + entry.name;
      if (entry.isSymbolicLink()) throw new Error('Rooted product symlink');
      if (entry.isDirectory()) walk(join(path, entry.name), `${name}/`);
      else if (!entry.isFile()) throw new Error('Unsupported rooted artifact');
      else if (!omitted.has(name)) result[name] = sha(readFileSync(join(path, entry.name)));
    }
  };
  walk(root); return result;
}
/** Structure/byte checks only; this does not create evidence or grant approval. */
export function verifyRootedLifecycleDecision(root, decision, identity) {
  if (decision.schema !== 'wildshard.shared-arena.rooted-admission.v1' || decision.synthetic !== false
    || decision.admitted !== true || decision.scope !== 'shared-arena' || decision.completeLifecycle !== true
    || !isDeepStrictEqual(decision.identity, identity)) throw new Error('Missing affirmative complete-lifecycle Arena admission');
  const evidence = pinned(root, decision.lifecycle), review = pinned(root, decision.independentReview);
  if (evidence.synthetic !== false || evidence.complete !== true || !isDeepStrictEqual(evidence.identity, identity)
    || PITCHER_LIFECYCLE_CHECKS.some(key => evidence.checks?.[key] !== 'passed')
    || review.synthetic !== false || review.verdict !== 'approved' || !isDeepStrictEqual(review.identity, identity)
    || review.lifecycleSha256 !== decision.lifecycle.sha256) throw new Error('Incomplete independently reviewed lifecycle evidence');
}
/** Caller supplies immutable artifact references, never a build GO in place of admission.
 * Decision schema is deliberately separate from the isolated build pin and host receipt.
 * No default descriptor or passing decision is shipped. Fixture decisions are not real proof.
 */
export function admitRootedPitcher(root, descriptor) {
  if (descriptor?.schema !== 'wildshard.shared-arena.rooted-input.v1' || descriptor.id !== 'pitcher' || descriptor.receipt?.path !== 'rooted-pitcher-proof.json') throw new Error('Invalid rooted input descriptor');
  const host = safePath(root, descriptor.host);
  const receipt = pinned(host, descriptor.receipt), pin = pinned(root, descriptor.pin);
  const decision = pinned(root, descriptor.decision);
  if (receipt.schema !== 'wildshard.rooted-pitcher.isolated-host.v1' || receipt.synthetic !== false
    || receipt.modelAdmission !== false || receipt.publicAdmission !== false
    || pin.schema !== 'wildshard.rooted-pitcher.isolated-build-pin.v2' || pin.synthetic !== false
    || pin.buildAllowed !== true || pin.browserAllowed !== true || pin.modelAdmission !== false || pin.publicAdmission !== false
    || receipt.pinSha256 !== descriptor.pin.sha256 || !isDeepStrictEqual(receipt.pin, pin)
    || pin.pinPath !== descriptor.pin.path || `${pin.outputPath}/dist` !== descriptor.host) throw new Error('Rooted isolated identity mismatch');
  for (const [path, hash] of Object.entries(receipt.sourceFiles ?? {})) {
    if ((pin.sourceFiles?.[path] ?? pin.files?.[path]) !== hash
      || sha(readFileSync(safePath(root, path))) !== hash) throw new Error('Rooted source closure differs from isolated pin');
  }
  const canonical = 'test/proof/brine-pitcher-native-owner/source';
  if (pin.files?.[`${canonical}/core-runtime-study/metadata.json`] !== PITCHER_IDENTITY.metadataSha256
    || pin.files?.[`${canonical}/v3/payload.bin`] !== PITCHER_IDENTITY.bodySha256) throw new Error('Rooted canonical input mismatch');
  const identity = { ...PITCHER_IDENTITY, host: descriptor.host, pinSha256: descriptor.pin.sha256, receiptSha256: descriptor.receipt.sha256 };
  verifyRootedLifecycleDecision(root, decision, identity);
  if (!isDeepStrictEqual(inventory(host, new Set([descriptor.receipt.path])), receipt.hostFiles)
    || !isDeepStrictEqual(inventory(join(host, 'practice-product')), receipt.productFiles)) throw new Error('Rooted immutable inventory mismatch');
  const read = path => JSON.parse(readFileSync(safePath(host, path)));
  const index = read('practice-product/shard.json'), validation = read('practice-product/validation.json');
  if (receipt.sourceHash !== identity.sourceHash || index.build.sourceHash !== identity.sourceHash
    || validation.sourceHash !== identity.sourceHash || validation.indexHash !== receipt.productFiles['shard.json']) throw new Error('Rooted product identity mismatch');
  for (const file of [...index.files, ...index.sections]) if (receipt.productFiles[file.path] !== file.hash) throw new Error('Rooted product member mismatch');
  const json = name => { const matches = index.files.filter(file => file.name === name); if (matches.length !== 1) throw new Error('Rooted product member missing or duplicated'); return read(`practice-product/${matches[0].path}`); };
  const bodies = json('practice/bodies.json'), looks = json('practice/looks.json');
  const metadata = index.files.find(file => file.name === 'practice/bodies.json');
  if (metadata.hash !== identity.metadataSha256 || bodies.bodies.length !== 1 || bodies.bodies[0].kind !== identity.kind
    || bodies.bodies[0].variant !== identity.variant || looks.looks.length !== 1 || looks.looks[0].kind !== identity.kind
    || looks.looks[0].pose !== 'poses/brine-pitcher-native-owner.json'
    || bodies.file !== `/assets/driftwood-isle/brine-pitcher-native-${identity.bodySha256}.bin`
    || receipt.hostFiles[bodies.file.slice(1)] !== identity.bodySha256) throw new Error('Rooted body identity mismatch');
  return { id: 'pitcher', host, index, validation, bodies, looks, previewFile: descriptor.receipt.path,
    preview: { candidate: 'rooted-pitcher-native7', mode: 'native-owner', bodyFile: bodies.file },
    nativePractice: { [`${identity.kind}:${identity.variant}`]: { poseFile: 'poses/brine-pitcher-native-owner.json', corpse: 'anchored-held' } }, admissionDecision: descriptor.decision };
}
