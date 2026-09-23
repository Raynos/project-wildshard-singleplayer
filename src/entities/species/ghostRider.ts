import * as THREE from 'three';
import { registerSpecies, speciesDef, type ThinkCtx } from './registry';
import { NO_FUR } from './rigs';
import { HORSE_SPEED, horseBones } from './horse';
import type { Animal } from '../Animal';
import { eliteDamageMul } from '../eliteBrain';

/**
 * Ghost rider — the night half of row B11 (NALATI.md; elites-and-bosses.md E5 "the ghost-rider line"; mockups
 * art/nalati-grasslands/round-1/3-enemies/enemy-6-ghost-riders.png, round-2/4-named-elites/elite-5-qara-batyr-night-rider.png):
 * a spectral horse archer, cyan smoke and glass, galloping the ridge lines at night.
 *
 * The horse IS the creature row's horse (src/entities/species/horse.ts — its build, gaits, mane / tail postPose, tack),
 * registered again as kind `ghost-rider` with this file's brain; src/nalati/ghostRiders.ts swaps its material for the
 * ghost one (translucent teal, a fresnel rim, additive, no shadow) and seats the hooded rider (`riderGeometry`) on the
 * horse's body bone. The brain is a puppet: the controller writes the steering target every frame (`mem.tx / tz`, the
 * speed `mem.v`) — the line's formation, the ridge path, the circling — and does the shooting; `think` only steers.
 *
 * Variants: `rider` (70 hp: two full-draw arrows) and `captain` (B12's Qara Batyr rides this rig: 800 hp, bigger, the
 * elite system decides the rest). No blood: a hit tears mist out of it (the controller).
 */

export const GHOST_RIDER = 'ghost-rider';

/** the horse rig's body bone and the seat on it (body-bone space; horse.ts's SADDLE_LOCAL) */
export const GHOST_SEAT = new THREE.Vector3(0, 0.36, 0.28);

const _p = new THREE.Vector3();

function thinkGhost(a: Animal, c: ThinkCtx): void {
  const m = a.mem;
  const tx = m['tx'], tz = m['tz'];
  a.lookWeight = 0.6; a.lookTarget.copy(c.player);
  if (tx === undefined || tz === undefined) { a.setMotion(a.yaw, 0, 1); return; }
  const dx = tx - a.position.x, dz = tz - a.position.z;
  const v = m['v'] ?? HORSE_SPEED.canter;
  a.state = v > HORSE_SPEED.canter ? 'flee' : 'wander';
  a.setMotion(Math.atan2(dx, dz), Math.hypot(dx, dz) < 0.8 ? 0 : v, m['turn'] ?? 2.4);
}

/** the rider's seat in world space (valid after the horse's update this frame) */
export function ghostSeat(a: Animal, out: THREE.Vector3): THREE.Vector3 {
  return out.copy(GHOST_SEAT).applyMatrix4(horseBones(a).body.matrixWorld);
}

/**
 * The hooded rider, in the horse's body-bone space (seat at GHOST_SEAT, +z = the horse's forward): hips in the saddle,
 * legs down the flanks, a lean-forward torso, a hood with a pointed peak, a long cloak streaming back off the shoulders,
 * the bow held out on the left, the right hand drawn back to the cheek. Smooth, one geometry, no colour (the ghost
 * material paints it from the fresnel).
 */
export function riderGeometry(captain = false): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const s = GHOST_SEAT;
  const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(s.x + x, s.y + y, s.z + z);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    parts.push(g.index ? g.toNonIndexed() : g);
  };
  const cap = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 4, 10);
  add(cap(0.15, 0.1).scale(1.3, 1, 1), 0, 0.12, -0.05);                              // hips in the saddle
  add(cap(0.17, 0.36).scale(1.15, 1, 0.85), 0, 0.5, 0.02, 0.28);                     // torso, leaning into the gallop
  add(new THREE.SphereGeometry(0.13, 14, 10), 0, 0.88, 0.16);                        // head
  add(new THREE.ConeGeometry(0.19, 0.42, 14, 1, true), 0, 0.98, 0.1, -0.2);          // the hood, peaked
  add(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1.05), 0, 0.84, 0.12);  // hood crown
  // the cloak: a flared, open cone from the shoulders, streaming back and down over the horse's rump
  const cloak = new THREE.CylinderGeometry(0.2, 0.46, 0.95, 16, 3, true, Math.PI * 0.2, Math.PI * 1.6);
  const cp = cloak.getAttribute('position');
  for (let i = 0; i < cp.count; i++) { const y = cp.getY(i); cp.setZ(i, cp.getZ(i) - (0.475 - y) * 0.55); cp.setX(i, cp.getX(i) + Math.sin(y * 9 + cp.getZ(i) * 5) * 0.03); }
  cloak.computeVertexNormals();
  add(cloak, 0, 0.36, -0.2, 0.55);
  for (const sx of [1, -1]) add(cap(0.075, 0.42), sx * 0.24, -0.12, 0.1, 0.9, 0, sx * 0.25);   // thighs down the flanks
  // the bow arm (left, +x): straight out to the left-front; the bow a tall recurve arc at its fist
  add(cap(0.06, 0.5), 0.36, 0.64, 0.22, 0, 0, -1.25);
  const bow = new THREE.TorusGeometry(0.55, 0.018, 6, 24, Math.PI * 0.9);
  bow.rotateZ(Math.PI * 0.55); add(bow, 0.52, 0.64, 0.32, 0, Math.PI / 2, 0);
  // the draw arm (right): the elbow up and back, the hand at the cheek
  add(cap(0.058, 0.3), -0.2, 0.72, 0.05, 1.3, 0, 0.6);
  add(new THREE.SphereGeometry(0.06, 8, 6), -0.08, 0.84, 0.2);
  if (captain) {
    // Qara Batyr: a spiked helm peak and a tall horsetail standard (tug) on his back
    add(new THREE.ConeGeometry(0.05, 0.3, 8), 0, 1.22, 0.12);
    add(new THREE.CylinderGeometry(0.018, 0.018, 2.2, 6), 0, 1.3, -0.22, -0.15);
    add(new THREE.ConeGeometry(0.12, 0.6, 10, 1, true), 0, 2.2, -0.3, Math.PI - 0.15);
  }
  const g = new THREE.BufferGeometry();
  let n = 0; for (const p of parts) n += p.getAttribute('position').count;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) { pos.set(p.getAttribute('position').array, o); nrm.set(p.getAttribute('normal').array, o); o += p.getAttribute('position').count * 3; }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.computeBoundingSphere();
  return g;
}

/** the rider's chest / head in world space, for the hit test the horse capsules miss (the controller's `riderTarget`) */
export function ghostRiderPoints(a: Animal, chest: THREE.Vector3, head: THREE.Vector3): void {
  const m = horseBones(a).body.matrixWorld;
  chest.copy(_p.set(0, 0.5, 0.02).add(GHOST_SEAT)).applyMatrix4(m);
  head.copy(_p.set(0, 0.9, 0.14).add(GHOST_SEAT)).applyMatrix4(m);
}

const horse = speciesDef('horse');
registerSpecies({
  kind: GHOST_RIDER,
  label: 'Ghost rider',
  fur: NO_FUR,
  aggressive: true,
  walkSpeed: HORSE_SPEED.canter,
  chargeSpeed: HORSE_SPEED.gallop,
  chargeDamage: 20,
  sounds: { call: 'horse_snort', hurt: 'horse_squeal', callEvery: [30, 70] },
  ...(horse.pose ? { pose: horse.pose } : {}),
  ...(horse.gait ? { gait: horse.gait } : {}),
  ...(horse.postPose ? { postPose: horse.postPose } : {}),
  variants: [
    { id: 'rider', label: 'Ghost rider', weight: 1, rarity: 'rare', scale: [1.0, 1.04], hp: 70, traits: { tack: 1, mane: 1.8 } },
    { id: 'captain', label: 'Qara Batyr', weight: 0, rarity: 'legendary', scale: [1.12, 1.12], hp: 800, traits: { tack: 1, mane: 2.2, stallion: 1 } },
  ],
  build: (v, rng) => horse.build(v, rng),
  think: thinkGhost,
  // arrows land in full; a blade from the ground or the saddle ×1.5 (the design's "ride them down");
  // × the named elite's window (B12: Qara Batyr's back is OPEN after a missed charge — ×3; 1 for an ordinary rider)
  damageMul: (a, hitPoint, dir) => {
    const p = a.mem['px'], q = a.mem['pz'];
    return (p !== undefined && q !== undefined && Math.hypot(hitPoint.x - p, hitPoint.z - q) < 4 ? 1.5 : 1) * eliteDamageMul(a, hitPoint, dir);
  },
  blood: false,
});
