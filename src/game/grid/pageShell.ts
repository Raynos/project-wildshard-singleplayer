import type { LevelSpec } from '@wildshard/engine/level/spec';
import type { ShardContext } from '../shard/context';
import type { ShardManifest } from '../shard/manifest';
import { ShardPlugin } from '../shard/plugin';
import { toLevelSpec } from '../shard/spec';
import { EmptyEquipment } from '../shardfile/emptyEquipment';

/**
 * G226: the page owns the renderer, player and platform controls, never an opaque home world. Keep only identity and
 * scalar presentation data here: the original manifest remains in the catalogue and its owned region builds its
 * terrain, creatures, equipment and hooks through the ordinary trusted factory. Standalone boots never use this copy.
 */
export function gridPageShell(source: ShardManifest): ShardManifest {
  const { slug, api, order, status, name, label, seed, biome, blurb, card, sky, atmosphere, grade, style, weapon, spawn } = source;
  const tools = [...(source.loadout?.tools ?? [])];
  return {
    slug, api, order, status, name, label, seed, biome, blurb, card, style, weapon, spawn: { ...spawn },
    treeCount: 0, ground: { structures: true }, trees: { factory: 'none', noun: 'trees' }, spawns: [], species: [],
    sky: { sunColor: sky.sunColor, sunIntensity: sky.sunIntensity, envIntensity: sky.envIntensity,
      bgIntensity: sky.bgIntensity, fogSunColor: sky.fogSunColor, cloudSunColor: sky.cloudSunColor,
      hemiSky: sky.hemiSky, hemiGround: sky.hemiGround, hemiIntensity: sky.hemiIntensity },
    atmosphere, grade, audio: { ambience: 'legacy', score: 'legacy' },
    boot: { files: () => [], precache: [] },
    loadout: { weapons: [], tools, start: tools.filter(id => source.loadout?.start.includes(id)) },
    ...(source.tiers === undefined ? {} : { tiers: source.tiers }),
    ...(source.camera === undefined ? {} : { camera: source.camera }),
  };
}

/** The neutral page cannot read a home terrain/navmesh bake merely because it keeps the picker's identity. */
export function gridPageShellLevel(shell: ShardManifest): LevelSpec {
  return { ...toLevelSpec(shell), id: 'platform.grid', boundary: { visible: false, walls: false } };
}

/** Mandatory shell equipment is inert; actual shard equipment lives only in the owned region's kit scope. */
export class GridPageShellPlugin extends ShardPlugin {
  override kit(context: ShardContext): void {
    const runtime = context.game.runtime;
    if (runtime === undefined) throw new Error('Grid page shell requires its staged runtime');
    runtime.buildEquipment = () => Promise.resolve({ primary: new EmptyEquipment(), rifle: null, secondary: null });
  }
}
