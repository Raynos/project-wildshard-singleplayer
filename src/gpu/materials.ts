/**
 * TSL ports of Driftwood's patched materials (the GLSL lives in each owner's module; the port reads that module's
 * live uniforms through `harvest`, so the owner keeps driving them):
 *
 *   ground-cover      GroundCover  grow-in by distance, bend away from the player, wind sway (instanced)
 *   palms-sway        Palms.ts     frond sway          rope-bridge-sway  RopeBridge.ts   deck sway
 *   seabed-sway       Seabed.ts    kelp / coral current
 *   gulls-anim        Gulls.ts     wings / head / legs from the per-instance aAnim (before the instance transform)
 *   shrine-pool, cove-pool         caustic / ripple tint on the pool water
 *   lowpoly-eyeglow   entities/lowpoly.ts   night eye glow (emissive)
 *   ridge             Horizon.ts   the far ranges: aerial haze instead of the shard fog
 *
 *   installPorts();   // GpuPath.build()
 */
import * as THREE from 'three';
import {
  abs, attribute, cameraPosition, cos, dot, float, fract, instancedDynamicBufferAttribute, length, max, mix, modelWorldMatrix,
  normalize, output, positionGeometry, positionLocal, positionWorld, pow, select, sin, smoothstep, uniform, vec2, vec3, vec4, vertexColor,
  materialColor, materialEmissive,
} from 'three/tsl';
import { InstancedInterleavedBuffer, type Node, type NodeBuilder } from 'three/webgpu';
import { asVec3, asVec4, gpuUniforms } from './bridge';
import { harvest, hFloat, hVec2, hVec3, registerPort, toonCopy } from './ports';
import { ToonStandardNodeMaterial } from './toon';

const fU = hFloat, v3U = hVec3, v2U = hVec2;

/** a toon material whose vertices are displaced BEFORE the instance / skin transform (the GLSL patches' `transformed`) */
export class PreDisplacedToonMaterial extends ToonStandardNodeMaterial {
  /** before the instance / skin transform (model-local, the GLSL `transformed`) */
  preDisplace: ((builder: NodeBuilder) => Node<'vec3'>) | null = null;
  /** after it (instanced position, per object — null leaves it) */
  postDisplace: ((builder: NodeBuilder) => Node<'vec3'> | null) | null = null;
  override setupPosition(builder: NodeBuilder): Node<'vec3'> {
    if (this.preDisplace) positionLocal.assign(this.preDisplace(builder));
    const out = super.setupPosition(builder);
    const post = this.postDisplace?.(builder) ?? null;
    if (post) positionLocal.assign(post);
    return post ? positionLocal : asVec3(out);
  }
}

const rot2 = (p: Node<'vec2'>, a: Node<'float'>): Node<'vec2'> => { const c = cos(a), s = sin(a); return vec2(c.mul(p.x).sub(s.mul(p.y)), s.mul(p.x).add(c.mul(p.y))); };
const num = (src: string, re: RegExp, i = 1): number => { const m = re.exec(src); const v = m?.[i]; if (v === undefined) throw new Error(`[gpu] constant not found: ${String(re)}`); return Number.parseFloat(v); };

/** the instance matrix as a node, from the mesh's own array (per mesh: the render object cache keys instanced meshes by uuid) */
const matrixBuffers = new WeakMap<THREE.InstancedMesh, InstancedInterleavedBuffer>();
function instanceFrameOf(builder: NodeBuilder): { origin: Node<'vec3'>; axis0: Node<'vec3'> } | null {
  const target: THREE.Object3D = builder.object;
  if (!(target instanceof THREE.InstancedMesh)) return null;
  const obj = target as THREE.InstancedMesh;
  let buf = matrixBuffers.get(obj);
  if (!buf) { buf = new InstancedInterleavedBuffer(obj.instanceMatrix.array, 16, 1); buf.setUsage(THREE.DynamicDrawUsage); matrixBuffers.set(obj, buf); }
  const b = buf, im = obj.instanceMatrix;
  const col = (o: number): Node<'vec4'> => asVec4(instancedDynamicBufferAttribute(b, 'vec4', 16, o));
  const sync = uniform(0).onObjectUpdate(() => { if (b.version !== im.version) b.version = im.version; return 0; });
  return { axis0: col(0).xyz, origin: col(12).xyz.add(sync) };
}

export function installPorts(): void {
  // ── the sway family: world-still roots, travelling tips ──
  registerPort('palms-sway', (src) => {
    const h = harvest(src), t = fU(h, 'uTime');
    const sw = attribute<'vec2'>('sway', 'vec2'), w = sw.x, ph = sw.y;
    const g = sin(t.mul(1.3).add(ph)).mul(0.6).add(sin(t.mul(2.9).add(ph.mul(1.7))).mul(0.25));
    const m = toonCopy(src, ToonStandardNodeMaterial);
    m.positionNode = positionLocal.add(vec3(g.mul(w).mul(0.22), abs(g).mul(w).mul(-0.05), cos(t.mul(1.1).add(ph)).mul(w).mul(0.14)));
    return m;
  });
  registerPort('seabed-sway', (src) => {
    const h = harvest(src), t = fU(h, 'uTime');
    const sw = attribute<'vec2'>('sway', 'vec2'), w = sw.x, ph = sw.y;
    const g = sin(t.mul(0.8).add(ph)).mul(0.7).add(sin(t.mul(1.9).add(ph.mul(1.7))).mul(0.3));
    const m = toonCopy(src, PreDisplacedToonMaterial);
    m.preDisplace = () => positionLocal.add(vec3(g.mul(w).mul(0.35), abs(g).mul(w).mul(-0.08), cos(t.mul(0.65).add(ph.mul(1.3))).mul(w).mul(0.28)));
    return m;
  });
  registerPort('rope-bridge-sway', (src) => {
    const h = harvest(src), t = fU(h, 'uTime'), side = v3U(h, 'uSide');
    const sway = attribute<'float'>('sway', 'float');
    const g = sin(t.mul(0.9)).mul(0.7).add(sin(t.mul(2.3).add(1)).mul(0.3));
    const m = toonCopy(src, ToonStandardNodeMaterial);
    m.positionNode = positionLocal.add(side.mul(g.mul(sway).mul(0.08))).sub(vec3(0, abs(g).mul(sway).mul(0.03), 0));
    return m;
  });

  // ── gulls: the per-instance pose (flap, head yaw, wing fold, leg tuck) bends the local mesh, then the instance places it ──
  registerPort('gulls-anim', (src) => {
    const vs = harvest(src).vertexShader;
    const elbow = num(vs, /abs\(position\.x\) > ([\d.]+)/), eY = num(vs, /vec2 e = vec2\([\d.]+ \* side, ([\d.]+)\)/);
    const sX = num(vs, /vec2 s = vec2\(([\d.]+) \* side/), sY = num(vs, /vec2 s = vec2\([\d.]+ \* side, ([\d.]+)\)/);
    const nX = num(vs, /vec2 n = vec2\((-?[\d.]+), (-?[\d.]+)\)/, 1), nZ = num(vs, /vec2 n = vec2\((-?[\d.]+), (-?[\d.]+)\)/, 2);
    const hY = num(vs, /vec2 h = vec2\((-?[\d.]+), (-?[\d.]+)\)/, 1), hZ = num(vs, /vec2 h = vec2\((-?[\d.]+), (-?[\d.]+)\)/, 2);
    const m = toonCopy(src, PreDisplacedToonMaterial);
    m.preDisplace = () => {
      const part = attribute<'float'>('aPart', 'float'), anim = attribute<'vec4'>('aAnim', 'vec4');
      const flap = anim.x, headYaw = anim.y, fold = anim.z, tuck = anim.w;
      const p = positionLocal;
      // wing (part 1 left, 2 right)
      const side = select(part.equal(1), float(-1), float(1));
      const k = float(1).sub(float(1).sub(tuck).mul(0.45));
      const sx = side.mul(sX), ex0 = side.mul(elbow);
      const ex = ex0.sub(sx).mul(k).add(sx);
      const xy0 = vec2(p.x.sub(sx).mul(k).add(sx), p.y);
      const e = vec2(ex, eY), s = vec2(sx, sY);
      const hand = abs(positionGeometry.x).greaterThan(elbow - 0.001);
      const xy1 = select(hand, rot2(xy0.sub(e), fold.negate().mul(side)).add(e), xy0);
      const xy2 = rot2(xy1.sub(s), flap.mul(side)).add(s);
      const sw = float(1).sub(tuck).mul(1.25), sz = vec2(sx, 0.02);
      const xz = rot2(vec2(xy2.x, p.z).sub(sz), sw.negate().mul(side)).add(sz);
      const wing = vec3(xz.x, xy2.y, xz.y);
      // head (part 3): about the neck; legs (part ≥ 4): tucked about the hip
      const n = vec2(nX, nZ), hz = rot2(p.xz.sub(n), headYaw).add(n);
      const head = vec3(hz.x, p.y, hz.y);
      const hip = vec2(hY, hZ), yz = rot2(p.yz.sub(hip), tuck.negate().mul(1.35)).add(hip);
      const legs = vec3(p.x, yz.x, yz.y);
      const isWing = part.equal(1).or(part.equal(2));
      return select(isWing, wing, select(part.equal(3), head, select(part.greaterThanEqual(4), legs, p)));
    };
    return m;
  });

  // ── ground cover: grow in from the draw edge, bend away from the player's legs, sway in the shared wind ──
  registerPort('ground-cover', (src) => {
    const h = harvest(src);
    const uPlayer = v3U(h, 'uPlayer'), uTime = fU(h, 'uTime'), uWind = fU(h, 'uWind'), uR = v2U(h, 'uR');
    const m = toonCopy(src, PreDisplacedToonMaterial);
    m.postDisplace = (builder) => {
      // after the instance transform: the instance's own origin and scale come from its matrix
      const M = instanceFrameOf(builder);
      if (!M) return null;
      const io = M.origin.toVar();
      const ioW = modelWorldMatrix.mul(vec4(io, 1)).xyz.toVar();
      const scale = length(M.axis0);
      const away = ioW.xz.sub(uPlayer.xz).toVar();
      const dl = max(length(away), 1e-3).toVar();
      const k = float(1).sub(smoothstep(uR.x, uR.y, dl));
      const hgt = max(positionGeometry.y, 0).toVar();
      const push = away.div(dl).mul(float(1).sub(smoothstep(0.35, 1.5, dl))).mul(1.1);
      const ph = ioW.x.mul(0.31).add(ioW.z.mul(0.23));
      const wind = vec2(sin(uTime.mul(1.7).add(ph)).add(sin(uTime.mul(3.1).add(ph.mul(1.7))).mul(0.5)), cos(uTime.mul(1.3).add(ph)).mul(0.6)).mul(uWind.mul(0.18).add(0.05));
      const off = push.add(wind).mul(hgt).toVar();
      return io.add(positionLocal.sub(io).mul(k)).add(vec3(off.x, length(off).mul(0.4).mul(hgt).mul(scale).negate(), off.y));
    };
    return m;
  });

  // ── pools: the caustic / ripple tint over the pool's own colour ──
  registerPort('shrine-pool', (src) => {
    const t = fU(harvest(src), 'uTime'), w = positionWorld;
    const wave = sin(w.x.mul(2.3).add(t.mul(1.1))).mul(sin(w.z.mul(2.9).sub(t.mul(0.9)))).add(sin(w.x.add(w.z).mul(4.1).add(t.mul(1.7))).mul(0.5));
    const m = toonCopy(src, ToonStandardNodeMaterial);
    const base = src instanceof THREE.MeshStandardMaterial && src.vertexColors ? materialColor.mul(vertexColor().rgb) : materialColor;
    m.colorNode = mix(base, vec3(0.55, 0.95, 0.95), smoothstep(0.9, 1.4, wave).mul(0.45));
    m.vertexColors = false;
    return m;
  });
  registerPort('cove-pool', (src) => {
    const t = fU(harvest(src), 'uTime'), w = positionWorld;
    const r = length(fract(w.xz.mul(0.11)).sub(0.5)).mul(9);
    const wave = sin(r.mul(6).sub(t.mul(2.2))).mul(sin(w.x.mul(3.1).add(t))).mul(0.5).add(0.5);
    const crest = smoothstep(0.75, 1, wave);
    const m = toonCopy(src, ToonStandardNodeMaterial);
    const base = src instanceof THREE.MeshStandardMaterial && src.vertexColors ? materialColor.mul(vertexColor().rgb) : materialColor;
    m.colorNode = mix(base, vec3(0.12, 0.4, 0.5), crest.mul(0.4).add(sin(w.z.mul(5).add(t.mul(1.7))).mul(0.06)));
    m.vertexColors = false;
    return m;
  });

  // ── creatures' eyes at night ──
  registerPort('lowpoly-eyeglow', (src) => {
    const glow = v3U(harvest(src), 'uEyeGlow');
    const m = toonCopy(src, ToonStandardNodeMaterial);
    m.emissiveNode = materialEmissive.add(glow.mul(attribute<'float'>('aGlow', 'float')));
    return m;
  });

  // ── the far ranges (Horizon.ts): aerial haze toward a cool blue, warmer toward the sun, instead of the shard fog ──
  registerPort('ridge', (src, base) => {
    const haze = fU(harvest(src), 'uHaze'), F = gpuUniforms().fog;
    const m = base();
    const ray = normalize(positionWorld.sub(cameraPosition));
    const sunAmt = max(dot(ray, F.fogSunDir), 0);
    const hazeCol = mix(vec3(0.5, 0.58, 0.74), F.fogSunColor.mul(0.9), pow(sunAmt, 3).mul(0.7));
    m.fog = false;
    m.outputNode = vec4(mix(output.rgb, hazeCol, haze), output.a);
    return m;
  });
}
