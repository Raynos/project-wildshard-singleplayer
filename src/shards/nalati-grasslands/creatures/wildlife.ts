import { bindEliteAdmission } from '../runtime/argymaqKeeper';
import { CrowdRoster } from '@wildshard/game/shardfile/crowdRuntime';
import ecology from '../data/ecology.generated.json' with { type: 'json' };
import { Rng } from '@wildshard/engine/core/rng';
import { PagePopulationPlanner, PopulationRelations, nearestPopulationActor } from '@wildshard/game/population/pageGroups';
import { ReturnProgram, ProjectedMotionSample } from '@wildshard/game/population/returnProgram';
import * as v from 'valibot';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import * as THREE from 'three';





import { Pack, HorseHerd, type PackController, type HerdController } from '../runtime/groupRegistry';
import { declaredGroupFactories } from '../runtime/groupDeclared';
import { PAGE_GROUP_WORLD } from '../runtime/groupPorts';
import { app } from '@wildshard/engine/app/runtime';
import { type Flock, dogWolves, type FlockOpts } from './flock';
import { wildEnv } from './env';
import { pushWildMovers } from '../look/trampleMovers';
import { Marmots } from './marmots';
import poiLayoutRows from '../boot/poiLayout.generated.json' with { type: 'json' };

const { HITCH_HORSE_SPOTS } = poiLayoutRows;

/**
 * Wildlife — Nalati's creatures placed into the shard (row B4; the Driftwood `Enemies.ts` pattern): wolf packs, wild
 * horse herds with their stallion, the camp's sheep flock and its dog. Wolves, horses and the dog are AnimalManager
 * animals (hit tests, health bars, blood, onKill, corpses and the sabre's stagger work as for any boar); the sheep are
 * one instanced crowd (`Flock`).
 *
 *   const wildlife = new Wildlife(animals, { scene, sky, seed, admission }).build();         // ecology.wildlife layout by default
 *   game.onUpdate((dt, t) => wildlife.update(dt, t, player, extra, advanceFlock));
 *   wildlife.disturb(x, z)     an arrow / javelin landed: a herd within 15 m stampedes, the flock panics
 *   wildlife.scare(x, z, r)    lightning / an explosion: packs within 20 m break, herds within r stampede
 *   wildlife.raycastSheep(o, dir, max) → { flock, index, distance } | null ; wildlife.killSheep(hit)
 *   wildlife.onSound = (name, position) => …   flock sounds ('sheep_bleat', 'dog_bark'); the animals' own sounds
 *                                                ('wolf_howl' 'wolf_snarl' 'wolf_bite' 'wolf_yip' 'wolf_yelp' 'horse_neigh'
 *                                                'horse_snort' 'horse_squeal') come through animals.onSound as usual
 *   wildlife.packs / herds / flocks
 * The player fields of `wildEnv` (look direction, crouch, mounted, health) are refreshed here every frame; the grass,
 * wind, clock and knock-down hooks are set by whoever owns them (see wildEnv.ts).
 *
 * Draw cost (painterly): each wolf / horse / the dog is ONE skinned draw (fur + hooves + eyes share a material), plus
 * its shadow draw inside TIER_CONFIG.animalShadowDist; a flock is one instanced draw + one shadow draw.
 */

/** Group policy factories leave placement, prey, mounts and unique elites in their shipping native recipes. */
interface WildlifeControllers {
  pack: (members: Animal[], x: number, z: number) => PackController;
  herd: (members: Animal[]) => HerdController;
}
export interface WildlifeOpts { scene: THREE.Scene; sky: Sky; seed: number; admission: unknown; pasture: unknown; flock: (options: FlockOpts, index: number) => Flock }
export interface SheepHit { flock: Flock; index: number; distance: number }

/** the player surface Wildlife reads (Player satisfies it) */
export interface WildPlayer { position: THREE.Vector3; forward: THREE.Vector3; crouching: boolean }

export class Wildlife {
  packs: PackController[] = [];
  herds: HerdController[] = [];
  flocks: Flock[] = [];
  marmots: Marmots | null = null;
  /** the saddled horses at the camp's hitching rail */
  campHorses: Animal[] = [];
  onSound?: ((name: string, position: THREE.Vector3) => void) | undefined;
  private readonly population: PagePopulationPlanner;
  private readonly placement: ReturnProgram;
  readonly pastureAuthor: ReturnProgram;
  private readonly motion: ProjectedMotionSample;
  private wolves: Animal[] = [];
  private _v = new THREE.Vector3();
  private readonly targets: CrowdRoster<Flock>;
  private readonly relations: PopulationRelations;
  private readonly controllers: WildlifeControllers;

  constructor(private readonly animals: AnimalManager, private readonly opts: WildlifeOpts) { bindEliteAdmission(opts.admission); this.pastureAuthor = ReturnProgram.page(opts.pasture); this.placement = ReturnProgram.page(opts.admission); this.population = new PagePopulationPlanner(animals, this.placement, new Rng(opts.seed ^ 0x3a17), { begin: 'begin', spot: 'spot', accept: 'accept', yaw: 'yaw' }); this.targets = new CrowdRoster(animals.animals, this.flocks, 'sheep');
    this.relations = new PopulationRelations(this.placement, { packs: this.packs, herds: this.herds, crowds: this.flocks },
      { alert: 'whistle', range: 'scare', packRadius: 20, disturbRadius: 25, disturbSeconds: 4, scareSeconds: 6 });
    this.controllers = this.declaredControllers(); this.motion = new ProjectedMotionSample(this.placement, 'speed'); }

  private declaredControllers(): WildlifeControllers {
    const factory = declaredGroupFactories({ preyIdentity: prey => this.targets.identity(prey), resolvePrey: id => this.targets.resolve(id),
      resolveActor: id => this.animals.animals.find(actor => actor.entityId === id) ?? null },
      { sharedRng: () => app.rng.stream('ai'), register: (a, director) => { app.aggression.register(a, director); } }, PAGE_GROUP_WORLD);
    return {
      pack: (members, x, z) => { const p = factory.pack(members, x, z); Pack.register(p); return p; },
      herd: members => {
        const view: Pick<HerdController, 'findWolf'> = { findWolf: undefined };
        const h = Object.assign(factory.herd(members), view);
        h.findThreat = (x, z, r) => h.findWolf?.(x, z, r) ?? null;
        const adopt = h.adoptStallion.bind(h);
        h.adoptStallion = actor => { adopt(actor); HorseHerd.register(h); };
        HorseHerd.register(h); return h;
      },
    };
  }

  build(): this {
    const steps = this.buildSteps();
    while (steps.next().done !== true) { /* every group now */ }
    return this;
  }

  /** `build`, a task apart per pack, herd, flock, the camp horses and the marmots (SF67: one ~370 ms task at 4x CPU); the
   *  same spawns in the same order from the same streams */
  async buildSliced(yieldTask: () => Promise<void>): Promise<this> {
    const steps = this.buildSteps();
    while (steps.next().done !== true) await yieldTask();
    return this;
  }

  private *buildSteps(): Generator<void, void> {
    const layout = ecology.wildlife;
    for (const p of layout.packs) { this.spawnPack(p.x, p.z, p.variants); yield; }
    for (const h of layout.herds) { this.spawnHerd(h.x, h.z, h.mares, h.foals, h.stallion); yield; }
    for (const f of layout.flocks) { this.spawnFlock(f.x, f.z, f.count, f.dog, f.range); yield; }
    if (layout.campHorses === true) {
      // tied at the rail, saddled (the tamed horse B8 hands the player waits here too); no herd → they stand and idle
      HITCH_HORSE_SPOTS.forEach((h, i) => { const a = this.animals.spawn('horse', h.x, h.z, Math.atan2(h.face.x, h.face.z), i === 0 ? 'camp-bay' : 'camp-black'); this.campHorses.push(a); });
      yield;
    }
    if (layout.marmots !== undefined) {
      const m = new Marmots(this.opts.sky, this.opts.seed).build(Marmots.scatter(this.opts.seed, layout.marmots.sites, layout.marmots.box));
      this.opts.scene.add(m.mesh);
      // a whistle warns anything within 30 m (awareness +0.3)
      m.onWhistle = (x, z) => {
        this._v.set(x, heightAt(x, z), z); this.onSound?.('marmot_whistle', this._v);
        this.relations.alert(x, z);
      };
      this.marmots = m;
    }
  }

  spawnPack(x: number, z: number, variants: string[]): PackController {
    const radius = v.parse(v.number(), this.placement.project('packPlan', {})['radius']);
    const members = this.population.scatter({ kind: 'wolf', variants, x, z, radius });
    this.wolves.push(...members);
    const pack = this.controllers.pack(members, x, z);
    pack.findPrey = (px, pz, r) => this.nearestFoal(px, pz, r);
    this.packs.push(pack);
    return pack;
  }

  spawnHerd(x: number, z: number, mares: number, foals: number, stallion: boolean): HerdController {
    const members = this.population.planned({ kind: 'horse', x, z, observations: { mares, foals, stallion: Number(stallion), coats: ecology.mareVariants.length },
      variants: [...ecology.mareVariants, 'foal-bay', 'foal-chestnut', 'stallion'], start: 'herdStart', member: 'herdMember', offset: 'foal' });
    const h = this.controllers.herd(members);
    h.findWolf = (px, pz, r) => this.nearestWolf(px, pz, r);
    this.herds.push(h);
    return h;
  }

  spawnFlock(x: number, z: number, count: number, dog: boolean, range?: number): Flock {
    const options = { x, z, count, seed: this.opts.seed + this.flocks.length * 101, ...(range !== undefined ? { range } : {}) };
    const f = this.opts.flock(options, this.flocks.length);
    this.opts.scene.add(f.mesh);
    f.onSound = (name, sx, sz) => { this._v.set(sx, heightAt(sx, sz) + 0.6, sz); this.onSound?.(name, this._v); };
    if (dog) {
      const plan = v.parse(v.object({ x: v.number(), z: v.number(), radius: v.number() }), this.placement.project('dogPlan', { x, z }));
      const at = this.population.spot(plan.x, plan.z, plan.radius), d = this.animals.spawn('sheepdog', at.x, at.z, 0, 'collie');
      d.herd = this.animals.addHerd('sheepdog', x, z);
      f.setDog(d, this.placement);
    }
    this.flocks.push(f);
    return f;
  }

  private nearestWolf(x: number, z: number, radius: number): Animal | null { return nearestPopulationActor(this.wolves, x, z, radius); }
  private nearestFoal(x: number, z: number, radius: number): Animal | null { return nearestPopulationActor(this.herds.flatMap(herd => herd.foals), x, z, radius); }

  /** the trample map's push, read when called (wildEnv.trample is rebound when the grass is wired) */
  private readonly pushTrample = (x: number, z: number, r: number, s: number, vx: number, vz: number): void => { wildEnv.trample(x, z, r, s, vx, vz); };
  /** every frame: the player into wildEnv, the flocks' crowd update */
  update(dt: number, _t: number, player: WildPlayer, extra: { mounted?: boolean; health01?: number },
    advanceFlock: (flock: Flock, index: number, playerSpeed: number) => void): void {
    const p = player.position;
    const speed = this.motion.update(dt, p.x, p.z);
    const fl = Math.hypot(player.forward.x, player.forward.z);
    if (fl > 1e-4) { wildEnv.playerFwdX = player.forward.x / fl; wildEnv.playerFwdZ = player.forward.z / fl; }
    wildEnv.playerCrouched = player.crouching;
    wildEnv.playerMounted = extra.mounted ?? false;
    wildEnv.playerHealth01 = extra.health01 ?? 1;
    dogWolves.length = 0;
    for (const w of this.wolves) if (w.alive) dogWolves.push(w);
    // the grass parts around every moving wolf / horse / dog near the player (GrassTrample's live movers + the map)
    pushWildMovers(this.animals.animals, p.x, p.z, this.pushTrample);
    for (const [index, f] of this.flocks.entries()) {
      advanceFlock(f, index, speed);
    }
    this.marmots?.update(dt, p, speed, player.crouching);
    // a wolf pack running through the flock scatters it (Flock reads the wolves); a stampede scatters packs in its path
    this.relations.ripple();
  }

  /** an arrow / javelin landed at (x, z) */
  disturb(x: number, z: number): void { this.relations.disturb(x, z); }
  scare(x: number, z: number, r = 60): void { this.relations.scare(x, z, r); wildEnv.onEvent?.('scare', x, z); }
  raycastSheep(o: THREE.Vector3, dir: THREE.Vector3, maxDist: number): SheepHit | null { return this.targets.raycast(o, dir, maxDist); }
  killSheep(hit: SheepHit): void { hit.flock.kill(hit.index); }

  /** living wolves (for the HUD's threat chevrons / minimap) */
  get livingWolves(): readonly Animal[] { return dogWolves; }
}

