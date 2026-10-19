import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateSync, deflateSync } from 'node:zlib';

export const CONCH_ORIGINAL = 'art/driftwood-isle/approved-conch/runtime-admission/character-pass-native1';
export const CONCH_CANDIDATE = 'art/driftwood-isle/approved-conch/runtime-admission/arena-candidate1';
export const conchHash = bytes => createHash('sha256').update(bytes).digest('hex');
const pins = {
  'metadata.json': '1f371d5f2e54934e59b08e9dcfeeda08345e31b4db48f7516a6dbc51b0828575',
  'payload.bin': '33cf3233f6a95727729023921add326e9a4eaf3efe468a76ac5233ef07fc43e5',
  'conch-character-pass-native.json': '2613acca174917dc71ab77a5d31cf23cc14828c6b28db8ddbfc74614c3ec69a3',
};
/** Proper rigid transform, not reflection: T(0,0,.05) Ry(pi). No resize or floor fitting. */
export const conchCanonicalPoint = ([x,y,z]) => [x === 0 ? 0 : -x, y, .05-z];
export const conchNativePoint = ([x,y,z]) => [x === 0 ? 0 : -x, y, .05-z];

/** Only this pinned tuple can enter the candidate builder. Original files remain immutable. */
export function prepareConchFrame(root) {
  const files = Object.fromEntries(Object.entries(pins).map(([name, expected]) => {
    const raw = readFileSync(resolve(root, CONCH_ORIGINAL, name));
    if (conchHash(raw) !== expected) throw new Error(`Conch native tuple mismatch: ${name}`);
    return [name, raw];
  }));
  const metadata = JSON.parse(files['metadata.json']);
  const native = JSON.parse(files['conch-character-pass-native.json']);
  const body = metadata.bodies[0];
  if (metadata.bodies.length !== 1 || body.kind !== 'conch-duelist' || body.variant !== 'conch-duelist'
    || body.bones.length !== 15 || JSON.stringify(body.bones[0]) !== '{"name":"body","parent":null,"pos":[0,1.04,0.05]}') throw new Error('Wrong Conch rig');
  const unpacked = inflateSync(files['payload.bin']);
  if (unpacked.length !== metadata.bytes) throw new Error('Wrong native byte count');
  let halfLen = 0;
  body.hard.forEach((part, index) => {
    if (part.row.attrs[0][0] !== 'position' || part.row.attrs[0][1] !== 'f32' || part.row.attrs[0][2] !== 3) throw new Error('Unsupported position encoding');
    const source = native.parts[index];
    for (let vertex = 0; vertex < part.row.count; vertex++) {
      const at = part.offsets[0] + vertex*12;
      const original = [0,1,2].map(axis => unpacked.readFloatLE(at+axis*4));
      if (original.some((value, axis) => value !== Math.fround(source.positions[vertex*3+axis]))) throw new Error('Native geometry disagreement');
      const point = conchCanonicalPoint(original);
      point.forEach((value, axis) => { unpacked.writeFloatLE(value, at+axis*4); });
      halfLen = Math.max(halfLen, Math.abs(point[2]));
    }
  });
  body.bones = body.bones.map(bone => ({ ...bone, pos: conchCanonicalPoint(bone.pos) }));
  body.dims.feet = body.dims.feet.map(([x,z]) => { const [a,,c] = conchCanonicalPoint([x,0,z]); return [a,c]; });
  body.dims.bodyHalfLen = halfLen;
  const payload = deflateSync(unpacked, { level: 9 });
  metadata.file = `/assets/driftwood-isle/conch-canonical-${conchHash(payload)}.bin`;
  return { metadata, payload, transform: { schema: 'wildshard.conch.canonical-frame.v1',
    matrixRowMajor: [-1,0,0,0, 0,1,0,0, 0,0,-1,.05, 0,0,0,1], determinant: 1,
    nativeForward: [0,0,-1], canonicalForward: [0,0,1], originalFiles: pins,
    changes: ['positions', 'absolute bind pivots', 'diagnostic feet', 'diagnostic bodyHalfLen', 'content-addressed payload path'],
    unchanged: ['triangle order', 'linear colors', 'skin indices', 'skin weights', 'fur length', 'bone names and parents', 'scale', 'all original files'],
    dimensionsStatus: 'Conservative rest diagnostics only; not gameplay tuning',
    visualAcceptance: false, animationAcceptance: false, colliderAcceptance: false, runtimeAcceptance: false } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = process.cwd(), result = prepareConchFrame(root), output = resolve(root, CONCH_CANDIDATE);
  mkdirSync(output); // Fail closed if a candidate already exists.
  writeFileSync(resolve(output, 'metadata.json'), `${JSON.stringify(result.metadata)}\n`, { flag: 'wx' });
  writeFileSync(resolve(output, 'payload.bin'), result.payload, { flag: 'wx' });
  writeFileSync(resolve(output, 'frame-transform.json'), `${JSON.stringify(result.transform, null, 2)}\n`, { flag: 'wx' });
}
