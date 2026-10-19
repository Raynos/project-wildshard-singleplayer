/** Exact selected corrected source only. No older asset fallback or native canonical admission. */
import { createHash } from 'node:crypto';
import { readFileSync, lstatSync } from 'node:fs';
import { resolve, join } from 'node:path';
const HERE = 'art/driftwood-isle/approved-conch/selected-native-view';
const NORMAL = 'art/driftwood-isle/approved-conch/selected-native-normals';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const NORMAL_FREEZE_SHA256 = 'a1e13c4fb4a62a5bba2ab978621d9cf955c031e0eed8b1d237cbec8811baba60';
const PINS_SHA256 = '38ad23566f67e38457ec7210c682e9ed18d7a2c7bfacd59c82a8e368d32965be';
export function safeRead(root, path) {
  if (typeof path !== 'string' || path.startsWith('/') || path.includes('\\') || path.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Unsafe selected-native path');
  let target = root;
  for (const part of path.split('/')) { target = join(target, part); if (lstatSync(target).isSymbolicLink()) throw new Error('Selected-native symlink refused'); }
  return readFileSync(target);
}
export function verifyPins(root, pins) {
  if (!pins || typeof pins !== 'object' || Array.isArray(pins) || Object.keys(pins).length < 20) throw new Error('Missing selected-native pins');
  for (const [path, expected] of Object.entries(pins)) {
    const bytes = safeRead(root, path);
    if (bytes.length !== expected.bytes || hash(bytes) !== expected.sha256) throw new Error(`Selected-native bytes changed: ${path}`);
  }
}
export function admitSelectedNative(root = resolve(import.meta.dirname, '../../../..')) {
  const pinBytes = safeRead(root, `${HERE}/native-pins.json`);
  if (hash(pinBytes) !== PINS_SHA256) throw new Error('Selected-native pin inventory changed or root checkpoint pending');
  const pins = JSON.parse(pinBytes); verifyPins(root, pins);
  const freezeBytes = safeRead(root, `${NORMAL}/freeze.json`);
  if (hash(freezeBytes) !== NORMAL_FREEZE_SHA256) throw new Error('Selected-normal freeze changed');
  const receipt = JSON.parse(safeRead(root, `${NORMAL}/native/closure.json`));
  const metadata = JSON.parse(safeRead(root, `${NORMAL}/native/metadata.json`));
  const payload = safeRead(root, `${NORMAL}/native/payload.bin`);
  if (receipt.glbSha256 !== '21a6fd0d5e300c58952408913c69824228304141daab461fcb0122a388e27f1a'
    || receipt.sourceMeshes !== 51 || receipt.sourcePrimitives !== 95 || receipt.stats.vertices !== 6570
    || metadata.file !== `/assets/driftwood-isle/conch-selected-normals-${hash(payload)}.bin`
    || metadata.bodies.length !== 1 || metadata.bodies[0].bones.length !== 15
    || metadata.bodies[0].hard.length !== 15 || metadata.bodies[0].kind !== 'conch-duelist') throw new Error('Wrong selected-native source tuple');
  for (const part of metadata.bodies[0].hard) {
    if (JSON.stringify(part.row.attrs) !== JSON.stringify([['position','f32',3,false],['normal','f32',3,false],['color','f32',3,false],['skinIndex','u16',4,false],['skinWeight','f32',4,false],['furLen','f32',1,false]])) throw new Error('Selected-native channels changed');
  }
  return { receipt, metadata, payload, manifest: { schema:'wildshard.conch.selected-native-view.source.v1', candidate:'selected-corrected-source-normals-rest', sourceFreezeSha256:NORMAL_FREEZE_SHA256, files:pins, buildAllowed:false, visualAcceptance:false, runtimeAcceptance:false, animationAcceptance:false } };
}
