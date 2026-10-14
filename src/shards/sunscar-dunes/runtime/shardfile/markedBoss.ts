import { Color, Mesh, SphereGeometry, type Scene, type Vector3 } from 'three';
import { weatherFog, type WeatherFog } from '@wildshard/engine/world/Atmosphere';
import type { ShardContext } from "@wildshard/game/plugin/context";
import type { MarkedBossPresentation } from '@wildshard/format/bossProfiles';
import { prepareClientWorld } from '@wildshard/game/shardfile/runtimeProduct';
import source from '../source';

/** The storm shells' look.materials ids, outer first (data/stormLook.ts STORM_GRAPHS, the presentation row's `shells`). */
const SHELL_LOOKS = ['storm-far', 'storm-near'] as const;

/**
 * The marked fight's sand storm (the presentation row's `storm`): the weather fog and the blown-sand shells round the
 * player, eased with the storm's strength. Made over the play scene by the platform's `RowBossView`. The shells draw in
 * their look's material graphs (G397, switched on for Signal, G387), whose alpha rides the strength as the host field
 * `shared.storm`; they join the scene once compiled. A host with no world stage (the contract test's) has no shells, and
 * one with no atmosphere no weather fog: the storm's strength still moves.
 */
export function stormWeather(ctx: ShardContext, player: Vector3, storm: MarkedBossPresentation['storm']): (scene: Scene) => (dt: number, strength: number) => void {
  return (scene) => {
    // The storm's fog (E390): made on the first update, once the level's atmosphere is installed. The level's own fog is
    // never written (a copy of it taken here was the engine's placeholder and erased the aerial layers).
    let strength = 0, tick: ((dt: number) => void) | null = null, fog: WeatherFog | null = null, fogTried = false;
    const shells: Mesh[] = [];
    if (ctx.game.runtime?.world) void (async () => {
      const looks = await prepareClientWorld(ctx, source, { materials: SHELL_LOOKS, requiredMaterials: SHELL_LOOKS }); if (ctx.scope.disposed) return;
      looks.graphs.bind({ state: (part, name) => (part === 'shared' && name === 'storm' ? strength : undefined) });
      storm.shells.forEach(([r], i) => {
        const shell = new Mesh(ctx.scope.own(new SphereGeometry(r, 24, 12)), looks.material(SHELL_LOOKS[i] ?? ''));
        shell.renderOrder = 10; shell.frustumCulled = false; shell.visible = false; scene.add(shell); shells.push(shell);
        ctx.scope.onDispose(() => { shell.removeFromParent(); });
      });
      tick = looks.tick;
    })().catch((e: unknown) => { console.error('[sunscar-dunes] the storm shells did not compile; the storm blows without them:', e); });
    return (dt, next) => {
      if (!fogTried) { fogTried = true; try { fog = weatherFog(ctx.scope, { dist: storm.dist, color: new Color(storm.color) }); } catch { fog = null; } }
      fog?.set(next * next * (3 - 2 * next)); // eased in and out
      strength = next; tick?.(dt);
      shells.forEach((shell) => { shell.visible = next > 0.01; shell.position.set(player.x, player.y + 1.6, player.z); });
    };
  };
}
