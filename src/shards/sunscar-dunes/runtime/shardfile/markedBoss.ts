import { Color, Mesh, Scene, SphereGeometry, Vector3 } from 'three';
import type { BossDefinition, BossSaved } from '@wildshard/engine/ai/BossBrain';
import { BossView, installBossView } from '@wildshard/game/plugin/ui';
import stages from '../../data/bossStages.json' with { type: 'json' };
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { weatherFog, type WeatherFog } from '@wildshard/engine/world/Atmosphere';
import { CoinBurst } from '@wildshard/game/loot/CoinBurst';
import { bossesSave, shardSave } from '@wildshard/game/saves';
import type { ShardContext } from "@wildshard/game/plugin/context";
import type { RuntimeBoss, RuntimeCoins } from "@wildshard/game/plugin/headless";
import { bossFlagRecord, type BossRowFlagNames, type BossRowFlags } from '@wildshard/game/shardfile/bossRow';
import { bossFight, type BossFightProfile } from '@wildshard/game/plugin/bossPhase';
import { parseBossProfile, type MarkedBossPresentation } from '@wildshard/format/bossProfiles';
import { stormShellMaterial } from '../looks/stormShell';

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

/** The rows a marked boss is built from: its encounter definition, its view-free fight, its presentation and its coins. */
export interface MarkedBossRows {
  readonly definition: BossDefinition;
  readonly profile: Extract<BossFightProfile, {pattern: 'spawned'}>;
  readonly presentation: MarkedBossPresentation;
  readonly reward: number;
}

/**
 * A marked boss fight in the browser (SF27): the engine's `BossBrain` runs the intro, thresholds, checkpoints, retry and
 * victory over the view-free marked fight (`markedBossFight`: the body per checkpoint, the storm's goal, the
 * invulnerability); this adds the presentation row's views — the storm's weather fog and sand shells, the boss bar and
 * the reward's coin burst — and its toasts, and refuses hits while the fight is invulnerable.
 */
export class MarkedBoss extends BossView {
  /** The arena's reward point (the declared body's spot on the floor). */
  readonly at: Vector3;
  /** The storm's strength 0..1 (captures and tests read it). */
  readonly weather: { storm: number };
  /** The boss's body while it is up. */
  readonly body: () => Animal | null;
  constructor(ctx: ShardContext, player: Vector3, body: RuntimeBoss, rows: MarkedBossRows, record: { saved: BossSaved; persist: (value: BossSaved) => void }, coins: RuntimeCoins, onDown?: () => void) {
    const profile = parseBossProfile(rows.profile);
    if (profile.pattern !== 'spawned') throw new Error('The Matriarch requires its declared spawned-body pattern');
    const look = rows.presentation, storm = look.storm, color = new Color(storm.color);
    const at = new Vector3(body.row.at[0], look.floor, body.row.at[1]);
    let stormT = 0;
    const scene = ctx.game.runtime?.world?.game.scene ?? new Scene(), burst = new CoinBurst(scene);
    // The storm's fog (E390): made on the first update, once the level's atmosphere is installed. The level's own fog is
    // never written (a copy of it taken here was the engine's placeholder and erased the aerial layers).
    let fog: WeatherFog | null = null, fogTried = false;
    const saved = record.saved;
    const shells = storm.shells.map(([r], i) => {
      const shell = new Mesh(new SphereGeometry(r, 24, 12), stormShellMaterial(color, i === 1, storm.wind));
      shell.renderOrder = 10; shell.frustumCulled = false; shell.visible = false; scene.add(shell);
      ctx.scope.own(shell.geometry); ctx.scope.own(shell.material); ctx.scope.onDispose(() => { shell.removeFromParent(); });
      return shell;
    });
    const fight = bossFight<Animal>(profile, { body: { spawn: (previous) => body.spawn(previous), retire: (a) => { body.retire(a); } }, rewardPoint: at,
      respawnPoint: () => ({ pos: new Vector3(look.respawn.x, ctx.manifest.ground.terrain?.heightAt(look.respawn.x, look.respawn.z) ?? 0, look.respawn.z), yaw: look.respawn.yaw }),
      victory: () => { ctx.game.runtime?.play?.hud.toast(saved.rewardTaken ? look.toasts.rewardAgain : look.toasts.reward); onDown?.(); },
      update: (dt, strength) => {
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
        burst.update(dt, player);
      } });
    super(ctx, { definition: rows.definition, stages, script: fight.script, player, body: fight.body, shielded: fight.invulnerable, saved, persist: record.persist, toast: true,
      spawnReward: () => { saved.rewardTaken = true; record.persist(saved); burst.spawn(player, rows.reward, coins, () => undefined); } });
    this.at = at; this.weather = fight.weather; this.body = fight.body;
    if (saved.defeated) onDown?.();
    ctx.scope.onDispose(() => {
      burst.update(3, player); burst.dispose(); const animal = fight.body(); if (animal) body.retire(animal); fight.adopt(null);
    });
  }
}

/** What `installMarkedBoss` is lent: the player, the bound body, the record, the purse, whether it is already summoned, and the victory's beat. */
export interface MarkedBossPorts {
  readonly player: Vector3;
  readonly body: RuntimeBoss;
  readonly record: { saved: BossSaved; persist: (value: BossSaved) => void };
  readonly coins: RuntimeCoins;
  /** Already summoned (a save past the summons): armed at install. */
  readonly lit: () => boolean;
  readonly onDown?: () => void;
}
/**
 * Installs a marked boss in a level from its rows: a `MarkedBoss` registered under its definition's id with the
 * encounters, armed now when `lit` holds (else by `summon`, which toasts the summons once), answering the death
 * checkpoint, updated each frame.
 */
export function installMarkedBoss(ctx: ShardContext, rows: MarkedBossRows, ports: MarkedBossPorts): { boss: MarkedBoss; summon: () => void } {
  return installBossView(ctx, rows.definition.id, new MarkedBoss(ctx, ports.player, ports.body, rows, ports.record, ports.coins, ports.onDown), ports.lit(),
    () => { ctx.game.runtime?.play?.hud.toast(rows.presentation.toasts.summoned); });
}
