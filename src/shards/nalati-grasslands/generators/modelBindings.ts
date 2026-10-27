import { MODEL_FILES } from './modelPaint.mjs';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';

const publicPrefix = '/assets/nalati/baked/painted-models/';
const productPrefix = 'models/painted/';
/** Equal atlas bytes have one logical product name, so shared images never create forbidden content aliases. */
export function nalatiPaintedAtlasFile(bytes: Uint8Array): string { return `${productPrefix}atlas-${hashImmutableBytes(bytes)}.ktx2`; }

/** Near tier geometry may be identical after stripping its atlas; retain the existing untextured far names. */
export function nalatiPaintedGeometryFile(name: string, bytes: Uint8Array): string {
  return name.endsWith('.far.glb') ? `${productPrefix}${name}` : `${productPrefix}geometry-${hashImmutableBytes(bytes)}.glb`;
}

function modelName(path: string, prefix: string): string {
  const name = path.slice(prefix.length);
  if (!MODEL_FILES.includes(name)) throw new Error('Unknown Nalati painted model binding');
  return name;
}

/** Select only the painted models actually declared by complete compiled scene rows. */
export function nalatiPaintedModelNames(input: unknown): readonly string[] {
  const names = new Set<string>();
  const visit = (value: unknown): void => {
    if (typeof value === 'string' && value.startsWith(publicPrefix)) names.add(modelName(value, publicPrefix));
    else if (Array.isArray(value)) { for (const item of value) visit(item); }
    else if (value !== null && typeof value === 'object') {
      const file: unknown = Reflect.get(value, 'file');
      if (typeof file === 'string' && file.startsWith(productPrefix)) names.add(modelName(file, productPrefix));
      for (const item of Object.values(value)) visit(item);
    }
  };
  visit(input);
  return [...names].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}

/** Replace only declared painted asset locations; original geometry/material/placement fields keep their order and values. */
export function nalatiPaintedBindings(input: unknown, files: ReadonlyMap<string, Uint8Array>): unknown {
  if (Array.isArray(input)) return input.map(value => nalatiPaintedBindings(value, files));
  if (input === null || typeof input !== 'object') return input;
  const out: Record<string, unknown> = Object.fromEntries(Object.entries(input).map(([key, value]: [string, unknown]) => [key, nalatiPaintedBindings(value, files)]));
  for (const [sourceKey, atlasKey] of [['url', 'atlas'], ['phoneUrl', 'phoneAtlas']] as const) {
    const path = out[sourceKey];
    if (typeof path !== 'string' || !path.startsWith(publicPrefix)) continue;
    const name = modelName(path, publicPrefix), geometry = files.get(name);
    if (geometry === undefined) throw new Error(`Missing owned Nalati model geometry: ${name}`);
    out[sourceKey] = { file: nalatiPaintedGeometryFile(name, geometry), bytes: geometry.byteLength };
    if (!name.endsWith('.far.glb')) {
      const texture = name.replace(/\.glb$/u, '.ktx2'), atlas = files.get(texture);
      if (atlas === undefined) throw new Error(`Missing owned Nalati model atlas: ${texture}`);
      if (out[atlasKey] !== undefined) throw new Error('Nalati painted model already declares an atlas');
      out[atlasKey] = { file: nalatiPaintedAtlasFile(atlas), bytes: atlas.byteLength,
        wrapS: 10497, wrapT: 10497, minFilter: 9987, magFilter: 9729, anisotropy: 4, colourSpace: 'srgb' };
    }
  }
  return out;
}

/** Unselected desktop alternatives stay admitted but warm after control. A
 * shared or phone-selected reference anywhere in the books keeps its source. */
export function nalatiLatePaintedNames(input: unknown): readonly string[] {
  const candidates = new Set<string>(), selected = new Set<string>();
  const location = (value: unknown): string | undefined => {
    if (value === null || typeof value !== 'object' || !('file' in value)) return undefined;
    return typeof value.file === 'string' && value.file.startsWith('models/painted/') ? value.file : undefined;
  };
  const visit = (value: unknown): void => {
    if (typeof value === 'string') { selected.add(value); return; }
    if (Array.isArray(value)) { for (const child of value) visit(child); return; }
    if (value === null || typeof value !== 'object') return;
    const skipped = new Set<string>();
    for (const [normal, phone] of [['url', 'phoneUrl'], ['atlas', 'phoneAtlas']] as const) {
      const full = location(Reflect.get(value, normal)), small = location(Reflect.get(value, phone));
      if (full !== undefined && small !== undefined) { candidates.add(full); skipped.add(normal); }
    }
    for (const [key, child] of Object.entries(value)) if (!skipped.has(key)) visit(child);
  };
  visit(input);
  return [...candidates].filter(name => !selected.has(name)).sort();
}
