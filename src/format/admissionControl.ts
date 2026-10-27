import { parseWorldScenes } from './worldScenes';
import { stringsSteps } from './tierSelection';
import type { OutputIndex } from './outputIndex';
import { materialTextureRefs } from './materials';
import { propMaterialsOf, propMaterialTextureRefs } from './propMaterials';
import { splatTerrainOf, splatTextureRefs } from './splatTerrain';
import type { Shardfile } from './shardSchema';

/** Exact required transport roots and their dependencies, shared by pack emission and phone admission.
 * Late is a scheduling hint: commons, critical flags, manifest images/navigation and the global LUT still win. */
export function controlFileHashes(source: Pick<Shardfile, 'files' | 'critical' | 'library' | 'late' | 'presentation' | 'navigation' | 'map' | 'look' | 'requires' | 'props'>): ReadonlySet<string> {
  const card = source.presentation?.card, late = new Set((source.late ?? []).map(row => row.hash));
  const graphFiles = Object.values(source.look.materials).flatMap(material => material.family === 'graph' && 'file' in material ? [material.file] : []);
  const materialFiles = [...materialTextureRefs(source.look.materials), ...graphFiles, ...source.props?.textures.map(row => row.colour) ?? [],
    ...propMaterialTextureRefs(source.props === null ? undefined : propMaterialsOf(source.props)),
    ...splatTextureRefs(source.props === null ? undefined : splatTerrainOf(source.props))];
  const pending = [...materialFiles, ...source.requires.commons, ...source.critical, ...source.library.filter(hash => !late.has(hash)),
    ...source.files.filter(file => file.critical).map(file => file.hash),
    ...source.navigation === null ? [] : [source.navigation.file], ...source.map === undefined ? [] : [source.map.image],
    ...card === undefined ? [] : [card.thumb, card.portrait, card.landscape], ...source.look.grade.lut === null ? [] : [source.look.grade.lut]];
  const needed = new Set<string>(), files = new Map(source.files.map(file => [file.hash, file]));
  while (pending.length > 0) {
    const ref = pending.pop(); if (ref === undefined) break;
    const hash = ref.replace(/^commons:/u, ''); if (needed.has(hash)) continue;
    needed.add(hash);
    const file = files.get(hash);
    if (file === undefined) {
      if (!source.requires.commons.includes(hash)) throw new Error('Control file is not declared');
    } else pending.push(...file.dependencies);
  }
  return needed;
}

/** Exclusive cold Explorer libraries, projected identically for live admission and pack emission.
 * Critical, dependency, tile and any other played reader keep their complete roots. */
export function* playLibrarySteps(source: Shardfile, descriptor: { readonly index: Pick<OutputIndex, 'files'>; readonly sections: ReadonlyMap<string, unknown> }): Generator<void, ReadonlySet<string>> {
  const input = descriptor.sections.get('world/scenes');
  if (input === undefined) return new Set();
  const scenes = parseWorldScenes(input), names = new Map<string, string>();
  for (const file of descriptor.index.files) for (const name of [file.hash, file.path, `/shardfiles/${source.identity.slug}/${file.path}`, ...file.name === undefined ? [] : [file.name]]) names.set(name, file.hash);
  const eligible = new Set<string>(), other = new Set<string>(source.critical);
  for (const row of scenes.libraries) if (row.kind === 'whole') {
    for (const model of row.models) for (const ref of model.files) { const hash = names.get(ref) ?? ref; (row.load === 'explorer' ? eligible : other).add(hash); }
  }
  if (eligible.size === 0) return eligible;
  const into = (text: string): void => { const hash = names.get(text); if (hash !== undefined) other.add(hash); };
  const plan: unknown = descriptor.sections.get('client/plan'), features: unknown = typeof plan === 'object' && plan !== null ? Reflect.get(plan, 'features') : undefined;
  const islands = Array.isArray(features) && features.some((row: unknown) => typeof row === 'object' && row !== null && Reflect.get(row, 'kind') === 'world.assembly' && Reflect.get(row, 'library') !== undefined);
  const { files: _files, library: _library, critical: _critical, late: _late, props, ...rest } = source;
  const fields = islands || props === null ? { ...rest, props } : { ...rest, props: { ...props, wholeLibrary: [] } };
  const { libraries: _libraries, ...world } = scenes, sections: unknown[] = [world];
  for (const [name, section] of descriptor.sections) {
    if (name === 'world/scenes') continue;
    // the props section carries the same whole-library list as `props` (its `props` row)
    const row: unknown = typeof section === 'object' && section !== null ? Reflect.get(section, 'props') : undefined;
    sections.push(!islands && name === 'world/props' && typeof section === 'object' && section !== null && typeof row === 'object' && row !== null
      ? { ...section, props: { ...row, wholeLibrary: [] } } : section);
  }
  yield* stringsSteps([fields, ...sections], into);
  for (const file of source.files) for (const ref of file.dependencies) other.add(ref);
  return new Set([...eligible].filter(hash => !other.has(hash)));
}
