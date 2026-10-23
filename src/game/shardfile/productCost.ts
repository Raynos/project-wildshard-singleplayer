import { parseImageAsset } from '@wildshard/format/stillImage';
import { journalImageRefs } from '@wildshard/format/compendiumRows';
import type { Shardfile } from '@wildshard/format/shardSchema';
import type { TextureTranscodeSupport } from '@wildshard/format/contentBounds';
import type { worstContentCost } from '@wildshard/format/budget';
import { deviceLibraryCostSteps } from '@wildshard/format/assetAdmission';
import { frameBudgetSpent } from '@wildshard/engine/core/framePacing';
import { preflightShardfile } from '@wildshard/format/preflight';
import { isJsonData } from '@wildshard/format/json';
import { outputDescriptor } from './outputDescriptor';
import { isPlatformDataSection } from '@wildshard/format/outputIndex';
import { parseWorldScenes, worldScenesForTier } from '@wildshard/format/worldScenes';
import { parseWorldSceneModels, worldSceneModelGraphs, worldSceneModelResources } from '@wildshard/format/worldSceneModels';
import { parseWorldSceneWeld } from '@wildshard/format/worldSceneWeld';
import { parseRiggedHullBook } from '@wildshard/format/riggedHulls';
import { PosedLibrarySchema } from '@wildshard/format/namedJsonContracts';
import * as v from 'valibot';
import { plumbingKnob } from '../shard/declaredPlumbing';
import { recordSceneProfile } from './sceneProfile';

/** View-scoped frozen specimens retain at most the current model and its two
 * tier comparisons. Reserve a fourth complete choice for a cancelled decoder.
 * Each choice includes its intake CPU storage and a copied draw geometry.
 * World geometry, transport, external readers and dependencies stay charged. */
interface SpecimenQuality { readonly tier: 'phone' | 'desktop'; readonly overrides?: Readonly<Partial<Record<`${string}.${string}`, number | boolean>>> }
export function scopedSpecimenLibrarySource(source: Shardfile, assets: ReadonlyMap<string, Uint8Array>, quality?: SpecimenQuality): Shardfile {
  const costs = specimenCosts(source, assets, quality);
  let result = costs.next();
  while (!result.done) result = costs.next();
  return result.value;
}

/** Run `steps` to its result, pausing after each 8 ms of them, or sooner once the frame's shared build budget is spent:
 *  the grid admits several products at once, and their own clocks alone stacked 45-65 ms of steps into one Pine frame
 *  (a live admission paints in between). */
async function paced<T>(steps: Generator<void, T>, pause: () => Promise<void>): Promise<T> {
  let started = performance.now(), result = steps.next();
  while (result.done !== true) {
    if (performance.now() - started >= 8 || frameBudgetSpent(8)) { await pause(); started = performance.now(); }
    result = steps.next();
  }
  return result.value;
}

/** This device's worst-disc cost of `source` (`deviceLibraryCostSteps`), paced like the specimen projection. */
export function deviceLibraryCostPaced(source: Shardfile, assets: ReadonlyMap<string, Uint8Array>, support: TextureTranscodeSupport,
  pause: (() => Promise<void>) | undefined): Promise<ReturnType<typeof worstContentCost>> {
  return paced(deviceLibraryCostSteps(source, assets, support), pause ?? (() => Promise.resolve()));
}

/** Same complete cost projection, allowing live admission to paint between catalogue choices. */
export async function scopedSpecimenLibrarySourcePaced(source: Shardfile, assets: ReadonlyMap<string, Uint8Array>, quality: SpecimenQuality | undefined, pause: (() => Promise<void>) | undefined): Promise<Shardfile> {
  if (pause === undefined) return scopedSpecimenLibrarySource(source, assets, quality);
  await pause();
  return paced(specimenCosts(source, assets, quality), pause);
}

function* specimenCosts(source: Shardfile, assets: ReadonlyMap<string, Uint8Array>, quality?: SpecimenQuality): Generator<void, Shardfile> {
  const descriptor = outputDescriptor(source), input = descriptor?.sections.get('world/scenes');
  if (descriptor === undefined || input === undefined) return source;
  const scenes = parseWorldScenes(input);
  if (scenes.catalogue === undefined) return source;
  const names = new Map<string, string>();
  for (const file of descriptor.index.files) for (const name of [file.hash, file.path, `/shardfiles/${source.identity.slug}/${file.path}`, ...file.name === undefined ? [] : [file.name]]) names.set(name, file.hash);
  const read = (name: string): unknown => {
    const hash = names.get(name), bytes = hash === undefined ? undefined : assets.get(hash);
    if (bytes === undefined) throw new Error(`Missing specimen cost bytes: ${name}`);
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  };
  const catalogue = parseWorldSceneModels(read(scenes.catalogue));
  yield;
  const libraries = new Map(scenes.libraries.filter(row => row.kind === 'owned').map(row => [row.id, row]));
  const files = new Map(source.files.map(file => [file.hash, file]));
  const refs = (library: string, model: string): string[] => {
    const row = libraries.get(library)?.models.find(entry => entry.id === model);
    return row === undefined ? [] : [typeof row.file === 'string' ? [row.file] : Object.values(row.file), row.segments ?? []].flat().map(name => {
      const hash = names.get(name); if (hash === undefined) throw new Error('Missing specimen geometry cost'); return hash;
    });
  };
  const eligible = new Set<string>(), retained = new Set(source.critical);
  if (quality !== undefined) for (const library of libraries.values()) for (const model of library.models) for (const hash of refs(library.id, model.id)) eligible.add(hash);
  let largest = 0;
  for (const model of catalogue.models) {
    for (const choice of model.choices) {
      const graphs = worldSceneModelGraphs(choice).map(leaf => 'file' in leaf ? parseWorldSceneWeld(read(leaf.file)) : leaf);
      const resources = worldSceneModelResources({ ...catalogue, models: [{ ...model, choices: [choice] }] }, graphs);
      const hashes = new Set(resources.geometry.flatMap(ref => refs(ref.library, ref.model)));
      if (model.assembly !== 'scene') { for (const hash of hashes) retained.add(hash); yield; continue; }
      for (const hash of hashes) eligible.add(hash);
      // A view resolves exactly one topology leaf. Admission still checks all
      // leaves; a union of mutually exclusive leaves is not one resident copy.
      // Only the admitted knob branch can be viewed (another quality reloads and
      // re-admits); both of its tier comparisons stay reserved.
      const scene = choice.scene, viewable = quality === undefined || scene === undefined || !('knob' in scene) ? graphs
        : worldSceneModelGraphs({ ...choice, scene: scene[plumbingKnob(source.plumbing, quality.tier, scene.knob, 'boolean', quality.overrides) ? 'true' : 'false'] })
          .map(leaf => 'file' in leaf ? parseWorldSceneWeld(read(leaf.file)) : leaf);
      for (const graph of viewable) {
        const selected = worldSceneModelResources({ ...catalogue, models: [{ ...model, choices: [{ ...choice, scene: graph }] }] });
        const selectedHashes = new Set(selected.geometry.flatMap(ref => refs(ref.library, ref.model)));
        largest = Math.max(largest, [...selectedHashes].reduce((sum, hash) => { const file = files.get(hash); if (file === undefined) throw new Error('Missing specimen file cost'); return sum + file.decoded + file.gpu * 2; }, 0));
        yield;
      }
    }
  }
  const visit = (value: unknown): void => {
    if (typeof value === 'string') { const hash = names.get(value); if (hash !== undefined) retained.add(hash); }
    else if (Array.isArray(value)) for (const child of value) visit(child);
    else if (typeof value === 'object' && value !== null) {
      if ('library' in value && 'model' in value && typeof value.library === 'string' && typeof value.model === 'string') for (const hash of refs(value.library, value.model)) retained.add(hash);
      for (const [key, child] of Object.entries(value)) { visit(key); visit(child); }
    }
  };
  const { files: _files, library: _library, critical: _critical, ...fields } = source;
  visit(fields);
  yield;
  for (const [name, row] of descriptor.sections) {
    if (name !== 'world/scenes') { visit(row); yield; continue; }
    const { libraries: _libraries, catalogue: _catalogue, ...world } = scenes;
    visit(world);
    yield;
  }
  const selectedFiles: string[] = [];
  for (const weld of scenes.welds) {
    if (quality !== undefined) {
      const file = typeof weld.file === 'object' && 'knob' in weld.file ? weld.file[plumbingKnob(source.plumbing, quality.tier, weld.file.knob, 'boolean', quality.overrides) ? 'true' : 'false'] : weld.file;
      const selected = typeof file === 'string' ? file : file[quality.tier];
      selectedFiles.push(selected); visit(parseWorldSceneWeld(read(selected))); yield; continue;
    }
    const variants = typeof weld.file === 'object' && 'knob' in weld.file ? [weld.file.false, weld.file.true] : [weld.file];
    for (const variant of variants) for (const name of typeof variant === 'string' ? [variant] : Object.values(variant)) { visit(parseWorldSceneWeld(read(name))); yield; }
  }
  if (quality !== undefined) recordSceneProfile(source, selectedFiles);
  for (const file of source.files) for (const dependency of file.dependencies) retained.add(dependency);
  const charged = new Set(source.library);
  const removable = source.files.reduce((sum, file) => sum + (charged.has(file.hash) && eligible.has(file.hash) && !retained.has(file.hash) ? file.decoded + file.gpu : 0), 0);
  const saving = Math.max(0, removable - largest * 4);
  return saving === 0 ? source : { ...source, budgets: { ...source.budgets, library: { ...source.budgets.library, resident: Math.max(0, source.budgets.library.resident - saving) } } };
}

/** Project only exclusive alternatives selected by existing typed presentation hosts.
 * Transport stays fully charged. References elsewhere or dependencies keep an asset resident;
 * arbitrary runtime names and unselected scene batches are never treated as tier selectors. */
export function tierLibrarySource(source: Shardfile, tier: 'phone' | 'desktop', assets?: ReadonlyMap<string, Uint8Array>): Shardfile {
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

/** Immutable manifest/journal URLs never create the data-URL string charged by image intake.
 * Keep one wire copy, CPU pixels and compositor pixels. Any other reader retains the full envelope. */
export function urlImageLibrarySource(source: Shardfile, assets: ReadonlyMap<string, Uint8Array>): Shardfile {
  const descriptor = outputDescriptor(source);
  if (descriptor === undefined) return source;
  const names = new Map<string, string>();
  for (const file of descriptor.index.files) if (file.kind === 'image') {
    names.set(file.hash, file.hash); names.set(file.path, file.hash);
    names.set(`/shardfiles/${source.identity.slug}/${file.path}`, file.hash);
    if (file.name !== undefined) names.set(file.name, file.hash);
  }
  const eligible = new Set<string>(), other = new Set<string>();
  const visit = (value: unknown, into: Set<string>): void => {
    if (typeof value === 'string') { const hash = names.get(value); if (hash !== undefined) into.add(hash); }
    else if (Array.isArray(value)) for (const child of value) visit(child, into);
    else if (typeof value === 'object' && value !== null) for (const [key, child] of Object.entries(value)) { visit(key, into); visit(child, into); }
  };
  visit(source.manifest, eligible);
  const compendiums = source.rows.compendiums.map(row => {
    if (!('kind' in row)) return row;
    for (const ref of journalImageRefs(row)) { const hash = names.get(ref); if (hash !== undefined) eligible.add(hash); }
    return { ...row, entries: row.entries.map(entry => {
      const { sketch: _sketch, silhouette: _silhouette, ...plate } = entry.plate;
      return { ...entry, plate };
    }), ...(row.chalk === undefined ? {} : { chalk: { ...row.chalk, atlas: '' } }) };
  });
  const { files: _files, library: _library, critical: _critical, manifest: _manifest, rows, ...fields } = source;
  visit({ ...fields, rows: { ...rows, compendiums } }, other);
  // These two typed sections are already represented by source.manifest/source.rows.
  for (const [name, section] of descriptor.sections) if (name !== 'ui/level' && name !== 'ui/compendium') visit(section, other);
  for (const file of source.files) for (const ref of file.dependencies) other.add(ref);
  const library = new Set(source.library);
  let saving = 0;
  for (const file of source.files) {
    if (!library.has(file.hash) || !eligible.has(file.hash) || other.has(file.hash)) continue;
    const bytes = assets.get(file.hash); if (bytes === undefined) continue;
    const image = parseImageAsset(bytes);
    saving += Math.max(0, Math.min(file.decoded, image.decoded) - image.gpu - bytes.length);
  }
  if (saving === 0) return source;
  return { ...source, budgets: { ...source.budgets, library: { ...source.budgets.library,
    resident: Math.max(0, source.budgets.library.resident - saving) } } };
}

/** Conservative heap estimate for a bounded plain-JSON source or its owned projection, including strings and container overhead. */
export function jsonResidentBytes(input: unknown): number {
  if (!isJsonData(input)) throw new Error('Product residency needs bounded plain JSON');
  let heap = 0;
  const pending: unknown[] = [input];
  // O14: a primitive is counted where it is met, never queued: the products' row arrays are mostly numbers
  const count = (item: unknown): void => {
    if (typeof item === 'string') heap += 24 + item.length * 2;
    else if (typeof item === 'object' && item !== null) pending.push(item);
    else heap += 8;
  };
  while (pending.length > 0) {
    const value = pending.pop();
    if (Array.isArray(value)) { const items: readonly unknown[] = value; heap += 40 + items.length * 8; for (const item of items) count(item); }
    else if (typeof value === 'object' && value !== null) {
      const entries = Object.entries(value); heap += 64 + entries.length * 16;
      for (const [key, item] of entries) { heap += 24 + key.length * 2; count(item); }
    } else count(value);
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
  const steps = runtimeOnlyProductFilesSteps(source);
  for (;;) { const step = steps.next(); if (step.done === true) return step.value; }
}
/** `runtimeOnlyProductFiles` in steps of 4096 visited values (its walk over a whole product was ~45 ms of a frame). */
function* runtimeOnlyProductFilesSteps(source: Shardfile, unread: ReadonlySet<string> = new Set()): Generator<void, readonly string[]> {
  let visited = 0;
  const files = new Map(source.files.map(file => [file.hash, file])), keep = new Set<string>();
  const descriptor = outputDescriptor(source), paths = new Map(descriptor?.index.files.map(file => [file.path, file.hash]));
  const pending: unknown[] = [{ ...source, files: [], critical: [], library: [] },
    ...[...descriptor?.sections ?? []].flatMap(([name, value]) => isPlatformDataSection(name) && !unread.has(name) ? [value] : [])];
  // O14: only strings can name a file: numbers, booleans and nulls (most of a product's rows) are never queued
  const queue = (item: unknown): void => { if (typeof item === 'string' || typeof item === 'object' && item !== null) pending.push(item); };
  while (pending.length > 0) {
    const value = pending.pop();
    if (++visited % 4096 === 0) yield;
    if (typeof value === 'string') { const ref = paths.get(value) ?? value; if (files.has(ref)) keep.add(ref); }
    else if (Array.isArray(value)) { const items: readonly unknown[] = value; for (const item of items) queue(item); }
    else if (typeof value === 'object' && value !== null) for (const [key, child] of Object.entries(value)) { pending.push(key); queue(child); }
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

/** Platform sections no neighbour reads synchronously: world scenes read their files through the product's `file()`. */
const NEIGHBOUR_UNREAD: ReadonlySet<string> = new Set(['world/scenes']);
/** Neighbours stream terrain, props tiles and placeholders through ClientAssets.read; bound whole geometry belongs to the entered runtime.
 * Keep every synchronous panel, material, physics and simulation reference, including dependencies shared with a tile.
 * World scenes read every file through the product's asynchronous `file()` (a released file is read again from the
 * cache or the network), so a neighbour holds none of its scene-only bytes (Nine's world GLBs were ~100 MB of a phone
 * renderer). */
export function neighbourProductFiles(source: Shardfile): readonly string[] {
  const steps = runtimeOnlyProductFilesSteps(neighbourSource(source), NEIGHBOUR_UNREAD);
  for (;;) { const step = steps.next(); if (step.done === true) return step.value; }
}
const neighbourWalks = new WeakMap<Shardfile, Promise<readonly string[]>>();
/** `neighbourProductFiles` paced like admission, walked once per admitted source (its pins, then its release). */
export function neighbourProductFilesPaced(source: Shardfile, pause: (() => Promise<void>) | undefined): Promise<readonly string[]> {
  let walk = neighbourWalks.get(source);
  if (walk === undefined) { walk = paced(runtimeOnlyProductFilesSteps(neighbourSource(source), NEIGHBOUR_UNREAD), pause ?? (() => Promise.resolve())); neighbourWalks.set(source, walk); }
  return walk;
}
/** `runtimeOnlyProductFiles` paced like admission. */
export function runtimeOnlyProductFilesPaced(source: Shardfile, pause: (() => Promise<void>) | undefined): Promise<readonly string[]> {
  return paced(runtimeOnlyProductFilesSteps(source), pause ?? (() => Promise.resolve()));
}
function neighbourSource(source: Shardfile): Shardfile {
  const props = source.props;
  const boundProps = source.runtime?.binds?.includes('props') === true;
  const boundTerrain = source.runtime?.binds?.includes('terrain') === true;
  const { near: _near, ...drawn } = source;
  return { ...drawn, tiles: [], far: null,
    terrain: source.terrain === null || boundTerrain ? null : { ...source.terrain, tiles: [] },
    props: props === null ? null : { ...props, tiles: [], far: null,
      ...(boundProps ? { models: [], wholeLibrary: [] } : {}),
      // The model key selects a colour map; material compilation only consumes its colour bytes.
      textures: props.textures.map(({ colour }) => ({ model: '', colour })) } };
}
