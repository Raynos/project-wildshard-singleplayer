import { BufferGeometry, Material, Mesh, MeshStandardMaterial, Texture } from 'three';
import { loadRigFile } from '@wildshard/engine/anim/rig';
import type { Scope } from '@wildshard/engine/app/scope';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import type { WorldScenesSection } from '@wildshard/format/worldScenes';

type Source = Extract<WorldScenesSection['materials'][number], { kind: 'source' }>;
const loaded = new WeakMap<Scope, Map<string, Promise<readonly Material[]>>>();
const geometryValue = (value: unknown): value is BufferGeometry => value instanceof BufferGeometry;
const materialValue = (value: unknown): value is Material => value instanceof Material;
const textureValue = (value: unknown): value is Texture => value instanceof Texture;

/** Client-only original PBR intake. Aliases retain the asset manager's tier and texture routing.
 * Degenerate source meshes are released immediately; only original materials and maps survive. */
export async function worldSceneSourceMaterial(row: Source, sky: SkyRig, owner: Scope): Promise<Material> {
  if (owner.disposed) throw new Error('Scene material owner is disposed');
  let files = loaded.get(owner);
  if (files === undefined) { files = new Map(); loaded.set(owner, files); owner.onDispose(() => { loaded.delete(owner); }); }
  const key = JSON.stringify([row.url, row.aliases, row.anisotropy, row.anisotropyMaps, row.envMapIntensity]);
  let pending = files.get(key);
  if (pending === undefined) {
    pending = loadRigFile(row.url, row.aliases).then(file => {
      const materials: Material[] = [], geometries = new Set<BufferGeometry>();
      file.scene.traverse(node => {
        if (!(node instanceof Mesh)) return;
        const geometry: unknown = node.geometry, value: unknown = node.material;
        if (geometryValue(geometry)) geometries.add(geometry);
        const candidates: readonly unknown[] = Array.isArray(value) ? value : [value];
        for (const material of candidates) if (materialValue(material)) materials.push(material);
      });
      for (const geometry of geometries) geometry.dispose();
      const textures = new Set<NonNullable<MeshStandardMaterial['map']>>();
      for (const material of new Set(materials)) {
        if (material instanceof MeshStandardMaterial) {
          for (const name of row.anisotropyMaps) { const texture = material[name]; if (texture !== null) texture.anisotropy = row.anisotropy; }
          material.envMapIntensity = row.envMapIntensity;
        }
        sky.setupMaterial(material);
        const values: readonly unknown[] = Object.values(material);
        for (const value of values) if (textureValue(value)) textures.add(value);
        owner.onDispose(() => { material.dispose(); });
      }
      owner.onDispose(() => { for (const texture of textures) texture.dispose(); });
      if (owner.disposed) throw new Error('Scene material owner is disposed');
      return materials;
    });
    files.set(key, pending);
    const cache = files;
    void pending.catch(() => { if (cache.get(key) === pending) cache.delete(key); });
  }
  const material = (await pending)[row.part];
  if (material === undefined) throw new Error(`Missing source material part: ${row.url}/${String(row.part)}`);
  return material;
}
