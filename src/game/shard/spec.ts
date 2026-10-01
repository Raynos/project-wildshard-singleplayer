import type { EngineMechanism, LevelSpec } from '#engine';
import type { ShardManifest } from './manifest';

const ENGINE_MECHANISMS: ReadonlySet<string> = new Set(['hover', 'explore', 'practice', 'water', 'creatures', 'weather', 'dayCycle']);
const engineMechanism = (value: string): value is EngineMechanism => ENGINE_MECHANISMS.has(value);

/** Pure, node-safe boundary. Only authored engine policy crosses it, never title or game metadata. */
export function toLevelSpec(manifest: ShardManifest): LevelSpec {
  return {
    id: manifest.slug,
    ground: { ...(manifest.ground.terrain === undefined ? {} : { terrain: manifest.ground.terrain }),
      ...(manifest.ground.structures === undefined ? {} : { structures: true }) },
    spawn: manifest.spawn,
    sky: manifest.sky, atmosphere: manifest.atmosphere, grade: manifest.grade,
    budgets: manifest.budgets ?? {}, fight: manifest.fight ?? {},
    mechanisms: (manifest.uses ?? []).filter(engineMechanism),
    boot: manifest.boot ?? { files: () => manifest.ground.structures?.files ?? [] },
    audio: manifest.audio ?? { ambience: 'legacy', score: 'legacy' },
    loadout: manifest.loadout ?? { weapons: [], tools: [], start: [] },
    species: manifest.species ?? [], spawns: manifest.spawns,
    minimap: manifest.minimap ?? {},
    kitLook: manifest.kitLook ?? 'pbr',
    ...(manifest.bounds === undefined ? {} : { bounds: manifest.bounds }),
    ...(manifest.camera === undefined ? {} : { camera: manifest.camera }),
    ...(manifest.render === undefined ? {} : { look: manifest.render }),
    ...(manifest.tiers === undefined ? {} : { tiers: manifest.tiers }),
    ...(manifest.faunaTuning === undefined ? {} : { faunaTuning: manifest.faunaTuning }),
    trees: manifest.trees,
    ...(manifest.forest === undefined ? {} : { forest: manifest.forest }),
    ...(manifest.horizon === undefined ? {} : { horizon: manifest.horizon }),
    ...(manifest.hud === undefined ? {} : { hud: manifest.hud }),
    ...(manifest.pois === undefined ? {} : { pois: manifest.pois }),
    ...(manifest.groundColor === undefined ? {} : { groundColor: manifest.groundColor }),
    ...(manifest.surfaceAt === undefined ? {} : { surfaceAt: manifest.surfaceAt }),
    ...(manifest.assets === undefined ? {} : { assets: manifest.assets }),
    ...(manifest.explore === undefined ? {} : { explore: manifest.explore }),
    ...(manifest.roster === undefined ? {} : { roster: manifest.roster }),
  };
}
