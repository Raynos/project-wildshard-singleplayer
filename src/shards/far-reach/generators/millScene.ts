import type { PrivateScene, WorldSceneRecipe } from '@wildshard/format/clientChannels';
import model from '../data/millModel.json' with { type: 'json' };

/** Mill hierarchy and native motion ports; geometry and painted materials remain borrowed. */
export function millSceneSource(): Uint8Array {
  const hub = [0, model.hubAt.y, model.hubAt.z], shaft: [number, number, number] = [0, model.hubAt.y, model.hubAt.z - 0.6];
  const parts = ['shaft', 'boss', 'frame', 'cloth-0', 'cloth-1', 'cloth-2', 'cloth-3'];
  const cloth = parts.filter(name => name.startsWith('cloth-'));
  const nodes: PrivateScene['nodes'] = [
    { kind: 'group', id: 'mill', children: ['shaft', 'model.tower', 'model.foot', 'hub'] },
    { kind: 'group', id: 'hub', position: [0, model.hubAt.y, model.hubAt.z], children: parts.slice(1) },
    ...parts.map(name => ({ kind: 'object' as const, id: name, source: name, missing: 'omit' as const, children: [],
      ...(name === 'shaft' ? { position: shaft } : {}) })),
    { kind: 'mesh', id: 'model.tower', name: 'far.mill.tower', geometry: 'mill-tower', material: 'tower', missing: 'omit', whenTexture: { texture: 'ready', present: true }, children: [] },
    { kind: 'mesh', id: 'model.foot', name: 'far.mill.foot', geometry: 'mill-foot', material: 'foot', missing: 'omit', whenTexture: { texture: 'ready', present: true }, children: [] },
  ];
  const recipe: WorldSceneRecipe = { scene: { version: 1, root: 'mill', nodes, materials: [{kind:'port',id:'tower',source:'tower'},{kind:'port',id:'foot',source:'foot'}], textures: [{kind:'port',id:'ready',source:'ready'}] }, imports: parts.map(name => ({id:name,kind:'baked',piece:'mill',only:{name}})) };
  return new TextEncoder().encode(`/** Authored mill assembly and borrowed motion ports; generated during the build. */\nexport const MILL_SCENE = ${JSON.stringify({ recipe, parts, cloth, bindings: { hub: { kind: 'group', part: 'hub' }, hubAt: { kind: 'vector', value: hub } } })} as const;\n`);
}
