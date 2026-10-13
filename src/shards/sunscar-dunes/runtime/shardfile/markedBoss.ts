import { Color, Mesh, SphereGeometry, type Scene, type Vector3 } from 'three';
import type { BossSaved } from '@wildshard/engine/ai/BossBrain';
import type { RowBossView } from '@wildshard/game/plugin/ui';
import { weatherFog, type WeatherFog } from '@wildshard/engine/world/Atmosphere';
import { bossesSave, shardSave } from '@wildshard/game/saves';
import type { ShardContext } from "@wildshard/game/plugin/context";
import { bossFlagRecord, type BossRowFlagNames, type BossRowFlags } from '@wildshard/game/shardfile/bossRow';
import type { MarkedBossPresentation } from '@wildshard/format/bossProfiles';
import { stormShellMaterial } from '../looks/stormShell';

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

/**
 * The marked fight's sand storm (the presentation row's `storm`): the weather fog and the blown-sand shells round the
 * player, eased with the storm's strength. Made over the play scene by the platform's `RowBossView`.
 */
export function stormWeather(ctx: ShardContext, player: Vector3, storm: MarkedBossPresentation['storm']): (scene: Scene) => (dt: number, strength: number) => void {
  return (scene) => {
    const color = new Color(storm.color);
    let stormT = 0;
    // The storm's fog (E390): made on the first update, once the level's atmosphere is installed. The level's own fog is
    // never written (a copy of it taken here was the engine's placeholder and erased the aerial layers).
    let fog: WeatherFog | null = null, fogTried = false;
    const shells = storm.shells.map(([r], i) => {
      const shell = new Mesh(new SphereGeometry(r, 24, 12), stormShellMaterial(color, i === 1, storm.wind));
      shell.renderOrder = 10; shell.frustumCulled = false; shell.visible = false; scene.add(shell);
      ctx.scope.own(shell.geometry); ctx.scope.own(shell.material); ctx.scope.onDispose(() => { shell.removeFromParent(); });
      return shell;
    });
    return (dt, strength) => {
      if (fog === null && !fogTried) {
        fogTried = true; // a host with no atmosphere (the contract test's) has no weather fog: the shells still blow
        try { fog = weatherFog(ctx.scope, { dist: storm.dist, color }); } catch { fog = null; }
      }
      fog?.set(strength * strength * (3 - 2 * strength)); // eased in and out
      stormT += dt;
      shells.forEach((shell, i) => {
        shell.visible = strength > 0.01; shell.position.set(player.x, player.y + 1.6, player.z);
        const u = shell.material.uniforms, opacity = u['uOpacity'], time = u['uTime'];
        if (opacity) opacity.value = strength * (storm.shells[i]?.[1] ?? 0);
        if (time) time.value = stormT;
      });
    };
  };
}
