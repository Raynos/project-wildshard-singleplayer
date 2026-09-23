import * as THREE from 'three';
import type { Sky } from '../world/Sky';
import { heightAt, inChunk, normalAt, waterLevel } from '../world/Heightfield';
import { Rng } from '../core/rng';
import type { AnimalManager } from './AnimalManager';
import type { Animal } from './Animal';
import { Pack } from './Pack';
import { HorseHerd } from './Herd';
import { Flock, dogWolves } from './Flock';
import { wildEnv } from './wildEnv';
import { Marmots } from './Marmots';
import { HITCH_HORSE_SPOTS } from '../world/nalati/layout';

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

export interface WildlifeLayout {
  packs: { x: number; z: number; variants: string[] }[];
  herds: { x: number; z: number; mares: number; foals: number; stallion: boolean }[];
  flocks: { x: number; z: number; count: number; dog: boolean; range?: number }[];
  /** marmot burrows: `sites` seeded inside the box (ambient; one instanced draw for all) */
  marmots?: { sites: number; box: { x0: number; x1: number; z0: number; z1: number } };
  /** the camp's saddled horses tied at the hitching rail (HITCH_HORSE_SPOTS, src/world/nalati/layout.ts) */
  campHorses?: boolean;
}

/** map-01 (docs/design/nalati/geography-and-map.md §3): the den in the east gully, the herd on the horse plains, the flock on the NE pasture */
export const NALATI_WILDLIFE: WildlifeLayout = {
  packs: [{ x: -150, z: 25, variants: ['alpha', 'grey', 'tawny', 'grey', 'scout'] }],
  herds: [{ x: 140, z: -120, mares: 11, foals: 3, stallion: true }],
  flocks: [{ x: -120, z: 205, count: 40, dog: true, range: 40 }],
  marmots: { sites: 7, box: { x0: -200, x1: 220, z0: -200, z1: -40 } },   // the Sky Grassland
  campHorses: true,
};

const MARE_VARIANTS = ['bay', 'chestnut', 'bay', 'dun', 'chestnut', 'grey', 'bay', 'black', 'dun', 'bay', 'chestnut', 'grey'];

export interface WildlifeOpts { scene: THREE.Scene; sky: Sky; seed: number; layout?: WildlifeLayout }
export interface SheepHit { flock: Flock; index: number; distance: number }

/** the player surface Wildlife reads (Player satisfies it) */
export interface WildPlayer { position: THREE.Vector3; forward: THREE.Vector3; crouching: boolean }

export class Wildlife {
  packs: Pack[] = [];
  herds: HorseHerd[] = [];
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

  constructor(private readonly animals: AnimalManager, private readonly opts: WildlifeOpts) { this.rng = new Rng(opts.seed ^ 0x3a17); }

  build(): this {
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

  /** a free spot near (x, z) within r: dry, in the chunk, not steep, not on top of another animal */
  private spot(x: number, z: number, r: number): [number, number] {
    for (let i = 0; i < 40; i++) {
      const a = this.rng.range(0, Math.PI * 2), d = Math.sqrt(this.rng.next()) * r;
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      if (!inChunk(px, pz, 15) || normalAt(px, pz)[1] < 0.78 || heightAt(px, pz) < waterLevel() + 0.3) continue;
      let clash = false;
      for (const o of this.animals.animals) if (Math.abs(o.position.x - px) < 2 && Math.abs(o.position.z - pz) < 2) { clash = true; break; }
      if (!clash) return [px, pz];
    }
    return [x, z];
  }

  spawnPack(x: number, z: number, variants: string[]): Pack {
    const herd = this.animals.addHerd('wolf', x, z);
    const members: Animal[] = [];
    for (const v of variants) {
      const [px, pz] = this.spot(x, z, 8);
      const w = this.animals.spawn('wolf', px, pz, this.rng.range(0, Math.PI * 2), v);
      w.herd = herd; this.animals.herds[herd]?.members.push(w);
      members.push(w); this.wolves.push(w);
    }
    const pack = new Pack(members, x, z);
    pack.findPrey = (px, pz, r) => this.nearestFoal(px, pz, r);
    this.packs.push(pack);
    return pack;
  }

  spawnHerd(x: number, z: number, mares: number, foals: number, stallion: boolean): HorseHerd {
    const herd = this.animals.addHerd('horse', x, z);
    const members: Animal[] = [];
    const add = (v: string, r: number): Animal => {
      const [px, pz] = this.spot(x, z, r);
      const h = this.animals.spawn('horse', px, pz, this.rng.range(0, Math.PI * 2), v);
      h.herd = herd; this.animals.herds[herd]?.members.push(h);
      members.push(h);
      return h;
    };
    const start = this.rng.int(0, MARE_VARIANTS.length - 1);
    const mareList: Animal[] = [];
    for (let i = 0; i < mares; i++) mareList.push(add(MARE_VARIANTS[(start + i) % MARE_VARIANTS.length] ?? 'bay', 11));
    for (let i = 0; i < foals; i++) {
      const mom = mareList[i % Math.max(1, mareList.length)];
      const f = add(i % 2 === 0 ? 'foal-bay' : 'foal-chestnut', 3);
      if (mom !== undefined) f.place(mom.position.x + this.rng.range(-2, 2), mom.position.z + this.rng.range(-2, 2), mom.yaw);
    }
    if (stallion) { const s = add('stallion', 4); s.place(x + 16, z + 4, 0); }
    const h = new HorseHerd(members);
    h.findWolf = (px, pz, r) => this.nearestWolf(px, pz, r);
    this.herds.push(h);
    return h;
  }

  spawnFlock(x: number, z: number, count: number, dog: boolean, range?: number): Flock {
    const f = new Flock(this.opts.sky, { x, z, count, seed: this.opts.seed + this.flocks.length * 101, ...(range !== undefined ? { range } : {}) }).build();
    this.opts.scene.add(f.mesh);
    f.onSound = (name, sx, sz) => { this._v.set(sx, heightAt(sx, sz) + 0.6, sz); this.onSound?.(name, this._v); };
    if (dog) {
      const [px, pz] = this.spot(x + 14, z, 4);
      const d = this.animals.spawn('sheepdog', px, pz, 0, 'collie');
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
  private nearestFoal(x: number, z: number, r: number): Animal | null {
    let best: Animal | null = null, bd = r;
    for (const h of this.herds) for (const f of h.foals) { if (!f.alive) continue; const d = Math.hypot(f.position.x - x, f.position.z - z); if (d < bd) { bd = d; best = f; } }
    return best;
  }

  /** every frame: the player into wildEnv, the flocks' crowd update */
  update(dt: number, t: number, player: WildPlayer, extra: { mounted?: boolean; health01?: number } = {}): void {
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
    for (const f of this.flocks) f.update(dt, t, p, this.speed, dogWolves);
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
