import { BufferAttribute, type BufferGeometry, MeshBasicMaterial } from 'three';
import { staticGlb } from '@wildshard/sharddev/bake/glb';
import { nameBlob, type NamedBlob } from '@wildshard/sharddev/blobs';
import { worldSceneRows, type AuthorWorldScenes } from '@wildshard/sharddev/worldScenes';
import { buildHalo } from './jianHalo';
import { buildViewmodelParts, mergedPendantParts } from './viewmodelParts';

type Pool = Extract<AuthorWorldScenes['libraries'][number], { kind: 'pool' }>;
interface JianGeometryFiles { readonly blobs: readonly NamedBlob[]; readonly pool: Pool }
const standard = new Set(['position', 'normal', 'uv', 'uv1', 'color', 'tangent']);

/** The original rest buffers, including shader channels and authored bounds.
 * The existing world-scene pool owns admission and reconstruction. */
function collection(name: string, parts: ReadonlyMap<string, BufferGeometry>): { blob: NamedBlob; file: Pool['files'][number] } {
  const material = new MeshBasicMaterial();
  const channels = new Map<string, { width: 1 | 2 | 3 | 4; parts: string[] }>();
  try {
    const primitives = [...parts].map(([id, geometry]) => {
      const custom = Object.keys(geometry.attributes).filter(key => !standard.has(key));
      for (const key of custom) {
        const attribute = geometry.getAttribute(key), width = attribute.itemSize;
        if (!(attribute instanceof BufferAttribute) || !(attribute.array instanceof Float32Array) || attribute.normalized
          || (width !== 1 && width !== 2 && width !== 3 && width !== 4)) throw new Error('Jian rest channels require original Float32 storage');
        const row = channels.get(key) ?? { width, parts: [] };
        if (row.width !== width) throw new Error('Jian rest channel width differs across parts');
        row.parts.push(id); channels.set(key, row);
      }
      const box = geometry.boundingBox, sphere = geometry.boundingSphere;
      return { name: id, geometry, material, compactIndex: true as const,
        customAttributes: Object.fromEntries(custom.map(key => [`_${key.toUpperCase()}`, key])),
        extras: { restGroups: geometry.groups.map(group => [group.start, group.count, group.materialIndex ?? 0]),
          restBox: box === null ? null : [...box.min, ...box.max],
          restSphere: sphere === null ? null : [...sphere.center, sphere.radius] } };
    });
    const file = `weapons/jian-${name}.glb`;
    const declarations: NonNullable<Pool['files'][number]['channels']> = [];
    for (const [id, row] of channels) declarations.push({ name: id, source: `_${id.toLowerCase()}`, width: row.width,
      ...(row.parts.length === parts.size ? {} : { parts: row.parts }) });
    return { blob: nameBlob(file, 'glb', staticGlb(primitives, `jian-${name}`)),
      file: { file, parts: [...parts.keys()], channels: declarations } };
  } finally { material.dispose(); }
}

function bakeJianGeometry(): JianGeometryFiles {
  const original = buildViewmodelParts(), merged = mergedPendantParts(original), halo = buildHalo();
  const geometries = new Set([...Object.values(original), ...Object.values(merged), halo.geo]);
  try {
    const cloth = collection('cloth', new Map([['knot', original.knot], ['tassel', original.tassel], ['sheet', original.sheet], ['silk-strands', merged.silk], ['thin-hulls', merged.thin]]));
    const edge = collection('halo', new Map([['edge', halo.geo]]));
    const pool = worldSceneRows({ version: 1, libraries: [{ id: 'jian.pendants', kind: 'pool', files: [cloth.file, edge.file] }], materials: [], steps: [] }).libraries[0];
    if (pool?.kind !== 'pool') throw new Error('Missing admitted Jian rest pool');
    return { blobs: [cloth.blob, edge.blob], pool };
  } finally { for (const geometry of geometries) geometry.dispose(); halo.mat.dispose(); }
}

/** Both consumers share one immutable bake; native looks and scene poses stay in heldView. */
export const JIAN_GEOMETRY: JianGeometryFiles = bakeJianGeometry();
