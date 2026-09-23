/**
 * Ambient life for the Nalati dressing — three draw calls:
 *
 *  - **pollen + seed fluff**: `THREE.Points` in a box that wraps round the camera (the positions are world-static
 *    and mod-wrapped in the vertex shader, zero CPU per mote), drifting downwind with the one `Wind`, bobbing; golden
 *    pollen specks and white dandelion / feather-grass fluff that light up when you look toward the sun (forward
 *    scattering) — the "motes in the sun shafts" of the mockups. Unlit, soft round sprites, no depth write.
 *  - **butterflies**: a few dozen, two instanced wing quads each (the left one mirrored), CPU-flapped; they wander
 *    round the flower-drift hearts nearest the player just above the grass, and dart up and away when you come close.
 *  - **kites / eagles**: three raptors circling high over the valley and the plateau, gliding on bent wings with the
 *    odd flap burst, banking into the turn.
 * Butterflies and raptors are painterly-lit instanced meshes (the shared material + instanceColor).
 *
 *   const life = new DressLife(sky, drifts).build();   scene.add(life.group);
 *   life.update(dt, camera, playerPos);
 */
import * as THREE from 'three';
import { Rng } from '../../../core/rng';
import { clamp, smoothstep } from '../../../core/noise';
import { TIER } from '../../../core/tier';
import { heightAt } from '../../Heightfield';
import { grassBaseHeightAt } from '../../GrassField';
import { wind } from '../../Wind';
import { painterlyMaterial, painterlyUniforms } from '../../painterly';
import type { Sky } from '../../Sky';

const PHONE = TIER === 'phone';

// ── pollen ──────────────────────────────────────────────────────────────────────────────────────────

const MOTES = PHONE ? 380 : 900;
const BOX = new THREE.Vector3(26, 7, 26); // wrap box (m), centred on the camera, a little lifted

const MOTE_VERT = /* glsl */`
uniform float uTime;
uniform vec2 uDrift;       // metres the wind has carried the cloud (x, z)
uniform vec3 uBox;
uniform float uPx;         // pixels per metre at 1 m
uniform vec3 uSunDir;
attribute vec4 aSeed;      // xyz in [0,1), w = random
varying float vAlpha;
varying float vGlow;
varying float vFluff;
void main() {
  float r = aSeed.w;
  vec3 p = aSeed.xyz * uBox;
  float sp = 0.6 + r * 0.8;
  p.xz += uDrift * sp;
  p += vec3( sin( uTime * 0.6 + r * 41.0 ) * 0.7, sin( uTime * ( 0.5 + r ) + r * 17.0 ) * 0.35 + uTime * 0.05 * ( r - 0.3 ), cos( uTime * 0.45 + r * 29.0 ) * 0.7 );
  vec3 c = cameraPosition + vec3( 0.0, uBox.y * 0.25, 0.0 );
  vec3 rel = mod( p - c + uBox * 0.5, uBox ) - uBox * 0.5;
  vec3 world = c + rel;
  vec4 mv = viewMatrix * vec4( world, 1.0 );
  gl_Position = projectionMatrix * mv;
  vec3 e = abs( rel ) / ( uBox * 0.5 );
  float edge = 1.0 - smoothstep( 0.7, 1.0, max( e.x, max( e.y, e.z ) ) );
  float d = length( rel );
  vAlpha = edge * smoothstep( 0.4, 1.6, d );
  vFluff = step( 0.72, fract( r * 7.31 ) );
  vec3 V = normalize( world - cameraPosition );
  vGlow = pow( max( dot( V, uSunDir ), 0.0 ), 5.0 );
  float size = mix( 0.018, 0.05, vFluff ) * ( 0.7 + r * 0.6 );
  gl_PointSize = clamp( size * uPx / max( -mv.z, 0.1 ), 1.0, 14.0 );
}
`;
const MOTE_FRAG = /* glsl */`
uniform vec3 uSunCol;
uniform float uOpacity;
varying float vAlpha;
varying float vGlow;
varying float vFluff;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length( q );
  float a = smoothstep( 0.5, 0.05, d );
  // fluff: a soft star of hairs round a bright seed
  if ( vFluff > 0.5 ) a = max( smoothstep( 0.5, 0.0, d ) * 0.35, smoothstep( 0.14, 0.0, d ) ) * ( 0.75 + 0.25 * abs( sin( atan( q.y, q.x ) * 6.0 ) ) );
  vec3 col = mix( vec3( 1.0, 0.86, 0.45 ), vec3( 1.0, 0.98, 0.92 ), vFluff );
  col *= uSunCol * ( 0.55 + 1.8 * vGlow );
  gl_FragColor = vec4( col, a * vAlpha * uOpacity * ( 0.35 + 0.9 * vGlow ) );
}
`;

// ── critters ────────────────────────────────────────────────────────────────────────────────────────

const BUTTERFLIES = PHONE ? 14 : 30;
const BIRDS = 3;

/** a butterfly wing: a fore + hind wing fan hinged on +x from the body line (x = 0), two-sided, painted */
function wingGeo(): THREE.BufferGeometry {
  const v = [0, 0, 0.004, 0.034, 0.004, 0.02, 0.044, 0, -0.004, 0.03, 0, -0.026, 0, 0, -0.012];
  const idx = [0, 1, 2, 0, 2, 3, 0, 3, 4];
  const back = [0, 2, 1, 0, 3, 2, 0, 4, 3];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  // dark at the hinge, the colour in the middle, dark wingtips (the instance colour tints it)
  g.setAttribute('color', new THREE.Float32BufferAttribute([0.15, 0.12, 0.1, 0.6, 0.55, 0.5, 0.9, 0.88, 0.85, 0.75, 0.72, 0.7, 0.2, 0.18, 0.16], 3));
  g.setIndex([...idx, ...back]);
  g.computeBoundingSphere();
  return g;
}

/** half a raptor (its right side): half the body, one long fingered wing on +x, half the tail; mirrored for the left */
function halfBirdGeo(): THREE.BufferGeometry {
  // (x, y, z) with −z forward; wing chord ~0.45 at the root, tapering to fingers at 1.0 m
  const v: number[] = [
    0, 0.02, -0.55, 0.07, 0, -0.35, 0.09, 0.0, 0.05, 0, 0.04, 0.2, 0, -0.05, -0.1,  // body: beak, shoulder, hip, back, belly (0-4)
    0.07, 0.0, -0.22, 0.45, 0.03, -0.2, 0.85, 0.06, -0.12, 1.0, 0.07, 0.0, 0.8, 0.05, 0.12, 0.4, 0.02, 0.2, 0.08, 0.0, 0.15, // wing (5-11)
    0, 0.02, 0.3, 0.13, 0.02, 0.55, 0, 0.02, 0.6, // tail (12-14)
  ];
  const tri = [
    0, 1, 3, 1, 2, 3, 0, 4, 1, 1, 4, 2,          // body top + belly
    5, 6, 11, 6, 10, 11, 6, 7, 10, 7, 9, 10, 7, 8, 9, // wing
    12, 13, 14,                                  // tail
  ];
  const back: number[] = [];
  for (let i = 0; i < tri.length; i += 3) back.push(tri[i] ?? 0, tri[i + 2] ?? 0, tri[i + 1] ?? 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex([...tri, ...back]);
  g.computeVertexNormals();
  const n = v.length / 3, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = v[i * 3] ?? 0, z = v[i * 3 + 2] ?? 0;
    // rufous body, darker wing, black fingertips, a pale band under the hand
    let r = 0.36, gg = 0.22, b = 0.12;
    if (x > 0.3) { r = 0.22; gg = 0.15; b = 0.1; }
    if (x > 0.8) { r = 0.06; gg = 0.05; b = 0.05; }
    if (z > 0.5) { r = 0.42; gg = 0.28; b = 0.16; }
    col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

interface Fly { x: number; y: number; z: number; vx: number; vy: number; vz: number; tx: number; ty: number; tz: number; retarget: number; phase: number; rate: number; home: number; scare: number; hue: THREE.Color }
interface Bird { cx: number; cz: number; alt: number; r: number; w: number; a: number; flap: number; nextFlap: number; phase: number; s: number }

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _mf = new THREE.Matrix4(), _mw = new THREE.Matrix4();
const BUTTERFLY_HUES = ['#f08a2a', '#f4f1e2', '#7fa0f0', '#f2d23c', '#f4f1e2', '#e9702a'];

export class DressLife {
  group = new THREE.Group();
  motes!: THREE.Points;
  butterflies!: THREE.InstancedMesh;
  birds!: THREE.InstancedMesh;
  private moteMat!: THREE.ShaderMaterial;
  private flies: Fly[] = [];
  private flock: Bird[] = [];
  private t = 0;
  private drift = new THREE.Vector2();
  private homes: { x: number; y: number; z: number; r: number }[] = [];
  private homeCheck = 0;
  private rng = new Rng(0xb077);

  constructor(private sky: Sky, private drifts: { x: number; y: number; z: number; r: number }[]) { this.group.name = 'nalati-dress-life'; }

  build(): this {
    // pollen
    const rng = new Rng(0x9011e);
    const seeds = new Float32Array(MOTES * 4);
    for (let i = 0; i < MOTES * 4; i++) seeds[i] = rng.next();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    this.moteMat = new THREE.ShaderMaterial({
      vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false,
      uniforms: {
        uTime: { value: 0 }, uDrift: { value: this.drift }, uBox: { value: BOX }, uPx: { value: 600 },
        uSunDir: painterlyUniforms.uPSunDir, uSunCol: { value: new THREE.Color(1, 0.93, 0.8) }, uOpacity: { value: 1 },
      },
    });
    this.motes = new THREE.Points(g, this.moteMat);
    this.motes.frustumCulled = false;
    this.motes.name = 'nalati-dress-pollen';
    this.motes.renderOrder = 2;
    this.group.add(this.motes);

    // butterflies: 2 instances each (right wing, mirrored left wing)
    const bmat = painterlyMaterial(this.sky, { rim: 0.3, bands: 0.5, shade: 0.6, emissive: 0x101010 });
    this.butterflies = new THREE.InstancedMesh(wingGeo(), bmat, BUTTERFLIES * 2);
    this.butterflies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.butterflies.frustumCulled = false;
    this.butterflies.count = 0;
    this.butterflies.name = 'nalati-dress-butterflies';
    for (let i = 0; i < BUTTERFLIES; i++) {
      const hue = new THREE.Color(BUTTERFLY_HUES[i % BUTTERFLY_HUES.length] ?? '#f08a2a');
      this.flies.push({ x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, tx: 0, ty: 0, tz: 0, retarget: 0, phase: rng.range(0, 6), rate: rng.range(9, 14), home: -1, scare: 0, hue });
      this.butterflies.setColorAt(i * 2, hue); this.butterflies.setColorAt(i * 2 + 1, hue);
    }
    this.group.add(this.butterflies);

    // raptors
    const rmat = painterlyMaterial(this.sky, { rim: 0.6, bands: 0.6 });
    this.birds = new THREE.InstancedMesh(halfBirdGeo(), rmat, BIRDS * 2);
    this.birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.birds.frustumCulled = false;
    this.birds.name = 'nalati-dress-raptors';
    const spots = [{ x: 60, z: 120, alt: 55, r: 55 }, { x: -60, z: -110, alt: 48, r: 42 }, { x: 110, z: -60, alt: 62, r: 36 }];
    spots.forEach((s, i) => {
      this.flock.push({ cx: s.x, cz: s.z, alt: s.alt, r: s.r, w: (i % 2 === 0 ? 1 : -1) * 9 / s.r, a: rng.range(0, 6), flap: 0, nextFlap: rng.range(3, 9), phase: 0, s: i === 2 ? 1.25 : 0.9 });
      const c = new THREE.Color(1, 1, 1).multiplyScalar(rng.range(0.9, 1.1));
      this.birds.setColorAt(i * 2, c); this.birds.setColorAt(i * 2 + 1, c);
    });
    this.birds.count = BIRDS * 2;
    this.group.add(this.birds);
    return this;
  }

  update(dt: number, camera: THREE.PerspectiveCamera, player: THREE.Vector3, renderHeight: number): void {
    this.t += dt;
    // pollen rides the wind
    this.drift.x += wind.dirX * wind.speed * 0.35 * dt; this.drift.y += wind.dirZ * wind.speed * 0.35 * dt;
    const u = this.moteMat.uniforms;
    if (u['uTime']) u['uTime'].value = this.t;
    if (u['uPx']) u['uPx'].value = renderHeight / (2 * Math.tan((camera.fov * Math.PI) / 360));
    this.updateFlies(dt, player);
    this.updateBirds(dt);
  }

  private updateFlies(dt: number, player: THREE.Vector3): void {
    // the drift hearts within reach (re-picked every second)
    this.homeCheck -= dt;
    if (this.homeCheck <= 0) {
      this.homeCheck = 1;
      this.homes = this.drifts.filter((d) => Math.hypot(d.x - player.x, d.z - player.z) < 55).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z)).slice(0, 8);
    }
    const bm = this.butterflies;
    if (this.homes.length === 0) { bm.count = 0; return; }
    const rng = this.rng;
    let n = 0;
    for (let i = 0; i < this.flies.length; i++) {
      const f = this.flies[i];
      if (!f) continue;
      let home = this.homes[f.home];
      if (f.home < 0 || f.home >= this.homes.length || !home || Math.hypot(home.x - f.x, home.z - f.z) > home.r + 25) {
        // (re)spawn at a drift heart
        f.home = i % this.homes.length;
        home = this.homes[f.home];
        if (!home) continue;
        f.x = home.x + rng.range(-home.r, home.r) * 0.6; f.z = home.z + rng.range(-home.r, home.r) * 0.6;
        f.y = heightAt(f.x, f.z) + grassBaseHeightAt(f.x, f.z) + rng.range(0.3, 0.9);
        f.retarget = 0;
      }
      f.retarget -= dt;
      if (f.retarget <= 0) {
        f.retarget = rng.range(0.6, 2.2);
        const a = rng.range(0, Math.PI * 2), d = rng.next() * home.r;
        f.tx = home.x + Math.cos(a) * d; f.tz = home.z + Math.sin(a) * d;
        f.ty = heightAt(f.tx, f.tz) + grassBaseHeightAt(f.tx, f.tz) + rng.range(0.2, 1.1);
      }
      // the player walks into them: up and away
      const px = f.x - player.x, pz = f.z - player.z, pd = Math.hypot(px, pz);
      if (pd < 2.2) { f.scare = 1.2; f.tx = f.x + (px / (pd || 1)) * 5; f.tz = f.z + (pz / (pd || 1)) * 5; f.ty = f.y + 2; f.retarget = 1.5; }
      f.scare = Math.max(0, f.scare - dt);
      const speed = f.scare > 0 ? 4.5 : 1.3;
      const dx = f.tx - f.x, dy = f.ty - f.y, dz = f.tz - f.z, dl = Math.hypot(dx, dy, dz) || 1;
      const k = clamp(dt * 3, 0, 1);
      f.vx += ((dx / dl) * speed - f.vx) * k; f.vy += ((dy / dl) * speed - f.vy) * k; f.vz += ((dz / dl) * speed - f.vz) * k;
      // the flutter: a jittery bob on top of the steering, and the wind leans them downwind
      f.vy += Math.sin(this.t * 7 + i) * 0.9 * dt * 10;
      f.x += (f.vx + wind.dirX * 0.4) * dt; f.y += f.vy * dt; f.z += (f.vz + wind.dirZ * 0.4) * dt;
      f.y = Math.max(f.y, heightAt(f.x, f.z) + 0.15);
      f.phase += dt * f.rate * (f.scare > 0 ? 1.4 : 1);
      // wing angle: fast beats with pauses (open glide) now and then
      const beat = Math.sin(f.phase), glide = smoothstep(0.6, 0.9, Math.sin(f.phase * 0.13 + i));
      const ang = (beat * 1.15 + 0.25) * (1 - glide) + 0.15 * glide;
      const yaw = Math.atan2(-f.vx, -f.vz);
      _e.set(-0.25, yaw, 0, 'YXZ');
      _m.compose(_p.set(f.x, f.y, f.z), _q.setFromEuler(_e), _s.set(1.25, 1.25, 1.25));
      _mf.makeRotationZ(ang);
      bm.setMatrixAt(n++, _mw.multiplyMatrices(_m, _mf));
      _mf.makeRotationZ(-ang); _mf.premultiply(_mw.makeScale(-1, 1, 1));
      bm.setMatrixAt(n++, _mw.multiplyMatrices(_m, _mf));
      bm.setColorAt(n - 2, f.hue); bm.setColorAt(n - 1, f.hue);
    }
    bm.count = n;
    bm.instanceMatrix.needsUpdate = true;
    if (bm.instanceColor) bm.instanceColor.needsUpdate = true;
  }

  private updateBirds(dt: number): void {
    const bm = this.birds;
    let n = 0;
    for (const b of this.flock) {
      b.a += b.w * dt;
      const x = b.cx + Math.cos(b.a) * b.r, z = b.cz + Math.sin(b.a) * b.r;
      const vx = -Math.sin(b.a) * b.w, vz = Math.cos(b.a) * b.w;
      const y = Math.max(heightAt(x, z) + 25, b.alt) + Math.sin(b.a * 0.7) * 3;
      // a flap burst every few seconds, else a glide with the wings bent up a little
      b.nextFlap -= dt;
      if (b.nextFlap <= 0) { b.flap = 1.6; b.nextFlap = 5 + Math.abs(Math.sin(b.a * 13.1)) * 7; }
      b.flap = Math.max(0, b.flap - dt);
      b.phase += dt * 5.5;
      const ang = b.flap > 0 ? Math.sin(b.phase) * 0.55 + 0.1 : 0.12 + Math.sin(b.phase * 0.2) * 0.03;
      const yaw = Math.atan2(-vx, -vz), bank = 0.32 * Math.sign(b.w);
      _e.set(0.05, yaw, bank, 'YXZ');
      _m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(b.s, b.s, b.s));
      _mf.makeRotationZ(ang);
      bm.setMatrixAt(n++, _mw.multiplyMatrices(_m, _mf));
      _mf.makeRotationZ(-ang); _mf.premultiply(_mw.makeScale(-1, 1, 1));
      bm.setMatrixAt(n++, _mw.multiplyMatrices(_m, _mf));
    }
    bm.count = n;
    bm.instanceMatrix.needsUpdate = true;
  }

  /** 0..1 — the weather dims the pollen (rain, night) */
  setPollen(k: number): void { const o = this.moteMat.uniforms['uOpacity']; if (o) o.value = k; }
}
