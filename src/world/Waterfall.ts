/**
 * Waterfall v3 (E150) — Driftwood's toon cascade, a stepped faceted curtain in the Wind Waker / Sea of Thieves manner.
 * It replaced the soft, blurred v2 curtain (DRIFTWOOD-REMASTER W5), which went in E162.
 *
 *   const fall = waterfallFor({ lip, foot, width: 2.2, ground: heightAt, poolRadius: 2.3 }).build();
 *   scene.add(fall.group);
 *   game.onUpdate((dt) => fall.update(dt));
 *
 * `lip` is the centre of the brink the water pours over, `foot` the centre of the plunge pool's surface. The water runs
 * from the lip to the foot in `steps` terraces: each is a short flat shelf (the pour-over lip, or the ledge the step
 * above lands on) and then a ballistic drop. `ground` keeps every vertex a hand above the terrain. Three draws, all unlit
 * (the sun's colour and direction come through the fog uniforms, so they follow the day / night clock), all fogged:
 * - **sheet**: the curtain, pleated into flat facets and shaded in three toon bands. Hard-edged bands of colour down each
 *   drop, a crisp white line at every brink, a scalloped foam band where each step lands, and a few bright streak
 *   dashes that scroll down it. The edges are cut hard with a thin white rim.
 * - **pool rings**: faceted (9-sided) foam rings spreading on the plunge pool from a scalloped white core.
 * - **puffs**: low-poly foam balls boiling at the foot and at each landing, and spray chunks thrown up that shrink away.
 *   Every puff is a 20-face icosahedron, toon-lit in two bands, all of them one merged mesh posed in the vertex shader.
 */
import * as THREE from 'three';
import { attachFogUniforms } from './Atmosphere';

export interface WaterfallSpec {
  lip: THREE.Vector3;
  foot: THREE.Vector3;
  /** width at the lip (m); the curtain spreads ~35 % by the foot */
  width: number;
  /** the terrain's height: the curtain never dips under it (v3) */
  ground?: (x: number, z: number) => number;
  /** the plunge pool's radius (m): the foam rings stay inside it (v3; default 1.1 × width) */
  poolRadius?: number;
  /** terraces from the lip to the foot (v3; default 3) */
  steps?: number;
}

/** what Cove keeps of the cascade */
export interface WaterfallLike {
  readonly group: THREE.Group;
  build: () => WaterfallLike;
  update: (dt: number) => void;
}

/** the shelf's share of each terrace (the flat run before the drop) */
const SHELF = 0.28;
/** the rows of one terrace, as fractions of it: two across the shelf, the rest down the drop */
const ROWS_F = [0, 0.14, SHELF, 0.42, 0.56, 0.7, 0.85, 1];
/** the columns across the curtain; the odd ones stand proud, so the sheet is pleated into flat facets */
const COLS = 6;

const HASH = /* glsl */`
  float wfH(float n) { return fract(sin(n * 127.1) * 43758.5453); }`;

export class Waterfall implements WaterfallLike {
  group = new THREE.Group();
  private u = { uTime: { value: 0 } };

  constructor(private spec: WaterfallSpec) {}

  build(): this {
    this.group.add(this.buildSheet(), this.buildRings(), this.buildPuffs());
    return this;
  }

  update(dt: number): void { this.u.uTime.value += dt; }

  /** the fogged unlit material the three parts share the setup of */
  private material(vert: string, frag: string, extra: Record<string, THREE.IUniform> = {}, side: THREE.Side = THREE.DoubleSide): THREE.ShaderMaterial {
    const m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, extra]),
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, fog: true, side,
    });
    Object.assign(m.uniforms, this.u);
    m.onBeforeCompile = (shader) => { attachFogUniforms(shader); };
    return m;
  }

  /** the curtain's frame: forward (away from the cliff) and sideways unit vectors, the run and the drop */
  private frame(): { fx: number; fz: number; sx: number; sz: number; run: number; drop: number } {
    const { lip, foot } = this.spec;
    const dx = foot.x - lip.x, dz = foot.z - lip.z, run = Math.max(0.5, Math.hypot(dx, dz)), drop = Math.max(1, lip.y - foot.y);
    const fx = dx / run, fz = dz / run;
    return { fx, fz, sx: -fz, sz: fx, run, drop };
  }

  /** a point on the curtain: terrace k, fraction f down it, s ∈ [-0.5, 0.5] across; `proud` pushes it off the sheet */
  private at(k: number, f: number, s: number, proud: number, jitter: number): THREE.Vector3 {
    const { lip, width } = this.spec, steps = this.spec.steps ?? 3;
    const { fx, fz, sx, sz, run, drop } = this.frame();
    const t = (k + f) / steps;
    const onShelf = f <= SHELF;
    // a shelf barely falls; the drop below it is ballistic (∝ the square of the time since the brink)
    const g = onShelf ? 0.05 * (f / SHELF) : 0.05 + 0.95 * ((f - SHELF) / (1 - SHELF)) ** 2;
    const out = run * t + (onShelf ? 0 : proud);
    const w = width * (1 + 0.35 * t);
    const x = lip.x + fx * out + sx * s * w, z = lip.z + fz * out + sz * s * w;
    let y = lip.y - (drop * (k + g)) / steps + (onShelf ? proud : 0) + jitter;
    if (this.spec.ground) y = Math.max(y, this.spec.ground(x, z) + 0.12);
    return new THREE.Vector3(x, y, z);
  }

  private buildSheet(): THREE.Mesh {
    const steps = this.spec.steps ?? 3, rows = ROWS_F.length - 1;
    // one grid of corners, row r global (the last row of a terrace is the first of the next), so the facets are watertight
    const hash = (a: number, b: number): number => { const v = Math.sin(a * 91.7 + b * 47.3) * 43758.5453; return v - Math.floor(v) - 0.5; };
    const corner = (k: number, ri: number, c: number): THREE.Vector3 => {
      const row = k * rows + ri, edge = c === 0 || c === COLS, brink = ri === 0 || ri === rows || ROWS_F[ri] === SHELF;
      const proud = c % 2 === 1 ? 0.07 : 0;
      const f = ROWS_F[ri] ?? 0;
      return this.at(k, f, c / COLS - 0.5, proud, edge || brink ? 0 : hash(row, c) * 0.08);
    };
    const pos: number[] = [], uv: number[] = [], stp: number[] = [];
    const push = (k: number, ri: number, c: number): void => {
      const p = corner(k, ri, c);
      pos.push(p.x, p.y, p.z);
      uv.push(c / COLS, (k + (ROWS_F[ri] ?? 0)) / steps);
      stp.push(ROWS_F[ri] ?? 0, k);
    };
    for (let k = 0; k < steps; k++) for (let ri = 0; ri < rows; ri++) for (let c = 0; c < COLS; c++) {
      push(k, ri, c); push(k, ri + 1, c); push(k, ri, c + 1);
      push(k, ri, c + 1); push(k, ri + 1, c); push(k, ri + 1, c + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aStep', new THREE.Float32BufferAttribute(stp, 2));
    g.computeBoundingSphere();
    const mat = this.material(/* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      attribute vec2 aStep;
      varying vec2 vUv; varying vec2 vStep; varying vec3 vW;
      void main() {
        vUv = uv; vStep = aStep;
        vec3 transformed = position;
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        vW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`, /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime;
      varying vec2 vUv; varying vec2 vStep; varying vec3 vW;
      ${HASH}
      // a hard edge, one screen pixel of anti-aliasing
      float edge(float e, float x) { float w = fwidth(x) * 0.75; return smoothstep(e - w, e + w, x); }
      void main() {
        vec3 fn = normalize(cross(dFdx(vW), dFdy(vW)));
        float lit = abs(dot(fn, fogSunDir));
        float facet = lit > 0.55 ? 1.0 : lit > 0.25 ? 0.86 : 0.74;          // three toon bands across the pleats
        float f = vStep.x, k = vStep.y;
        float d = clamp((f - ${SHELF.toFixed(2)}) / ${(1 - SHELF).toFixed(2)}, 0.0, 1.0); // how far down this terrace's drop
        // the body: glassy cyan where it pours, deeper teal down the drop, in hard bands
        vec3 col = mix(vec3(0.50, 0.88, 0.94), vec3(0.24, 0.72, 0.84), edge(0.22, d));
        col = mix(col, vec3(0.15, 0.56, 0.72), edge(0.62, d));
        // streaks: a few lanes of bright dashes scrolling down, longer and more of them toward the foot of each drop
        float lanes = 7.0, x = vUv.x * lanes, lane = floor(x), h = wfH(lane + k * 13.0);
        float inLane = 1.0 - edge(0.09 + 0.08 * h, abs(fract(x) - 0.5 - (h - 0.5) * 0.3));
        float p = fract(vUv.y * 6.0 - uTime * (1.1 + 0.5 * h) + h * 7.0);
        float dash = 1.0 - edge(0.22 + 0.3 * d, p);
        float streak = inLane * dash * step(0.3, h + d * 0.4);
        col = mix(col, vec3(0.93, 0.99, 1.0), streak);
        // the brink: a crisp white roll where the shelf tips over, a pale band just below it
        float brink = 1.0 - edge(0.035, abs(f - ${SHELF.toFixed(2)} - 0.01));
        col = mix(col, vec3(0.80, 0.97, 1.0), (1.0 - edge(0.1, abs(f - ${(SHELF + 0.08).toFixed(2)}))) * 0.5);
        col = mix(col, vec3(1.0), brink);
        // where a drop lands on the next shelf: scalloped foam, bobbing
        float scallop = 0.16 + 0.05 * sin(vUv.x * 40.0 + k * 2.0 + uTime * 5.0) + 0.03 * sin(vUv.x * 17.0 - uTime * 3.0);
        float landing = k > 0.5 ? 1.0 - edge(scallop, f) : 0.0;
        col = mix(col, vec3(0.97, 1.0, 1.0), landing);
        // the last metre of the last drop churns white into the pool
        col = mix(col, vec3(0.95, 1.0, 1.0), edge(0.955 + 0.02 * sin(vUv.x * 30.0 + uTime * 6.0), vUv.y));
        // the sides: a hard cut with a thin white rim
        float e = abs(vUv.x - 0.5) * 2.0;
        col = mix(col, vec3(0.9, 0.98, 1.0), edge(0.88, e));
        float a = (1.0 - edge(0.985, e)) * mix(0.95, 1.0, max(streak, max(brink, landing)));
        gl_FragColor = vec4(col * facet * (0.35 + 0.75 * fogSunColor), a);
        #include <fog_fragment>
      }`);
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = 'waterfall-sheet';
    mesh.renderOrder = 5; // after the sea
    return mesh;
  }

  private buildRings(): THREE.Mesh {
    const { foot, width } = this.spec;
    const R = this.spec.poolRadius ?? width * 1.1;
    const g = new THREE.CircleGeometry(R, 18);
    g.rotateX(-Math.PI / 2);
    g.translate(foot.x, foot.y + 0.05, foot.z);
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
      ${HASH}
      float edge(float e, float x) { float w = fwidth(x) * 0.75; return smoothstep(e - w, e + w, x); }
      void main() {
        float ang = atan(vL.y, vL.x), seg = 6.2831853 / 9.0;
        float r = length(vL) / uR;
        float rp = r * cos(mod(ang + 0.3, seg) - seg * 0.5);          // the distance to a 9-sided polygon: faceted rings
        float side = floor((ang + 3.1415927) / seg);
        // the churn at the core: a white disc with a scalloped rim
        float core = 1.0 - edge(0.3 + 0.05 * sin(ang * 7.0 + uTime * 4.0), rp);
        // three rings spreading out, thinning as they go, each broken into dashes on a few of the polygon's sides
        float ring = 0.0, pale = 0.0;
        for (int i = 0; i < 3; i++) {
          float ph = fract(uTime * 0.42 + float(i) / 3.0);
          float rad = mix(0.3, 0.95, ph), th = mix(0.055, 0.012, ph);
          float on = step(0.28, wfH(side + float(i) * 11.0 + floor(uTime * 0.42 + float(i) / 3.0) * 3.0));
          float band = (1.0 - edge(th, abs(rp - rad))) * on;
          ring = max(ring, band * step(ph, 0.6));
          pale = max(pale, band * step(0.6, ph));
        }
        float foam = max(core, ring);
        vec3 col = mix(vec3(0.75, 0.93, 0.98), vec3(0.97, 1.0, 1.0), foam);
        float a = max(foam, pale * 0.75) * (1.0 - edge(0.98, rp));
        gl_FragColor = vec4(col * (0.35 + 0.75 * fogSunColor), a);
        #include <fog_fragment>
      }`, { uCentre: { value: foot.clone() }, uR: { value: R } });
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = 'waterfall-rings';
    mesh.renderOrder = 6;
    return mesh;
  }

  private buildPuffs(): THREE.Mesh {
    const { foot, width } = this.spec, steps = this.spec.steps ?? 3;
    const { fx, fz, sx, sz } = this.frame();
    const ico = new THREE.IcosahedronGeometry(1, 0);
    const local = ico.getAttribute('position');
    // [centre, radius, seed, kind (0 foam at the foot, 1 foam on a landing, 2 spray), out dir x/z]
    const puffs: { c: THREE.Vector3; r: number; seed: number; kind: number; ox: number; oz: number }[] = [];
    let seed = 11;
    const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const wFoot = width * 1.35;
    for (let i = 0; i < 12; i++) {
      const s = (i / 11 - 0.5) * wFoot * 0.95, fwd = (rnd() - 0.35) * 0.9;
      const c = new THREE.Vector3(foot.x + sx * s + fx * fwd, foot.y + 0.1, foot.z + sz * s + fz * fwd);
      const ox = sx * Math.sign(s) * 0.5 + fx * 0.8, oz = sz * Math.sign(s) * 0.5 + fz * 0.8;
      puffs.push({ c, r: 0.32 + rnd() * 0.3, seed: rnd(), kind: 0, ox, oz });
    }
    for (let k = 1; k < steps; k++) for (let i = 0; i < 4; i++) {
      const s = (i / 3 - 0.5) * 0.75 + (rnd() - 0.5) * 0.1;
      const c = this.at(k, 0.06, s, 0, 0.05);
      puffs.push({ c, r: 0.18 + rnd() * 0.12, seed: rnd(), kind: 1, ox: fx * 0.5, oz: fz * 0.5 });
    }
    for (let i = 0; i < 8; i++) {
      const s = (rnd() - 0.5) * wFoot, fwd = rnd() * 0.8;
      const c = new THREE.Vector3(foot.x + sx * s + fx * fwd, foot.y + 0.3, foot.z + sz * s + fz * fwd);
      puffs.push({ c, r: 0.14 + rnd() * 0.1, seed: rnd(), kind: 2, ox: fx + sx * (rnd() - 0.5), oz: fz + sz * (rnd() - 0.5) });
    }
    const n = local.count, N = puffs.length;
    const pos = new Float32Array(N * n * 3), centre = new Float32Array(N * n * 3), info = new Float32Array(N * n * 4);
    puffs.forEach((p, j) => {
      for (let v = 0; v < n; v++) {
        const o = (j * n + v) * 3, q = (j * n + v) * 4;
        pos[o] = local.getX(v); pos[o + 1] = local.getY(v) * 0.8; pos[o + 2] = local.getZ(v); // a little squat
        centre[o] = p.c.x; centre[o + 1] = p.c.y; centre[o + 2] = p.c.z;
        info[q] = p.r; info[q + 1] = p.seed; info[q + 2] = p.kind; info[q + 3] = Math.atan2(p.oz, p.ox);
      }
    });
    ico.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aCentre', new THREE.BufferAttribute(centre, 3));
    g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
    g.boundingSphere = new THREE.Sphere(foot.clone().lerp(this.spec.lip, 0.5), foot.distanceTo(this.spec.lip) * 0.5 + width + 4);
    const mat = this.material(/* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      attribute vec3 aCentre;
      attribute vec4 aInfo;
      uniform float uTime;
      varying vec3 vW; varying float vA; varying float vMist;
      void main() {
        float r = aInfo.x, sd = aInfo.y, kind = aInfo.z;
        vec2 out2 = vec2(cos(aInfo.w), sin(aInfo.w));
        vec3 c = aCentre;
        float s; vA = 1.0; vMist = 0.0;
        if (kind > 1.5) {
          // spray: a chunk thrown up off the churn, shrinking away as it rises and drifts out, then again at the foot
          float life = fract(uTime * 0.35 + sd);
          c += vec3(out2.x * life * 0.8, sin(life * 2.2) * 1.2, out2.y * life * 0.8);
          s = r * (1.0 - life);
          vA = 0.9; vMist = 1.0;
        } else {
          // foam: each ball boils up from nothing, drifts a little outward and sinks back
          float life = fract(uTime * (kind > 0.5 ? 0.9 : 0.62) + sd);
          c += vec3(out2.x, 0.0, out2.y) * life * (kind > 0.5 ? 0.25 : 0.55);
          c.y += 0.12 * sin(life * 3.14159) * r;
          s = r * (0.12 + 0.95 * sin(life * 3.14159));
        }
        vec3 transformed = c + position * s;
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        vW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`, /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      varying vec3 vW; varying float vA; varying float vMist;
      void main() {
        vec3 fn = normalize(cross(dFdx(vW), dFdy(vW)));
        float ndl = dot(fn, fogSunDir);
        // two toon bands: sunlit white, a pale-blue shade; the spray is paler
        vec3 col = ndl > 0.15 ? vec3(0.98, 1.0, 1.0) : vec3(0.64, 0.84, 0.93);
        col = mix(col, vec3(1.0), vMist * 0.7);
        gl_FragColor = vec4(col * (0.35 + 0.75 * fogSunColor), vA);
        #include <fog_fragment>
      }`, {}, THREE.FrontSide);
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = 'waterfall-puffs';
    mesh.renderOrder = 7;
    return mesh;
  }
}

/** the toon cascade (E150) */
export function waterfallFor(spec: WaterfallSpec): WaterfallLike {
  return new Waterfall(spec);
}
