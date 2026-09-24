/**
 * Pine Hollow's running water (PINE-HOLLOW-REMASTER PH-L9): the creek from the beaver dam to the slab's south edge, the
 * waterfall off the Ridge into the pond, the plunge-pool foam where it lands and a spray of mist at the foot.
 *
 *   const streams = new PineStreams(sky).build();   // Pine Hollow only (its layout: src/chunks/pineHollowLayout.ts)
 *   scene.add(streams.group);                        // nothing to update: it all runs on wind.ts's clock
 *
 * Two draws, no extra render pass, no per-frame CPU:
 *   · `water`: one mesh for the creek ribbon, the waterfall sheet and the plunge ring, in the pond's photoreal water
 *     (waterSurface.ts — the same program: the clock's sky, Fresnel, depth tint, flow-scrolled ripples, foam, the wet line
 *     on the banks). The creek follows the layout's polyline and `creekSurfaceAt` (the bed + 0.45 m, a thin sheet over the
 *     dam's crest), its uv.y is travel time so the ripples ride the flow and stretch where it is fast; the dam's face is
 *     white (`creekFoamAt`). The waterfall is a curved sheet down the Ridge's face (standing off the rock where it is
 *     steep, bulged at its middle), quickening with the drop, white all the way, ending on the pond's surface in a foam
 *     ring that spreads outward.
 *   · `spray`: a few soft puffs (Particles' mist texture + its fog) rising and fading at the foot of the fall's face and
 *     where it hits the pond, tinted by the fog / sun colours so they follow the clock.
 */
import * as THREE from 'three';
import { heightAt, normalAt, waterLevel } from './Heightfield';
import { attachFogUniforms } from './Atmosphere';
import type { Sky } from './Sky';
import { createWaterMaterial } from './waterSurface';
import { fogGLSL, makeMistTexture } from './Particles';
import { windUniforms, WIND_DIR } from './wind';
import {
  CREEK, WATERFALL, RIDGE_STREAM, CREEK_WATER, creekSpan, creekSurfaceAt, creekFlowAt, creekFoamAt, type XZ,
} from '../chunks/pineHollowLayout';

/** the creek ribbon's across-stream offsets (m): dense where the water meets the banks */
const CREEK_ACROSS = [-6, -4.6, -3.8, -3.2, -2.6, -1.5, 0, 1.5, 2.6, 3.2, 3.8, 4.6, 6];

/** an accumulating mesh: positions, uv, aWater and an index */
class Builder {
  pos: number[] = []; uv: number[] = []; aw: number[] = []; idx: number[] = [];
  get count(): number { return this.pos.length / 3; }
  vert(x: number, y: number, z: number, u: number, v: number, depth: number, flow: number, foam: number, kAbs: number): void {
    this.pos.push(x, y, z); this.uv.push(u, v); this.aw.push(depth, flow, foam, kAbs);
  }
  /** a grid of `rows` × `cols` vertices starting at `base`, rows along the flow, columns to its left (wound to face up) */
  grid(base: number, rows: number, cols: number): void {
    for (let r = 0; r + 1 < rows; r++) for (let c = 0; c + 1 < cols; c++) {
      const a = base + r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      this.idx.push(a, b, d, b, e, d);
    }
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aWater', new THREE.Float32BufferAttribute(this.aw, 4));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

/** a polyline sampled by arc length: point and (smoothed) unit tangent */
class Path {
  private cum: number[] = [0];
  readonly length: number;
  constructor(private pts: readonly XZ[]) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      this.cum.push((this.cum[i - 1] ?? 0) + (a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0));
    }
    this.length = this.cum[this.cum.length - 1] ?? 0;
  }
  at(s: number): [number, number] {
    const t = Math.min(this.length, Math.max(0, s));
    let i = 0;
    while (i < this.pts.length - 2 && t > (this.cum[i + 1] ?? 0)) i++;
    const a = this.pts[i], b = this.pts[i + 1], l = (this.cum[i + 1] ?? 0) - (this.cum[i] ?? 0);
    if (!a || !b) return [0, 0];
    const u = l > 0 ? (t - (this.cum[i] ?? 0)) / l : 0;
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  }
  /** the direction over ±`span` m (so the ribbon bends smoothly round the polyline's corners) */
  tangent(s: number, span: number): [number, number] {
    const p = this.at(s - span), q = this.at(s + span), dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l];
  }
}

const smooth = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export class PineStreams {
  readonly group = new THREE.Group();
  /** the creek, the waterfall sheet and the plunge ring (one draw) */
  water!: THREE.Mesh;
  /** the mist puffs at the fall's foot and where it meets the pond (one draw) */
  spray!: THREE.InstancedMesh;
  /** where the fall's sheet meets the pond, and the foot of its steep face (the spray's anchors, the sound's) */
  readonly plunge = new THREE.Vector3();
  readonly faceFoot = new THREE.Vector3();

  constructor(private sky: Sky) {}

  build(): this {
    const b = new Builder();
    this.buildCreek(b);
    this.buildFall(b);
    this.buildRing(b);
    // the gully's banks and the forest over them fill the low reflections (sin 0.3 ≈ 17°)
    const { material } = createWaterMaterial(this.sky, { skyline: null, forestSinEl: 0.3 });
    this.water = new THREE.Mesh(b.geometry(), material);
    this.water.name = 'creek-waterfall';
    this.water.receiveShadow = true;
    this.water.renderOrder = 6; // after the pond: the plunge ring lies on it
    this.spray = this.buildSpray();
    this.group.add(this.water, this.spray);
    return this;
  }

  /** the creek: from just before the dam's crest (the outlet above it is the pond's own water) to the slab's edge */
  private buildCreek(b: Builder): void {
    const path = new Path(CREEK), { dam, end } = creekSpan();
    const stations: number[] = [];
    for (let s = dam - CREEK_WATER.lead; s < end - 0.2;) { stations.push(s); s += s > dam - 2.5 && s < dam + 8 ? 0.5 : 1.5; }
    stations.push(end - 0.2);
    let travel = 0, prev = stations[0] ?? 0;
    const base = b.count;
    for (const s of stations) {
      travel += (s - prev) / Math.max(0.1, (creekFlowAt(s) + creekFlowAt(prev)) / 2);
      prev = s;
      const [cx, cz] = path.at(s), [tx, tz] = path.tangent(s, 7), lx = -tz, lz = tx;
      const surf = creekSurfaceAt(s), foam = creekFoamAt(s);
      for (const o of CREEK_ACROSS) {
        const x = cx + lx * o, z = cz + lz * o, h = heightAt(x, z), d = surf - h;
        // just above the water the ribbon drapes onto the bank: the wet film
        const y = d < 0 && d > -0.45 ? h + 0.04 : surf;
        b.vert(x, y, z, o, travel, d, 1, foam, 2.0); // tea-brown running water (the forest's tannins): 2 / m, the bed shows through
      }
    }
    b.grid(base, stations.length, CREEK_ACROSS.length);
  }

  /** the waterfall: the ridge-top stream's last metres, down the Ridge's face, the short run below it, into the pond */
  private buildFall(b: Builder): void {
    const wl = waterLevel();
    const entry = this.pondEntry();
    // start 9 m above the lip on the ridge-top stream (further up its bed is too rough to hold water: it climbs again)
    const r2 = RIDGE_STREAM[2] ?? [WATERFALL.lip.x, WATERFALL.lip.z + 16], lip = WATERFALL.lip;
    const start: XZ = [r2[0] + (lip.x - r2[0]) * 0.44, r2[1] + (lip.z - r2[1]) * 0.44];
    const path = new Path([start, [lip.x, lip.z], [WATERFALL.foot.x, WATERFALL.foot.z], entry]);
    const COLS = 9, step = 0.7;
    const lipS = Math.hypot(lip.x - start[0], lip.z - start[1]);
    let yRun = Infinity, travel = 0, top = 0, rows = 0, faceFootFound = false;
    const base = b.count;
    for (let s = 0; s <= path.length + 1e-6; s += step) {
      const [cx, cz] = path.at(s), [tx, tz] = path.tangent(s, 2), lx = -tz, lz = tx;
      const hC = heightAt(cx, cz), nC = normalAt(cx, cz);
      // the surface never climbs downstream (the ridge top is rough): the running minimum of the ground + a skin
      yRun = Math.min(yRun, hC + 0.22);
      if (s === 0) top = yRun;
      const steep = 1 - nC[1];                                        // 0 flat … ~0.4 on the 53° face
      if (!faceFootFound && s > lipS + 8 && steep < 0.12) { faceFootFound = true; this.faceFoot.set(cx, hC + 0.6, cz); }
      const drop = Math.max(0, top - yRun);
      const speed = Math.min(8, Math.max(1.2, Math.sqrt(2 * 9.8 * drop) * (steep > 0.15 ? 1 : 0.55)));
      travel += step / speed;
      const halfW = 1.1 + 0.9 * smooth(0, lipS, s) + 1.3 * smooth(lipS, lipS + 30, s) + 0.5 * smooth(path.length - 10, path.length, s);
      const foam = s < lipS - 2 ? 0.5 : steep > 0.15 ? 0.84 : 0.7;
      for (let c = 0; c < COLS; c++) {
        const o = (c / (COLS - 1) * 2 - 1) * halfW, e = o / halfW;
        const x = cx + lx * o, z = cz + lz * o, n = normalAt(x, z);
        // off the rock by a skin, standing further off (and bulged at the middle) where the face is steep: a curved curtain
        const off = 0.14 + 0.55 * steep * (1 - e * e);
        let y = Math.max(heightAt(x, z) + off * n[1], yRun - 0.05 + (off - 0.14));
        y = Math.max(y, wl + 0.02);
        b.vert(x + n[0] * off, y, z + n[2] * off, o, travel, 0.5 * (1 - e ** 4), 1, foam, 4);
      }
      rows++;
    }
    b.grid(base, rows, COLS);
    if (!faceFootFound) this.faceFoot.set(WATERFALL.foot.x, heightAt(WATERFALL.foot.x, WATERFALL.foot.z) + 0.6, WATERFALL.foot.z);
    this.plunge.set(entry[0], wl, entry[1]);
  }

  /** where the line from the fall's foot toward the pond's centre first meets the water */
  private pondEntry(): XZ {
    const wl = waterLevel(), f = WATERFALL.foot;
    const dx = -100 - f.x, dz = 110 - f.z, l = Math.hypot(dx, dz);
    for (let t = 0; t < l; t += 0.25) {
      const x = f.x + (dx / l) * t, z = f.z + (dz / l) * t;
      if (heightAt(x, z) < wl) return [x, z];
    }
    return [f.x, f.z - 6];
  }

  /** the plunge ring: foam spreading outward on the pond's surface from where the fall lands (an overlay: no reflection) */
  private buildRing(b: Builder): void {
    const wl = waterLevel(), R = 6.5, RINGS = 8, SEGS = 28, cx = this.plunge.x, cz = this.plunge.z;
    const base = b.count;
    for (let r = 0; r < RINGS; r++) {
      const rr = (r / (RINGS - 1)) * R, fade = (1 - rr / R) ** 0.8;
      for (let k = 0; k <= SEGS; k++) {
        const a = (k / SEGS) * Math.PI * 2;
        // uv: 20 m round (4 texture periods: seamless), radial travel at 0.6 m/s — the foam rides outward
        b.vert(cx + Math.cos(a) * rr, wl + 0.02, cz + Math.sin(a) * rr, (k / SEGS) * 20, rr / 0.6, fade, 1, 0.35 + 0.6 * fade, -1);
      }
    }
    b.grid(base, RINGS, SEGS + 1);
  }

  /** mist puffs: each rises and swells over its own few-second cycle, drifting downwind */
  private buildSpray(): THREE.InstancedMesh {
    const anchors: { p: THREE.Vector3; n: number; size: number; rise: number }[] = [
      { p: this.faceFoot, n: 5, size: 4.5, rise: 3.5 },
      { p: new THREE.Vector3(this.plunge.x, this.plunge.y + 0.3, this.plunge.z), n: 6, size: 5.5, rise: 3 },
    ];
    const total = anchors.reduce((a, x) => a + x.n, 0);
    const geo = new THREE.PlaneGeometry(1, 1);
    const seed = new Float32Array(total * 4), m = new THREE.Matrix4();
    const mesh = new THREE.InstancedMesh(geo, this.sprayMaterial(), total);
    let i = 0;
    for (const a of anchors) for (let k = 0; k < a.n; k++, i++) {
      const j = (i * 0.618034) % 1;
      m.makeScale(a.size * (0.8 + 0.4 * j), a.size * (0.8 + 0.4 * ((j * 7.3) % 1)), a.rise);
      m.setPosition(a.p.x + Math.cos(i * 2.4) * 1.2, a.p.y, a.p.z + Math.sin(i * 2.4) * 1.2);
      mesh.setMatrixAt(i, m);
      seed[i * 4] = j; seed[i * 4 + 1] = 2.6 + 1.6 * ((j * 3.7) % 1); seed[i * 4 + 2] = (j * 5.1) % 1 - 0.5; seed[i * 4 + 3] = 0.8 + 0.4 * ((j * 11.3) % 1);
    }
    geo.setAttribute('spraySeed', new THREE.InstancedBufferAttribute(seed, 4));
    mesh.renderOrder = 7;
    mesh.name = 'waterfall-spray';
    mesh.computeBoundingSphere();
    return mesh;
  }

  private sprayMaterial(): THREE.ShaderMaterial {
    const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]) as Record<string, THREE.IUniform>;
    attachFogUniforms({ uniforms: u });
    u['uTex'] = { value: makeMistTexture() };
    u['uWindTime'] = windUniforms.uWindTime;
    u['uSunColor'] = { value: this.sky.sunColor };
    const mat = new THREE.ShaderMaterial({
      uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
      vertexShader: /* glsl */`
        attribute vec4 spraySeed;   // phase, period (s), sideways drift, opacity
        uniform float uWindTime;
        varying vec2 vUv; varying vec3 vWorld; varying float vFade;
        void main() {
          vec3 anchor = instanceMatrix[3].xyz;
          vec2 size = vec2( length( instanceMatrix[0].xyz ), length( instanceMatrix[1].xyz ) );
          float rise = length( instanceMatrix[2].xyz );
          float t = fract( uWindTime / spraySeed.y + spraySeed.x );
          vec3 centre = anchor + vec3( 0.0, rise * t, 0.0 ) + vec3( ${WIND_DIR.x.toFixed(3)}, 0.0, ${WIND_DIR.z.toFixed(3)} ) * t * 2.2
            + vec3( spraySeed.z, 0.0, - spraySeed.z ) * t * 1.5;
          float grow = 0.55 + 0.75 * t;
          vec3 toCam = cameraPosition - centre;
          vec3 fwd = normalize( vec3( toCam.x, 0.0, toCam.z ) + 1e-4 );
          vec3 right = normalize( cross( vec3( 0.0, 1.0, 0.0 ), fwd ) );
          vec3 w = centre + right * position.x * size.x * grow + vec3( 0.0, position.y * size.y * grow, 0.0 );
          vWorld = w;
          float ang = spraySeed.x * 6.283 + t * 0.8;
          vec2 c = uv - 0.5;
          vUv = vec2( c.x * cos( ang ) - c.y * sin( ang ), c.x * sin( ang ) + c.y * cos( ang ) ) + 0.5;
          vFade = sin( 3.14159 * t ) * spraySeed.w * smoothstep( 1.5, 5.0, length( toCam ) );
          gl_Position = projectionMatrix * viewMatrix * vec4( w, 1.0 );
        }`,
      fragmentShader: /* glsl */`
        ${fogGLSL}
        uniform sampler2D uTex; uniform vec3 uSunColor;
        varying vec2 vUv; varying vec3 vWorld; varying float vFade;
        void main() {
          float a = texture2D( uTex, vUv ).a * vFade * 0.55;
          // spray is lit like the air around it: the fog's colour, brighter toward the sun
          float sunAmt = max( dot( normalize( vWorld - cameraPosition ), fogSunDir ), 0.0 );
          vec3 col = mix( fogColor * 1.15, fogSunColor, 0.25 + 0.5 * pow( sunAmt, 3.0 ) ) + uSunColor * 0.04;
          col = mix( col, atmosFogColor( vWorld ), atmosFogFactor( vWorld ) );
          gl_FragColor = vec4( col, a );
        }`,
    });
    mat.onBeforeCompile = (shader) => { attachFogUniforms(shader); };
    return mat;
  }
}
