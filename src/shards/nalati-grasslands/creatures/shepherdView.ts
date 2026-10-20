import { app } from '@wildshard/engine/app/runtime';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { TIER } from '@wildshard/engine/core/tier';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import * as THREE from 'three';
import type { Wildlife } from './wildlife';
import { horseBones } from '../species/horse';
import { bakedActorGeometry } from '../world/places';
import { PastureRaid } from './pasture';
import type { PackBrain } from '@wildshard/engine/ai/pack';

type PackController = PackBrain<Animal>;

const SEAT = new THREE.Vector3(0, 0.36, 0.28);
const SHOULDER_R = new THREE.Vector3(-0.2, 0.6, 0.0);
// ── the shepherd, seated (seat space: origin on the saddle, +y up, +z forward, +x his LEFT — the camp people's frame) ──
/** the shepherd in the saddle (seated at SEAT on a horse's body bone): his body and the whip arm, one painterly material —
 *  the camp's rider (SheepRaid) and the Model Explorer's (src/shards/nalati-grasslands/models/people.ts, E315 M5) */
export function shepherdRider(): { rider: THREE.Group; arm: THREE.Mesh } {
  const mat = painterlyMaterial(null, { rim: 0.4, bands: 0.8 });
  const rider = new THREE.Group();
  rider.name = 'nalati-shepherd';
  const body = new THREE.Mesh(bakedActorGeometry('shepherd-body'), mat);
  const arm = new THREE.Mesh(bakedActorGeometry('shepherd-arm'), mat);
  arm.position.copy(SHOULDER_R);
  rider.add(body, arm);
  rider.position.copy(SEAT);
  for (const m of [body, arm]) { m.castShadow = TIER !== 'phone'; m.receiveShadow = true; }
  return { rider, arm };
}

/** Client-only rider pose; the shared native pasture controller owns the actors. */
export class SheepRaid extends PastureRaid<Animal, PackController> {
  private readonly rider: THREE.Group | null;
  private readonly arm: THREE.Mesh | null;
  private lean = 0;
  private crackT = -1;
  constructor(private readonly ctx: { animals: AnimalManager; wildlife: Wildlife; toast: (text: string) => void }) {
    const f = ctx.wildlife.flocks[0] ?? null, random = app.rng.stream('ai');
    // Preserve the boot stream's first-raid draw before the parked King's draw.
    const delay = ctx.wildlife.pastureAuthor.project('raidFirst', {}, random)['raidT'] ?? 0;
    const site = ctx.wildlife.pastureAuthor.project('shepherdSite', { cx: f?.cx ?? 10000, cz: f?.cz ?? 10000 });
    const h = site['accept'] === 1 ? ctx.animals.spawn('horse', site['x'] ?? 0, site['z'] ?? 0, site['yaw'] ?? 0, 'camp-bay') : null;
    if (h !== null) { h.mem['owned'] = 1; h.label = "Shepherd's horse"; }
    super(ctx.wildlife.pastureAuthor, random, h, f, ctx.wildlife.packs, i => {
      if (f === null) throw new Error('Missing raid flock'); return f.prey(i);
    }, (x, z, variants) => ctx.wildlife.spawnPack(x, z, variants), delay, (key, actor) => {
      if (key === 'crack') { this.crackT = 0; if (actor !== undefined) ctx.animals.onSound?.('wolf_yelp', actor.position); }
      else ctx.toast(key === 'start' ? 'Wolves are raiding the flock — the shepherd rides out' : key === 'taken' ? 'The wolves took a sheep' : 'The shepherd drove the wolves off');
    });
    const figure = h === null ? null : shepherdRider(); this.rider = figure?.rider ?? null; this.arm = figure?.arm ?? null;
    if (h !== null && figure !== null) horseBones(h).body.add(figure.rider);
  }
  override update(dt: number, player: THREE.Vector3): void {
    super.update(dt, player, this.ctx.wildlife.livingWolves, app.clock.now, practiceRoom.open);
    const h = this.shepherd; if (h === null) return;
    this.lean += ((h.speed > 9 ? .28 : h.speed > 5 ? .12 : 0)-this.lean)*Math.min(1,dt*3);
    if (this.rider !== null) this.rider.rotation.x = this.lean;
    if (this.arm === null) return;
    let angle = -.2;
    if (this.crackT >= 0) {
      this.crackT += dt; const u = this.crackT/.45;
      angle = u < .45 ? -.2-2.4*u/.45 : -2.6+3.2*Math.min(1,(u-.45)/.3);
      if (u >= 1) this.crackT = -1;
    }
    this.arm.rotation.x = angle;
  }
}
