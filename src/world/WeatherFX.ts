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
 * Draw cost while clear: 0 (every mesh hidden). In the storm: the deck dome + curtain cylinder + rain + puddles
 * (+ the bolt for 0.35 s, the smoke plume after a tree strike) — 4–6 draws, ~10 k triangles, all unlit.
 *
 * Layering: the deck is a dome at 2350 m drawn after the painted clouds and the planet (renderOrder −9: it covers
 * both when the storm is overhead); the curtains + rainbow are a cylinder at 1150 m, in front of the far ranges and
 * behind the near ring and the terrain (depth-tested).
 */
import * as THREE from 'three';
import { Rng } from '../core/rng';
import { attachFogUniforms } from './Atmosphere';
import { heightAt, trailDistance, inChunk } from './Heightfield';
import type { Weather, Strike } from './Weather';
import type { SkyLook } from './DayNight';

export interface WeatherFXOpts { phone: boolean; seed: number }

/** inside the near horizon ring (800 m): the storm veils the mountains; the slab itself is nearer than this */
const DECK_R = 770;
const CURTAIN_R = 745;
const BOLT_SEGS = 220;
const PUDDLES = 110;

/** shared by the deck and the curtains: where the storm body is in cloud-plane coordinates */
const STORM_GLSL = /* glsl */`
uniform vec2 uFrom; uniform float uFront; uniform float uTime; uniform sampler2D tNoise;
// P: a point on the cloud plane, in cloud heights (d.xz / (d.y + 0.12)); returns 0..1 storm cover, edge = distance past the lead
float stormCover( vec2 P, out float edge ) {
  float s = dot( P, uFrom );
  float n = texture2D( tNoise, P * 0.055 + vec2( uTime * 0.0035, uTime * 0.002 ) ).r;
  float n2 = texture2D( tNoise, P * 0.19 - vec2( uTime * 0.004, 0.0 ) ).r;
  float lead = mix( 9.0, -9.0, clamp( uFront, 0.0, 1.0 ) );
  float back = mix( 16.0, -9.5, clamp( ( uFront - 1.0 ) * 2.0, 0.0, 1.0 ) );
  edge = s - lead + ( n - 0.5 ) * 4.0 + ( n2 - 0.5 ) * 1.2;
  float c = smoothstep( -0.4, 1.2, edge );
  c *= 1.0 - smoothstep( -1.2, 0.4, s - back + ( n - 0.5 ) * 4.0 );
  return c;
}
`;

const FOG_GLSL = /* glsl */`
  uniform vec3 fogColor; uniform vec3 fogSunDir; uniform vec3 fogSunColor;
  uniform float fogHeight; uniform float fogHeightFalloff; uniform float fogHeightDensity; uniform float fogDistDensity;
  float atmosFogFactor( vec3 wp ) {
    vec3 ray = wp - cameraPosition; float rayLen = length( ray );
    float dy = wp.y - cameraPosition.y;
    float camF = exp( - fogHeightFalloff * ( cameraPosition.y - fogHeight ) );
    float t = fogHeightFalloff * dy;
    float integ = abs( t ) > 1e-3 ? ( 1.0 - exp( - t ) ) / t : 1.0;
    return clamp( 1.0 - exp( - ( fogHeightDensity * camF * integ * rayLen + fogDistDensity * rayLen ) ), 0.0, 1.0 );
  }`;

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

/** tileable value noise (5 octaves, lattice 4 → 64 cells across) for the deck / curtains / smoke — 128², built once */
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

  private readonly noise: THREE.DataTexture;
  private readonly shared = {
    uFrom: { value: new THREE.Vector2(1, 0) }, uFront: { value: 0 }, uTime: { value: 0 },
    tNoise: { value: null as THREE.Texture | null },
  };
  private readonly deckU = {
    uOvercast: { value: 0 }, uLight: { value: new THREE.Color(1, 1, 1) }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) },
    uFlash: { value: 0 }, uFlashDir: { value: new THREE.Vector3(1, 0.2, 0) }, uFade: { value: 0 }, uRainbow: { value: 0 },
  };
  private readonly curtainU = {
    uRain: { value: 0 }, uLight: { value: new THREE.Color(1, 1, 1) }, uWind: { value: new THREE.Vector2(0, 0) },
    uStorm: { value: 0 },
  };
  private readonly rainU = {
    uOffset: { value: new THREE.Vector3() }, uR: { value: 16 }, uVel: { value: new THREE.Vector3(0, -9, 0) }, uLen: { value: 0.9 },
    uCol: { value: new THREE.Color(0.6, 0.65, 0.75) }, uAlpha: { value: 0.3 }, uWidth: { value: 0.013 },
  };
  private readonly boltU = { uAlpha: { value: 0 }, uWidth: { value: 3.2 } };
  private readonly puddleU = {
    uWet: { value: 0 }, uRain: { value: 0 }, uSky: { value: new THREE.Color(0.5, 0.6, 0.8) }, uHorizon: { value: new THREE.Color(0.7, 0.8, 0.9) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uTime: { value: 0 },
  };
  private readonly smokeU = { uTime: { value: 0 }, uOrigin: { value: new THREE.Vector3() }, uAmt: { value: 0 }, uLight: { value: new THREE.Color(1, 1, 1) }, uWind: { value: new THREE.Vector2() } };

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

  constructor(private opts: WeatherFXOpts) {
    this.rng = new Rng(opts.seed ^ 0xb017);
    this.noise = noiseTexture(opts.seed ^ 0x51);
    this.shared.tNoise.value = this.noise;
    this.rainCount = opts.phone ? 3500 : 6000;
    this.boltA = new Float32Array(BOLT_SEGS * 4 * 3);
    this.boltB = new Float32Array(BOLT_SEGS * 4 * 3);
    this.boltW = new Float32Array(BOLT_SEGS * 4);
  }

  build(): this {
    this.deck = this.buildDeck();
    this.curtains = this.buildCurtains();
    this.rain = this.buildRain();
    this.boltMesh = this.buildBolt();
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

  // ─────────────────────────────── the storm deck ───────────────────────────────
  private buildDeck(): THREE.Mesh {
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...this.shared, ...this.deckU },
      transparent: true, depthWrite: false, side: THREE.BackSide, fog: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        ${STORM_GLSL}
        uniform float uOvercast; uniform vec3 uLight; uniform vec3 uSunDir; uniform vec3 uSunCol;
        uniform float uFlash; uniform vec3 uFlashDir; uniform float uFade; uniform float uRainbow;
        varying vec3 vDir;
        vec3 spectrum(float t) { // 0 violet … 1 red
          return clamp(vec3(abs(t * 6.0 - 3.0) - 1.0, 2.0 - abs(t * 6.0 - 2.0), 2.0 - abs(t * 6.0 - 4.0)), 0.0, 1.0).bgr;
        }
        void main() {
          vec3 d = normalize(vDir);
          if (d.y < -0.08) discard;
          vec3 outc = vec3(0.0);
          // the rainbow: 40.5°–42.5° round the anti-solar point, a faint secondary at 50–53° (colours reversed)
          if (uRainbow > 0.0) {
            vec3 anti = -uSunDir;
            float ang = degrees(acos(clamp(dot(d, anti), -1.0, 1.0)));
            float p = smoothstep(40.2, 41.0, ang) * smoothstep(42.9, 42.1, ang);
            float s = smoothstep(50.0, 50.8, ang) * smoothstep(53.4, 52.6, ang);
            vec3 bow = spectrum(clamp((ang - 40.4) / 2.3, 0.0, 1.0)) * p + spectrum(clamp((53.2 - ang) / 3.0, 0.0, 1.0)) * s * 0.16;
            // brighter inside the bow (the classic lighter sky within), fading into the ground and at the top
            float inside = smoothstep(41.0, 30.0, ang) * 0.05;
            float fadeY = smoothstep(-0.02, 0.06, d.y);
            outc += (bow * 0.55 + vec3(inside)) * uRainbow * fadeY;
          }
          if (uFade <= 0.0) { gl_FragColor = vec4(outc, 0.0); return; }
          // the storm is a towering wall, not a flat deck: its coverage reads a plane 3.5× flatter (it stands taller
          // over the horizon), the billow shading keeps the true plane
          vec2 P = d.xz / (max(d.y, 0.0) + 0.12);
          vec2 Pt = d.xz / (max(d.y, 0.0) / 3.5 + 0.12);
          float edge;
          float c = stormCover(Pt, edge);
          // billows: two octaves of the noise shade the underside; the lead edge is the lighter shelf lip
          float b1 = texture2D(tNoise, P * 0.11 + vec2(uTime * 0.006, 0.0)).r;
          float b2 = texture2D(tNoise, P * 0.43 + vec2(0.0, uTime * 0.01)).r;
          float bill = b1 * 0.65 + b2 * 0.35;
          vec3 belly = mix(vec3(0.07, 0.08, 0.12), vec3(0.2, 0.21, 0.28), smoothstep(0.3, 0.75, bill));
          // the top of the wall (just past the lead edge) is the billowing sunlit crown; below it the body darkens to
          // the rain-dark base (storm-1: bright piled tops over a slate-violet body)
          float lip = smoothstep(3.0, 0.1, edge) * smoothstep(-0.3, 0.4, edge);
          float crown = lip * smoothstep(0.35, 0.7, bill + 0.25 * b2);
          vec3 col = mix(belly, vec3(0.42, 0.44, 0.52) * (0.85 + 0.3 * b2), lip * 0.55);
          col = mix(col, vec3(0.78, 0.78, 0.82), crown * 0.6);
          float sunSide = 0.35 + 0.65 * max(dot(normalize(d.xz + 1e-4), normalize(uSunDir.xz + 1e-4)), 0.0);
          col += uSunCol * 0.22 * crown * sunSide * smoothstep(-0.05, 0.3, uSunDir.y);
          // the base under the wall is darkest (rain falling out of it)
          col *= mix(1.0, 0.65, smoothstep(0.12, 0.0, d.y) * c);
          col *= uLight;
          // in-cloud lightning: a soft blob round the flash's bearing + the whole deck lifts a little
          float fl = pow(max(dot(d, uFlashDir), 0.0), 10.0);
          col += vec3(0.75, 0.72, 1.0) * uFlash * (0.25 + 2.2 * fl) * c;
          // the overcast greys the rest of the sky too (a thin veil beyond the body)
          // the veil beyond the body thickens toward it (clear sky stays clear on the far side until it is overhead)
          float a = max(c * 0.97, uOvercast * 0.6 * smoothstep(-9.0, 0.0, edge)) * smoothstep(-0.08, 0.02, d.y) * uFade;
          gl_FragColor = vec4(col * a + outc * (1.0 - a), a);
        }`,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(DECK_R, 48, 20, 0, Math.PI * 2, 0, Math.PI * 0.56), mat);
    m.frustumCulled = false; m.renderOrder = -9; m.visible = false; m.name = 'storm-deck';
    return m;
  }

  // ─────────────────────── rain curtains + the rainbow ───────────────────────
  private buildCurtains(): THREE.Mesh {
    const uniforms = { ...this.shared, ...this.curtainU };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true, depthWrite: false, side: THREE.BackSide, fog: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      vertexShader: /* glsl */`
        varying vec3 vDir; varying float vH;
        void main() { vDir = position; vH = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        ${STORM_GLSL}
        uniform float uRain; uniform vec3 uLight; uniform vec2 uWind; uniform float uStorm;
        varying vec3 vDir; varying float vH;
        void main() {
          vec3 d = normalize(vDir);
          vec2 h = normalize(d.xz + 1e-5);
          // the storm body over the hills this way, ~2 cloud heights out
          float edge;
          float c = stormCover(h * 7.0, edge);
          float az = atan(h.y, h.x);
          // streaks: slanted by the wind, falling
          float slant = dot(vec2(-h.y, h.x), uWind) * 0.05;
          vec2 q = vec2(az * 38.0 + d.y * slant * 40.0, d.y * 4.0 + uTime * 0.9);
          float s1 = texture2D(tNoise, q * vec2(1.0, 0.08)).r;
          float s2 = texture2D(tNoise, q * vec2(2.3, 0.05) + 0.37).r;
          float streak = smoothstep(0.35, 0.8, s1 * 0.6 + s2 * 0.4);
          // the curtain hangs from the cloud (top) to the ground (bottom), densest low
          float veil = c * (0.3 + 0.7 * streak) * smoothstep(1.0, 0.6, vH) * smoothstep(0.0, 0.25, vH);
          float a = veil * 0.62 * (1.0 - 0.6 * uStorm);
          vec3 col = vec3(0.16, 0.17, 0.22) * uLight;
          vec3 outc = col * a;
          gl_FragColor = vec4(outc, a);
        }`,
    });
    // from under the horizon (so the far hills stand in it) up to ~12° — the storm's cloud base
    const geo = new THREE.CylinderGeometry(CURTAIN_R, CURTAIN_R, 330, 64, 1, true);
    geo.translate(0, 330 / 2 - 170, 0);
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false; m.renderOrder = -8; m.visible = false; m.name = 'storm-curtains';
    return m;
  }

  // ─────────────────────────── rain around the camera ───────────────────────────
  private buildRain(): THREE.Mesh {
    const n = this.rainCount, rng = new Rng(this.opts.seed ^ 0x2a1);
    const seed = new Float32Array(n * 4 * 4), corner = new Float32Array(n * 4 * 2), idx = new Uint32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const sx = rng.next(), sy = rng.next(), sz = rng.next(), sp = rng.range(0.85, 1.2);
      for (let k = 0; k < 4; k++) {
        const v = i * 4 + k;
        seed[v * 4] = sx; seed[v * 4 + 1] = sy; seed[v * 4 + 2] = sz; seed[v * 4 + 3] = sp;
        corner[v * 2] = k & 1 ? 1 : -1; corner[v * 2 + 1] = k < 2 ? 0 : 1;
      }
      const b = i * 4;
      idx.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 4 * 3), 3)); // unused (the shader builds it)
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    geo.setAttribute('corner', new THREE.BufferAttribute(corner, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const uniforms: Record<string, THREE.IUniform> = { ...THREE.UniformsUtils.merge([THREE.UniformsLib.fog]), ...this.rainU };
    attachFogUniforms({ uniforms });
    const mat = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide, // screen-built quads: either winding
      vertexShader: /* glsl */`
        attribute vec4 seed; attribute vec2 corner;
        uniform vec3 uOffset; uniform float uR; uniform vec3 uVel; uniform float uLen; uniform float uWidth;
        varying float vA; varying vec3 vW;
        void main() {
          float R = uR;
          vec3 p = seed.xyz * 2.0 * R + uOffset * seed.w;
          vec3 c = cameraPosition + vec3(0.0, 2.0, 0.0);
          vec3 w = mod(p - c + R, 2.0 * R) - R + c;
          vec3 v = normalize(uVel);
          vec3 a = w + v * (corner.y * uLen * seed.w);
          vW = a;
          vec4 mv = viewMatrix * vec4(a, 1.0);
          vec3 vv = (viewMatrix * vec4(v, 0.0)).xyz;
          vec2 side = normalize(vec2(-vv.y, vv.x) + 1e-5);
          float dist = length(mv.xyz);
          mv.xy += side * corner.x * uWidth * max(dist, 1.0) * 0.12 * (0.6 + 0.4 * seed.w);
          vec3 off = abs(w - c);
          float edge = 1.0 - smoothstep(R * 0.65, R * 0.98, max(max(off.x, off.y), off.z));
          vA = edge * smoothstep(0.6, 2.5, dist) * (corner.y > 0.5 ? 1.0 : 0.15);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        ${FOG_GLSL}
        uniform vec3 uCol; uniform float uAlpha;
        varying float vA; varying vec3 vW;
        void main() {
          float a = vA * uAlpha;
          vec3 col = mix(uCol, fogColor, atmosFogFactor(vW) * 0.6);
          gl_FragColor = vec4(col, a);
        }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false; m.renderOrder = 20; m.visible = false; m.name = 'rain';
    return m;
  }

  // ─────────────────────────────── the bolt ───────────────────────────────
  private buildBolt(): THREE.Mesh {
    const n = BOLT_SEGS, corner = new Float32Array(n * 4 * 2), idx = new Uint16Array(n * 6);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 4; k++) { const v = i * 4 + k; corner[v * 2] = k & 1 ? 1 : -1; corner[v * 2 + 1] = k < 2 ? 0 : 1; }
      const b = i * 4; idx.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.boltA, 3));
    geo.setAttribute('bEnd', new THREE.BufferAttribute(this.boltB, 3));
    geo.setAttribute('bW', new THREE.BufferAttribute(this.boltW, 1));
    geo.setAttribute('corner', new THREE.BufferAttribute(corner, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.boltU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false, side: THREE.DoubleSide, // screen-built quads: either winding
      vertexShader: /* glsl */`
        attribute vec3 bEnd; attribute float bW; attribute vec2 corner;
        uniform float uWidth;
        varying float vEdge; varying float vW;
        void main() {
          vec3 p = mix(position, bEnd, corner.y);
          vec4 mv = viewMatrix * vec4(p, 1.0);
          vec4 a = viewMatrix * vec4(position, 1.0), b = viewMatrix * vec4(bEnd, 1.0);
          vec2 dir = normalize(b.xy / max(-b.z, 0.1) - a.xy / max(-a.z, 0.1) + 1e-5);
          vec2 side = vec2(-dir.y, dir.x);
          float dist = max(-mv.z, 1.0);
          // at least ~1.6 px wide however far, a bit wider than the real channel so it reads
          mv.xy += side * corner.x * bW * uWidth * (0.6 + dist * 0.0022);
          vEdge = corner.x; vW = bW;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uAlpha;
        varying float vEdge; varying float vW;
        void main() {
          // a white-hot channel in the middle third, a violet glow round it (storm-2)
          float d = abs(vEdge);
          float core = 1.0 - smoothstep(0.1, 0.3, d);
          float glow = exp(-d * 3.5) * (1.0 - d);
          vec3 col = vec3(1.0, 0.97, 1.0) * core * (2.5 + 5.0 * vW) + vec3(0.55, 0.38, 1.0) * glow * (0.9 + 1.2 * vW);
          gl_FragColor = vec4(col * uAlpha, 1.0);
        }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false; m.renderOrder = 15; m.visible = false; m.name = 'lightning-bolt';
    return m;
  }

  // ───────────────────────── smoke off a struck tree ─────────────────────────
  private buildSmoke(): THREE.Points {
    const n = 28, rng = new Rng(this.opts.seed ^ 0x5e0);
    const seed = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { seed[i * 4] = i / n; seed[i * 4 + 1] = rng.range(-1, 1); seed[i * 4 + 2] = rng.range(-1, 1); seed[i * 4 + 3] = rng.range(0.7, 1.3); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.smokeU, transparent: true, depthWrite: false, fog: false,
      vertexShader: /* glsl */`
        attribute vec4 seed;
        uniform float uTime; uniform vec3 uOrigin; uniform vec2 uWind;
        varying float vA;
        void main() {
          float life = fract(uTime * 0.09 * seed.w + seed.x);
          vec3 p = uOrigin + vec3(seed.y * 0.6, life * 16.0, seed.z * 0.6);
          p.xz += uWind * life * life * 5.0;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          vA = smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.5, 1.0, life));
          gl_PointSize = (2.0 + life * 7.0) * 320.0 / max(-mv.z, 1.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uAmt; uniform vec3 uLight;
        varying float vA;
        void main() {
          vec2 q = gl_PointCoord - 0.5;
          float r = length(q);
          float a = smoothstep(0.5, 0.1, r) * vA * uAmt * 0.45;
          gl_FragColor = vec4(vec3(0.3, 0.3, 0.32) * uLight, a);
        }`,
    });
    const p = new THREE.Points(geo, mat);
    p.frustumCulled = false; p.visible = false; p.renderOrder = 9; p.name = 'lightning-smoke';
    return p;
  }

  // ─────────────────────────── puddles on the trails ───────────────────────────
  private buildPuddles(): THREE.InstancedMesh {
    const rng = new Rng(this.opts.seed ^ 0x9dd1);
    const spots: { x: number; z: number; y: number; r: number }[] = [];
    // low spots on or beside the trails: a point on a trail that sits a few cm under its neighbours
    for (let tries = 0; tries < 12000 && spots.length < PUDDLES; tries++) {
      const x = rng.range(-240, 240), z = rng.range(-240, 240);
      if (!inChunk(x, z, 6) || trailDistance(x, z) > 2.2) continue;
      const h = heightAt(x, z);
      const m = (heightAt(x + 2, z) + heightAt(x - 2, z) + heightAt(x, z + 2) + heightAt(x, z - 2)) / 4;
      if (h - m > -0.004 && rng.next() > 0.12) continue; // mostly concave spots, a few anywhere on the track
      if (spots.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < 36)) continue;
      spots.push({ x, z, y: h, r: rng.range(0.6, 1.7) });
    }
    const geo = new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2);
    const uniforms: Record<string, THREE.IUniform> = { ...THREE.UniformsUtils.merge([THREE.UniformsLib.fog]), ...this.puddleU };
    attachFogUniforms({ uniforms });
    const mat = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, fog: true,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      vertexShader: /* glsl */`
        varying vec3 vW; varying vec2 vL; varying float vSeed;
        void main() {
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vW = w.xyz; vL = position.xz; vSeed = fract(instanceMatrix[3].x * 0.137 + instanceMatrix[3].z * 0.071);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */`
        ${FOG_GLSL}
        uniform float uWet; uniform float uRain; uniform vec3 uSky; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uTime;
        varying vec3 vW; varying vec2 vL; varying float vSeed;
        void main() {
          // an irregular soft edge
          float ang = atan(vL.y, vL.x);
          float rim = 0.78 + 0.12 * sin(ang * 3.0 + vSeed * 20.0) + 0.08 * sin(ang * 5.0 + vSeed * 7.0);
          float r = length(vL);
          float shape = smoothstep(rim, rim - 0.2, r);
          if (shape <= 0.0) discard;
          vec3 V = normalize(cameraPosition - vW);
          float fres = pow(1.0 - max(V.y, 0.0), 3.0);
          vec3 N = vec3(0.0, 1.0, 0.0);
          // rain rings
          if (uRain > 0.0) {
            vec2 cell = floor(vW.xz * 2.5); vec2 f = fract(vW.xz * 2.5) - 0.5;
            float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
            float t = fract(uTime * 1.3 + h);
            float ring = smoothstep(0.06, 0.0, abs(length(f) - t * 0.45)) * (1.0 - t) * uRain;
            N = normalize(N + vec3(f.x, 0.0, f.y) * ring * 1.5);
          }
          vec3 R = reflect(-V, N);
          vec3 sky = mix(uHorizon, uSky, smoothstep(0.0, 0.6, R.y));
          float glint = pow(max(dot(R, uSunDir), 0.0), 180.0) * 6.0;
          vec3 col = mix(vec3(0.05, 0.045, 0.04), sky, 0.35 + 0.55 * fres) + uSunCol * glint;
          float a = shape * uWet * (0.55 + 0.4 * fres);
          col = mix(col, fogColor, atmosFogFactor(vW));
          gl_FragColor = vec4(col, a);
        }`,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, spots.length));
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
    for (const name of ['position', 'bEnd', 'bW'] as const) {
      const a = geo.getAttribute(name);
      if (a instanceof THREE.BufferAttribute) a.needsUpdate = true;
    }
    geo.setDrawRange(0, this.boltSegs * 6);
    this.boltMesh.visible = true;
    this.boltT = 0;
    if (s.kind === 'tree') {
      // the struck tree burns and smokes for the rest of the storm (and the after)
      this.smokeU.uOrigin.value.set(s.x, s.y - 2, s.z);
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
    const sh = this.shared;
    sh.uTime.value += dt;
    sh.uFrom.value.set(Math.cos(w.stormFrom), Math.sin(w.stormFrom));
    sh.uFront.value = w.front;
    const cam = camera.position;

    // the deck: from the first sight of the shelf to the end of the clearing
    const stormOn = w.front > 0.01 && w.front < 1.499;
    const bow = w.rainbow * Math.min(1, Math.max(0, L.sunDir.y * 6)) * (L.moon > 0 ? 0 : 1);
    const deckOn = stormOn || bow > 0.001;
    this.deck.visible = deckOn;
    if (deckOn) {
      this.deck.position.copy(cam);
      const d = this.deckU;
      d.uOvercast.value = w.overcast;
      d.uLight.value.copy(L.cloudLight).multiplyScalar(1.35);
      d.uSunDir.value.copy(L.sunDir); d.uSunCol.value.copy(L.keyColor);
      d.uFlash.value = w.flash; d.uFlashDir.value.copy(this.flashDir);
      d.uFade.value = stormOn ? Math.min(1, w.front * 12) * Math.min(1, (1.5 - w.front) * 12) : 0;
      d.uRainbow.value = bow;
    }
    // the curtains + rainbow
    const curtainsOn = stormOn;
    this.curtains.visible = curtainsOn;
    if (curtainsOn) {
      this.curtains.position.set(cam.x, 0, cam.z);
      const c = this.curtainU;
      c.uRain.value = w.rain; c.uLight.value.copy(L.cloudLight); c.uWind.value.set(wind.x, wind.z);
      c.uStorm.value = Math.max(0, w.overcast - 0.3) / 0.7;
    }
    // rain around the camera: the count follows the intensity
    const rainOn = w.rain > 0.01;
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
      r.uLen.value = 0.7 + 0.4 * w.rain;
      r.uCol.value.copy(L.fogColor).lerp(L.hemiSky, 0.5).multiplyScalar(1.9).addScalar(0.05 + 0.8 * w.flash);
      r.uAlpha.value = 0.16 + 0.16 * w.rain;
      this.rain.geometry.setDrawRange(0, Math.ceil(this.rainCount * Math.min(1, w.rain * 1.1)) * 6);
    }
    // the bolt: two re-strikes, then gone
    if (this.boltMesh.visible) {
      this.boltT += dt;
      const t = this.boltT;
      const a = t < 0.07 ? 1 : t < 0.11 ? 0.25 : t < 0.18 ? 1 : t < 0.22 ? 0.3 : t < 0.26 ? 0.8 : Math.max(0, 0.8 - (t - 0.26) * 8);
      this.boltU.uAlpha.value = a;
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
    this.smoke.visible = smokeOn; this.fire.visible = smokeOn && w.state !== 'clear';
    if (smokeOn) {
      this.smokeU.uTime.value += dt;
      this.smokeU.uAmt.value = Math.min(1, this.smokeLeft / 30);
      this.smokeU.uLight.value.copy(L.hemiSky).lerp(L.keyColor, 0.3);
      this.smokeU.uWind.value.set(wind.x * 0.2, wind.z * 0.2);
      const f = this.fire.material;
      f.opacity = Math.min(1, this.smokeLeft / 60) * (0.55 + 0.45 * Math.sin(this.smokeU.uTime.value * 13) * Math.sin(this.smokeU.uTime.value * 7.3));
      this.fire.scale.setScalar(2.2);
    }
    // puddles
    const pOn = w.wet > 0.02;
    this.puddles.visible = pOn;
    if (pOn) {
      const p = this.puddleU;
      p.uWet.value = w.wet; p.uRain.value = w.rain; p.uTime.value += dt;
      p.uSky.value.copy(L.zenith); p.uHorizon.value.copy(L.horizon);
      p.uSunDir.value.copy(L.keyDir); p.uSunCol.value.copy(L.keyColor).multiplyScalar(L.keyIntensity * (1 - w.overcast));
    }
  }
}
