import { rainCurtain } from '@wildshard/game/systems/looks/rainCurtain';
import { RAIN_PROGRAM } from './rainProgram';
/**
 * WeatherFX — what the steppe storm looks like (Nalati B10): the storm deck and its shelf cloud rolling in from one
 * horizon, rain curtains hanging off it over the far hills, the rain itself around the camera, lightning (the bolt,
 * the violet telegraph glow on the target, the in-cloud flash), the struck tree smoking, puddles on the trails and
 * the rainbow after. Everything reads `Weather` + the current `SkyLook`; nothing here decides anything.
 *
 *   const fx = new WeatherFX(scene, { tier }).build();
 *   fx.update(dt, weather, look, camera)          // every frame (hidden meshes cost nothing while it is clear)
 *   fx.telegraph(strike)                          // Weather.onTelegraph
 *   fx.bolt(strike)                               // Weather.onStrike
 *   fx.inCloudFlash(bearing)                      // Weather.onFlash for flashes with no bolt
 *
 * The deck, the curtains, the bolt, the smoke and the puddles wear the look.materials graphs `nalati-storm-deck`,
 * `nalati-storm-curtains`, `nalati-lightning-bolt`, `nalati-strike-smoke` and `nalati-puddles` (data/lookGraphs.json,
 * lent by runtime/index.ts); this module builds their geometry and writes their params each frame.
 *
 * Draw cost while clear: 0 (every mesh hidden). In the storm: the deck dome + curtain cylinder + rain + puddles
 * (+ the bolt for 0.35 s, the smoke plume after a tree strike) — 4–6 draws, ~10 k triangles, all unlit.
 *
 * Layering: the deck is a dome at 2350 m drawn after the painted clouds and the planet (renderOrder −9: it covers
 * both when the storm is overhead); the curtains + rainbow are a cylinder at 1150 m, in front of the far ranges and
 * behind the near ring and the terrain (depth-tested).
 */
import * as THREE from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import { trailDistance, inChunk } from '@wildshard/engine/world/Heightfield';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { lentLook, setLentParam, setLentTexture } from '@wildshard/sdk/looks/lentLooks';
import type { Lightning as Weather, Strike } from './Lightning';
import type { SkyLook } from '../look/skyRig';

export interface WeatherFXOpts { phone: boolean; seed: number }

/** inside the near horizon ring (800 m): the storm veils the mountains; the slab itself is nearer than this */
const DECK_R = 770;
const CURTAIN_R = 745;
const BOLT_SEGS = 220;
const PUDDLES = 110;
const DECK = 'nalati-storm-deck', CURTAINS = 'nalati-storm-curtains', BOLT = 'nalati-lightning-bolt', SMOKE = 'nalati-strike-smoke', PUDDLE = 'nalati-puddles';

const rgb = (c: THREE.Color, k = 1): number[] => [c.r * k, c.g * k, c.b * k];

/** a soft radial sprite (the telegraph glow, the fire at a struck tree) */
function glowTexture(inner: string, outer: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  if (!g) throw new Error('[weather] no 2d canvas');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner); grad.addColorStop(0.35, outer); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** tileable value noise (5 octaves, lattice 4 → 64 cells across) for the deck / curtains — 128², built once */
function noiseTexture(seed: number): THREE.DataTexture {
  const N = 128;
  const hash = (x: number, y: number, o: number): number => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(o + seed, 2147483647)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0, amp = 0.5, norm = 0;
    for (let o = 0; o < 5; o++) {
      const L = 4 << o, fx = (x / N) * L, fy = (y / N) * L;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const x1 = (x0 + 1) % L, y1 = (y0 + 1) % L;
      const a = hash(x0, y0, o), b = hash(x1, y0, o), c = hash(x0, y1, o), d = hash(x1, y1, o);
      v += (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy) * amp; norm += amp; amp *= 0.5;
    }
    const i = (y * N + x) * 4, b8 = Math.round((v / norm) * 255);
    data[i] = data[i + 1] = data[i + 2] = b8; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export class WeatherFX {
  readonly group = new THREE.Group();
  deck!: THREE.Mesh;
  curtains!: THREE.Mesh;
  rain!: THREE.Mesh;
  boltMesh!: THREE.Mesh;
  glow!: THREE.Sprite;
  smoke!: THREE.Points;
  fire!: THREE.Sprite;
  puddles!: THREE.InstancedMesh;

  private readonly rainU = {
    uOffset: { value: new THREE.Vector3() }, uR: { value: 16 }, uVel: { value: new THREE.Vector3(0, -9, 0) }, uLen: { value: 0.9 },
    uCol: { value: new THREE.Color(0.6, 0.65, 0.75) }, uAlpha: { value: 0.3 }, uWidth: { value: 0.013 },
  };

  private rainCount: number;
  private boltT = 99;
  private glowT = 99;
  private readonly boltA: Float32Array;
  private readonly boltB: Float32Array;
  private readonly boltW: Float32Array;
  private boltSegs = 0;
  private readonly rng: Rng;
  private readonly flashDir = new THREE.Vector3(1, 0.2, 0);
  private smokeLeft = 0;
  private smokeT = 0;

  constructor(private opts: WeatherFXOpts) {
    this.rng = new Rng(opts.seed ^ 0xb017);
    this.rainCount = opts.phone ? 3500 : 6000;
    this.boltA = new Float32Array(BOLT_SEGS * 4 * 3);
    this.boltB = new Float32Array(BOLT_SEGS * 4 * 3);
    this.boltW = new Float32Array(BOLT_SEGS * 4);
  }

  build(): this {
    const noise = noiseTexture(this.opts.seed ^ 0x51);
    setLentTexture(DECK, 'tNoise', noise); setLentTexture(CURTAINS, 'tNoise', noise);
    // the deck: a dome round the camera; the curtains: from under the horizon (the far hills stand in it) up to ~12°
    this.deck = this.mesh(new THREE.SphereGeometry(DECK_R, 48, 20, 0, Math.PI * 2, 0, Math.PI * 0.56), DECK, -9, 'storm-deck');
    this.curtains = this.mesh(new THREE.CylinderGeometry(CURTAIN_R, CURTAIN_R, 330, 64, 1, true).translate(0, 330 / 2 - 170, 0), CURTAINS, -8, 'storm-curtains');
    this.rain = rainCurtain({ count: this.rainCount, seed: this.opts.seed, uniforms: this.rainU, program: RAIN_PROGRAM });
    this.boltMesh = this.mesh(this.boltGeometry(), BOLT, 15, 'lightning-bolt');
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(235,215,255,1)', 'rgba(150,90,255,0.45)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
    this.glow.visible = false; this.glow.renderOrder = 12;
    this.fire = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,210,120,1)', 'rgba(255,90,20,0.5)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.fire.visible = false; this.fire.renderOrder = 11;
    this.smoke = this.buildSmoke();
    this.puddles = this.buildPuddles();
    this.group.add(this.deck, this.curtains, this.rain, this.boltMesh, this.glow, this.fire, this.smoke, this.puddles);
    this.group.name = 'weather-fx';
    return this;
  }

  private mesh(geo: THREE.BufferGeometry, look: string, order: number, name: string): THREE.Mesh {
    const m = new THREE.Mesh(geo, lentLook(look));
    m.frustumCulled = false; m.renderOrder = order; m.visible = false; m.name = name;
    return m;
  }

  /** the bolt's segments: four corners each (aCorner: side ±1, start 0 / end 1), the endpoints written per strike */
  private boltGeometry(): THREE.BufferGeometry {
    const n = BOLT_SEGS, corner = new Float32Array(n * 4 * 2), idx = new Uint16Array(n * 6);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 4; k++) { const v = i * 4 + k; corner[v * 2] = k & 1 ? 1 : -1; corner[v * 2 + 1] = k < 2 ? 0 : 1; }
      const b = i * 4; idx.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.boltA, 3));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(this.boltB, 3));
    geo.setAttribute('aW', new THREE.BufferAttribute(this.boltW, 1));
    geo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    return geo;
  }

  /** smoke off a struck tree: 28 points rising from `origin` (aSeed: phase, spread x / z, rate) */
  private buildSmoke(): THREE.Points {
    const n = 28, rng = new Rng(this.opts.seed ^ 0x5e0);
    const seed = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { seed[i * 4] = i / n; seed[i * 4 + 1] = rng.range(-1, 1); seed[i * 4 + 2] = rng.range(-1, 1); seed[i * 4 + 3] = rng.range(0.7, 1.3); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const p = new THREE.Points(geo, lentLook(SMOKE));
    p.frustumCulled = false; p.visible = false; p.renderOrder = 9; p.name = 'lightning-smoke';
    return p;
  }

  /** puddles on the trails: low spots on or beside a track, a few cm under their neighbours */
  private buildPuddles(): THREE.InstancedMesh {
    const rng = new Rng(this.opts.seed ^ 0x9dd1);
    const spots: { x: number; z: number; y: number; r: number }[] = [];
    for (let tries = 0; tries < 12000 && spots.length < PUDDLES; tries++) {
      const x = rng.range(-240, 240), z = rng.range(-240, 240);
      if (!inChunk(x, z, 6) || trailDistance(x, z) > 2.2) continue;
      const h = heightAt(x, z);
      const m = (heightAt(x + 2, z) + heightAt(x - 2, z) + heightAt(x, z + 2) + heightAt(x, z - 2)) / 4;
      if (h - m > -0.004 && rng.next() > 0.12) continue; // mostly concave spots, a few anywhere on the track
      if (spots.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < 36)) continue;
      spots.push({ x, z, y: h, r: rng.range(0.6, 1.7) });
    }
    const mesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), lentLook(PUDDLE), Math.max(1, spots.length));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    spots.forEach((sp, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.range(0, Math.PI * 2));
      s.set(sp.r * rng.range(1, 1.8), 1, sp.r);
      p.set(sp.x, sp.y + 0.03, sp.z);
      mesh.setMatrixAt(i, m4.compose(p, q, s));
    });
    mesh.count = spots.length;
    mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 2; mesh.name = 'puddles';
    return mesh;
  }

  // ─────────────────────────────── events ───────────────────────────────
  telegraph(s: Strike): void {
    this.glow.position.set(s.x, s.y + 0.4, s.z);
    this.glow.visible = true;
    this.glowT = 0;
  }

  /** the bolt from the cloud base to the strike point, with branches */
  bolt(s: Strike): void {
    this.glow.visible = false;
    const rng = this.rng;
    const top = new THREE.Vector3(s.x + rng.range(-60, 60), s.y + rng.range(320, 420), s.z + rng.range(-60, 60));
    const bottom = new THREE.Vector3(s.x, s.y, s.z);
    this.boltSegs = 0;
    const trunk = this.jag(top, bottom, 6, 0.16, 1);
    // 3–5 branches off the upper two thirds of the trunk
    const nb = rng.int(3, 5);
    for (let i = 0; i < nb && trunk.length > 4; i++) {
      const k = Math.floor(rng.range(0.08, 0.66) * (trunk.length - 1));
      const from = trunk[k];
      if (!from) continue;
      const len = rng.range(40, 110) * (1 - k / trunk.length);
      const a = rng.range(0, Math.PI * 2);
      const to = new THREE.Vector3(from.x + Math.cos(a) * len * 0.7, from.y - len * rng.range(0.5, 0.9), from.z + Math.sin(a) * len * 0.7);
      this.jag(from, to, 4, 0.22, 0.35);
    }
    const geo = this.boltMesh.geometry;
    for (const name of ['position', 'aEnd', 'aW'] as const) {
      const a = geo.getAttribute(name);
      if (a instanceof THREE.BufferAttribute) a.needsUpdate = true;
    }
    geo.setDrawRange(0, this.boltSegs * 6);
    this.boltMesh.visible = true;
    this.boltT = 0;
    if (s.kind === 'tree') {
      // the struck tree burns and smokes for the rest of the storm (and the after)
      setLentParam(SMOKE, 'origin', [s.x, s.y - 2, s.z]);
      this.fire.position.set(s.x, s.y - 1.5, s.z);
      this.smokeLeft = 360;
    }
  }

  /** midpoint displacement between a and b (2^levels segments); returns the points; writes the segments */
  private jag(a: THREE.Vector3, b: THREE.Vector3, levels: number, rough: number, width: number): THREE.Vector3[] {
    let pts = [a.clone(), b.clone()];
    let amp = a.distanceTo(b) * rough;
    for (let l = 0; l < levels; l++) {
      const next: THREE.Vector3[] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i], p1 = pts[i + 1];
        if (!p0 || !p1) continue;
        const m = p0.clone().add(p1).multiplyScalar(0.5);
        m.x += this.rng.range(-amp, amp); m.z += this.rng.range(-amp, amp); m.y += this.rng.range(-amp, amp) * 0.3;
        next.push(p0, m);
      }
      const last = pts[pts.length - 1];
      if (last) next.push(last);
      pts = next; amp *= 0.55;
    }
    for (let i = 0; i < pts.length - 1 && this.boltSegs < BOLT_SEGS; i++) {
      const p0 = pts[i], p1 = pts[i + 1];
      if (!p0 || !p1) continue;
      const s = this.boltSegs++;
      const w = width * (1 - (i / pts.length) * 0.4);
      for (let k = 0; k < 4; k++) {
        const v = s * 4 + k;
        this.boltA[v * 3] = p0.x; this.boltA[v * 3 + 1] = p0.y; this.boltA[v * 3 + 2] = p0.z;
        this.boltB[v * 3] = p1.x; this.boltB[v * 3 + 1] = p1.y; this.boltB[v * 3 + 2] = p1.z;
        this.boltW[v] = w;
      }
    }
    return pts;
  }

  /** an in-cloud flash toward a world bearing (atan2(z, x)) */
  inCloudFlash(bearing: number): void {
    this.flashDir.set(Math.cos(bearing), 0.25, Math.sin(bearing)).normalize();
  }

  // ─────────────────────────────── per frame ───────────────────────────────
  /** `wind`: the live wind (m/s, world xz) — rain slant, smoke; `stormFrom`: the world bearing (atan2(z, x)) the storm comes from */
  update(dt: number, w: Weather, L: SkyLook, camera: THREE.Camera, wind: { x: number; z: number }): void {
    const storm = [Math.cos(w.stormFrom), Math.sin(w.stormFrom), w.front];
    const cam = camera.position;

    // the deck: from the first sight of the shelf to the end of the clearing
    const stormOn = w.front > 0.01 && w.front < 1.499;
    const bow = w.rainbow * Math.min(1, Math.max(0, L.sunDir.y * 6)) * (L.moon > 0 ? 0 : 1);
    const deckOn = stormOn || bow > 0.001;
    this.deck.visible = deckOn;
    if (deckOn) {
      this.deck.position.copy(cam);
      const fade = stormOn ? Math.min(1, w.front * 12) * Math.min(1, (1.5 - w.front) * 12) : 0;
      setLentParam(DECK, 'storm', storm);
      setLentParam(DECK, 'deck', [w.weather.overcast, w.flash, fade, bow]);
      setLentParam(DECK, 'light', rgb(L.cloudLight, 1.35));
      setLentParam(DECK, 'sunDir', L.sunDir.toArray()); setLentParam(DECK, 'sunCol', rgb(L.keyColor));
      setLentParam(DECK, 'flashDir', this.flashDir.toArray());
    }
    // the curtains + rainbow
    this.curtains.visible = stormOn;
    if (stormOn) {
      this.curtains.position.set(cam.x, 0, cam.z);
      setLentParam(CURTAINS, 'storm', storm);
      setLentParam(CURTAINS, 'curtain', [w.weather.rain, Math.max(0, w.weather.overcast - 0.3) / 0.7, wind.x, wind.z]);
      setLentParam(CURTAINS, 'light', rgb(L.cloudLight));
    }
    // rain around the camera: the count follows the intensity
    const rainOn = w.weather.rain > 0.01;
    this.rain.visible = rainOn;
    if (rainOn) {
      const r = this.rainU;
      const fall = 9.5;
      r.uVel.value.set(wind.x * 0.35, -fall, wind.z * 0.35);
      r.uOffset.value.addScaledVector(r.uVel.value, dt);
      const R = this.opts.phone ? 11 : 16;
      // keep the offset small (float precision) — any whole multiple of the box wraps to itself
      const box = 2 * R;
      r.uOffset.value.set(((r.uOffset.value.x % box) + box) % box, ((r.uOffset.value.y % box) + box) % box, ((r.uOffset.value.z % box) + box) % box);
      r.uR.value = R;
      r.uLen.value = 0.7 + 0.4 * w.weather.rain;
      r.uCol.value.copy(L.fogColor).lerp(L.hemiSky, 0.5).multiplyScalar(1.9).addScalar(0.05 + 0.8 * w.flash);
      r.uAlpha.value = 0.16 + 0.16 * w.weather.rain;
      this.rain.geometry.setDrawRange(0, Math.ceil(this.rainCount * Math.min(1, w.weather.rain * 1.1)) * 6);
    }
    // the bolt: two re-strikes, then gone
    if (this.boltMesh.visible) {
      this.boltT += dt;
      const t = this.boltT;
      setLentParam(BOLT, 'alpha', t < 0.07 ? 1 : t < 0.11 ? 0.25 : t < 0.18 ? 1 : t < 0.22 ? 0.3 : t < 0.26 ? 0.8 : Math.max(0, 0.8 - (t - 0.26) * 8));
      if (t > 0.4) this.boltMesh.visible = false;
    }
    // the telegraph glow pulses up to the strike
    if (this.glow.visible) {
      this.glowT += dt;
      const k = Math.min(1, this.glowT / 1.2);
      const pulse = 0.6 + 0.4 * Math.sin(this.glowT * 28);
      this.glow.scale.setScalar((1.5 + 3.5 * k) * pulse);
      this.glow.material.opacity = (0.35 + 0.65 * k) * pulse;
      if (this.glowT > 1.6) this.glow.visible = false;
    }
    // smoke + embers at a struck tree
    this.smokeLeft = Math.max(0, this.smokeLeft - dt);
    const smokeOn = this.smokeLeft > 0;
    this.smoke.visible = smokeOn; this.fire.visible = smokeOn && w.weather.state !== 'clear';
    if (smokeOn) {
      this.smokeT += dt;
      setLentParam(SMOKE, 'smoke', [Math.min(1, this.smokeLeft / 30), wind.x * 0.2, wind.z * 0.2]);
      setLentParam(SMOKE, 'light', rgb(L.hemiSky.clone().lerp(L.keyColor, 0.3)));
      this.fire.material.opacity = Math.min(1, this.smokeLeft / 60) * (0.55 + 0.45 * Math.sin(this.smokeT * 13) * Math.sin(this.smokeT * 7.3));
      this.fire.scale.setScalar(2.2);
    }
    // puddles
    const pOn = w.weather.wet > 0.02;
    this.puddles.visible = pOn;
    if (pOn) {
      setLentParam(PUDDLE, 'puddle', [w.weather.wet, w.weather.rain]);
      setLentParam(PUDDLE, 'sky', rgb(L.zenith)); setLentParam(PUDDLE, 'horizon', rgb(L.horizon));
      setLentParam(PUDDLE, 'sunDir', L.keyDir.toArray()); setLentParam(PUDDLE, 'sunCol', rgb(L.keyColor, L.keyIntensity * (1 - w.weather.overcast)));
    }
  }
}
