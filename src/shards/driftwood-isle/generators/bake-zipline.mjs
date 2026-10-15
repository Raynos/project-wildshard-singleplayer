// Authored launch and Explorer geometry; the page owns materials, collision and the ride.
import { Vector3, Matrix4, Quaternion, MeshStandardMaterial } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { CableLayout } from '@wildshard/sdk/movers';
import { buildZiplineGeometry } from './lookout.ts';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { byteWriter, outputHash } from '../../../../scripts/bake-output.mjs';

const writer = byteWriter(process.argv.includes('--check'), 'driftwood-zipline');
const layout = JSON.parse(readFileSync(new URL('../data/spotsRows.json', import.meta.url), 'utf8')).zipline;
const specimenLayout = { top: { x: 0, y: 0, z: 0 }, bottom: { x: 13, y: -5, z: 3 } };
const cable = row => new CableLayout({ top: new Vector3(row.top.x, row.top.y, row.top.z), bottom: new Vector3(row.bottom.x, row.bottom.y, row.bottom.z), sag: row.sag ?? 1.6 });
const world = buildZiplineGeometry(cable(layout)), specimenCable = cable(specimenLayout), specimen = buildZiplineGeometry(specimenCable);
const at = new Vector3(), yaw = specimenCable.park(at);
specimen.trolley.applyMatrix4(new Matrix4().compose(at, new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw), new Vector3(1, 1, 1)));
const material = new MeshStandardMaterial({ vertexColors: true });
const files = {};
for (const [name, geometry] of Object.entries({ world: world.rig, trolley: world.trolley, specimen: specimen.rig, parked: specimen.trolley })) {
  const customAttributes = Object.fromEntries(Object.keys(geometry.attributes).filter(key => !['position', 'normal', 'color', 'uv'].includes(key)).map(key => [`_${key.toUpperCase()}`, key]));
  const bytes = staticGlb([{ geometry, material, customAttributes }], `zipline-${name}`);
  const file = `zipline-${outputHash(bytes)}.glb`;
  writer.put(fileURLToPath(new URL(`../../../../public/assets/driftwood-isle/baked/${file}`, import.meta.url)), bytes);
  files[name] = `/assets/driftwood-isle/baked/${file}`;
  console.info(`${name}: ${bytes.byteLength} B; channels ${Object.keys(geometry.attributes).join(',')}`);
  geometry.dispose();
}
material.dispose();
writer.put(fileURLToPath(new URL('../data/zipline.generated.json', import.meta.url)), `${JSON.stringify({ ...files, layout, specimenLayout }, null, 2)}\n`);
writer.finish();
