/**
 * Waterfall v2 (DRIFTWOOD-REMASTER W5) — a stylized cascade for a cliff face: E8 places it in Wreck Cove.
 *
 *   const fall = new Waterfall({ lip: new THREE.Vector3(x, yTop, z), foot: new THREE.Vector3(x2, yPool, z2), width: 3 }).build();
 *   scene.add(fall.group);
 *   game.onUpdate((dt) => fall.update(dt));
 *
 * `lip` is the centre of the brink the water pours over, `foot` the centre of the plunge pool's surface; the sheet leaves
 * the lip moving toward the foot (horizontally) and falls ballistically, so it hangs off the cliff as a curtain instead of
 * lying on the slope. Three draws, all unlit (the sheet reads the sun colour through the fog uniforms, so it follows the
 * day / night clock) and fogged:
 * - **sheet**: a faceted curtain (rows × 4 columns, per-vertex wobble) — cyan-white water with foam streaks that scroll
 *   down it, brighter and wider toward the foot, soft ragged edges.
 * - **splash ring**: foam rings spreading out on the pool from the impact point.
 * - **mist**: soft billboard puffs rising and fading at the foot.
 */
import * as THREE from 'three';
import { attachFogUniforms } from './Atmosphere';

export interface WaterfallSpec {
  lip: THREE.Vector3;
  foot: THREE.Vector3;
  /** width at the lip (m); the curtain spreads ~40 % by the foot */
  width: number;
}

const NOISE = /* glsl */`
  float wfHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float wfNoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(wfHash(i), wfHash(i + vec2(1.0, 0.0)), u.x), mix(wfHash(i + vec2(0.0, 1.0)), wfHash(i + vec2(1.0, 1.0)), u.x), u.y); }`;

export class Waterfall {
  group = new THREE.Group();
  private u = { uTime: { value: 0 } };

  constructor(private spec: WaterfallSpec) {}

  build(): this {
    this.group.add(this.buildSheet(), this.buildRing(), this.buildMist());
    return this;
  }

  update(dt: number): void { this.u.uTime.value += dt; }

  /** the fogged unlit material the three parts share the setup of */
  private material(vert: string, frag: string, extra: Record<string, THREE.IUniform> = {}, blending: THREE.Blending = THREE.NormalBlending): THREE.ShaderMaterial {
    const m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, extra]),
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide, blending,
    });
    Object.assign(m.uniforms, this.u);
    m.onBeforeCompile = (shader) => { attachFogUniforms(shader); };
    return m;
  }

  private buildSheet(): THREE.Mesh {
    const { lip, foot, width } = this.spec;
    const dx = foot.x - lip.x, dz = foot.z - lip.z, run = Math.max(0.5, Math.hypot(dx, dz)), drop = Math.max(1, lip.y - foot.y);
    const fx = dx / run, fz = dz / run, sx = -fz, sz = fx;          // forward (away from the cliff) and sideways
    const ROWS = Math.max(8, Math.round(drop / 1.2)), COLS = 4;
    const pos: number[] = [], uv: number[] = [];
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
    for (let r = 0; r <= ROWS; r++) {
      const t = r / ROWS;
      // ballistic: out along forward ∝ t (constant horizontal speed), down ∝ t² (gravity), ending on the foot
      const out = run * t, y = lip.y - drop * t * t;
      const w = width * (1 + 0.4 * t);
      for (let c = 0; c <= COLS; c++) {
        const s = c / COLS - 0.5, edge = Math.abs(s) * 2;
        const wob = r > 0 && r < ROWS ? 0.12 : 0;
        pos.push(lip.x + fx * out + sx * s * w + rnd() * wob, y + rnd() * wob * (1 - edge * 0.5), lip.z + fz * out + sz * s * w + rnd() * wob);
        uv.push(c / COLS, t);
      }
    }
    const idx: number[] = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const a = r * (COLS + 1) + c, b = a + 1, d = a + COLS + 1, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    const ng = g.toNonIndexed(); g.dispose(); // facets: every triangle its own normal (flat shading from derivatives below)
    const mat = this.material(/* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      varying vec2 vUv; varying vec3 vW;
      void main() {
        vUv = uv;
        vec3 transformed = position;
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        vW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`, /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime;
      varying vec2 vUv; varying vec3 vW;
      ${NOISE}
      void main() {
        vec3 fn = normalize(cross(dFdx(vW), dFdy(vW)));
        float facet = 0.82 + 0.18 * abs(fn.x + fn.z * 0.6);
        // foam streaks: noise stretched along the fall, scrolling down it, thicker toward the foot
        vec2 p = vec2(vUv.x * 7.0, vUv.y * 3.0 - uTime * 1.6);
        float streak = wfNoise(p) * 0.6 + wfNoise(p * vec2(2.3, 1.7) + 4.0) * 0.4;
        float foam = smoothstep(0.42 - vUv.y * 0.25, 0.62 - vUv.y * 0.2, streak);
        vec3 water = mix(vec3(0.18, 0.62, 0.72), vec3(0.95, 0.98, 1.0), foam);
        vec3 col = water * facet * (0.35 + 0.75 * fogSunColor);
        float edge = 1.0 - smoothstep(0.32, 0.5, abs(vUv.x - 0.5) + (wfNoise(vec2(vUv.y * 9.0 - uTime * 2.0, 3.0)) - 0.5) * 0.12);
        float a = edge * mix(0.72, 0.95, foam) * smoothstep(0.0, 0.04, vUv.y + 0.02);
        gl_FragColor = vec4(col, a);
        #include <fog_fragment>
      }`);
    const mesh = new THREE.Mesh(ng, mat);
    mesh.renderOrder = 5; // after the sea
    return mesh;
  }

  private buildRing(): THREE.Mesh {
    const { foot, width } = this.spec;
    const R = width * 1.6 + 1.2;
    const g = new THREE.RingGeometry(0.2, R, 24, 3);
    g.rotateX(-Math.PI / 2);
    g.translate(foot.x, foot.y + 0.04, foot.z);
    const mat = this.material(/* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      varying vec2 vL;
      uniform vec3 uCentre;
      void main() {
        vec3 transformed = position;
        vL = position.xz - uCentre.xz;
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`, /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime; uniform float uR;
      varying vec2 vL;
      ${NOISE}
      void main() {
        float r = length(vL) / uR;
        float ang = atan(vL.y, vL.x);
        // rings spreading outward, broken up by noise around the circle
        float wave = fract(r * 3.0 - uTime * 0.9);
        float ring = smoothstep(0.75, 0.9, wave) * (1.0 - smoothstep(0.93, 1.0, wave));
        float n = wfNoise(vec2(ang * 3.0, r * 4.0 - uTime));
        float core = 1.0 - smoothstep(0.08, 0.35, r);
        float foam = max(core * (0.6 + 0.4 * n), ring * smoothstep(0.35, 0.7, n)) * (1.0 - smoothstep(0.7, 1.0, r));
        vec3 col = vec3(0.95, 0.98, 1.0) * (0.35 + 0.75 * fogSunColor);
        gl_FragColor = vec4(col, foam * 0.9);
        #include <fog_fragment>
      }`, { uCentre: { value: foot.clone() }, uR: { value: R } });
    const mesh = new THREE.Mesh(g, mat);
    mesh.renderOrder = 6;
    return mesh;
  }

  private buildMist(): THREE.Points {
    const { foot, width } = this.spec;
    const N = 26;
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 * 3.7, r = width * 0.4 + ((i * 37) % 11) / 11 * width * 0.8;
      pos[i * 3] = foot.x + Math.cos(a) * r; pos[i * 3 + 1] = foot.y; pos[i * 3 + 2] = foot.z + Math.sin(a) * r;
      seed[i] = ((i * 53) % 17) / 17;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const mat = this.material(/* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      attribute float seed;
      uniform float uTime;
      varying float vA;
      void main() {
        float life = fract(uTime * 0.18 + seed);
        vec3 transformed = position + vec3(sin(seed * 20.0 + uTime * 0.4) * life * 1.2, life * 3.5, cos(seed * 13.0 + uTime * 0.3) * life * 1.2);
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = (1.6 + life * 2.6) * 120.0 / max(1.0, -mvPosition.z);
        vA = sin(life * 3.14159) * 0.22;
        #include <fog_vertex>
      }`, /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.1, length(c)) * vA;
        gl_FragColor = vec4(vec3(0.92, 0.96, 1.0) * (0.4 + 0.7 * fogSunColor), a);
        #include <fog_fragment>
      }`);
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 7;
    return pts;
  }
}
