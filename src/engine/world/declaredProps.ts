import { Group, Mesh, MeshStandardMaterial, type BufferGeometry, type Material, type Object3D, type Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Scope } from '../app/scope';

function isMesh(object: Object3D): object is Mesh { return object instanceof Mesh; }

/** Admitted prop bindings; the game validates hashes and tile relationships before handing bytes to this renderer. */
export interface DeclaredProps {
  family: string; tiles: readonly { lod: number; x: number; z: number; file: string }[];
  panels: readonly { id: string; file: string; visible?: boolean }[]; models: readonly { id: string; file: string }[];
  far: string | null; textures: readonly { model: string; colour: string }[];
}
/** Level-owned roots and stable panel/model ports. Visibility/pose commands act on the returned roots. */
export interface InstalledProps { tiles: ReadonlyMap<string, Object3D>; panels: ReadonlyMap<string, Object3D>; models: ReadonlyMap<string, Object3D>; far: Object3D | null; disposeTile: (key: string) => void }
/** Parse only admitted memory, apply a resolved family and texture catalogue, and dispose everything with the level. */
export async function installDeclaredProps(props: DeclaredProps, ports: {
  scene: Object3D; scope: Scope; assets: ReadonlyMap<string, Uint8Array>; materials: ReadonlyMap<string, Material>;
  textures?: ReadonlyMap<string, Texture>; lod?: 0 | 1 | 'far'; selectedTiles?: ReadonlySet<string>; includeLibrary?: boolean;
}): Promise<InstalledProps> {
  const roots = new Group(), geometries = new Set<BufferGeometry>(), materials = new Set<Material>();
  let disposed = false;
  ports.scope.onDispose(() => { disposed = true; roots.removeFromParent(); for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); });
  const family = ports.materials.get(props.family); if (family === undefined) throw new Error(`Unresolved props family ${props.family}`);
  const parse = async (hash: string): Promise<Object3D> => {
    const bytes = ports.assets.get(hash); if (bytes === undefined) throw new Error('Missing admitted props GLB');
    const gltf = await new GLTFLoader().parseAsync(bytes.slice().buffer, '');
    const textureRef = props.textures.find((t) => t.model === hash)?.colour, texture = textureRef === undefined ? undefined : ports.textures?.get(textureRef);
    if (textureRef !== undefined && texture === undefined) throw new Error('Missing admitted props texture');
    gltf.scene.traverse((o) => {
      if (!isMesh(o)) return;
      geometries.add(o.geometry);
      const original = Array.isArray(o.material) ? o.material : [o.material];
      const converted = original.map((source) => {
        const m = family.clone(); materials.add(source); materials.add(m);
        if (m instanceof MeshStandardMaterial && source instanceof MeshStandardMaterial) { m.color.copy(source.color); m.roughness = source.roughness; m.metalness = source.metalness; if (texture !== undefined) m.map = texture; }
        m.vertexColors = o.geometry.hasAttribute('color'); m.side = source.side; m.transparent = source.transparent; m.opacity = source.opacity; return m;
      });
      o.material = Array.isArray(o.material) ? converted : converted[0] ?? family.clone();
      o.castShadow = o.userData['castShadow'] !== false; o.receiveShadow = true;
    });
    if (disposed) { for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); throw new Error('Props level unloaded while parsing'); }
    return gltf.scene;
  };
  const tiles = new Map<string, Object3D>(), panels = new Map<string, Object3D>(), models = new Map<string, Object3D>();
  try {
    for (const tile of props.tiles) { const key = `${tile.lod}/${tile.x}/${tile.z}`; if (tile.lod !== (ports.lod ?? 0) || (ports.selectedTiles !== undefined && !ports.selectedTiles.has(key))) continue; const root = await parse(tile.file); tiles.set(key, root); roots.add(root); }
    for (const panel of ports.includeLibrary === false || (ports.lod ?? 0) !== 0 ? [] : props.panels) { const root = await parse(panel.file); root.visible = panel.visible ?? true; panels.set(panel.id, root); roots.add(root); }
    for (const model of ports.includeLibrary === false ? [] : props.models) models.set(model.id, await parse(model.file));
    const far = props.far === null || ports.lod !== 'far' ? null : await parse(props.far); if (far !== null) { far.visible = ports.lod === 'far'; roots.add(far); }
    const disposeTile = (key: string): void => { const root = tiles.get(key); if (root === undefined) return; root.removeFromParent(); tiles.delete(key); root.traverse((o) => { if (!isMesh(o)) return; if (geometries.delete(o.geometry)) o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (materials.delete(m)) m.dispose(); }); };
    ports.scene.add(roots); return { tiles, panels, models, far, disposeTile };
  } catch (error) { roots.removeFromParent(); for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); throw error; }
}
