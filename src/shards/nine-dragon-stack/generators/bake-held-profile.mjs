import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { bakeRawColourTexture } from '@wildshard/sdk/bake/texture';
import { writeImagePixels } from '@wildshard/sdk/bake/image';

// Read declarations only: the shipped GLB and its compressed maps stay intact.
const bytes = readFileSync(new URL('../../../../public/assets/nine-dragon/viewmodel/fp-rig.glb', import.meta.url));
const source = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
const rows = source.nodes.filter(node => node.mesh !== undefined).map((node, index) => {
  const primitives = source.meshes[node.mesh].primitives;
  if (primitives.length !== 1 || typeof node.name !== 'string') throw new Error('Held rig requires named single-primitive meshes');
  const extras = node.extras ?? {}, attributes = Object.keys(primitives[0].attributes);
  const channels = { aMat: '_amat', ...(attributes.includes('_AFACE') ? { aFace: '_aface' } : {}),
    ...(attributes.includes('_AHULLN') ? { aHullN: '_ahulln' } : {}), ...(attributes.includes('NORMAL') ? { aNs: attributes.includes('_ANS') ? '_ans' : 'normal' } : {}) };
  return { name: node.name, look: `nine-vm-rig-${index}`, attributes, channels,
    hull: extras.hull === true, width: extras.hullK ?? 1, maps: extras.maps ?? '',
    rotation: extras.assetRot ?? [1, 0, 0, 0, 1, 0, 0, 0, 1], doubleSide: node.skin !== undefined && extras.hull !== true };
});
if (rows.length === 0 || rows.length > 64) throw new Error('Held rig mesh bound exceeded');
const writer = byteWriter(process.argv.includes('--check'), 'nine-held-profile');
const standIn = await bakeRawColourTexture(await writeImagePixels({ width: 1, height: 1, pixels: new Uint8ClampedArray([0, 0, 0, 255]) }), { colourSpace: 'linear' });
writer.put(fileURLToPath(new URL('../data/heldProfile.generated.json', import.meta.url)), JSON.stringify({ meshes: rows, standIn: Buffer.from(standIn).toString('base64') }));
writer.put(fileURLToPath(new URL('../data/heldProfile.generated.d.json.ts', import.meta.url)),
  'declare const profile: { readonly standIn: string; readonly meshes: readonly { readonly name: string; readonly look: string; readonly attributes: readonly string[]; readonly channels: Readonly<Record<string,string>>; readonly hull: boolean; readonly width: number; readonly maps: string; readonly rotation: readonly number[]; readonly doubleSide: boolean }[] };\nexport default profile;\n');
writer.finish();
