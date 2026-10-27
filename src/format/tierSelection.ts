import type { LateFile } from './admissionLate';
import { parseWorldScenes, worldScenesForTier } from './worldScenes';
import { parseRiggedHullBook } from './riggedHulls';
import { PosedLibrarySchema } from './namedJsonContracts';
import { parseClientPlan } from './clientPlan';
import * as v from 'valibot';

/** Only immutable addressing and typed alternatives are needed for selection.
 * Other root fields are retained by the conservative string walk at runtime. */
export interface TierSelectionSource {
  readonly identity: { readonly slug: string };
  readonly files: readonly { readonly hash: string; readonly kind: string; readonly decoded: number; readonly dependencies: readonly string[] }[];
  readonly library: readonly string[]; readonly critical: readonly string[];
  /** Scheduling metadata never creates a synchronous consumer or a tier pin. */
  readonly late?: readonly LateFile[];
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
    // Own enumerable keys in Object.entries order, without an entry pair per key (admission walks every product field).
    else if (typeof value === 'object' && value !== null) for (const key in value) if (Object.hasOwn(value, key)) { found(key); const child: unknown = Reflect.get(value, key); pending.push(child); }
  }
}

/** Entry transport omits manifest-only URL-image copies. Their authored URL
 * readers do not consume admitted buffers; any other host or dependency does.
 * Cost projection stays separate and retains URL-image pixels and wire. */
export function* entryFileSteps(source: TierSelectionSource, tier: 'phone' | 'desktop', descriptor: Parameters<typeof tierLibrarySteps>[2]): Generator<void, ReadonlySet<string>> {
  const alternatives = yield* tierLibrarySteps(source, tier, descriptor);
  const inactive = new Set(alternatives);
  if (source.manifest === undefined) return inactive;
  const images = new Set(source.files.filter(file => file.kind === 'image').map(file => file.hash));
  const names = new Map<string, string>();
  for (const file of descriptor.index.files) if (images.has(file.hash)) {
    for (const name of [file.hash, file.path, `/shardfiles/${source.identity.slug}/${file.path}`]) names.set(name, file.hash);
    if (file.name !== undefined) names.set(file.name, file.hash);
  }
  const eligible = new Set<string>(), used = new Set(source.critical);
  yield* stringsSteps([source.manifest], text => { const hash = names.get(text); if (hash !== undefined) eligible.add(hash); });
  const { files: _files, library: _library, critical: _critical, manifest: _manifest, late: _late, ...fields } = source;
  const sections = [...descriptor.sections].map(([name, row]) => name === 'ui/level' && typeof row === 'object' && row !== null
    ? Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'manifest')) : row);
  yield* stringsSteps([fields, ...sections], text => { const hash = names.get(text); if (hash !== undefined) used.add(hash); });
  for (const file of source.files) for (const dependency of file.dependencies) used.add(dependency);
  for (const hash of eligible) if (!used.has(hash)) inactive.add(hash);
  return inactive;
}

export function* tierLibrarySteps(source: TierSelectionSource, tier: 'phone' | 'desktop', descriptor: { readonly index: { readonly files: readonly { readonly hash: string; readonly path: string; readonly name?: string; readonly tier?: 'phone' | 'desktop'; readonly variantOf?: string; readonly compressed?: number }[] }; readonly sections: ReadonlyMap<string, unknown> }, assets?: ReadonlyMap<string, Uint8Array>): Generator<void, ReadonlySet<string>> {
  const names = new Map<string, string>();
  for (const file of descriptor.index.files) {
    for (const name of [file.hash, file.path, `/shardfiles/${source.identity.slug}/${file.path}`]) names.set(name, file.hash);
    if (file.name !== undefined) names.set(file.name, file.hash);
  }
  const inactive = new Set<string>(), used = new Set(source.critical);
  // a named file marked for the other device tier is that tier's download only, even where an active row names it (an
  // alias table naming both tiers' payloads); only a critical pin or a file dependency keeps it
  const otherTier = new Set(descriptor.index.files.filter(file => file.tier !== undefined && file.tier !== tier).map(file => file.hash));
  // variants of one payload (its texture modes' alternatives): the device fetches one, so this tier keeps only its largest
  const variants = new Map<string, { readonly hash: string; readonly compressed: number }[]>();
  for (const file of descriptor.index.files) if (file.variantOf !== undefined && !otherTier.has(file.hash))
    variants.set(file.variantOf, [...variants.get(file.variantOf) ?? [], { hash: file.hash, compressed: file.compressed ?? 0 }]);
  for (const group of variants.values()) {
    const kept = group.reduce((best, row) => row.compressed > best.compressed || (row.compressed === best.compressed && row.hash < best.hash) ? row : best);
    for (const row of group) if (row !== kept) otherTier.add(row.hash);
  }
  for (const hash of otherTier) inactive.add(hash);
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
  const client = sections.get('client/plan');
  if (client !== undefined) {
    const plan = parseClientPlan(client);
    // iPhone downloads I8: a water row draws its page tier's grid and a baked row its tier's tiles, lightmaps, wear and
    // plan (clientWaterSurfaces, bakedTiles): every { phone, desktop } pair keeps only this tier's files
    const strings = (input: unknown, into: (text: string) => void): void => {
      if (typeof input === 'string') into(input);
      else if (typeof input === 'object' && input !== null) for (const value of Object.values(input)) strings(value, into);
    };
    const tiered = (input: unknown): unknown => {
      if (Array.isArray(input)) return input.map(tiered);
      if (typeof input !== 'object' || input === null) return input;
      if (Object.keys(input).length === 2 && 'phone' in input && 'desktop' in input) {
        strings(tier === 'phone' ? input.desktop : input.phone, text => { const ref = names.get(text); if (ref !== undefined) inactive.add(ref); });
        const selected = tiered(tier === 'phone' ? input.phone : input.desktop);
        return { phone: selected, desktop: selected };
      }
      return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, tiered(value)]));
    };
    const features: unknown[] = plan.features.map(feature => {
      if (feature.kind === 'world.water' || feature.kind === 'world.baked') return { ...feature, rows: tiered(feature.rows) };
      if (feature.kind !== 'world.assembly' || feature.rows.construction?.cells === undefined) return feature;
      const construction = feature.rows.construction, cells = construction.cells;
      if (cells === undefined) return feature;
      // WorldAssembly.construct reads exactly cells[TIER], including on a
      // restored entry. Other sections, critical pins and dependencies below
      // still protect a shared file; the descriptor itself is never changed.
      alternative(cells[tier], cells[tier === 'phone' ? 'desktop' : 'phone']);
      return { ...feature, rows: { ...feature.rows, construction: { ...construction,
        cells: { phone: cells[tier], desktop: cells[tier] } } } };
    });
    sections.set('client/plan', { ...plan, features });
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
  const { files: _files, library: _library, critical: _critical, manifest: _manifest, late: _late, ...fields } = source;
  yield* stringsSteps([{ ...fields, manifest }, ...sections.values()], text => { const hash = names.get(text); if (hash !== undefined) used.add(hash); });
  const pinned = new Set([...source.critical, ...source.files.flatMap(file => file.dependencies)]);
  for (const file of source.files) for (const ref of file.dependencies) used.add(ref);
  return new Set([...inactive].filter(hash => otherTier.has(hash) ? !pinned.has(hash) : !used.has(hash)));
}
