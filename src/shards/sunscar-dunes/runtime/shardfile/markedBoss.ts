import { Color, Mesh, SphereGeometry, type Material, type Scene, type Vector3 } from 'three';
import type { BossSaved } from '@wildshard/engine/ai/BossBrain';
import type { RowBossView } from '@wildshard/game/plugin/ui';
import { weatherFog, type WeatherFog } from '@wildshard/engine/world/Atmosphere';
import { bossesSave, shardSave } from '@wildshard/game/saves';
import type { ShardContext } from "@wildshard/game/plugin/context";
import { bossFlagRecord, type BossRowFlagNames, type BossRowFlags } from '@wildshard/game/shardfile/bossRow';
import type { MarkedBossPresentation } from '@wildshard/format/bossProfiles';
import { ownLookMaterials } from '../looks/bakedGround';
import source from '../source';

/** The Matriarch's browser encounter: the platform's spawned-body boss view (`RowBossView`). */
export type MarkedBoss = RowBossView;

/**
 * A boss's record on the shard's flags (`bossFlagRecord`), first carrying over a current save's old `bossesSave` entry
 * under its id (read once, never written again).
 */
export function carriedBossRecord(ctx: Pick<ShardContext, 'manifest'>, flags: BossRowFlags, id: string, names: BossRowFlagNames): { saved: BossSaved; persist: (value: BossSaved) => void } {
  const legacy = shardSave(bossesSave, ctx.manifest.slug).read()[id];
  if (legacy?.defeated === true) flags.set(names.defeated);
  if (legacy?.rewardTaken === true) flags.set(names.paid);
  return bossFlagRecord(flags, names);
}

/** The storm shells' look.materials ids, outer first (data/stormLook.ts STORM_GRAPHS, the presentation row's `shells`). */
const SHELL_LOOKS = ['storm-far', 'storm-near'] as const;

/**
 * The marked fight's sand storm (the presentation row's `storm`): the weather fog and the blown-sand shells round the
 * player, eased with the storm's strength. Made over the play scene by the platform's `RowBossView`. The shells draw in
 * their look's material graphs (G397, switched on for Signal, G387), whose alpha rides the strength as the host field
 * `shared.storm`; they join the scene once compiled.
 */
export function stormWeather(ctx: ShardContext, player: Vector3, storm: MarkedBossPresentation['storm']): (scene: Scene) => (dt: number, strength: number) => void {
  return (scene) => {
    const color = new Color(storm.color);
    let strength = 0, tick: ((dt: number) => void) | null = null;
    // The storm's fog (E390): made on the first update, once the level's atmosphere is installed. The level's own fog is
    // never written (a copy of it taken here was the engine's placeholder and erased the aerial layers).
    let fog: WeatherFog | null = null, fogTried = false;
    const shells: Mesh[] = [];
    const wear = (materials: ReadonlyMap<string, Material>): void => {
      storm.shells.forEach(([r], i) => {
        const material = materials.get(SHELL_LOOKS[i] ?? ''); if (material === undefined) throw new Error(`Signal Dunes: no storm shell look ${String(i)}`);
        const shell = new Mesh(new SphereGeometry(r, 24, 12), material);
        shell.renderOrder = 10; shell.frustumCulled = false; shell.visible = false; scene.add(shell);
        ctx.scope.own(shell.geometry); ctx.scope.onDispose(() => { shell.removeFromParent(); });
        shells.push(shell);
      });
    };
    // a host with no world stage (the contract test's) has no shells: the storm's fog and strength still move
    if (ctx.game.runtime?.world) {
      void (async () => {
        const looks = await ownLookMaterials(ctx, source, SHELL_LOOKS); if (ctx.scope.disposed) return;
        looks.graphs.bind({ state: (part, name) => (part === 'shared' && name === 'storm' ? strength : undefined) });
        wear(looks.materials); tick = looks.tick;
      })().catch((e: unknown) => { console.error('[sunscar-dunes] the storm shells did not compile; the storm blows without them:', e); });
    }
    return (dt, next) => {
      if (fog === null && !fogTried) {
        fogTried = true; // a host with no atmosphere (the contract test's) has no weather fog: the shells still blow
        try { fog = weatherFog(ctx.scope, { dist: storm.dist, color }); } catch { fog = null; }
      }
      fog?.set(next * next * (3 - 2 * next)); // eased in and out
      strength = next; tick?.(dt);
      shells.forEach((shell) => { shell.visible = next > 0.01; shell.position.set(player.x, player.y + 1.6, player.z); });
    };
  };
}
