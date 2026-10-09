import { BossBrain, type BossSaved } from '@wildshard/engine/ai/BossBrain';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { BossBar } from '@wildshard/engine/ui/BossBar';
import { weatherFog, type WeatherFog } from '@wildshard/engine/world/Atmosphere';
import { CoinBurst } from '@wildshard/game/loot/CoinBurst';
import { bossesSave, shardSave } from '@wildshard/game/saves';
import type { ShardContext } from '@wildshard/game/shard/context';
import { bindRuntimeBoss, bindRuntimeCoins, type RuntimeBoss, type RuntimeCoins } from '@wildshard/game/shardfile/hybridRows';
import { Color, Mesh, Scene, SphereGeometry, Vector3 } from 'three';
import { BASIN } from '../layout';
import { STRINGS } from '../strings';
import { BASIN_FLOOR } from '../world/dunes';
import { stormMaterial } from '../world/stormFx';
import { lastLightAll } from '../look/light';
import { MATRIARCH_DEFEATED_FLAG, MATRIARCH_PAID_FLAG } from '../quests/signal';
import source from '../shard.config';
import { MATRIARCH_ID, MATRIARCH_REWARD, matriarchDefinition, matriarchFight, matriarchFlagRecord } from './matriarchFight';
import type { SignalWorld } from '../world/build';

type Flags = SignalWorld['flags'];

/**
 * Her record (SF50-p: no save of her own): beaten and paid are the shard's flags. A current save's old `bossesSave` entry
 * is read once and carried over (C26), never written again.
 */
export function matriarchRecord(ctx: Pick<ShardContext, 'manifest'>, flags: Flags): { saved: BossSaved; persist: (value: BossSaved) => void } {
  const legacy = shardSave(bossesSave, ctx.manifest.slug).read()[MATRIARCH_ID];
  if (legacy?.defeated === true) flags.set(MATRIARCH_DEFEATED_FLAG);
  if (legacy?.rewardTaken === true) flags.set(MATRIARCH_PAID_FLAG);
  return matriarchFlagRecord(flags);
}
/**
 * The sand storm of phase II, over `STORM_FADE` seconds: a weather fog (E390, `weatherFog`) of `dist` per metre closes in
 * in a dusty orange (at 0.03 about 40 % of her survives 30 m, so her silhouette reads inside it, R1B-17; the far dunes
 * are gone by 100 m), and two shells of blown sand (`shells`: radius metres, opacity) ride with the player and veil the distance.
 */
export const STORM = { dist: 0.03, color: new Color(0x8a5238), shells: [[46, 0.85], [22, 0.4]] } as const;

/**
 * The Dune Matriarch (C5): a huge ray that rises from the basin when the signal fire is lit. Phase I sweeping dives,
 * phase II a sand storm (the fog closes in, she dives from higher and more often), phase III grounded: she crawls on
 * the basin floor, sweeps her tail and buffets, and the whip reaches her. The engine's `BossBrain` owns the intro,
 * the thresholds, checkpoints and retry, and the victory; the renderer-free script (combat/matriarchFight.ts) owns her
 * body and the storm's goal; this class adds the storm's fog and sand shells, the boss bar and the coin burst.
 */
export class DuneMatriarch extends BossBrain {
  readonly at: Vector3;
  /** The storm's strength 0..1 and the Matriarch's body while she is up (captures and tests read them). */
  readonly weather: { storm: number };
  readonly body: () => Animal | null;
  constructor(ctx: ShardContext, player: Vector3, body: RuntimeBoss, record: ReturnType<typeof matriarchRecord>, coins: RuntimeCoins, onDown?: () => void) {
    const at = new Vector3(body.row.at[0], BASIN_FLOOR, body.row.at[1]);
    let stormT = 0;
    const scene = ctx.game.runtime?.world?.game.scene ?? new Scene(), burst = new CoinBurst(scene);
    // The storm's fog (E390): made on the first update, once the level's atmosphere is installed. The level's own fog is
    // never written (loop 4: a copy of it taken here was the engine's placeholder and erased the aerial layers).
    let fog: WeatherFog | null = null, fogTried = false;
    const saved = record.saved;
    // The blown-sand sheets (P2 #11, world/stormFx.ts): streaks racing downwind over a dusty veil, pulsing in gusts.
    const shells = STORM.shells.map(([r], i) => {
      const shell = new Mesh(new SphereGeometry(r, 24, 12), stormMaterial(STORM.color, i === 1));
      shell.renderOrder = 10; shell.frustumCulled = false; shell.visible = false; scene.add(shell);
      ctx.scope.own(shell.geometry); ctx.scope.own(shell.material); ctx.scope.onDispose(() => { shell.removeFromParent(); });
      return shell;
    });
    const fight = matriarchFight<Animal>({ body: { spawn: (previous) => body.spawn(previous), retire: (a) => { body.retire(a); } }, rewardPoint: at,
      respawnPoint: () => ({ pos: new Vector3(BASIN.x, ctx.manifest.ground.terrain?.heightAt(BASIN.x, BASIN.z + BASIN.r + 4) ?? 0, BASIN.z + BASIN.r + 4), yaw: 0 }),
      victory: () => { ctx.game.runtime?.play?.hud.toast(saved.rewardTaken ? STRINGS.bossRewardAgain : STRINGS.bossReward); onDown?.(); },
      update: (dt, storm) => {
        if (fog === null && !fogTried) {
          fogTried = true; // a host with no atmosphere (the contract test's) has no weather fog: the shells still blow
          try { fog = weatherFog(ctx.scope, { dist: STORM.dist, color: STORM.color }); } catch { fog = null; }
        }
        fog?.set(storm * storm * (3 - 2 * storm)); // eased in and out
        stormT += dt;
        shells.forEach((shell, i) => {
          shell.visible = storm > 0.01; shell.position.set(player.x, player.y + 1.6, player.z);
          const u = shell.material.uniforms, opacity = u['uOpacity'], time = u['uTime'];
          if (opacity) opacity.value = storm * (STORM.shells[i]?.[1] ?? 0);
          if (time) time.value = stormT;
        });
        burst.update(dt, player);
      } });
    const presentation = new BossBar(); ctx.scope.onDispose(() => { presentation.scope.dispose(); });
    ctx.answer('damage.modify', (request) => { const animal = fight.body(); return request !== null && animal !== null && request.target === animal.combatActor() && fight.invulnerable() ? null : request; });
    super(matriarchDefinition(), fight.script,
      { events: ctx.app.events, player: { position: player }, lockInput: (on) => { ctx.game.runtime?.play?.weapons.setEnabled(!on); },
        respawn: (pos, yaw) => { const motor = ctx.game.runtime?.world?.player; if (motor) { motor.position.copy(pos); motor.yaw = yaw; } }, skipHeld: () => ctx.app.input.held('skip'),
        faceToward: (target) => { const motor = ctx.game.runtime?.world?.player; if (motor) motor.yaw = Math.atan2(motor.position.x - target.x, motor.position.z - target.z); },
        spawnReward: () => { saved.rewardTaken = true; record.persist(saved); burst.spawn(player, MATRIARCH_REWARD, coins, () => undefined); },
        toast: (text) => { ctx.game.runtime?.play?.hud.toast(text); },
        persist: record.persist }, presentation, saved);
    this.at = at; this.weather = fight.weather; this.body = fight.body;
    if (saved.defeated) onDown?.();
    ctx.scope.onDispose(() => {
      burst.update(3, player); burst.dispose(); const animal = fight.body(); if (animal) body.retire(animal); fight.adopt(null);
    });
  }
}

/**
 * Arms the Matriarch once the signal fire is lit (now, or on a later visit); answers the death checkpoint. Her body is the
 * shardfile's declared boss row (`runtime.spawns`, bound by the platform under `sunscar.matriarch`); her coins go through
 * the platform purse (`coins`, else the shard's platform purse headless).
 */
export function installMatriarch(ctx: ShardContext, player: Vector3, flags: Flags, lit: () => boolean, coins?: RuntimeCoins, onDown?: () => void): { boss: DuneMatriarch; summon: () => void } {
  const body = bindRuntimeBoss(ctx, source, MATRIARCH_ID, (a) => { lastLightAll(a.mesh, ctx.scope); });
  const boss = ctx.app.encounters.boss(MATRIARCH_ID, new DuneMatriarch(ctx, player, body, matriarchRecord(ctx, flags), coins ?? bindRuntimeCoins(ctx, null), onDown), ctx.scope);
  const summon = (): void => { if (boss.state === 'dormant') { boss.arm(); ctx.game.runtime?.play?.hud.toast(STRINGS.summoned); } };
  if (lit()) boss.arm();
  ctx.answer('death.checkpoint', (value) => boss.onPlayerDeath() || value === true);
  ctx.system({ id: 'sunscar.matriarch', phase: 'update', run: (dt, t) => { boss.update(dt, t); } });
  return { boss, summon };
}
