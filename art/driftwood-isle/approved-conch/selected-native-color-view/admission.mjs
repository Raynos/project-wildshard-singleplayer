import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { admitSelectedNative as admitBaseline, safeRead, NORMAL_FREEZE_SHA256 } from '../selected-native-view/admission.mjs';
export { NORMAL_FREEZE_SHA256 };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const HERE = 'art/driftwood-isle/approved-conch/selected-native-color-view';
const COLOR = 'art/driftwood-isle/approved-conch/selected-native-color';
export function admitSelectedNative(root = resolve(import.meta.dirname, '../../../..')) {
  const baseline = admitBaseline(root);
  const pinsBytes = safeRead(root, `${HERE}/candidate-pins.json`);
  if (hash(pinsBytes) !== '222e7560ae2e1bfdfa01d2cac71cea446321ad0c906d78a9d45520dea3b6e73b') throw new Error('Authored-color pins changed');
  const pins = JSON.parse(pinsBytes);
  for (const [path, pin] of Object.entries(pins)) { const bytes = safeRead(root,path); if(bytes.length !== pin.bytes || hash(bytes) !== pin.sha256) throw new Error(`Color source changed: ${path}`); }
  const receipt = JSON.parse(safeRead(root, `${COLOR}/closure.json`));
  const metadata = JSON.parse(safeRead(root, `${COLOR}/metadata.json`));
  const payload = safeRead(root, `${COLOR}/payload.bin`);
  if (metadata.file !== `/assets/driftwood-isle/conch-selected-color-${hash(payload)}.bin` || metadata.bodies.length !== 1 || metadata.bodies[0].hard.length !== 15) throw new Error('Wrong authored-color tuple');
  for (const part of metadata.bodies[0].hard) {
    const attrs = part.row.attrs;
    if (JSON.stringify(attrs) !== JSON.stringify([...baseline.metadata.bodies[0].hard[0].row.attrs, ['aAuthoredColour','f32',3,false]])) throw new Error('Authored-color channels differ');
  }
  return {receipt,metadata,payload,manifest:{schema:'wildshard.conch.authored-color-view.source.v1',candidate:'selected-corrected-authored-color-rest',sourceFreezeSha256:NORMAL_FREEZE_SHA256,files:{...baseline.manifest.files,...pins},buildAllowed:false,visualAcceptance:false,runtimeAcceptance:false,animationAcceptance:false}};
}
