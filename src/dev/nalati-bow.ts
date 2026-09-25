// Dev entry: the Nalati recurve bow (B2 of project/archive/2026-09-23-nalati.md) — Bow.ts + Projectiles.ts on stub targets.
// http://127.0.0.1:5188/dev/nalati-bow.html?chunk=nalati-grasslands&nolock=1&skipintro=1
// Desktop: hold LMB draw, release at full = loose, early = let-down; RMB toggles AIM (the zoom). Keys: G = hold / release
//          the draw (the FIRE disc), V = the AIM toggle (the AIM disc), X = clear stuck arrows, N = the drop arc on / off.
// Params:  ?draw=1      hold the draw from the start (full draw + the arc)
//          ?arc=1|0     the Hunter's eye setting (Settings `huntersEye`)
//          ?shots=<n>   loose n full-draw arrows at the practice butt on load (the stuck-arrow shots)
//          ?grass=1     the painterly grass carpet (on by default on the Nalati chunk)
//          ?wolves=<n>  stub animals circling ahead (arrows ride them; a kill drops them in the grass)
//          ?steady=1    AIM on (the RMB zoom toggle)
//          ?freeze=1    freeze the wind (no gusts) — for comparing arcs
// window.__world = { ...bootstrap(), bow, targets, butt, hud, audio, wind, pose } — `pose` = Bow.ts POSE, live-tunable
import * as THREE from 'three';
import { bootstrap } from '../core/bootstrap';
import { Bow, POSE, QUIVER_MAX } from '../player/Bow';
import type { TargetAnimal, TargetHit, Targets } from '../player/Crossbow';
import { heightAt } from '../world/Heightfield';
import { painterlyMaterial, paintGeometry } from '../world/painterly';
import { Grass } from '../world/Grass';
import { wind } from '../world/steppeWind';
import { HUD } from '../ui/HUD';
import { Audio } from '../audio/Audio';
import { getSetting, setSetting } from '../ui/Settings';

const world = await bootstrap();
const { game, sky, player, forest, params, num } = world;
const nalati = world.chunk.slug === 'nalati-grasslands';
const grass = params.get('grass') === '0' || (!nalati && !params.has('grass')) ? null : new Grass(sky, forest).build();
if (grass) game.scene.add(grass.group);
if (params.has('freeze')) wind.wander = false;

// ── stub animals: a body sphere + a head sphere, walking circles ahead (they carry `yaw`, so arrows ride them) ──
class StubAnimal implements TargetAnimal {
  kind = 'wolf'; alive = true; hidden = false; hp = 70; yaw = 0;
  position = new THREE.Vector3();
  readonly group = new THREE.Group();
  private readonly body: THREE.Mesh; private readonly head: THREE.Mesh;
  private deadAt = 0;
  constructor(mat: THREE.Material, private cx: number, private cz: number, private r: number, private speed: number, private phase: number) {
    this.body = new THREE.Mesh(paintGeometry(new THREE.CapsuleGeometry(0.28, 0.75, 4, 12).rotateX(Math.PI / 2), 0x8a7a66, 0.08), mat);
    this.head = new THREE.Mesh(paintGeometry(new THREE.SphereGeometry(0.17, 14, 10), 0x7a6a58, 0.08), mat);
    this.body.position.y = 0.55; this.head.position.set(0, 0.72, 0.62);
    this.body.castShadow = this.head.castShadow = true;
    this.group.add(this.body, this.head);
  }
  damageFor(headshot: boolean): number { return headshot ? 90 : 36; }
  applyDamage(amount: number): boolean {
    if (!this.alive) return false;
    this.hp -= amount;
    if (this.hp <= 0) { this.alive = false; this.deadAt = performance.now(); this.group.rotation.z = Math.PI / 2; this.group.position.y += 0.3; return true; }
    return false;
  }
  update(t: number): void {
    if (!this.alive) { if (performance.now() - this.deadAt > 8000) { this.alive = true; this.hp = 70; this.group.rotation.z = 0; } else return; }
    const a = t * this.speed / this.r + this.phase;
    const x = this.cx + Math.cos(a) * this.r, z = this.cz + Math.sin(a) * this.r;
    this.yaw = Math.atan2(-Math.sin(a) * Math.sign(this.speed), Math.cos(a) * Math.sign(this.speed));
    this.position.set(x, heightAt(x, z), z);
    this.group.position.copy(this.position); this.group.rotation.y = this.yaw;
  }
  hitSpheres(out: [THREE.Sphere, THREE.Sphere]): void {
    this.body.getWorldPosition(out[0].center); out[0].radius = 0.42;
    this.head.getWorldPosition(out[1].center); out[1].radius = 0.2;
  }
}
const _ray = new THREE.Ray(), _pt = new THREE.Vector3(), _spheres: [THREE.Sphere, THREE.Sphere] = [new THREE.Sphere(), new THREE.Sphere()];
class StubTargets implements Targets {
  list: StubAnimal[] = [];
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): TargetHit | null {
    _ray.set(origin, dir);
    let best: TargetHit | null = null;
    for (const a of this.list) {
      if (!a.alive) continue;
      a.hitSpheres(_spheres);
      _spheres.forEach((s, i) => {
        if (!_ray.intersectSphere(s, _pt)) return;
        const d = origin.distanceTo(_pt);
        if (d <= maxDist && (!best || d < best.distance)) best = { animal: a, point: _pt.clone(), distance: d, headshot: i === 1 };
      });
    }
    return best;
  }
}

// ── the practice butt: a straw boss on a wooden A-frame, 22 m ahead, with a collider so arrows stick in it ──
const yaw = player.yaw;
const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
const mat = painterlyMaterial(sky, { rim: 0.4 });
const buttDist = num('butt', 22);
const bx = player.position.x + fx * buttDist, bz = player.position.z + fz * buttDist, by = heightAt(bx, bz);
const butt = new THREE.Group();
{
  const straw = new THREE.CylinderGeometry(0.62, 0.62, 0.34, 28, 1); straw.rotateX(Math.PI / 2);
  const rings: THREE.BufferGeometry[] = [paintGeometry(straw, 0xd9bf7a, 0.12, 3)];
  const faces: [number, number, number][] = [[0.6, 0xf2ead8, 0.001], [0.46, 0x2d4f7a, 0.002], [0.32, 0xb8322a, 0.003], [0.16, 0xe8c24a, 0.004]];
  for (const [r, c, dz] of faces) { const g = new THREE.CircleGeometry(r, 28); g.translate(0, 0, 0.171 + dz); rings.push(paintGeometry(g, c, 0.04, 5)); }
  const face = new THREE.Mesh(mergeAll(rings), mat); face.position.y = 1.15; face.rotation.x = -0.12; face.castShadow = true;
  const legs: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) { const g = new THREE.BoxGeometry(0.07, 1.6, 0.07); g.rotateZ(s * 0.2); g.translate(s * 0.45, 0.78, -0.22); legs.push(paintGeometry(g, 0x6a4a2c, 0.1, 9)); }
  const back = new THREE.BoxGeometry(0.07, 1.5, 0.07); back.rotateX(-0.5); back.translate(0, 0.72, -0.6); legs.push(paintGeometry(back, 0x5a3e24, 0.1, 10));
  const frame = new THREE.Mesh(mergeAll(legs), mat); frame.castShadow = true;
  butt.add(face, frame);
  butt.position.set(bx, by, bz); butt.rotation.y = yaw;
  game.scene.add(butt);
  // the straw boss as an oriented box (Player.ts collider): arrows stick in it, the player can't walk through it
  player.colliders.push({ x: bx, z: bz, hw: 0.6, hd: 0.17, rot: -yaw, yTop: by + 1.78, yBottom: by + 0.52 });
}
function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const clean = parts.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') n.deleteAttribute(k); return n; });
  const out = new THREE.BufferGeometry();
  for (const key of ['position', 'normal', 'color'] as const) {
    const arrs = clean.map((g) => g.getAttribute(key).array);
    const total = arrs.reduce((s, a) => s + a.length, 0), buf = new Float32Array(total);
    let o = 0; for (const a of arrs) { buf.set(a, o); o += a.length; }
    out.setAttribute(key, new THREE.BufferAttribute(buf, 3));
  }
  return out;
}

const targets = new StubTargets();
const nWolves = Math.round(num('wolves', 2));
for (let i = 0; i < nWolves; i++) {
  const a = new StubAnimal(mat, player.position.x + fx * (34 + i * 10) + rx * (i % 2 ? 6 : -6), player.position.z + fz * (34 + i * 10) + rz * (i % 2 ? 6 : -6), 5 + i * 2, (i % 2 ? -1 : 1) * 2.2, i * 1.3);
  targets.list.push(a); game.scene.add(a.group);
}

// ── the bow ──
const nolock = params.has('nolock');
const bow = new Bow({ game, sky, player, forest }, targets, { allowUnlocked: nolock });
bow.wind = wind;
bow.altHeld = params.has('draw');
bow.inspect = Math.round(num('inspect', 0)); bow.inspectYaw = num('iyaw', 0.6); bow.inspectPitch = num('ipitch', 0);
const hud = new HUD({ pointerLock: !nolock });
const audio = new Audio();
let kills = 0;
bow.onFire = () => audio.crossbowFire();
bow.onDry = () => audio.dryFire();
bow.onImpact = (surface, point) => {
  const dx = point.x - player.position.x, dz = point.z - player.position.z, d = Math.hypot(dx, dz);
  audio.boltImpact(surface, d > 1 ? ((dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw)) / d) * 0.7 : 0, 1 / (1 + d / 12));
};
bow.onHit = (kind, headshot, killed) => { hud.showHitMarker(headshot, killed); audio.hitMarker(); if (killed) { kills++; audio.kill(); hud.killFeed(`${kind} ${headshot ? 'headshot' : 'down'}`); } };
bow.onRecover = (ok) => { hud.toast(ok ? 'Arrow recovered' : 'Arrow broke'); if (ok) audio.hitMarker(); };

const enter = () => { audio.resume(); bow.enabled = true; if (!nolock) player.lock(); };
hud.onResume = enter;
if (params.has('skipintro')) { hud.markEntered(); if (!nolock) bow.enabled = false; }
else { bow.enabled = false; hud.showIntro(enter, { Targets: 'straw butt + stub wolves' }); }
document.addEventListener('keydown', (e) => {
  audio.resume();
  if (e.code === 'KeyG') bow.altHeld = !bow.altHeld;
  if (e.code === 'KeyV') bow.adsHeld = !bow.adsHeld;
  if (e.code === 'KeyX') bow.arrows.clearStuck();
  if (e.code === 'KeyN') setSetting('huntersEye', !getSetting('huntersEye'));
});
if (params.has('steady')) bow.adsHeld = true;

// ?shots=n: n full-draw arrows at the butt's gold, one every 1.4 s, then back to rest
const shots = Math.round(num('shots', 0));
let shotT = 0, shotsLeft = shots;
if (shots > 0) { bow.altHeld = true; player.yaw = yaw; }

game.onUpdate((dt, t) => {
  if (!grass) wind.update(dt);
  else grass.update(dt, player.position);
  for (const a of targets.list) a.update(t);
  if (shotsLeft > 0) {
    shotT += dt;
    // hold to full, release (the loose), press again on the next frame
    if (!bow.altHeld && shotsLeft > 0) bow.altHeld = true;
    else if (shotT > 1.4 && bow.fullDraw) { bow.altHeld = false; shotT = 0; shotsLeft--; if (shotsLeft === 0) setTimeout(() => { bow.altHeld = params.has('draw'); }, 50); }
  }
  bow.update(dt, t);
  audio.listenerYaw = player.yaw;
  hud.setAimInfo(bow.aimInfo);
  hud.setState({
    bolts: bow.state.bolts, loaded: bow.state.loaded, reloading: bow.state.reloading, reloadProgress: bow.state.reloadProgress,
    maxBolts: QUIVER_MAX, ammoLabel: 'Arrows', weaponName: 'Bow', segments: 4,
    health: 100, pos: { x: player.position.x, z: player.position.z }, yaw: player.yaw, kills, speed: player.speedFactor, ads: bow.state.ads,
  });
});
game.buildComposer();
game.start();
(window as unknown as { __world: unknown }).__world = { ...world, bow, targets, butt, hud, audio, wind, grass, pose: POSE };
