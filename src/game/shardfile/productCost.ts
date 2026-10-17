import type { Shardfile } from '@wildshard/format/shardSchema';
import { preflightShardfile } from '@wildshard/format/preflight';
import { isJsonData } from '@wildshard/format/json';
import { outputDescriptor } from './outputDescriptor';
import { isPlatformDataSection } from '@wildshard/format/outputIndex';

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
  const { near: _near, ...drawn } = source;
  return runtimeOnlyProductFiles({ ...drawn, tiles: [], far: null,
    terrain: source.terrain === null ? null : { ...source.terrain, tiles: [] },
    props: props === null ? null : { ...props, tiles: [], far: null,
      ...(boundProps ? { models: [], wholeLibrary: [] } : {}),
      // The model key selects a colour map; material compilation only consumes its colour bytes.
      textures: props.textures.map(({ colour }) => ({ model: '', colour })) } });
}
