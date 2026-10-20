import { app } from '@wildshard/engine/app/runtime';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { TIER } from '@wildshard/engine/core/tier';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import * as THREE from 'three';
import type { PageWildlife } from '@wildshard/game/population/wildlife';
import type { CrowdDraw as Flock } from '@wildshard/game/ambient/crowdDraw';
import { bakedActorGeometry } from '../world/places';
import { PagePastureRaid } from '@wildshard/game/riding/pagePasture';

type Wildlife = PageWildlife<Flock>;


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
export class SheepRaid extends PagePastureRaid<Flock> {
  private readonly rider: THREE.Group | null;
  private readonly arm: THREE.Mesh | null;
  private lean = 0;
  private crackT = -1;
  constructor(private readonly ctx: { animals: AnimalManager; wildlife: Wildlife; toast: (text: string) => void }) {
    super(ctx.animals,ctx.wildlife,ctx.wildlife.pastureProfile);
    const h = this.shepherd;
    const figure = h === null ? null : shepherdRider(); this.rider = figure?.rider ?? null; this.arm = figure?.arm ?? null;
    if (h !== null && figure !== null) { const body = h.mesh.skeleton.getBoneByName('body'); if (body === undefined) throw new Error('Missing rider body joint'); body.add(figure.rider); }
  }
  override update(dt: number, player: THREE.Vector3): void {
    super.update(dt, player, this.ctx.wildlife.predators, app.clock.now, practiceRoom.open);
    for (let i=0;i<8;i++) {
      const cue=this.nextCue();if(cue===undefined)break;
      if(cue.kind==='crack')this.crackT=0;
      if(cue.text!=='')this.ctx.toast(cue.text);
      const actor=this.ctx.animals.animals.find(body=>body.entityId===cue.actor);
      if(cue.sound!==null&&actor!==undefined)this.ctx.animals.onSound?.(cue.sound,actor.position);
    }
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
