import { Rng } from '@wildshard/engine/core/rng';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt, terrainNormal as normalAt, terrainWaterLevel as waterLevel } from '@wildshard/engine/world/terrainHeight';
import * as THREE from 'three';





import type { PackController, PackPrey, HerdController } from '../runtime/groupRegistry';
import { declaredGroupFactories } from '../runtime/groupDeclared';
import { APP_GROUP_HOST } from '../runtime/groupHost';
import { Flock, SheepPrey, dogWolves, type FlockOpts } from './flock';
import { wildEnv } from './env';
import { Marmots } from './marmots';
import { NALATI_WILDLIFE, placeDog, placeHerd, placePack, type WildlifeLayout, type WildPlacer } from './wildPlacement';
import { HITCH_HORSE_SPOTS } from '../world/layout';

/**
 * Wildlife — Nalati's creatures placed into the shard (row B4; the Driftwood `Enemies.ts` pattern): wolf packs, wild
 * horse herds with their stallion, the camp's sheep flock and its dog. Wolves, horses and the dog are AnimalManager
 * animals (hit tests, health bars, blood, onKill, corpses and the sabre's stagger work as for any boar); the sheep are
 * one instanced crowd (`Flock`).
 *
 *   const wildlife = new Wildlife(animals, { scene, sky, seed }).build();         // NALATI_WILDLIFE layout by default
 *   game.onUpdate((dt, t) => wildlife.update(dt, t, player));
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
export interface WildlifeControllers {
  pack: (members: Animal[], x: number, z: number) => PackController;
  herd: (members: Animal[]) => HerdController;
}
export interface WildlifeOpts { scene: THREE.Scene; sky: Sky; seed: number; layout?: WildlifeLayout; controllers?: WildlifeControllers; flock?: (options: FlockOpts, index: number) => Flock }
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
  private rng: Rng;
  private prev = new THREE.Vector3(); private speed = 0; private init = false;
  private wolves: Animal[] = [];
  private _v = new THREE.Vector3();
  private sheepHit: SheepHit | null = null;
  private readonly preyBindings = new Map<string, PackPrey>();
  private controllers: WildlifeControllers;

  constructor(private readonly animals: AnimalManager, private readonly opts: WildlifeOpts) { this.rng = new Rng(opts.seed ^ 0x3a17); this.controllers = opts.controllers ?? this.declaredControllers(); }

  private declaredControllers(): WildlifeControllers {
    return declaredGroupFactories({ preyIdentity: prey => this.preyIdentity(prey), resolvePrey: id => this.resolvePrey(id),
      resolveActor: id => this.animals.animals.find(actor => actor.entityId === id) ?? null }, APP_GROUP_HOST);
  }

  build(controllers = this.opts.controllers): this {
    this.controllers = controllers ?? this.declaredControllers();
    const layout = this.opts.layout ?? NALATI_WILDLIFE;
    for (const p of layout.packs) this.spawnPack(p.x, p.z, p.variants);
    for (const h of layout.herds) this.spawnHerd(h.x, h.z, h.mares, h.foals, h.stallion);
    for (const f of layout.flocks) this.spawnFlock(f.x, f.z, f.count, f.dog, f.range);
    if (layout.campHorses === true) {
      // tied at the rail, saddled (the tamed horse B8 hands the player waits here too); no herd → they stand and idle
      HITCH_HORSE_SPOTS.forEach((h, i) => { const a = this.animals.spawn('horse', h.x, h.z, Math.atan2(h.face.x, h.face.z), i === 0 ? 'camp-bay' : 'camp-black'); this.campHorses.push(a); });
    }
    if (layout.marmots !== undefined) {
      const m = new Marmots(this.opts.sky, this.opts.seed).build(Marmots.scatter(this.opts.seed, layout.marmots.sites, layout.marmots.box));
      this.opts.scene.add(m.mesh);
      // a whistle warns anything within 30 m (awareness +0.3)
      m.onWhistle = (x, z) => {
        this._v.set(x, heightAt(x, z), z); this.onSound?.('marmot_whistle', this._v);
        for (const h of this.herds) for (const a of h.members) if (Math.hypot(a.position.x - x, a.position.z - z) < 30) a.mem['aw'] = Math.min(1, (a.mem['aw'] ?? 0) + 0.3);
        for (const p of this.packs) for (const w of p.members) if (w.alive && Math.hypot(w.position.x - x, w.position.z - z) < 30) { p.awareness = Math.min(1, p.awareness + 0.3); break; }
      };
      this.marmots = m;
    }
    return this;
  }

  /** the shared placement (wildPlacement.ts) over this world: Wildlife's stream, the page's ground, the manager's bodies */
  private placer(): WildPlacer<Animal> {
    return { rng: this.rng, bodies: () => this.animals.animals,
      ground: { normalY: (x, z) => normalAt(x, z)[1], heightAt, waterLevel, wetAt: (x, z) => wildEnv.wetAt?.(x, z) === true },
      spawn: (kind, x, z, yaw, variant) => this.animals.spawn(kind, x, z, yaw, variant), place: (a, x, z, yaw) => { a.place(x, z, yaw); } };
  }

  spawnPack(x: number, z: number, variants: string[]): PackController {
    const herd = this.animals.addHerd('wolf', x, z);
    const members = placePack(this.placer(), x, z, variants, w => { w.herd = herd; this.animals.herds[herd]?.members.push(w); this.wolves.push(w); });
    const pack = this.controllers.pack(members, x, z);
    pack.findPrey = (px, pz, r) => this.nearestFoal(px, pz, r);
    this.packs.push(pack);
    return pack;
  }

  spawnHerd(x: number, z: number, mares: number, foals: number, stallion: boolean): HerdController {
    const herd = this.animals.addHerd('horse', x, z);
    const members = placeHerd(this.placer(), x, z, mares, foals, stallion, h => { h.herd = herd; this.animals.herds[herd]?.members.push(h); });
    const h = this.controllers.herd(members);
    h.findWolf = (px, pz, r) => this.nearestWolf(px, pz, r);
    this.herds.push(h);
    return h;
  }

  spawnFlock(x: number, z: number, count: number, dog: boolean, range?: number): Flock {
    const options = { x, z, count, seed: this.opts.seed + this.flocks.length * 101, ...(range !== undefined ? { range } : {}) };
    const f = this.opts.flock?.(options, this.flocks.length) ?? new Flock(this.opts.sky, options).build();
    this.opts.scene.add(f.mesh);
    f.onSound = (name, sx, sz) => { this._v.set(sx, heightAt(sx, sz) + 0.6, sz); this.onSound?.(name, this._v); };
    if (dog) {
      const d = placeDog(this.placer(), x, z);
      d.herd = this.animals.addHerd('sheepdog', x, z);
      f.setDog(d);
    }
    this.flocks.push(f);
    return f;
  }

  private nearestWolf(x: number, z: number, r: number): Animal | null {
    let best: Animal | null = null, bd = r;
    for (const w of this.wolves) { if (!w.alive) continue; const d = Math.hypot(w.position.x - x, w.position.z - z); if (d < bd) { bd = d; best = w; } }
    return best;
  }
  /** Native identity ownership: bind only an existing animal or an authored flock member. */
  preyIdentity(prey: PackPrey): string {
    const actor = this.animals.animals.find(value => value === prey);
    if (actor !== undefined) return `actor:${actor.entityId}`;
    if (!(prey instanceof SheepPrey)) throw new Error('Unbound native prey');
    const flock = this.flocks.indexOf(prey.flock);
    if (flock === -1 || prey.index < 0 || prey.index >= prey.flock.n) throw new Error('Unbound native flock prey');
    const id = `sheep:${flock}:${prey.index}`; this.preyBindings.set(id, prey); return id;
  }
  /** Resolve through this world's recipe; same-world restores preserve raid object identity. */
  resolvePrey(id: string): PackPrey | null {
    if (id.startsWith('actor:')) return this.animals.animals.find(actor => actor.entityId === id.slice(6)) ?? null;
    const existing = this.preyBindings.get(id); if (existing !== undefined) return existing;
    const match = /^sheep:(\d+):(\d+)$/u.exec(id);
    if (match === null) return null;
    const flock = this.flocks[Number(match[1])], index = Number(match[2]);
    if (flock === undefined || !Number.isSafeInteger(index) || index < 0 || index >= flock.n) return null;
    const prey = flock.prey(index); this.preyBindings.set(id, prey); return prey;
  }
  private nearestFoal(x: number, z: number, r: number): Animal | null {
    let best: Animal | null = null, bd = r;
    for (const h of this.herds) for (const f of h.foals) { if (!f.alive) continue; const d = Math.hypot(f.position.x - x, f.position.z - z); if (d < bd) { bd = d; best = f; } }
    return best;
  }

  /** every frame: the player into wildEnv, the flocks' crowd update */
  update(dt: number, t: number, player: WildPlayer, extra: { mounted?: boolean; health01?: number } = {},
    advanceFlock?: (flock: Flock, index: number, playerSpeed: number) => void): void {
    const p = player.position;
    if (!this.init) { this.prev.copy(p); this.init = true; }
    const moved = Math.hypot(p.x - this.prev.x, p.z - this.prev.z);
    this.prev.copy(p);
    if (dt > 0) this.speed += (Math.min(moved / dt, 14) - this.speed) * Math.min(1, dt * 6);
    const fl = Math.hypot(player.forward.x, player.forward.z);
    if (fl > 1e-4) { wildEnv.playerFwdX = player.forward.x / fl; wildEnv.playerFwdZ = player.forward.z / fl; }
    wildEnv.playerCrouched = player.crouching;
    wildEnv.playerMounted = extra.mounted ?? false;
    wildEnv.playerHealth01 = extra.health01 ?? 1;
    dogWolves.length = 0;
    for (const w of this.wolves) if (w.alive) dogWolves.push(w);
    // the grass parts around every moving wolf / horse / dog near the player (GrassTrample's live movers + the map)
    for (const a of this.animals.animals) {
      if (!a.alive || a.speed < 0.6 || (a.kind !== 'wolf' && a.kind !== 'horse' && a.kind !== 'sheepdog')) continue;
      const dx = a.position.x - p.x, dz = a.position.z - p.z;
      if (dx * dx + dz * dz > 80 * 80) continue;
      const r = (a.kind === 'horse' ? 0.8 : a.kind === 'wolf' ? 0.5 : 0.4) * a.scale;
      wildEnv.trample(a.position.x, a.position.z, r, Math.min(1, a.speed / 6), Math.sin(a.yaw) * a.speed, Math.cos(a.yaw) * a.speed);
    }
    for (const [index, f] of this.flocks.entries()) {
      if (advanceFlock !== undefined) advanceFlock(f, index, this.speed); else f.update(dt, t, p, this.speed, dogWolves);
    }
    this.marmots?.update(dt, p, this.speed, player.crouching);
    // a wolf pack running through the flock scatters it (Flock reads the wolves); a stampede scatters packs in its path
    for (const h of this.herds) if (h.stampeding) for (const pk of this.packs) pk.scare(h.cx, h.cz, 20);
  }

  /** an arrow / javelin landed at (x, z) */
  disturb(x: number, z: number): void {
    for (const h of this.herds) h.disturb(x, z);
    for (const f of this.flocks) if (Math.hypot(f.cx - x, f.cz - z) < 25) f.scare(x, z, 4);
  }

  /** lightning / anything terrifying at (x, z): packs within 20 m break, herds within r stampede, the flock bolts */
  scare(x: number, z: number, r = 60): void {
    for (const p of this.packs) p.scare(x, z, 20);
    for (const h of this.herds) if (Math.hypot(h.cx - x, h.cz - z) < r) h.stampede(x, z);
    for (const f of this.flocks) if (Math.hypot(f.cx - x, f.cz - z) < r) f.scare(x, z, 6);
    wildEnv.onEvent?.('scare', x, z);   // B1: the horse under the rider panics (src/shards/nalati-grasslands/ride/ride.ts)
  }

  raycastSheep(o: THREE.Vector3, dir: THREE.Vector3, maxDist: number): SheepHit | null {
    let best: SheepHit | null = null;
    for (const f of this.flocks) {
      const i = f.raycast(o, dir, maxDist);
      if (i < 0) continue;
      f.positions(i, this._v);
      const d = this._v.distanceTo(o);
      if (best === null || d < best.distance) { best = this.sheepHit ??= { flock: f, index: i, distance: d }; best.flock = f; best.index = i; best.distance = d; }
    }
    return best;
  }
  killSheep(hit: SheepHit): void { hit.flock.kill(hit.index); }

  /** living wolves (for the HUD's threat chevrons / minimap) */
  get livingWolves(): readonly Animal[] { return dogWolves; }
}

