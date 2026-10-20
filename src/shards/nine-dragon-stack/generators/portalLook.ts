import { CircleGeometry, Matrix4, MeshBasicMaterial, TorusGeometry } from 'three';
import { parseSceneBuffers } from '@wildshard/format/sceneBuffers';
import { parseWorldScene } from '@wildshard/format/clientChannels';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { compressGlb } from '@wildshard/sdk/bake/glbCompression';
import { parseWorldScenes, type WorldScenesSection } from '@wildshard/format/worldScenes';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { portalPlanRows } from './portalEntries';

/** Original instanced rings/discs and deterministic sparks on the three look
 * graphs. Local disc positions stay local: its swirl reads positionGeometry. */
export function portalLookRows(): { blobs: NamedBlob[]; scenes: WorldScenesSection } {
  const plan = portalPlanRows(), portals = [...plan.decks, plan.square];
  const matrices = portals.flatMap(p => new Matrix4().makeRotationY(Math.atan2(p.nx, p.nz)).setPosition(p.x, p.y + plan.ring.lift, p.z).toArray());
  const positions: number[] = [], across: number[] = [], seeds: number[] = [];
  for (const [i, p] of portals.entries()) for (let s = 0; s < 36; s++) {
    positions.push(p.x, p.y + plan.ring.lift, p.z); across.push(-p.nz, 0, p.nx);
    seeds.push((s * .618034 + i * .13) % 1, (s * .381966 + i * .29) % 1);
  }
  const channels = [['position', positions, 3], ['aAcross', across, 3], ['aSeed', seeds, 2]] as const;
  const sparks = parseSceneBuffers({ version: 1, name: 'portal-sparks',
    buffers: channels.map(([id, values]) => ({ id, storage: 'f32', bytes: btoa(Array.from(new Uint8Array(Float32Array.from(values).buffer), value => String.fromCodePoint(value)).join('')) })),
    attributes: channels.map(([id, , size]) => ({ id, buffer: id, size })),
    geometries: [{ id: 'sparks', attributes: { position: 'position', aAcross: 'aAcross', aSeed: 'aSeed' } }],
    draws: [{ id: 'sparks', name: 'portal-sparks', draw: { kind: 'points', geometry: 'sparks' } }] });
  const scene = parseWorldScene({ imports: [], scene: { version: 1, root: 'root', textures: [],
    materials: ['ring', 'disc'].map(id => ({ kind: 'port', id, source: id })),
    nodes: [{ kind: 'group', id: 'root', name: 'portals', children: ['ring', 'disc'] },
      ...['ring', 'disc'].map(id => ({ kind: 'mesh', id, name: id === 'ring' ? 'portal-rings' : 'portal-swirls', geometry: id, material: id,
        instances: portals.length, matrices, missing: 'omit', renderOrder: id === 'ring' ? 0 : 4 }))] } });
  const json = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
  const material = new MeshBasicMaterial();
  const shapes = [['ring', new TorusGeometry(plan.ring.r, plan.ring.tube, 8, 48)], ['disc', new CircleGeometry(plan.ring.r - plan.ring.tube * .5, 40)]] as const;
  const blobs = shapes.map(([id, geometry]) => nameBlob(`world/portals/${id}.glb`, 'glb', compressGlb(staticGlb([{ geometry, material, nativeAttributes: true, compactIndex: true }], id))));
  for (const [, geometry] of shapes) geometry.dispose(); material.dispose();
  return { blobs: [...blobs, nameBlob('world/portals/scene.json', 'json', json(scene)), nameBlob('world/portals/sparks.json', 'json', json(sparks))],
    scenes: parseWorldScenes({ version: 1, libraries: [{ id: 'portals', kind: 'owned', models: shapes.map(([id]) => ({ id, file: `world/portals/${id}.glb` })) }],
    materials: ['ring', 'disc', 'sparks'].map(id => ({ id: `portal-${id}`, kind: 'look', look: `nine-portal-${id}` })),
    steps: [{ id: 'portals', scene: 'world/portals/scene.json', geometry: { ring: { library: 'portals', model: 'ring' }, disc: { library: 'portals', model: 'disc' } },
      materials: { ring: 'portal-ring', disc: 'portal-disc' }, draws: [{ kind: 'buffered', file: 'world/portals/sparks.json', material: 'portal-sparks', order: 5 }] }] }) };
}
