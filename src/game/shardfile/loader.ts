import type { App } from '@wildshard/engine/app/app';
import type { LevelSpec } from '@wildshard/engine/level/spec';
import { _applyChunkConstants } from '@wildshard/engine/core/config';
import { configureLevel } from '@wildshard/engine/level/selection';
import type { ShardManifest } from '../shard/manifest';
import { shardEntries } from '../shard/entryMode';
import { game } from '../shard/registry';
import { installShards, shards } from '../shard/list';
import { toLevelSpec } from '../shard/spec';
import { parseShardSlug } from '../shard/slug';
import { parseShardfile, type Shardfile } from './schema';
import { SHARDFILE_VERSION } from './version';
import { emptyLook } from './emptyLook';
import { shardfileLook } from './look';
import { EmptyEquipment } from './emptyEquipment';
import type { ShardContext } from '../shard/context';
import { admitProduct, boundedResponse, browserContentHash, browserProductCache, type AdmittedProduct, type ProductOptions } from './product';
import { ClientAssets } from './clientAssets';
import { ShardfileClient, type ShardfileClientBindings } from './client';
import { clientGround } from './clientGround';
import { shardfileWater } from './water';
import { clientResidency } from './clientResidency';
import { firstPartyInstance } from '../grid/instances';
import { SHARDFILE_ADMISSION_LIMITS as limits } from './admissionLimits';
import { preflightShardfile } from './preflight';
import { ResidencyAllocator } from '../grid/allocator';

/** Validate before allocating a level. Content bindings belong to the full loader. */
export function emptyShardfileSource(input: unknown): ShardManifest {
  preflightShardfile(input);
  if (typeof input === 'object' && input !== null && 'version' in input && input.version !== SHARDFILE_VERSION) throw new Error(`Shardfile version ${String(input.version)} requires a compatible client (this client supports ${SHARDFILE_VERSION})`);
  const source = parseShardfile(input);
  if (source.meshCollision !== null) throw new Error('Compiled mesh collision runtime and entry admission pending');
  if (source.runtime !== null) throw new Error('Custom runtime requires trusted hybrid composition');
  // The look (SF10b) is the one content kind bound here: day keys and a LUT, the LUT's file the only file allowed.
  const lut = source.look.grade.lut;
  const lutOnly = source.files.every((f) => f.hash === lut) && source.requires.commons.every((h) => `commons:${h}` === lut);
  const newContent = source.movers.length + source.crowds.length + source.clientScripts.bindings.length + source.water.length + source.creatures.spawns.length + source.creatures.brains.length + source.encounters.length + source.ledger.length + source.audio.cues.length + source.audio.routing.length + Object.values(source.quests).reduce((sum, rows) => sum + rows.length, 0);
  if (source.items.rows.length + source.items.contexts.length > 0 || source.props !== null || source.targets.panels.length + source.targets.interactions.length > 0 || Object.keys(source.look.materials).length + Object.keys(source.look.familyLooks).length > 0 || newContent > 0 || source.hooks.conditions.length + source.hooks.scenes.length > 0 || source.plumbing !== null || source.terrain !== null || source.audio.ambience !== null || source.audio.score !== 'silent' || source.audio.music !== undefined || source.audio.samples !== undefined || source.audio.zones !== undefined || Object.values(source.rows).reduce((sum, rows) => sum + rows.length, 0) + source.ui.length + source.tiles.length + source.library.filter((ref) => ref !== lut).length + source.requires.capabilities.length + source.sim.scripts.length + source.sim.bindings.length + source.look.families.length > 0 || !lutOnly || source.far !== null || source.state.shared.length + source.state.player.length > 0) throw new Error('This client supports empty shardfiles only; content requires the full shardfile loader');
  return sourceManifest(source);
}

function sourceManifest(source: Shardfile): ShardManifest {
  const card = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E';
  return {
    api: 1, accent: source.accent, slug: parseShardSlug(source.identity.slug), name: source.identity.name, seed: source.identity.seed,
    order: 0, status: 'live', label: '(0, 0)', biome: 'Empty world', blurb: 'An empty shardfile world.',
    card: { thumb: card, portrait: card, landscape: card }, style: 'greybox', kitLook: 'toon', hands: 'toon', weapon: 'custom',
    treeCount: 0, trees: { factory: 'none', noun: 'trees' }, ground: { structures: true, paths: 'plugin' }, horizon: { rings: [], cloudSea: false },
    spawn: { ...source.spawn }, spawns: [], species: [], uses: [], boundary: { visible: false },
    sky: { sunColor: [1, 1, 1], sunIntensity: 1, envIntensity: 0.5, bgIntensity: 1, fogSunColor: [1, 1, 1], cloudSunColor: [1, 1, 1], hemiSky: 0x9ca7b4, hemiGround: 0x606060, hemiIntensity: 0.7, sun: { azimuth: 35, elevation: 45 } },
    atmosphere: { fogHeight: -20, fogHeightFalloff: 0, fogHeightDensity: 0, fogDistDensity: 0, volumetricSunColor: [1, 1, 1] },
    grade: { saturation: source.look.grade.saturation - 1, brightness: 0, contrast: source.look.grade.contrast - 1, bloomIntensity: 0, bloomThreshold: 1, shadowTint: [1, 1, 1], highTint: [1, 1, 1], lift: [0, 0, 0], gain: [1, 1, 1], gamma: 1 },
    budgets: {}, fight: {}, loadout: { weapons: [], tools: [], start: [] }, minimap: {},
    render: () => Promise.resolve(source.look.keys.length === 0 ? emptyLook(source.look.dayOverride) : shardfileLook(source.look)), tiers: { phone: { ao: false, godRays: false }, desktop: { ao: false, godRays: false } },
    audio: { ambience: 'none', score: 'none' },
    boot: { files: () => [], sources: () => ({ sky: [], baked: [], terrain: [], trees: [], physics: [], cabins: [], props: [], art: [], music: [], sfx: [] }), viewmodelSets: [], audio: () => Promise.resolve([]), precache: [] },
    // A plugin source enters the ordinary staged LevelLoader, even with no authored hooks.
    load: () => Promise.resolve({ default: class {
      kit(ctx: ShardContext): void {
        const runtime = ctx.game.runtime;
        if (runtime === undefined) throw new Error('Shardfile source requires the session host');
        runtime.buildEquipment = () => Promise.resolve({ primary: new EmptyEquipment(), secondary: null, rifle: null });
      }
    } }),
  };
}

/** Admit every immutable byte before creating a normal Game level source; scopes own all staged content bindings. */
export async function shardfileSource(input: unknown, options: ProductOptions, bindings: ShardfileClientBindings): Promise<ShardManifest> {
  const ownedOptions = withPageMemory(options, bindings);
  return clientSource(await admitProduct(input, ownedOptions), ownedOptions, bindings);
}

function withPageMemory(options: ProductOptions, bindings: ShardfileClientBindings): ProductOptions {
  const memory = bindings.residency?.memory ?? options.memory;
  if (bindings.residency !== undefined && options.memory !== undefined && memory !== options.memory) throw new Error('Shardfile admission must share the page memory policy');
  return memory === undefined ? options : { ...options, memory };
}

function clientSource(admitted: AdmittedProduct, options: ProductOptions, bindings: ShardfileClientBindings): ShardManifest {
  const source = admitted.source;
  if (bindings.trustedRuntime === true && (!options.firstParty || source.runtime === null)) throw new Error('Empty hybrid policy requires a trusted first-party runtime declaration');
  if (bindings.audioOwner === 'runtime' && (!options.firstParty || source.runtime === null)) throw new Error('Runtime audio ownership requires a trusted first-party runtime declaration');
  if (bindings.worldOwner === 'runtime' && (!options.firstParty || source.runtime === null)) throw new Error('Runtime world ownership requires a trusted first-party runtime declaration');
  if (!options.firstParty && admitted.instance === undefined) throw new Error('Outside shardfile is missing its admitted save identity');
  const ownedBindings = { ...bindings,
    ...(bindings.allocator === undefined && bindings.residency === undefined && options.memory !== undefined ? { allocator: new ResidencyAllocator({ memory: options.memory }) } : {}),
    ...(options.firstParty ? {} : { instance: admitted.instance ?? '' }) };
  const residency = clientResidency(source, ownedBindings);
  const assets = new ClientAssets(source, admitted.assets, options);
  const manifest = sourceManifest(source);
  const clientBindings = { ...ownedBindings, allocator: residency.allocator };
  return { ...manifest, biome: 'Authored world', blurb: source.identity.name,
    // Traversal belongs to the platform, independently of authored item rows or Developer mode.
    loadout: { weapons: [], tools: ['tool.hoverboard'], start: ['tool.hoverboard'] },
    ground: { ...(source.terrain === null && !source.entryways.some(entry => entry.kind === 'socketLift' || entry.kind === 'portalLink') ? {} : { structures: true }), paths: 'plugin', terrain: clientGround(source, assets.retained), water: shardfileWater(source.water) },
    species: source.rows.species.map((row) => row.kind), uses: ['spawns', 'quests', 'bosses', 'elites', 'swim', 'hover', 'explore', 'practice'],
    loot: { coins: source.rows.loot.length > 0 },
    creatures: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true },
    render: () => Promise.resolve(source.look.keys.length === 0 ? emptyLook(source.look.dayOverride) : shardfileLook(source.look, assets.retained)),
    load: () => Promise.resolve({ default: class extends ShardfileClient { constructor() { super(source, assets, clientBindings); } } }),
  };
}

/** Select a fully admitted external product before the ordinary session starts; first-party discovery remains installed. */
export async function installShardfileProduct(input: unknown, providedOptions: ProductOptions, bindings: ShardfileClientBindings): Promise<ShardManifest> {
  const options = withPageMemory(providedOptions, bindings);
  const admitted = await admitProduct(input, options);
  if (admitted.source.runtime !== null) throw new Error('Custom runtime requires trusted hybrid composition');
  const source = clientSource(admitted, options, bindings);
  return selectSource(source, options.firstParty);
}

function selectSource(source: ShardManifest, firstParty: boolean): ShardManifest {
  const list = new Map(firstParty ? shards().map((manifest) => [manifest.slug.replace(/^_/u, ''), manifest]) : []);
  list.set(source.slug.replace(/^_/u, ''), source); installShards([...list.values()]);
  game.shard = source; _applyChunkConstants(source); configureLevel(toLevelSpec(source)); return source;
}

/** Admit a built first-party descriptor before the normal session, preserving picker identity and its canonical save instance. */
export async function installManifestShardfile(manifest: ShardManifest, providedOptions: ProductOptions, bindings: ShardfileClientBindings): Promise<ShardManifest> {
  const options = withPageMemory(providedOptions, bindings);
  if (manifest.shardfile === undefined) return manifest;
  if (!options.firstParty) throw new Error('Manifest shardfile descriptors require first-party provenance');
  const url = new URL(manifest.shardfile, options.base);
  if (url.origin !== new URL(options.base).origin || url.search !== '' || url.hash !== '') throw new Error('Manifest shardfile must be an unqualified same-origin source');
  const productOptions = { ...options, base: new URL('.', url).href };
  let input: unknown;
  if (options.offline) {
    options.progress?.({ phase: 'descriptor', detail: 'Reading visited shard descriptor', bytesRead: 0, bytesTotal: 0, filesDone: 0, filesTotal: 1 });
    const visited = await options.cache?.product(productOptions.base);
    if (visited?.firstParty !== true) throw new Error('First-party shardfile has not been visited offline');
    input = visited.source;
  } else {
    let bytesRead = 0;
    options.progress?.({ phase: 'descriptor', detail: 'Fetching shard descriptor', bytesRead, bytesTotal: 0, filesDone: 0, filesTotal: 1 });
    const response = await options.fetch(url.href), length = Number(response.headers.get('content-length'));
    const bytesTotal = Number.isSafeInteger(length) && length > 0 ? length : 0;
    const bytes = await boundedResponse(response, limits.sourceBytes, (size) => {
      bytesRead += size; options.progress?.({ phase: 'descriptor', detail: 'Reading shard descriptor', bytesRead, bytesTotal, filesDone: 0, filesTotal: 1 });
    });
    options.progress?.({ phase: 'descriptor', detail: 'Parsing shard descriptor', bytesRead, bytesTotal: bytesRead, filesDone: 1, filesTotal: 1 });
    input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  }
  const source = parseShardfile(input);
  const { slug: authoredIdentity } = source.identity, expectedIdentity = manifest.slug.replace(/^_/u, '');
  if (authoredIdentity !== expectedIdentity) throw new Error('Manifest and shardfile identities differ');
  if (source.runtime !== null) throw new Error('Custom runtime requires trusted hybrid composition');
  const admitted = await admitProduct(source, productOptions);
  return selectSource({ ...clientSource(admitted, productOptions, { ...bindings, instance: firstPartyInstance(manifest.slug) }),
    slug: manifest.slug, name: manifest.name, order: manifest.order, status: manifest.status, label: manifest.label,
    biome: manifest.biome, blurb: manifest.blurb, card: manifest.card,
    // SF65 (G241): the picker's ways in survive admission (the admitted manifest's client `load` is not legacy TypeScript)
    entries: shardEntries(manifest),
    // G252b: so does its map (the baked image, SF66): the admitted source's empty minimap left Bag ▸ MAP with only the fog
    ...(manifest.minimap === undefined ? {} : { minimap: manifest.minimap }),
  }, true);
}

/** Browser connectivity and visited-product storage feed the same admission path as headless validation. */
export function browserShardfileOptions(base: string, firstParty = false): ProductOptions {
  return { base, firstParty, offline: !navigator.onLine, hash: browserContentHash, fetch: (url) => fetch(url),
    ...(typeof caches === 'undefined' ? {} : { cache: browserProductCache(caches) }),
  };
}

/** Project an empty shardfile into the same engine spec consumed by legacy sources. */
export function shardfileLevelSpec(input: unknown): LevelSpec { return toLevelSpec(emptyShardfileSource(input)); }

/** Load through an installed engine driver; the ordinary unloadLevel owns every resource. */
export async function loadShardfile(app: App, input: unknown): Promise<void> {
  await app.loadLevel(shardfileLevelSpec(input), {});
}

/** The prebuilt client's HTML supplies data, without a second boot loop or URL switch. */
export function configuredShardfile(document: Pick<Document, 'getElementById'>): Shardfile | null {
  const element = document.getElementById('ws-shardfile');
  if (element === null) return null;
  const text = element.textContent;
  // Reject excessive character counts before creating a UTF-8 copy or parsing the inline source.
  if (text.length > limits.sourceBytes || new TextEncoder().encode(text).length > limits.sourceBytes) throw new Error('Shardfile source exceeds admission cap');
  return parseShardfile(JSON.parse(text));
}

/** Select a validated external source before the normal session starts. */
export function installShardfileSource(input: unknown): ShardManifest {
  const source = emptyShardfileSource(input);
  installShards([source]);
  game.shard = source;
  _applyChunkConstants(source);
  configureLevel(toLevelSpec(source));
  return source;
}
