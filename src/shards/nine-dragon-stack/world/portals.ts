// G224 (E435): the portals' look, in the shard's neon: each a floating iris ring with a slow cyan-to-magenta swirl inside
// it and sparks drawn in along a spiral. Five portals (one on each deck, one in Lantern Square) in three draws for the
// lot: the rings and the swirl discs are instanced, the sparks one point cloud, all animated in their shaders off the
// look's shared clock (no per-frame CPU work, no full-screen pass). Two paper lanterns hang on each deck's end wall
// behind its ring (the fragment's lantern batch). The ride itself is world/portalRide.ts; the plan world/portalPlan.ts.
import {
  AdditiveBlending, BufferGeometry, CircleGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Points,
  Quaternion, ShaderMaterial, TorusGeometry, Vector3,
} from 'three';
import type { Ctx } from './ctx';
import type { Shared } from '../look/style';
import { DECK_PORTALS, RING, SQUARE_PORTAL, type Portal } from './portalPlan';

/** sparks per portal */
const SPARKS = 36;

const VS_RING = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const FS_RING = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
  // a bright iris tube with a cyan pulse running round it
  float run = 0.5 + 0.5 * sin(vUv.x * 6.2832 * 3.0 - uTime * 2.4);
  vec3 col = mix(vec3(0.62, 0.42, 1.35), vec3(0.45, 1.25, 1.45), run * run);
  gl_FragColor = vec4(col * (1.15 + 0.35 * sin(uTime * 1.7)), 1.0);
}`;
const VS_DISC = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const FS_DISC = /* glsl */ `
uniform float uTime;
uniform float uR;
varying vec2 vP;
void main() {
  vec2 p = vP / uR;
  float r = length(p), a = atan(p.y, p.x);
  float arms = 0.5 + 0.5 * sin(a * 3.0 + r * 9.0 - uTime * 2.2);
  float fine = 0.5 + 0.5 * sin(a * 7.0 - r * 16.0 + uTime * 3.1);
  float edge = smoothstep(1.0, 0.82, r), core = smoothstep(0.55, 0.0, r);
  vec3 col = mix(vec3(0.12, 0.75, 1.0), vec3(1.0, 0.22, 0.7), arms) * (0.45 + 0.55 * fine) + vec3(0.75, 0.6, 1.0) * core;
  float k = edge * (0.22 + 0.5 * arms * fine + 0.35 * core);
  gl_FragColor = vec4(col * k, 1.0);
}`;
const VS_SPARK = /* glsl */ `
uniform float uTime;
uniform float uR;
attribute vec3 aAcross;
attribute vec2 aSeed;
varying float vFade;
void main() {
  // each spark spirals in from the ring to the centre and starts again, a little in front of or behind the disc
  float life = fract(uTime * (0.22 + 0.18 * aSeed.y) + aSeed.x);
  float ang = aSeed.x * 6.2832 + life * (3.0 + 2.0 * aSeed.y);
  float rad = uR * (1.05 - life * 0.95);
  vec3 normal = cross(aAcross, vec3(0.0, 1.0, 0.0));
  vec3 p = position + aAcross * cos(ang) * rad + vec3(0.0, sin(ang) * rad, 0.0) + normal * (aSeed.y - 0.5) * 0.5;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vFade = sin(life * 3.1416);
  gl_PointSize = clamp(90.0 / -mv.z, 1.5, 14.0);
  gl_Position = projectionMatrix * mv;
}`;
const FS_SPARK = /* glsl */ `
varying float vFade;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = 1.0 - dot(c, c);
  if (d <= 0.0) discard;
  gl_FragColor = vec4(vec3(0.85, 0.7, 1.0) * d * d * vFade * 1.6, 1.0);
}`;

/** the portals' drawn parts (named for the budget lanes) */
export interface PortalLook { readonly root: Group; readonly portals: readonly Portal[] }

/** every portal's ring centre and its orientation (the ring's plane faces along the portal's normal) */
function frames(portals: readonly Portal[]): Matrix4[] {
  const up = new Vector3(0, 1, 0);
  return portals.map((p) => new Matrix4().compose(new Vector3(p.x, p.y + RING.lift, p.z), new Quaternion().setFromAxisAngle(up, Math.atan2(p.nx, p.nz)), new Vector3(1, 1, 1)));
}

/** build the five portals' look under one group; their shaders read `shared.u.uTime` */
export function buildPortals(ctx: Ctx, shared: Shared): PortalLook {
  const portals: Portal[] = [...DECK_PORTALS, SQUARE_PORTAL];
  const root = new Group(); root.name = 'portals';
  const at = frames(portals);
  const time = shared.u.uTime;
  const ring = new InstancedMesh(new TorusGeometry(RING.r, RING.tube, 8, 48),
    new ShaderMaterial({ uniforms: { uTime: time }, vertexShader: VS_RING, fragmentShader: FS_RING }), portals.length);
  const disc = new InstancedMesh(new CircleGeometry(RING.r - RING.tube * 0.5, 40),
    new ShaderMaterial({ uniforms: { uTime: time, uR: { value: RING.r } }, vertexShader: VS_DISC, fragmentShader: FS_DISC,
      transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide }), portals.length);
  at.forEach((m, i) => { ring.setMatrixAt(i, m); disc.setMatrixAt(i, m); });
  for (const mesh of [ring, disc]) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
  disc.renderOrder = 4;
  // the sparks: one point cloud for every portal, each spark knowing its portal's centre and across axis
  const pos: number[] = [], across: number[] = [], seed: number[] = [];
  portals.forEach((p, i) => {
    for (let s = 0; s < SPARKS; s++) {
      pos.push(p.x, p.y + RING.lift, p.z); across.push(-p.nz, 0, p.nx);
      // a fixed, even spread (no random draw: the same sparks every load)
      seed.push(((s * 0.618034) + i * 0.13) % 1, ((s * 0.381966) + i * 0.29) % 1);
    }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aAcross', new Float32BufferAttribute(across, 3));
  g.setAttribute('aSeed', new Float32BufferAttribute(seed, 2));
  const sparks = new Points(g, new ShaderMaterial({ uniforms: { uTime: time, uR: { value: RING.r } }, vertexShader: VS_SPARK, fragmentShader: FS_SPARK,
    transparent: true, depthWrite: false, blending: AdditiveBlending }));
  // the spread spans the whole cell: one sphere round it all (three culls the cloud whole)
  g.computeBoundingSphere();
  sparks.renderOrder = 5;
  ring.name = 'portal-rings'; disc.name = 'portal-swirls'; sparks.name = 'portal-sparks';
  root.add(ring, disc, sparks);
  // two red paper lanterns on each deck's end wall, either side of its ring, in the fragment's lantern batch
  for (const p of DECK_PORTALS) {
    for (const s of [-1, 1]) {
      const back = 1.75, side = RING.r + 0.9;
      ctx.lantern(p.x + p.nx * back - p.nz * side * s, 4.4, p.z + p.nz * back + p.nx * side * s, 1.1);
    }
  }
  return { root, portals };
}
