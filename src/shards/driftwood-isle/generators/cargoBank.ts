import { Mesh, MeshStandardMaterial, Vector3, type BufferGeometry } from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { cargoModels } from './cargoCatalogue';
import type { FixedWreckLayout } from './fixedLayouts';

/** The wreck's cargo as world-scene models: each choice sized by its scaled original mesh, and a scaled copy of the mesh
 *  for every choice that is not the original size (GR7: the `driftwood-cargo-scenes` job's rows and blobs). */
export interface DriftwoodCargoBank {
  readonly models: ReturnType<typeof cargoModels>;
  readonly library: { readonly id: 'cargo'; readonly kind: 'owned'; readonly models: { id: string; file: string; attributes: Record<string, never> }[] };
  /** the scaled copies' raw GLBs by logical name (the product names them as meshopt sources, as `assets.ts` does) */
  readonly glbs: ReadonlyMap<string, Uint8Array>;
}

const isMesh = (value: unknown): value is Mesh => value instanceof Mesh;
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** `data/fixedBlobs.generated.json`'s name → source rows, from the owned fixed files (driftwoodFixedFiles). */
function fixedSources(fixed: ReadonlyMap<string, Uint8Array>): ReadonlyMap<string, string> {
  const bytes = fixed.get('data/fixedBlobs.generated.json');
  if (bytes === undefined) throw new Error('Missing owned fixed blob rows');
  const rows: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const blobs = isRecord(rows) ? rows['blobs'] : undefined;
  if (!Array.isArray(blobs)) throw new Error('Invalid owned fixed blob rows');
  const sources = new Map<string, string>();
  for (const row of blobs as readonly unknown[]) {
    if (!isRecord(row) || typeof row['name'] !== 'string' || typeof row['source'] !== 'string') throw new Error('Invalid owned fixed blob row');
    sources.set(row['name'], row['source']);
  }
  return sources;
}

/** The original cargo mesh, with an identity index dropped as the source intake drops it. */
async function cargoTemplate(bytes: Uint8Array): Promise<BufferGeometry> {
  const decoded = await readSourceModel(bytes), meshes: Mesh[] = [];
  decoded.gltf.scene.traverse(node => { if (isMesh(node)) meshes.push(node); });
  const mesh = meshes[0];
  if (mesh === undefined || meshes.length !== 1) throw new Error('Cargo template needs one original mesh');
  const template = mesh.geometry.clone(), index = template.index;
  if (index !== null && index.count === template.getAttribute('position').count && Array.from(index.array).every((value, i) => value === i)) template.setIndex(null);
  for (const part of meshes) { part.geometry.dispose(); for (const surface of Array.isArray(part.material) ? part.material : [part.material]) surface.dispose(); }
  return template;
}

/** Build the cargo bank from the owned fixed files. Equal scaled payloads keep one logical name, as the job's writer did. */
export async function driftwoodCargoBank(fixed: ReadonlyMap<string, Uint8Array>, wreck: FixedWreckLayout): Promise<DriftwoodCargoBank> {
  const sources = fixedSources(fixed), models = cargoModels(wreck), templates = new Map<string, BufferGeometry>(), material = new MeshStandardMaterial();
  const library: DriftwoodCargoBank['library'] = { id: 'cargo', kind: 'owned', models: [] };
  const glbs = new Map<string, Uint8Array>(), names = new Map<string, string>();
  try {
    for (const model of models) for (const choice of model.choices) {
      const p: Readonly<Record<string, unknown>> = choice.params;
      const kind = model.key === 'barrel' ? p['lying'] === true ? 'barrel-lying' : 'barrel'
        : model.key === 'crate' ? p['broken'] === true ? 'crate-broken' : 'crate' : 'coil';
      const scale = model.key === 'crate' ? Number(p['size']) / (p['broken'] === true ? 0.7 : 0.8) : model.key === 'ropeCoil' ? Number(p['r']) / 0.3 : 1;
      const name = `models/fixed/cargo-${kind}.glb`, source = sources.get(name), bytes = source === undefined ? undefined : fixed.get(source);
      if (bytes === undefined || !Number.isFinite(scale) || scale <= 0) throw new Error('Missing authored cargo source');
      let template = templates.get(name);
      if (template === undefined) { template = await cargoTemplate(bytes); templates.set(name, template); }
      const shape = template.clone();
      try {
        if (scale !== 1) shape.scale(scale, scale, scale);
        shape.computeBoundingBox();
        const bounds = shape.boundingBox; if (bounds === null) throw new Error('Missing cargo bounds');
        choice.size = bounds.getSize(new Vector3()).toArray();
        const draw = choice.draws[0]; if (draw === undefined) throw new Error('Cargo choice needs its draw');
        let file = name;
        if (scale !== 1) {
          const scaled = staticGlb([{ geometry: shape, material }], `cargo-${draw.model}`), hash = hashImmutableBytes(scaled);
          file = names.get(hash) ?? `models/cargo/${draw.model}.glb`;
          if (!names.has(hash)) { names.set(hash, file); glbs.set(file, scaled); }
        }
        library.models.push({ id: draw.model, file, attributes: {} });
      } finally { shape.dispose(); }
    }
    return { models, library, glbs };
  } finally { for (const shape of templates.values()) shape.dispose(); material.dispose(); }
}
