import type { EngineMechanism, LevelSpec } from '@wildshard/engine/level/spec';
import { bakedMapUrl, type ShardManifest } from './manifest';
import { legacyContentIdentity } from './list';

const ENGINE_MECHANISMS: ReadonlySet<string> = new Set(['weather', 'dayCycle', 'bosses', 'elites', 'spawns', 'quests', 'swim', 'hover', 'explore', 'practice']);
const engineMechanism = (value: string): value is EngineMechanism => ENGINE_MECHANISMS.has(value);

/** Node-safe boundary. Only authored engine policy crosses it, never title or game metadata. */
export function toLevelSpec(manifest: ShardManifest): LevelSpec {
  const bakedId = manifest.legacy === true ? legacyContentIdentity(manifest.slug) : undefined;
  const { style: creatureStyle, dev } = manifest; // opaque authored metadata, copied without a rendering decision
  return {
    id: manifest.slug,
    ...(bakedId === undefined ? {} : { bakedId }),
    seed: manifest.seed, treeCount: manifest.treeCount, label: manifest.label,
    ...(dev === undefined ? {} : { capturePoses: async () => Object.fromEntries(Object.entries(await dev.poses()).map(([name, pose]) => [name, { eye: pose.eye, yaw: pose.yaw, pitch: pose.pitch, ...(pose.feet === undefined ? {} : { feet: pose.feet }), ...(pose.probe === undefined ? {} : { probe: pose.probe }) }])) }),
    ...(manifest.horizonStrips === undefined ? {} : { horizonStrips: manifest.horizonStrips }),
    creatureStyle,
    ...(manifest.world === undefined ? {} : { world: manifest.world }),
    ...(manifest.navmesh === undefined ? {} : { navmesh: manifest.navmesh }),
    ...(manifest.creatures === undefined ? {} : { creatures: manifest.creatures }),
    ...(manifest.debugOptions === undefined ? {} : { debugOptions: manifest.debugOptions }),
    ...(manifest.blender === undefined ? {} : { blender: manifest.blender }),
    ground: { ...(manifest.ground.paths === undefined ? {} : { paths: manifest.ground.paths }), ...(manifest.ground.terrain === undefined ? {} : { terrain: manifest.ground.terrain }),
      ...(manifest.ground.structures === undefined ? {} : { structures: true }), ...(manifest.ground.water === undefined ? {} : { water: manifest.ground.water }) },
    spawn: manifest.spawn,
    sky: manifest.sky, atmosphere: manifest.atmosphere, grade: manifest.grade,
    budgets: manifest.budgets ?? {}, fight: manifest.fight ?? {},
    mechanisms: (manifest.uses ?? []).filter(engineMechanism),
    boot: manifest.boot ?? { files: () => typeof manifest.ground.structures === 'object' ? manifest.ground.structures.files : [] },
    audio: manifest.audio ?? { ambience: 'legacy', score: 'legacy' },
    loadout: manifest.loadout ?? { weapons: [], tools: [], start: [] },
    species: manifest.species ?? [], spawns: manifest.spawns,
    minimap: ((map) => {
      const { image: path, ...look } = map ?? {}, image = bakedMapUrl(path);
      return image === undefined ? look : { ...look, image };
    })(manifest.minimap),
    kitLook: manifest.kitLook ?? 'pbr',
    ...(manifest.hands === undefined ? {} : { hands: manifest.hands }),
    ...(manifest.bounds === undefined ? {} : { bounds: manifest.bounds }),
    ...(manifest.camera === undefined ? {} : { camera: manifest.camera }),
    ...(manifest.render === undefined ? {} : { look: manifest.render }),
    ...(manifest.look === undefined ? {} : { lookLayer: manifest.look }),
    ...(manifest.tiers === undefined ? {} : { tiers: manifest.tiers }),
    ...(manifest.faunaTuning === undefined ? {} : { faunaTuning: manifest.faunaTuning }),
    trees: manifest.trees,
    ...(manifest.forest === undefined ? {} : { forest: manifest.forest }),
    ...(manifest.horizon === undefined ? {} : { horizon: manifest.horizon }),
    ...(manifest.boundary === undefined ? {} : { boundary: manifest.boundary }),
    ...(manifest.hud === undefined ? {} : { hud: manifest.hud }),
    ...(manifest.pois === undefined ? {} : { pois: manifest.pois }),
    ...(manifest.groundColor === undefined ? {} : { groundColor: manifest.groundColor }),
    ...(manifest.surfaceAt === undefined ? {} : { surfaceAt: manifest.surfaceAt }),
    ...(manifest.assets === undefined ? {} : { assets: manifest.assets }),
    ...(manifest.explore === undefined ? {} : { explore: manifest.explore }),
    ...(manifest.roster === undefined ? {} : { roster: manifest.roster }),
  };
}
