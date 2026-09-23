/**
 * Castaway — Wendell, the marooned sailor who gives Driftwood Isle's quest (A1, D5). Built with the low-poly kit
 * (src/world/lowpolyKit.ts: LowPolyKit + the shared lowPolyMaterial): a lanky old salt in a torn blue-and-white striped
 * shirt, rolled canvas trousers, bare feet, a rope belt, a frayed straw hat over a big grey beard, leaning on a
 * driftwood staff — and his campfire beside him (stone ring, logs, flames, a smoke column you can see from the pier:
 * the breadcrumb the intro objective points at).
 *
 *   const npc = new Castaway(sky, { x, y, z, yaw }, { x, y, z }).build();   // his feet; the fire's centre
 *   scene.add(npc.group);  player.colliders.push(npc.collider);
 *   game.onUpdate((dt, t) => npc.update(dt, t, player.position));
 *   npc.talking = true    // gestures with the free arm while the dialogue is open
 *   npc.wave()            // a big overhead wave (the first time you come near)
 *   npc.headWorld(v)      // where the "[E] Talk" prompt sits
 *
 * Draw calls: body + campfire (one merged mesh, the only shadow caster), head, waving arm (each its own pivot), flames
 * (unlit), smoke (Points); past 85 m only the smoke. The smoke is a thin, broken wisp: each puff grows as it climbs,
 * fades in over the fire and out toward the top (per-puff size + alpha on the points shader), wanders on its own
 * turbulence and leans downwind — so from the pier it reads as smoke, not a straight bright streak.
 * No lights; the flames are unlit colour that blooms.
 */
import * as THREE from 'three';
import { LowPolyKit, log, rock, plank, lowPolyMaterial } from '../../world/lowpolyKit';
import type { Sky } from '../../world/Sky';
import type { Collider } from '../../player/Player';
import { attachFogUniforms } from '../../world/Atmosphere';

const C = {
  skin: '#c98d62', skinDark: '#a8704a', beard: '#cfcac0', beardDark: '#a9a39a', hat: '#d8b867', hatDark: '#b8964a', band: '#7a3b2a',
  shirt: '#e9e3d4', stripe: '#3d6fae', trousers: '#b59f77', trousersDark: '#8f7b58', rope: '#b9a57a', staff: '#9a7b58',
  eye: '#1d1a18', stone: '#7d7f84', stoneDark: '#5d5f64', log: '#6a4a2e', char: '#2a2320', ember: '#ff7a2a', flame: '#ffc15a', core: '#fff0b0',
};

const M = new THREE.Matrix4();
const at = (x: number, y: number, z: number, ry = 0, rx = 0, rz = 0, s: [number, number, number] = [1, 1, 1]): THREE.Matrix4 =>
  M.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(...s));
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const NECK = 1.52, SHOULDER = V(-0.21, 1.4, 0);   // right shoulder (the model faces +Z; its right is −X)
const SMOKE = 42;
const SMOKE_RISE = 21, SMOKE_LIFE = 13;   // metres the column climbs, seconds a puff lives
const WIND_X = 0.8, WIND_Z = 0.55;         // the lean (NPC-local; the trade wind off the sea)
const NEAR_R = 85;

export interface Pos { x: number; y: number; z: number; yaw?: number }

export class Castaway {
  readonly group = new THREE.Group();
  readonly collider: Collider;
  talking = false;
  private body!: THREE.Mesh;
  private head!: THREE.Mesh;
  private arm!: THREE.Mesh;
  private flames!: THREE.Mesh;
  private smoke!: THREE.Points;
  private smokeMat!: THREE.PointsMaterial;
  private sPos = new Float32Array(SMOKE * 3);
  private sAge = new Float32Array(SMOKE);
  private sRate = new Float32Array(SMOKE);   // per-puff life speed (0.85–1.15): uneven spacing = a broken column
  private sSeed = new Float32Array(SMOKE);
  private sSize = new Float32Array(SMOKE);
  private sAlpha = new Float32Array(SMOKE);
  private sAttr!: THREE.BufferAttribute;
  private sSizeAttr!: THREE.BufferAttribute;
  private sAlphaAttr!: THREE.BufferAttribute;
  private headYaw = 0; private headPitch = 0; private readonly bodyYaw: number;
  private waveT = -1;
  private glanceT = 0; private glanceYaw = 0;
  private fireLocal: THREE.Vector3;

  constructor(private sky: Sky, private feet: Pos, fire: Pos) {
    this.bodyYaw = feet.yaw ?? 0;
    // the fire in the NPC's frame (the group is placed at his feet, rotated with him)
    const dx = fire.x - feet.x, dz = fire.z - feet.z, c = Math.cos(-this.bodyYaw), s = Math.sin(-this.bodyYaw);
    this.fireLocal = V(dx * c + dz * s, fire.y - feet.y, -dx * s + dz * c);
    this.collider = { x: feet.x, z: feet.z, hw: 0.28, hd: 0.28, rot: 0, yTop: feet.y + 1.8, yBottom: feet.y - 0.3 };
  }

  build(): this {
    const mat = lowPolyMaterial(this.sky);
    this.group.position.set(this.feet.x, this.feet.y, this.feet.z);
    this.group.rotation.y = this.bodyYaw;
    this.group.name = 'castaway';

    // ── body + the campfire (one mesh) ──
    const k = new LowPolyKit(0xca57a);
    for (const sx of [-1, 1]) {
      // bare feet, shins, rolled trouser cuffs, thighs
      k.add(new THREE.BoxGeometry(0.11, 0.07, 0.24), C.skin, { matrix: at(sx * 0.1, 0.035, 0.04), wobble: 0.01 });
      k.add(log(V(sx * 0.1, 0.06, 0), V(sx * 0.1, 0.42, 0.01), 0.05, 0.055, 6), C.skin);
      k.add(log(V(sx * 0.1, 0.4, 0.01), V(sx * 0.1, 0.5, 0.01), 0.085, 0.085, 7), C.trousersDark);
      k.add(log(V(sx * 0.1, 0.48, 0.01), V(sx * 0.11, 0.98, 0), 0.075, 0.095, 7), C.trousers);
    }
    k.add(log(V(0, 0.9, 0), V(0, 1.02, 0), 0.19, 0.19, 8), C.trousers);
    k.add(new THREE.TorusGeometry(0.19, 0.022, 4, 10).rotateX(Math.PI / 2), C.rope, { matrix: at(0, 1.02, 0) });
    k.add(log(V(0.12, 1.0, 0.17), V(0.14, 0.86, 0.19), 0.018, 0.012, 4), C.rope);  // the knot's tail
    // the shirt: stacked stripe bands, a little barrel-chested, a torn hem
    for (let i = 0; i < 6; i++) {
      const y0 = 1.02 + i * 0.075, r0 = 0.19 + Math.sin((i / 6) * Math.PI) * 0.035, r1 = 0.19 + Math.sin(((i + 1) / 6) * Math.PI) * 0.035;
      k.add(log(V(0, y0, 0), V(0, y0 + 0.075, 0), r0, i === 5 ? 0.15 : r1, 8), i % 2 ? C.stripe : C.shirt, { matrix: at(0, 0, 0, 0, 0, 0, [1, 1, 0.72]), jitter: 0.04 });
    }
    k.add(log(V(0, 1.47, 0), V(0, 1.55, 0.01), 0.07, 0.06, 6), C.skin);   // the neck
    // the left arm hangs, hand on the staff
    k.add(log(V(0.21, 1.42, 0), V(0.25, 1.15, 0.05), 0.058, 0.05, 6), C.shirt);
    k.add(log(V(0.25, 1.15, 0.05), V(0.27, 0.93, 0.14), 0.045, 0.04, 6), C.skin);
    k.add(new THREE.IcosahedronGeometry(0.05, 0), C.skin, { matrix: at(0.27, 0.9, 0.16) });
    k.add(log(V(0.3, 0, 0.2), V(0.26, 1.35, 0.14), 0.03, 0.028, 5, 0.3), C.staff, { wobble: 0.008 });
    k.add(rock(0.06, 0, k.rng, 1, 0.3), C.staff, { matrix: at(0.26, 1.37, 0.14) });
    // the campfire (fire-local): a ring of stones, crossed logs, char
    const f = this.fireLocal;
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; k.add(rock(0.16, 0, k.rng, 0.7, 0.3), i % 2 ? C.stone : C.stoneDark, { matrix: at(f.x + Math.cos(a) * 0.55, f.y + 0.06, f.z + Math.sin(a) * 0.55) }); }
    k.add(new THREE.CylinderGeometry(0.42, 0.45, 0.04, 9), C.char, { matrix: at(f.x, f.y + 0.02, f.z) });
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI + 0.3; k.add(log(V(f.x + Math.cos(a) * 0.42, f.y + 0.05, f.z + Math.sin(a) * 0.42), V(f.x - Math.cos(a) * 0.1, f.y + 0.3, f.z - Math.sin(a) * 0.1), 0.05, 0.04, 5), C.log); }
    // a log seat and a stick propped over the fire
    k.add(log(V(f.x - 1.1, f.y + 0.16, f.z + 0.6), V(f.x - 1.1, f.y + 0.16, f.z - 0.7), 0.17, 0.16, 7), C.log);
    k.add(plank(0.9, 0.05, 0.03, k.rng), C.staff, { matrix: at(f.x + 0.3, f.y + 0.4, f.z - 0.35, 0.6, 0, 0.5) });
    this.body = new THREE.Mesh(k.finish({ ao: { floorY: 0, strength: 0.45 } }), mat);
    this.body.castShadow = true; this.body.receiveShadow = true;

    // ── head (pivot at the neck): face, nose, eyes, the beard, the straw hat ──
    const h = new LowPolyKit(0xca57b);
    h.add(new THREE.IcosahedronGeometry(0.115, 1), C.skin, { matrix: at(0, 0.11, 0, 0, 0, 0, [0.92, 1.05, 0.95]), wobble: 0.006 });
    h.add(new THREE.ConeGeometry(0.03, 0.07, 4).rotateX(Math.PI / 2), C.skinDark, { matrix: at(0, 0.1, 0.12) });
    for (const sx of [-1, 1]) h.add(new THREE.BoxGeometry(0.028, 0.02, 0.01), C.eye, { matrix: at(sx * 0.042, 0.135, 0.108) });
    for (const sx of [-1, 1]) h.add(new THREE.BoxGeometry(0.05, 0.016, 0.02), C.beardDark, { matrix: at(sx * 0.042, 0.162, 0.105, 0, 0, sx * 0.15) });  // bushy brows
    const beard = new THREE.ConeGeometry(0.1, 0.26, 7);
    beard.rotateX(Math.PI);
    h.add(beard, C.beard, { matrix: at(0, -0.06, 0.075, 0, -0.3), wobble: 0.012, jitter: 0.12 });   // hangs from the jaw, the face stays clear
    h.add(new THREE.BoxGeometry(0.16, 0.035, 0.03), C.beard, { matrix: at(0, 0.075, 0.115) });   // moustache
    h.add(new THREE.CylinderGeometry(0.3, 0.32, 0.025, 10), C.hat, { matrix: at(0, 0.2, 0, 0, 0.08), wobble: 0.02, jitter: 0.1 });  // the brim, tipped back
    h.add(new THREE.CylinderGeometry(0.1, 0.13, 0.13, 8), C.hatDark, { matrix: at(0, 0.27, -0.01, 0, 0.08), wobble: 0.01 });
    h.add(new THREE.CylinderGeometry(0.132, 0.132, 0.03, 8), C.band, { matrix: at(0, 0.225, -0.005, 0, 0.08) });
    this.head = new THREE.Mesh(h.finish({ ao: false }), mat);
    this.head.position.set(0, NECK, 0.01);

    // ── the right arm (pivot at the shoulder, hanging along −Y) ──
    const a = new LowPolyKit(0xca57c);
    a.add(log(V(0, 0, 0), V(-0.03, -0.27, 0.02), 0.058, 0.05, 6), C.shirt);
    a.add(log(V(-0.03, -0.27, 0.02), V(-0.04, -0.5, 0.04), 0.045, 0.04, 6), C.skin);
    a.add(new THREE.IcosahedronGeometry(0.05, 0), C.skin, { matrix: at(-0.04, -0.55, 0.04) });
    this.arm = new THREE.Mesh(a.finish({ ao: false }), mat);
    this.arm.position.copy(SHOULDER);

    // ── flames (unlit, bloom) ──
    const fl = new LowPolyKit(0xca57d);
    fl.add(new THREE.ConeGeometry(0.26, 0.7, 6), C.ember, { matrix: at(0, 0.35, 0), wobble: 0.03, jitter: 0.12 });
    fl.add(new THREE.ConeGeometry(0.15, 0.55, 5), C.flame, { matrix: at(0.08, 0.3, 0.04, 0.4), wobble: 0.02 });
    fl.add(new THREE.ConeGeometry(0.13, 0.5, 5), C.flame, { matrix: at(-0.09, 0.27, -0.05, 1.2), wobble: 0.02 });
    fl.add(new THREE.ConeGeometry(0.08, 0.6, 5), C.core, { matrix: at(0, 0.32, 0), wobble: 0.01 });
    const flameMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.8, 1.8, 1.8) });
    flameMat.name = 'castaway-flame';
    this.flames = new THREE.Mesh(fl.finish({ ao: false }), flameMat);
    this.flames.position.set(f.x, f.y + 0.08, f.z);

    // ── smoke: one Points cloud rising off the fire, drifting a little downwind ──
    const g = new THREE.BufferGeometry();
    this.sAttr = new THREE.BufferAttribute(this.sPos, 3); this.sAttr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.sAttr);
    this.sSizeAttr = new THREE.BufferAttribute(this.sSize, 1); this.sSizeAttr.setUsage(THREE.DynamicDrawUsage);
    this.sAlphaAttr = new THREE.BufferAttribute(this.sAlpha, 1); this.sAlphaAttr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aSize', this.sSizeAttr); g.setAttribute('aAlpha', this.sAlphaAttr);
    g.boundingSphere = new THREE.Sphere(V(f.x + 2, f.y + 9, f.z + 1.5), 14);
    let hs = 0x5e0c;
    const rnd = () => { hs = (Math.imul(hs, 1103515245) + 12345) & 0x7fffffff; return hs / 0x7fffffff; };
    for (let i = 0; i < SMOKE; i++) { this.sAge[i] = rnd(); this.sRate[i] = 0.85 + rnd() * 0.3; this.sSeed[i] = rnd() * 10; this.placeSmoke(i); }
    const smokeMat = this.smokeMat = new THREE.PointsMaterial({ color: new THREE.Color(0.8, 0.79, 0.77), size: 1, sizeAttenuation: true, transparent: true, opacity: 0.42, depthWrite: false, map: puffTexture(), fog: true });
    smokeMat.name = 'castaway-smoke';
    // per-puff size + alpha: the stock points shader with two attributes spliced in
    smokeMat.onBeforeCompile = (sh) => {
      attachFogUniforms(sh);
      sh.vertexShader = sh.vertexShader
        .replace('uniform float size;', 'uniform float size;\nattribute float aSize;\nattribute float aAlpha;\nvarying float vAlpha;')
        .replace('gl_PointSize = size;', 'gl_PointSize = size * aSize;\n\tvAlpha = aAlpha;');
      sh.fragmentShader = sh.fragmentShader
        .replace('uniform float opacity;', 'uniform float opacity;\nvarying float vAlpha;')
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse, opacity * vAlpha );');
    };
    smokeMat.customProgramCacheKey = () => 'castaway-smoke-v2';
    this.smoke = new THREE.Points(g, smokeMat);
    this.smoke.renderOrder = 4;

    this.group.add(this.body, this.head, this.arm, this.flames, this.smoke);
    return this;
  }

  /** the head's world position (the talk prompt / the name tag) */
  headWorld(out: THREE.Vector3): THREE.Vector3 { return out.set(0, NECK + 0.15, 0).applyMatrix4(this.group.matrixWorld); }
  get position(): THREE.Vector3 { return this.group.position; }

  wave(): void { if (this.waveT < 0) this.waveT = 0; }

  private placeSmoke(i: number): void {
    const age = this.sAge[i] ?? 0, sd = this.sSeed[i] ?? 0, f = this.fireLocal, j = i * 3;
    // rise slows as it cools; the lean grows with height; each puff wanders on its own slow turbulence
    const rise = SMOKE_RISE * (1 - (1 - age) * (1 - age)) * 0.9 + age * SMOKE_RISE * 0.1, lean = age * age * 5;
    const tx = Math.sin(age * 8 + sd * 5) * (0.2 + age * 1.1), tz = Math.cos(age * 6.3 + sd * 3) * (0.2 + age * 0.9);
    this.sPos[j] = f.x + WIND_X * lean + tx;
    this.sPos[j + 1] = f.y + 1.2 + rise;
    this.sPos[j + 2] = f.z + WIND_Z * lean + tz;
    // thin at the fire, spreading as it climbs; in over the first metre, out long before the top; some puffs thinner (broken)
    this.sSize[i] = 0.9 + age * 4.4;
    const thin = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(sd * 7.7));
    this.sAlpha[i] = Math.min(1, age / 0.08) * Math.min(1, (1 - age) / 0.45) ** 1.3 * thin;   // full body over the hut, thinning out over the top ~40 %
  }

  update(dt: number, t: number, player: THREE.Vector3): void {
    const gp = this.group.position;
    const dx = player.x - gp.x, dz = player.z - gp.z, d = Math.hypot(dx, dz);
    // past NEAR_R only the smoke column is drawn (the breadcrumb from the pier): the man and his fire are a few pixels there
    const near = d < NEAR_R;
    if (near !== this.body.visible) { this.body.visible = this.head.visible = this.arm.visible = this.flames.visible = near; }
    // the head turns toward you whenever you are near (the body stays put: it carries the campfire in one mesh)
    const toYou = Math.atan2(dx, dz);
    let wantYaw: number, wantPitch: number;
    if (d < 9) {
      wantYaw = THREE.MathUtils.clamp(wrap(toYou - this.bodyYaw), -1.1, 1.1);
      wantPitch = THREE.MathUtils.clamp(-Math.atan2(player.y + 1.6 - (gp.y + NECK + 0.1), Math.max(0.5, d)), -0.4, 0.4);
    } else {
      // idle: glance at the fire, the sea, the fire again
      this.glanceT -= dt;
      if (this.glanceT <= 0) { this.glanceT = 2.5 + (Math.sin(t * 1.7) + 1) * 2; this.glanceYaw = Math.sin(t * 0.37) * 0.8; }
      wantYaw = this.glanceYaw; wantPitch = 0.15;
    }
    this.headYaw += (wantYaw - this.headYaw) * Math.min(1, dt * 5);
    this.headPitch += (wantPitch - this.headPitch) * Math.min(1, dt * 5);
    const breathe = Math.sin(t * 1.6);
    this.head.rotation.set(this.headPitch + breathe * 0.02, this.headYaw, Math.sin(t * 0.5) * 0.05);
    this.head.position.y = NECK + breathe * 0.006;
    this.body.scale.set(1, 1 + breathe * 0.006, 1);
    // the arm: hangs and sways; a wave is a big overhead arc for 2.2 s
    if (this.waveT >= 0) {
      this.waveT += dt;
      const up = Math.min(1, this.waveT * 4) * Math.min(1, Math.max(0, (2.2 - this.waveT) * 4));
      this.arm.rotation.set(0, 0, -2.6 * up + Math.sin(this.waveT * 12) * 0.35 * up);
      if (this.waveT > 2.2) this.waveT = -1;
    } else {
      this.arm.rotation.set(Math.sin(t * 1.1) * 0.05, 0, 0.08 + (this.talking ? Math.max(0, Math.sin(t * 2.3)) * 0.35 : 0));
    }
    // flames flicker; smoke rises (only near enough to see it: 260 m covers the whole island)
    const fl = 1 + Math.sin(t * 13) * 0.1 + Math.sin(t * 31 + 2) * 0.06;
    this.flames.scale.set(1 + Math.sin(t * 17) * 0.05, fl, 1 + Math.cos(t * 19) * 0.05);
    this.flames.rotation.y = t * 0.6;
    // the column is the far breadcrumb; up close it thins out so it never fogs the view
    this.smokeMat.opacity = 0.12 + 0.46 * THREE.MathUtils.smoothstep(d, 8, 30);
    if (d > 260) return;
    for (let i = 0; i < SMOKE; i++) { let a = (this.sAge[i] ?? 0) + (dt / SMOKE_LIFE) * (this.sRate[i] ?? 1); if (a > 1) { a -= 1; this.sSeed[i] = (this.sSeed[i] ?? 0) + 1.37; } this.sAge[i] = a; this.placeSmoke(i); }
    this.sAttr.needsUpdate = true; this.sSizeAttr.needsUpdate = true; this.sAlphaAttr.needsUpdate = true;
  }
}

function wrap(a: number): number { return Math.atan2(Math.sin(a), Math.cos(a)); }

let puff: THREE.CanvasTexture | null = null;
function puffTexture(): THREE.CanvasTexture {
  if (puff) return puff;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  if (g === null) throw new Error('Castaway: no 2d context');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  puff = new THREE.CanvasTexture(c);
  return puff;
}
