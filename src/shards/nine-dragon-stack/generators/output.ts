import { MeshStandardMaterial } from 'three';
import { nameBlob, emitNamedBlobs } from '@wildshard/sdk/blobs';
import { buildHalo } from './jianHalo';
import { buildSword } from './jianSupport';

// JSON numbers erase -0; the numeric reviver restores its original float32 sign bit.
const json = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value, (_key, entry: unknown) => typeof entry === 'number' && Object.is(entry, -0) ? '-0' : entry));
const halo = buildHalo(), support = buildSword('wood');
const material = new MeshStandardMaterial({ flatShading: true, vertexColors: true, roughness: 0.82, metalness: 0, envMapIntensity: 0.6 });
material.name = 'sword';
/** Original float32 channels and material settings; the live halo shaders stay in fpArms. */
const emitted = emitNamedBlobs([
  nameBlob('weapons/jian-halo.json', 'json', json({ geometry: { ...halo.geo.toJSON(), uuid: '96d3a000-0000-4000-8000-000000000001' }, material: { ...halo.mat.toJSON(), uuid: '96d3a000-0000-4000-8000-000000000002' } })),
  nameBlob('weapons/jian-support.json', 'json', json({ sword: { ...support.sword.toJSON(), uuid: '96d3a000-0000-4000-8000-000000000003' }, arms: { ...support.arms.toJSON(), uuid: '96d3a000-0000-4000-8000-000000000004' }, tipY: support.tipY, baseY: support.baseY, material: { ...material.toJSON(), uuid: '96d3a000-0000-4000-8000-000000000005' } })),
]);

export const output = { namedFiles: emitted.files, assets: emitted.assets };
