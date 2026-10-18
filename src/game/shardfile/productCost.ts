import type { Shardfile } from '@wildshard/format/shardSchema';
import { preflightShardfile } from '@wildshard/format/preflight';
import { isJsonData } from '@wildshard/format/json';
import { outputDescriptor } from './outputDescriptor';
import { isPlatformDataSection } from '@wildshard/format/outputIndex';
import { parseWorldScenes, worldScenesForTier } from '@wildshard/format/worldScenes';

/** Project only exclusive alternatives selected by existing typed presentation hosts.
 * Transport stays fully charged. References elsewhere or dependencies keep an asset resident;
 * arbitrary runtime names and unselected scene batches are never treated as tier selectors. */
export function tierLibrarySource(source: Shardfile, tier: 'phone' | 'desktop'): Shardfile {
  const descriptor = outputDescriptor(source);
  if (descriptor === undefined) return source;
  const names = new Map<string, string>();
  for (const file of descriptor.index.files) {
    for (const name of [file.hash, file.path, `/shardfiles/${source.identity.slug}/${file.path}`]) names.set(name, file.hash);
    if (file.name !== undefined) names.set(file.name, file.hash);
  }
  const inactive = new Set<string>(), used = new Set(source.critical);
  const alternative = (selected: string, other: string): void => {
    const off = names.get(other); if (off !== undefined) inactive.add(off);
    const on = names.get(selected); if (on !== undefined) used.add(on);
  };
  const sections = new Map(descriptor.sections);
  const metadata = source.manifest;
  let manifest = source.manifest;
  if (metadata?.horizonStrips?.phone !== undefined) {
    const horizon = metadata.horizonStrips, selected = tier === 'phone' ? horizon.phone : horizon;
    const other = tier === 'phone' ? horizon : horizon.phone;
    if (selected !== undefined && other !== undefined) {
      alternative(selected.day, other.day); alternative(selected.night, other.night);
      const { phone: _phone, ...base } = horizon;
      manifest = { ...metadata, horizonStrips: { ...base, day: selected.day, night: selected.night } };
      sections.set('ui/level', { manifest });
    }
  }
  const scenes = sections.get('world/scenes');
  if (scenes !== undefined) {
    const declared = parseWorldScenes(scenes);
    for (const library of declared.libraries) if (library.kind === 'owned') for (const model of library.models) {
      if (model.tier === undefined || model.tier === tier) continue;
      for (const file of typeof model.file === 'string' ? [model.file] : Object.values(model.file)) {
        const ref = names.get(file); if (ref !== undefined) inactive.add(ref);
      }
    }
    for (const placement of declared.placements) if (placement.tier !== undefined && placement.tier !== tier && 'file' in placement) {
      const ref = names.get(placement.file); if (ref !== undefined) inactive.add(ref);
    }
    const row = worldScenesForTier(declared, tier);
    const libraries: typeof row.libraries = [];
    for (const library of row.libraries) {
      if (library.kind !== 'owned') { libraries.push(library); continue; }
      const models: typeof library.models = [];
      for (const model of library.models) {
        if (typeof model.file === 'string') models.push(model);
        else {
          alternative(model.file[tier], model.file[tier === 'phone' ? 'desktop' : 'phone']);
          models.push({ ...model, file: model.file[tier] });
        }
      }
      libraries.push({ ...library, models });
    }
    sections.set('world/scenes', { ...row, libraries });
  }
  if (inactive.size === 0) return source;
  const visit = (input: unknown): void => {
    if (typeof input === 'string') { const hash = names.get(input); if (hash !== undefined) used.add(hash); }
    else if (Array.isArray(input)) for (const value of input) visit(value);
    else if (typeof input === 'object' && input !== null) for (const [key, value] of Object.entries(input)) { visit(key); visit(value); }
  };
  const { files: _files, library: _library, critical: _critical, manifest: _manifest, ...fields } = source;
  visit({ ...fields, manifest });
  for (const value of sections.values()) visit(value);
  for (const file of source.files) for (const ref of file.dependencies) used.add(ref);
  const excluded = new Set([...inactive].filter(hash => !used.has(hash)));
  const library = new Set(source.library), saving = source.files.reduce((sum, file) =>
    sum + (library.has(file.hash) && excluded.has(file.hash) ? file.decoded + file.gpu : 0), 0);
  return { ...source, library: source.library.filter(hash => !excluded.has(hash)), budgets: {
    ...source.budgets, library: { ...source.budgets.library, resident: Math.max(0, source.budgets.library.resident - saving) },
  } };
}

/** Conservative heap estimate for a bounded plain-JSON source or its owned projection, including strings and container overhead. */
export function jsonResidentBytes(input: unknown): number {
  if (!isJsonData(input)) throw new Error('Product residency needs bounded plain JSON');
  let heap = 0;
  const pending: unknown[] = [input];
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value === 'string') heap += 24 + value.length * 2;
    else if (Array.isArray(value)) { const items: readonly unknown[] = value; heap += 40 + items.length * 8; pending.push(...items); }
    else if (typeof value === 'object' && value !== null) {
      const entries = Object.entries(value); heap += 64 + entries.length * 16;
      for (const [key, item] of entries) { heap += 24 + key.length * 2; pending.push(item); }
    } else heap += 8;
  }
  return heap;
}
/** Conservative transport/source heap claim: two parsed-source copies, owned asset buffers and map/object overhead. */
export function productResidentBytes(source: Shardfile): number {
  preflightShardfile(source);
  // File/common aliases are copied into separate owned buffers by admitProduct, so count each actual Map entry.
  const wire = source.files.reduce((sum, file) => sum + file.compressed, 0)
    + source.requires.commons.reduce((sum, hash) => sum + (source.requires.commonsWire[hash] ?? 0), 0);
  return wire + jsonResidentBytes(source) * 2 + (source.files.length + source.requires.commons.length) * 128 + 1024;
}

/** Files read only through the asynchronous runtime product API. Inventory membership is not a use:
 * retain every host-declared reference and its dependency closure for synchronous neighbour/simulation readers. */
export function runtimeOnlyProductFiles(source: Shardfile): readonly string[] {
  const files = new Map(source.files.map(file => [file.hash, file])), keep = new Set<string>();
  const descriptor = outputDescriptor(source), paths = new Map(descriptor?.index.files.map(file => [file.path, file.hash]));
  const pending: unknown[] = [{ ...source, files: [], critical: [], library: [] },
    ...[...descriptor?.sections ?? []].flatMap(([name, value]) => isPlatformDataSection(name) ? [value] : [])];
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value === 'string') { const ref = paths.get(value) ?? value; if (files.has(ref)) keep.add(ref); }
    else if (Array.isArray(value)) { const items: readonly unknown[] = value; pending.push(...items); }
    else if (typeof value === 'object' && value !== null) for (const [key, child] of Object.entries(value)) pending.push(key, child);
  }
  const dependencies = [...keep];
  while (dependencies.length > 0) {
    const ref = dependencies.pop();
    if (ref === undefined) continue;
    for (const dependency of files.get(ref)?.dependencies ?? []) {
      if (keep.has(dependency)) continue;
      keep.add(dependency); dependencies.push(dependency);
    }
  }
  return source.files.filter(file => !keep.has(file.hash)).map(file => file.hash);
}

/** Neighbours stream terrain, props tiles and placeholders through ClientAssets.read; bound whole geometry belongs to the entered runtime.
 * Keep every synchronous panel, material, physics and simulation reference, including dependencies shared with a tile. */
export function neighbourProductFiles(source: Shardfile): readonly string[] {
  const props = source.props;
  const boundProps = source.runtime?.binds?.includes('props') === true;
  const boundTerrain = source.runtime?.binds?.includes('terrain') === true;
  const { near: _near, ...drawn } = source;
  return runtimeOnlyProductFiles({ ...drawn, tiles: [], far: null,
    terrain: source.terrain === null || boundTerrain ? null : { ...source.terrain, tiles: [] },
    props: props === null ? null : { ...props, tiles: [], far: null,
      ...(boundProps ? { models: [], wholeLibrary: [] } : {}),
      // The model key selects a colour map; material compilation only consumes its colour bytes.
      textures: props.textures.map(({ colour }) => ({ model: '', colour })) } });
}
