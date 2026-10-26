import type { PrivateScene, WorldSceneRecipe } from '@wildshard/format/clientChannels';
import { bakeSkyMillModel } from './millModel';

/** Source-owned mill hierarchy and motion bindings, with fresh rows for every caller. */
export interface SkyMillSceneValues {
  readonly MILL_SCENE: {
    readonly recipe: WorldSceneRecipe;
    readonly parts: readonly string[];
    readonly cloth: readonly string[];
    readonly bindings: {
      readonly hub: { readonly kind: 'group'; readonly part: string };
      readonly hubAt: { readonly kind: 'vector'; readonly value: readonly [number, number, number] };
    };
  };
}

/** Derive the original mill hierarchy while borrowing native geometry and painted materials. */
export async function millSceneValues(read: (url: string) => Uint8Array): Promise<SkyMillSceneValues> {
  const { rows: model } = await bakeSkyMillModel(read);
  const hub: [number, number, number] = [0, model.hubAt.y, model.hubAt.z], shaft: [number, number, number] = [0, model.hubAt.y, model.hubAt.z - 0.6];
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
  return { MILL_SCENE: { recipe, parts, cloth, bindings: { hub: { kind: 'group', part: 'hub' }, hubAt: { kind: 'vector', value: hub } } } };
}

/** Retained publication adapter preserves the complete original JSON wire. */
export async function millSceneSource(read: (url: string) => Uint8Array): Promise<Uint8Array> {
  return new TextEncoder().encode(`${JSON.stringify(await millSceneValues(read))}\n`);
}
