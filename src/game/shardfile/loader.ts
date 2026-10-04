import type { App } from '@wildshard/engine/app/app';
import type { LevelSpec } from '@wildshard/engine/level/spec';
import { _applyChunkConstants } from '@wildshard/engine/core/config';
import { configureLevel } from '@wildshard/engine/level/selection';
import type { ShardManifest } from '../shard/manifest';
import { game } from '../shard/registry';
import { installShards } from '../shard/list';
import { toLevelSpec } from '../shard/spec';
import { parseShardSlug } from '../shard/slug';
import { parseShardfile, type Shardfile } from './schema';
import { SHARDFILE_VERSION } from './version';
import { emptyLook } from './emptyLook';
import { shardfileLook } from './look';
import { EmptyEquipment } from './emptyEquipment';
import type { ShardContext } from '../shard/context';

/** Validate before allocating a level. Content bindings belong to the full loader. */
export function emptyShardfileSource(input: unknown): ShardManifest {
  if (typeof input === 'object' && input !== null && 'version' in input && input.version !== SHARDFILE_VERSION) throw new Error(`Shardfile version ${String(input.version)} requires a compatible client (this client supports ${SHARDFILE_VERSION})`);
  const source = parseShardfile(input);
  // The look (SF10b) is the one content kind bound here: day keys and a LUT, the LUT's file the only file allowed.
  const lut = source.look.grade.lut;
  const lutOnly = source.files.every((f) => f.hash === lut) && source.requires.commons.every((h) => `commons:${h}` === lut);
  const newContent = source.water.length + source.creatures.spawns.length + source.creatures.brains.length + source.encounters.length + source.ledger.length + source.audio.cues.length + Object.values(source.quests).reduce((sum, rows) => sum + rows.length, 0);
  if (newContent > 0 || source.hooks.conditions.length + source.hooks.scenes.length > 0 || source.plumbing !== null || source.terrain !== null || source.audio.ambience !== null || source.audio.score !== 'silent' || Object.values(source.rows).reduce((sum, rows) => sum + rows.length, 0) + source.ui.length + source.tiles.length + source.library.length + source.requires.capabilities.length + source.sim.scripts.length + source.sim.bindings.length + source.look.families.length > 0 || !lutOnly || source.far !== null || source.state.shared.length + source.state.player.length > 0) throw new Error('This client supports empty shardfiles only; content requires the full shardfile loader');
  const card = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E';
  return {
    api: 1, slug: parseShardSlug(source.identity.slug), name: source.identity.name, seed: source.identity.seed,
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

/** Project an empty shardfile into the same engine spec consumed by legacy sources. */
export function shardfileLevelSpec(input: unknown): LevelSpec { return toLevelSpec(emptyShardfileSource(input)); }

/** Load through an installed engine driver; the ordinary unloadLevel owns every resource. */
export async function loadShardfile(app: App, input: unknown): Promise<void> {
  await app.loadLevel(shardfileLevelSpec(input), {});
}

/** The prebuilt client's HTML supplies data, without a second boot loop or URL switch. */
export function configuredShardfile(document: Pick<Document, 'getElementById'>): Shardfile | null {
  const element = document.getElementById('ws-shardfile');
  return element === null ? null : parseShardfile(JSON.parse(element.textContent));
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
