import { BossBar, BossBrain, type Animal, type BossScript } from '#engine';
import { CoinBurst, bossesSave, purseSave, shardSave, type ShardContext } from '#game';
import { BackSide, Color, Fog, Mesh, MeshBasicMaterial, Scene, SphereGeometry, Vector3 } from 'three';
import { BASIN } from '../layout';
import { STRINGS } from '../strings';
import { BASIN_FLOOR } from '../world/dunes';

const ID = 'sunscar.matriarch';
/**
 * The sand storm of phase II, over `fade` seconds: the fog closes to `near`–`far` metres in a dusty orange, and two
 * shells of blown sand (`shells`: radius metres, opacity) ride with the player and veil the distance.
 */
export const STORM = { near: 8, far: 62, color: new Color(0x8a5238), fade: 2.5, shells: [[46, 0.72], [22, 0.3]] } as const;
/** The reward: coins once, on the first fall. */
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
  constructor(ctx: ShardContext, player: Vector3, spawn: () => Animal | null, retire: (a: Animal) => void, onCoin?: (share: number) => void) {
    const at = new Vector3(BASIN.x, BASIN_FLOOR, BASIN.z), focus = new Vector3();
    let animal: Animal | null = null, invulnerable = false, stormGoal = 0;
    const weather = { storm: 0 };
    const scene = ctx.game.runtime?.world?.game.scene ?? new Scene(), burst = new CoinBurst(scene), purse = shardSave(purseSave, ctx.manifest.slug);
    const fog = scene.fog instanceof Fog ? { near: scene.fog.near, far: scene.fog.far, color: scene.fog.color.clone() } : null;
    const saves = shardSave(bossesSave, ctx.manifest.slug), saved = saves.read()[ID] ?? { defeated: false, rewardTaken: false, kills: 0 };
    const shells = STORM.shells.map(([r]) => {
      const shell = new Mesh(new SphereGeometry(r, 24, 12), new MeshBasicMaterial({ color: STORM.color, transparent: true, opacity: 0, side: BackSide, depthWrite: false, fog: false }));
      shell.renderOrder = 10; shell.frustumCulled = false; shell.visible = false; scene.add(shell);
      ctx.scope.own(shell.geometry); ctx.scope.own(shell.material); ctx.scope.onDispose(() => { shell.removeFromParent(); });
      return shell;
    });
    const fresh = (): Animal | null => { if (animal) retire(animal); animal = spawn(); if (animal) { animal.mem['fight'] = 0; animal.mem['rise'] = 0; animal.mem['phase'] = 0; } return animal; };
    const script: BossScript = {
      inArena: (p) => Math.hypot(p.x - BASIN.x, p.z - BASIN.z) < BASIN.r - 6,
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
        if (fog && scene.fog instanceof Fog) {
          scene.fog.near = fog.near + (STORM.near - fog.near) * weather.storm; scene.fog.far = fog.far + (STORM.far - fog.far) * weather.storm;
          scene.fog.color.copy(fog.color).lerp(STORM.color, weather.storm);
        }
        shells.forEach((shell, i) => {
          shell.visible = weather.storm > 0.01; shell.position.set(player.x, player.y + 1.6, player.z);
          shell.material.opacity = weather.storm * (STORM.shells[i]?.[1] ?? 0);
        });
        burst.update(dt, player);
      },
      get hpFrac() { return animal ? Math.max(0, animal.hp / animal.maxHp) : 0; },
      get shielded() { return invulnerable; },
      get dead() { return animal !== null && !animal.alive; },
      clampHp: (frac) => { if (animal) animal.hp = frac * animal.maxHp; },
      setInvulnerable: (on) => { invulnerable = on; },
      victory: () => { stormGoal = 0; ctx.game.runtime?.play?.hud.toast(saved.rewardTaken ? STRINGS.bossRewardAgain : STRINGS.bossReward); },
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
        spawnReward: () => { burst.spawn(player, MATRIARCH_REWARD, onCoin ?? ((share) => { purse.write(purse.read() + share); }), () => undefined); },
        toast: (text) => { ctx.game.runtime?.play?.hud.toast(text); },
        persist: (value) => { saves.write({ ...saves.read(), [ID]: { ...value } }); } }, presentation, saved);
    this.at = at; this.weather = weather; this.body = () => animal;
    ctx.scope.onDispose(() => {
      burst.update(3, player); burst.dispose(); if (animal) retire(animal); animal = null;
      if (fog && scene.fog instanceof Fog) { scene.fog.near = fog.near; scene.fog.far = fog.far; scene.fog.color.copy(fog.color); }
    });
  }
}

/** Arms the Matriarch once the signal fire is lit (now, or on a later visit); answers the death checkpoint. */
export function installMatriarch(ctx: ShardContext, player: Vector3, lit: () => boolean, onCoin?: (share: number) => void): { boss: DuneMatriarch; summon: () => void } {
  const animals = ctx.game.runtime?.play?.animals;
  const boss = ctx.app.encounters.boss(ID, new DuneMatriarch(ctx, player, () => animals?.spawn('duneMatriarch', BASIN.x, BASIN.z, 0, 'matriarch') ?? null,
    (a) => { animals?.retire(a); }, onCoin), ctx.scope);
  const summon = (): void => { if (boss.state === 'dormant') { boss.arm(); ctx.game.runtime?.play?.hud.toast(STRINGS.summoned); } };
  if (lit()) boss.arm();
  ctx.answer('death.checkpoint', (value) => boss.onPlayerDeath() || value === true);
  ctx.system({ id: 'sunscar.matriarch', phase: 'update', run: (dt, t) => { boss.update(dt, t); } });
  return { boss, summon };
}
