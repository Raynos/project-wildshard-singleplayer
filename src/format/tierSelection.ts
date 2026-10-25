import { parseWorldScenes, worldScenesForTier } from './worldScenes';
import { parseRiggedHullBook } from './riggedHulls';
import { PosedLibrarySchema } from './namedJsonContracts';
import * as v from 'valibot';

/** Only immutable addressing and typed alternatives are needed for selection.
 * Other root fields are retained by the conservative string walk at runtime. */
export interface TierSelectionSource {
  readonly identity: { readonly slug: string };
  readonly files: readonly { readonly hash: string; readonly kind: string; readonly decoded: number; readonly dependencies: readonly string[] }[];
  readonly library: readonly string[]; readonly critical: readonly string[];
  readonly manifest?: { readonly horizonStrips?: { readonly day: string; readonly night: string; readonly phone?: { readonly day: string; readonly night: string } } };
}

/** Pure typed-alternative selection, shared by boot compilation and admission.
 * No runtime owner, current device, storage or transport is read here. */
export function* stringsSteps(roots: readonly unknown[], found: (text: string) => void): Generator<void> {
  const pending: unknown[] = [...roots];
  let visited = 0;
  while (pending.length > 0) {
    const value = pending.pop();
    if (++visited % 4096 === 0) yield;
    if (typeof value === 'string') found(value);
    else if (Array.isArray(value)) { const items: readonly unknown[] = value; for (const item of items) pending.push(item); }
    else if (typeof value === 'object' && value !== null) for (const [key, child] of Object.entries(value)) { found(key); pending.push(child); }
  }
}

export function* tierLibrarySteps(source: TierSelectionSource, tier: 'phone' | 'desktop', descriptor: { readonly index: { readonly files: readonly { readonly hash: string; readonly path: string; readonly name?: string }[] }; readonly sections: ReadonlyMap<string, unknown> }, assets?: ReadonlyMap<string, Uint8Array>): Generator<void, ReadonlySet<string>> {
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
  const hulls = sections.get('look/rigged-hulls');
  if (hulls !== undefined) {
    // The rigged-hull loader reads only its page tier's resources (looks/riggedHulls.ts).
    const book = parseRiggedHullBook(hulls);
    const off = (input: unknown): void => {
      if (typeof input === 'string') { const hash = names.get(input); if (hash !== undefined) inactive.add(hash); }
      else if (typeof input === 'object' && input !== null) for (const value of Object.values(input)) off(value);
    };
    off(book.tiers[tier === 'phone' ? 'desktop' : 'phone']);
    sections.set('look/rigged-hulls', { ...book, tiers: { [tier]: book.tiers[tier] } });
  }
  // Posed libraries (looks/posedInstances.ts) read only their page tier's geometry and atlas.
  // Only a small named JSON can be one; the strict schema, not a name, identifies it.
  if (assets !== undefined) for (const file of source.files) {
    const bytes = file.kind === 'json' && file.decoded <= 65_536 ? assets.get(file.hash) : undefined;
    const text = bytes === undefined ? '' : new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (!text.includes('"tiers"')) continue;
    const row = v.safeParse(PosedLibrarySchema, JSON.parse(text));
    if (!row.success) continue;
    const selected = row.output.tiers[tier], other = row.output.tiers[tier === 'phone' ? 'desktop' : 'phone'];
    alternative(selected.geometry, other.geometry); if (selected.atlas !== undefined && other.atlas !== undefined) alternative(selected.atlas, other.atlas);
  }
  if (inactive.size === 0) return inactive;
  const { files: _files, library: _library, critical: _critical, manifest: _manifest, ...fields } = source;
  yield* stringsSteps([{ ...fields, manifest }, ...sections.values()], text => { const hash = names.get(text); if (hash !== undefined) used.add(hash); });
  for (const file of source.files) for (const ref of file.dependencies) used.add(ref);
  return new Set([...inactive].filter(hash => !used.has(hash)));
}
