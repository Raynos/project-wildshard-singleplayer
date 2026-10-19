import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export const IGUANA_SOURCE = 'art/driftwood-isle/approved-bloomthroat-iguana/complete-character-next';
const pins = {
 'metadata.json':'b1dfd298135f609f01ad8195c242617073f0d184b79be6636bc1a0c961111b14',
 'payload.bin':'6f53f402e8574c985f87b95fe80bd5b98a445a2e221688686f1b1714ec17e219',
 'native-source.json':'3a8c1d134385720d2d77051c8a5aac138a25773cd01771ee6eedc304f5673171',
 'bloomthroat-iguana-complete-next.glb':'8f9337f5675a2692b01e097db4b5df813699bc21e9e403c88b441ed516472d43',
};
/** Source integrity is separate from runtime admission. This diagnostic never grants build permission. */
export function inspectBloomthroatIguanaNative(root) {
 for (const [name, expected] of Object.entries(pins)) {
  const bytes = readFileSync(resolve(root,IGUANA_SOURCE,name));
  if(createHash('sha256').update(bytes).digest('hex')!==expected)throw new Error(`Iguana selected source changed: ${name}`);
 }
 const metadata=JSON.parse(readFileSync(resolve(root,IGUANA_SOURCE,'metadata.json'),'utf8'));
 const body=metadata.bodies[0];
 if(metadata.bodies.length!==1||body.kind!=='bloomthroat-iguana'||body.variant!==body.kind||body.bones.length!==27||body.hard.length!==16)throw new Error('Wrong Iguana tuple');
 if(body.dims.bodyY!==.78||body.dims.bodyRadius!==.623||body.dims.headRadius!==.574||body.dims.rigidCorpse!==undefined)throw new Error('Iguana dimensions or corpse changed');
 return {metadata,payload:readFileSync(resolve(root,IGUANA_SOURCE,'payload.bin')),pins,
  receipt:{candidate:'complete-character-next-native-lifecycle1',sourceIntegrity:true,buildAllowed:false,visualAcceptance:false,runtimeAcceptance:false,colliderAcceptance:false,
   blockers:['Upper chest is real body geometry outside the retained torso hit capsule; not merely decorative appendages.','Default single-box physical corpse requires the bounded weighted-vertex contact study; no hull padding or root lift is permitted.']}};
}
/** Fail closed. A complete source author is retained, but cannot accidentally become an admitted app. */
export function admitBloomthroatIguanaNative(root) {
 const candidate=inspectBloomthroatIguanaNative(root);
 throw new Error(`Iguana runtime admission refused: ${candidate.receipt.blockers.join(' ')}`);
}
