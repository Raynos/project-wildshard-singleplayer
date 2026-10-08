import { BossBrain, type BossSaved, type BossScript } from '@wildshard/engine/ai/BossBrain';
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
import type { SignalWorld } from '../world/build';

type Flags = SignalWorld['flags'];

const ID = 'sunscar.matriarch';
/**
 * Her record (SF50-p: no save of her own): beaten and paid are the shard's flags. A current save's old `bossesSave` entry
 * is read once and carried over (C26), never written again.
 */
export function matriarchRecord(ctx: Pick<ShardContext, 'manifest'>, flags: Flags): { saved: BossSaved; persist: (value: BossSaved) => void } {
  const legacy = shardSave(bossesSave, ctx.manifest.slug).read()[ID];
  if (legacy?.defeated === true) flags.set(MATRIARCH_DEFEATED_FLAG);
  if (legacy?.rewardTaken === true) flags.set(MATRIARCH_PAID_FLAG);
  const defeated = flags.has(MATRIARCH_DEFEATED_FLAG);
  return { saved: { defeated, rewardTaken: flags.has(MATRIARCH_PAID_FLAG), kills: defeated ? 1 : 0 },
    persist: (value) => { if (value.defeated) flags.set(MATRIARCH_DEFEATED_FLAG); if (value.rewardTaken) flags.set(MATRIARCH_PAID_FLAG); } };
}
/**
 * The sand storm of phase II, over `fade` seconds: a weather fog (E390, `weatherFog`) of `dist` per metre closes in in a
 * dusty orange (at 0.03 about 40 % of her survives 30 m, so her silhouette reads inside it, R1B-17; the far dunes are
 * gone by 100 m), and two shells of blown sand (`shells`: radius metres, opacity) ride with the player and veil the distance.
 */
export const STORM = { dist: 0.03, color: new Color(0x8a5238), fade: 2.5, shells: [[46, 0.85], [22, 0.4]] } as const;
/** The reward: coins once, on the first fall (her paid flag). */
export const MATRIARCH_REWARD = 20;
const RISE = 3.2;

/**
 * The Dune Matriarch (C5): a huge ray that rises from the basin when the signal fire is lit. Phase I sweeping dives,
 * phase II a sand storm (the fog closes in, she dives from higher and more often), phase III grounded: she crawls on
 * the basin floor, sweeps her tail and buffets, and the whip reaches her. The engine's `BossBrain` owns the intro,
 * the thresholds, checkpoints and retry, and the victory; this script owns her body and the storm.
 */
export class DuneMatriarch extends BossBrain {
  readonly at: Vector3;
  /** The storm's strength 0..1 and the Matriarch's body while she is up (captures and tests read them). */
  readonly weather: { storm: number };
  readonly body: () => Animal | null;
  constructor(ctx: ShardContext, player: Vector3, body: RuntimeBoss, record: ReturnType<typeof matriarchRecord>, coins: RuntimeCoins, onDown?: () => void) {
    const at = new Vector3(body.row.at[0], BASIN_FLOOR, body.row.at[1]), focus = new Vector3(), { spawn, retire } = body;
    let animal: Animal | null = null, invulnerable = false, stormGoal = 0;
    const weather = { storm: 0 };
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
    const fresh = (): Animal | null => { const previous = animal; if (previous) retire(previous); animal = spawn(previous ?? undefined); if (animal) { animal.mem['fight'] = 0; animal.mem['rise'] = 0; animal.mem['phase'] = 0; } return animal; };
    const script: BossScript = {
      // The fire's light is the summons (review R7): she rises while the player is anywhere from the bowl to the tower
      // deck (78 m from its centre), so the lighting player sees it.
      inArena: (p) => Math.hypot(p.x - BASIN.x, p.z - BASIN.z) < BASIN.r + 34,
      reset: (checkpoint) => {
        stormGoal = 0; const a = fresh();
        if (a) { a.hp = a.maxHp * (checkpoint === 0 ? 1 : checkpoint === 1 ? 0.66 : 0.33); a.mem['phase'] = checkpoint; }
      },
      seal: () => undefined,
      intro: (t) => { if (animal) { animal.mem['rise'] = Math.min(1, t / RISE); focus.copy(animal.position); return focus; } return at; },
      begin: (next) => { if (animal) { animal.mem['rise'] = 1; animal.mem['fight'] = 1; animal.mem['phase'] = next; } stormGoal = next === 1 ? 1 : 0; },
      enterPhase: (next) => { if (animal) animal.mem['phase'] = next; stormGoal = next === 1 ? 1 : 0; },
      update: (dt) => {
        weather.storm += Math.sign(stormGoal - weather.storm) * Math.min(Math.abs(stormGoal - weather.storm), dt / STORM.fade);
        if (fog === null && !fogTried) {
          fogTried = true; // a host with no atmosphere (the contract test's) has no weather fog: the shells still blow
          try { fog = weatherFog(ctx.scope, { dist: STORM.dist, color: STORM.color }); } catch { fog = null; }
        }
        fog?.set(weather.storm * weather.storm * (3 - 2 * weather.storm)); // eased in and out
        stormT += dt;
        shells.forEach((shell, i) => {
          shell.visible = weather.storm > 0.01; shell.position.set(player.x, player.y + 1.6, player.z);
          const u = shell.material.uniforms, opacity = u['uOpacity'], time = u['uTime'];
          if (opacity) opacity.value = weather.storm * (STORM.shells[i]?.[1] ?? 0);
          if (time) time.value = stormT;
        });
        burst.update(dt, player);
      },
      get hpFrac() { return animal ? Math.max(0, animal.hp / animal.maxHp) : 0; },
      get shielded() { return invulnerable; },
      get dead() { return animal !== null && !animal.alive; },
      clampHp: (frac) => { if (animal) animal.hp = frac * animal.maxHp; },
      setInvulnerable: (on) => { invulnerable = on; },
      victory: () => { stormGoal = 0; ctx.game.runtime?.play?.hud.toast(saved.rewardTaken ? STRINGS.bossRewardAgain : STRINGS.bossReward); onDown?.(); },
      rewardPoint: () => at,
      respawnPoint: () => ({ pos: new Vector3(BASIN.x, ctx.manifest.ground.terrain?.heightAt(BASIN.x, BASIN.z + BASIN.r + 4) ?? 0, BASIN.z + BASIN.r + 4), yaw: 0 }),
    };
    const presentation = new BossBar(); ctx.scope.onDispose(() => { presentation.scope.dispose(); });
    ctx.answer('damage.modify', (request) => request !== null && animal !== null && request.target === animal.combatActor() && invulnerable ? null : request);
    super({ id: ID, name: STRINGS.matriarch, title: STRINGS.matriarchTitle, retryTitle: STRINGS.retry, intro: RISE + 0.6, introShort: 1.2,
      phases: [{ at: 1, caption: STRINGS.phaseDives, name: STRINGS.phaseDives }, { at: 0.66, caption: STRINGS.phaseStorm, name: STRINGS.phaseStorm },
        { at: 0.33, caption: STRINGS.phaseGrounded, name: STRINGS.phaseGrounded }], reward: {} }, script,
      { events: ctx.app.events, player: { position: player }, lockInput: (on) => { ctx.game.runtime?.play?.weapons.setEnabled(!on); },
        respawn: (pos, yaw) => { const motor = ctx.game.runtime?.world?.player; if (motor) { motor.position.copy(pos); motor.yaw = yaw; } }, skipHeld: () => ctx.app.input.held('skip'),
        faceToward: (target) => { const motor = ctx.game.runtime?.world?.player; if (motor) motor.yaw = Math.atan2(motor.position.x - target.x, motor.position.z - target.z); },
        spawnReward: () => { saved.rewardTaken = true; record.persist(saved); burst.spawn(player, MATRIARCH_REWARD, coins, () => undefined); },
        toast: (text) => { ctx.game.runtime?.play?.hud.toast(text); },
        persist: record.persist }, presentation, saved);
    this.at = at; this.weather = weather; this.body = () => animal;
    if (saved.defeated) onDown?.();
    ctx.scope.onDispose(() => {
      burst.update(3, player); burst.dispose(); if (animal) retire(animal); animal = null;
    });
  }
}

/**
 * Arms the Matriarch once the signal fire is lit (now, or on a later visit); answers the death checkpoint. Her body is the
 * shardfile's declared boss row (`runtime.spawns`, bound by the platform under `sunscar.matriarch`); her coins go through
 * the platform purse (`coins`, else the shard's platform purse headless).
 */
export function installMatriarch(ctx: ShardContext, player: Vector3, flags: Flags, lit: () => boolean, coins?: RuntimeCoins, onDown?: () => void): { boss: DuneMatriarch; summon: () => void } {
  const body = bindRuntimeBoss(ctx, source, ID, (a) => { lastLightAll(a.mesh, ctx.scope); });
  const boss = ctx.app.encounters.boss(ID, new DuneMatriarch(ctx, player, body, matriarchRecord(ctx, flags), coins ?? bindRuntimeCoins(ctx, null), onDown), ctx.scope);
  const summon = (): void => { if (boss.state === 'dormant') { boss.arm(); ctx.game.runtime?.play?.hud.toast(STRINGS.summoned); } };
  if (lit()) boss.arm();
  ctx.answer('death.checkpoint', (value) => boss.onPlayerDeath() || value === true);
  ctx.system({ id: 'sunscar.matriarch', phase: 'update', run: (dt, t) => { boss.update(dt, t); } });
  return { boss, summon };
}
