import { BoxGeometry, Group, Mesh, MeshStandardMaterial, TorusGeometry } from 'three';
import { clientSceneGlb, type ClientSceneBake } from '@wildshard/sdk/bake/glb';
import entries from '../data/islets.generated.json' with { type: 'json' };
import rig from '../data/isletRig.json' with { type: 'json' };
import { isletMotionRows } from './isletMotion';
import { STRINGS } from '../data/strings';

/** Finite rest geometry for the shared private-scene host. */
function isletPool(): ClientSceneBake {
  const root = new Group(), material = new MeshStandardMaterial(); root.name = 'islet-pool';
  const link = new Mesh(new TorusGeometry(0.3, 0.075, 3, 6), material); link.name = 'islet-link'; root.add(link);
  const box = new Mesh(new BoxGeometry(1, 1, 1), material); box.name = 'islet-box'; root.add(box);
  for (const entry of entries.entries) {
    const l = entry.landing, lip = new Mesh(new BoxGeometry(2 * l.hx, 2 * l.hy, 2 * l.hz), material);
    lip.name = `islet-lip-${entry.edge}`; root.add(lip);
  }
  return clientSceneGlb(root, new Map([[material, 'unused']]));
}
export function isletGlb(): Uint8Array { return isletPool().glb; }
/** Scene storage and registry rows; the existing native mover remains the sole motion owner. */
export function isletScenes(): {
  staticScene: ClientSceneBake['scene']; scene: ClientSceneBake['scene']; rest: ReturnType<typeof isletMotionRows>['rest'];
  pieces: { id: string; name: string; category: string; file: string; surface: string; colliders: (typeof entries.entries[number]['landing'] | typeof rig.rails[number][number]['box'])[] }[];
} {
  const motion = isletMotionRows();
  const lips: ClientSceneBake['scene']['nodes'] = entries.entries.map(entry => ({
    kind: 'mesh', id: `far.islet.lip.${entry.edge}`, geometry: `islet-lip-${entry.edge}`, material: 'stone', missing: 'empty',
    position: [entry.landing.x, entry.landing.y, entry.landing.z], children: [],
  }));
  return {
    staticScene: { textures: [], version: 1, root: 'islet-static', nodes: [{ kind: 'group', id: 'islet-static', children: lips.map(row => row.id) }, ...lips],
      materials: [{ kind: 'standard', id: 'stone', properties: { color: 0x8a7468, roughness: 0.95, metalness: 0, flatShading: true } }] },
    pieces: [...entries.entries.map(entry => ({ id: `far.islet.lip.${entry.edge}`, name: STRINGS.isletLip, category: 'buildings',
      file: 'src/shards/far-reach/world/build.ts', surface: 'stone', colliders: [entry.landing] })),
      { id: 'far.islet.rails', name: STRINGS.isletRail, category: 'props', file: 'src/shards/far-reach/world/build.ts', surface: 'wood', colliders: rig.rails.flat().map(row => row.box) }],
    scene: { textures: [], version: 1, root: 'far.islets', nodes: [
      { kind: 'group', id: 'far.islets', children: [...entries.entries.map(entry => `islet.${entry.edge}`), 'links', 'gates', 'rails'] },
      ...entries.entries.flatMap<ClientSceneBake['scene']['nodes'][number]>(entry => [
        { kind: 'group', id: `islet.${entry.edge}`, children: [`islet-mesh.${entry.edge}`] },
        { kind: 'object', id: `islet-mesh.${entry.edge}`, source: `islet.${entry.edge}`, missing: 'refuse', children: [] },
      ]),
      ...(['links', 'gates', 'rails'] as const).map<ClientSceneBake['scene']['nodes'][number]>(id => ({ kind: 'mesh', id, geometry: id === 'links' ? 'islet-link' : 'islet-box',
        material: id === 'links' ? 'iron' : 'wood', missing: 'empty', instances: motion.counts[id], frustumCulled: false, children: [] })),
    ], materials: [
      { kind: 'standard', id: 'iron', properties: { color: 0x4a4244, roughness: 0.7, metalness: 0.3, flatShading: true } },
      { kind: 'standard', id: 'wood', properties: { color: 0x5a3f2e, roughness: 0.95, metalness: 0, flatShading: true } },
    ] }, rest: motion.rest,
  };
}
