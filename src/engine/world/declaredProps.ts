import { Group, Mesh, MeshLambertMaterial, MeshStandardMaterial, type BufferGeometry, type Color, type Material, type Object3D, type Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Scope } from '../app/scope';
import { familyVariant } from '../render/families/registry';

function isMesh(object: Object3D): object is Mesh { return object instanceof Mesh; }

/** the colour and map slots a family material and a GLB material share (PBR and toon are standard, painterly Lambert) */
function surfaceOf(m: Material): MeshStandardMaterial | MeshLambertMaterial | null {
  return m instanceof MeshStandardMaterial || m instanceof MeshLambertMaterial ? m : null;
}

/** What a prop mesh takes from its GLB material onto the family's: one shared family variant per distinct set. */
interface Surface { colour: Color | null; roughness: number | null; metalness: number | null; map: Texture | undefined; vertexColours: boolean; side: Material['side']; transparent: boolean; opacity: number }
const surfaceKey = (s: Surface): string =>
  `${s.colour?.getHexString() ?? '-'}|${s.roughness ?? '-'}|${s.metalness ?? '-'}|${s.map?.uuid ?? '-'}|${s.vertexColours ? 'v' : ''}|${s.side}|${s.transparent ? 't' : ''}|${s.opacity}`;

/**
 * The family variants every installed prop shares, per family material: a toon or painterly prop draws with its family's
 * own program (patches and key kept, `familyVariant`), and equal surfaces across tiles are one material. Counted: a
 * variant is disposed when the last tile or level holding it lets go.
 */
const variants = new WeakMap<Material, Map<string, { material: Material; holders: number; scope: Scope }>>();
function acquireVariant(family: Material, surface: Surface): Material {
  let byKey = variants.get(family);
  if (byKey === undefined) { byKey = new Map(); variants.set(family, byKey); }
  const key = surfaceKey(surface), known = byKey.get(key);
  if (known !== undefined) { known.holders++; return known.material; }
  const scope = new Scope('props.family-variant');
  const material = familyVariant(family, scope, (m) => {
    const own = surfaceOf(m);
    if (own !== null) {
      // the family's colour tints the GLB's (white by default: the GLB's colour as authored)
      if (surface.colour !== null) own.color.multiply(surface.colour);
      if (surface.map !== undefined) own.map = surface.map;
    }
    if (m instanceof MeshStandardMaterial) { if (surface.roughness !== null) m.roughness = surface.roughness; if (surface.metalness !== null) m.metalness = surface.metalness; }
    m.vertexColors = surface.vertexColours; m.side = surface.side; m.transparent = surface.transparent; m.opacity = surface.opacity;
  });
  byKey.set(key, { material, holders: 1, scope });
  return material;
}
function releaseVariant(family: Material, material: Material): void {
  const byKey = variants.get(family); if (byKey === undefined) return;
  for (const [key, entry] of byKey) {
    if (entry.material !== material) continue;
    if (--entry.holders === 0) { byKey.delete(key); entry.scope.dispose(); material.dispose(); }
    return;
  }
}

/** Admitted prop bindings; the game validates hashes and tile relationships before handing bytes to this renderer. */
export interface DeclaredProps {
  family: string; tiles: readonly { lod: number; x: number; z: number; file: string }[];
  panels: readonly { id: string; file: string; visible?: boolean }[]; models: readonly { id: string; file: string }[];
  far: string | null; textures: readonly { model: string; colour: string }[];
}
/** Level-owned roots and stable panel/model ports. Visibility/pose commands act on the returned roots. */
export interface InstalledProps { tiles: ReadonlyMap<string, Object3D>; panels: ReadonlyMap<string, Object3D>; models: ReadonlyMap<string, Object3D>; far: Object3D | null; disposeTile: (key: string) => void }
/**
 * Parse only admitted memory, apply a resolved family and texture catalogue, and dispose everything with the level. Every
 * prop mesh draws with a shared variant of the family material that keeps the family's program (toon and painterly
 * shading survive), so props add no programs beyond the family's own variants.
 */
export async function installDeclaredProps(props: DeclaredProps, ports: {
  scene: Object3D; scope: Scope; assets: ReadonlyMap<string, Uint8Array>; materials: ReadonlyMap<string, Material>;
  textures?: ReadonlyMap<string, Texture>; lod?: 0 | 1 | 'far'; selectedTiles?: ReadonlySet<string>; includeLibrary?: boolean;
}): Promise<InstalledProps> {
  const roots = new Group(), geometries = new Set<BufferGeometry>(), held: Material[] = [];
  const family = ports.materials.get(props.family); if (family === undefined) throw new Error(`Unresolved props family ${props.family}`);
  let disposed = false;
  const releaseAll = (): void => { for (const g of geometries) g.dispose(); geometries.clear(); for (const m of held.splice(0)) releaseVariant(family, m); };
  ports.scope.onDispose(() => { disposed = true; roots.removeFromParent(); releaseAll(); });
  const parse = async (hash: string): Promise<Object3D> => {
    const bytes = ports.assets.get(hash); if (bytes === undefined) throw new Error('Missing admitted props GLB');
    const gltf = await new GLTFLoader().parseAsync(bytes.slice().buffer, '');
    const textureRef = props.textures.find((t) => t.model === hash)?.colour, texture = textureRef === undefined ? undefined : ports.textures?.get(textureRef);
    if (textureRef !== undefined && texture === undefined) throw new Error('Missing admitted props texture');
    gltf.scene.traverse((o) => {
      if (!isMesh(o)) return;
      geometries.add(o.geometry);
      const original = Array.isArray(o.material) ? o.material : [o.material];
      const vertexColours = o.geometry.hasAttribute('color');
      const convert = (source: Material | undefined): Material => {
        const glb = source === undefined ? null : surfaceOf(source), standard = source instanceof MeshStandardMaterial ? source : null;
        const m = acquireVariant(family, { colour: glb?.color ?? null, roughness: standard?.roughness ?? null, metalness: standard?.metalness ?? null, map: texture, vertexColours,
          side: source?.side ?? family.side, transparent: source?.transparent ?? family.transparent, opacity: source?.opacity ?? family.opacity });
        // the GLB's own material is only read: it never reaches the GPU
        source?.dispose(); held.push(m); return m;
      };
      o.material = Array.isArray(o.material) ? original.map(convert) : convert(original[0]);
      o.castShadow = o.userData['castShadow'] !== false; o.receiveShadow = true;
    });
    if (disposed) { releaseAll(); throw new Error('Props level unloaded while parsing'); }
    return gltf.scene;
  };
  const tiles = new Map<string, Object3D>(), panels = new Map<string, Object3D>(), models = new Map<string, Object3D>();
  try {
    for (const tile of props.tiles) { const key = `${tile.lod}/${tile.x}/${tile.z}`; if (tile.lod !== (ports.lod ?? 0) || (ports.selectedTiles !== undefined && !ports.selectedTiles.has(key))) continue; const root = await parse(tile.file); tiles.set(key, root); roots.add(root); }
    for (const panel of ports.includeLibrary === false || (ports.lod ?? 0) !== 0 ? [] : props.panels) { const root = await parse(panel.file); root.visible = panel.visible ?? true; panels.set(panel.id, root); roots.add(root); }
    for (const model of ports.includeLibrary === false ? [] : props.models) models.set(model.id, await parse(model.file));
    const far = props.far === null || ports.lod !== 'far' ? null : await parse(props.far); if (far !== null) { far.visible = ports.lod === 'far'; roots.add(far); }
    const disposeTile = (key: string): void => {
      const root = tiles.get(key); if (root === undefined) return; root.removeFromParent(); tiles.delete(key);
      root.traverse((o) => {
        if (!isMesh(o)) return; if (geometries.delete(o.geometry)) o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) { const at = held.indexOf(m); if (at !== -1) { held.splice(at, 1); releaseVariant(family, m); } }
      });
    };
    ports.scene.add(roots); return { tiles, panels, models, far, disposeTile };
  } catch (error) { roots.removeFromParent(); releaseAll(); throw error; }
}
