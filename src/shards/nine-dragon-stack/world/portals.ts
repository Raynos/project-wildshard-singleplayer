// G224 (E435): the portals' look, in the shard's neon: each a floating iris ring with a slow cyan-to-magenta swirl inside
// it and sparks drawn in along a spiral. Five portals (one on each deck, one in Lantern Square) in three draws for the
// lot: the rings and the swirl discs are instanced, the sparks one point cloud, all animated in their shaders off the
// look's shared clock (no per-frame CPU work, no full-screen pass). Two paper lanterns hang on each deck's end wall
// behind its ring (the fragment's lantern batch). The ride itself is world/portalRide.ts; the plan world/portalPlan.ts.
// SHARD-PLATFORM M3: the three programs' GLSL is data (data/portalLook.ts).
import {
  AdditiveBlending, BufferGeometry, CircleGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Points,
  Quaternion, ShaderMaterial, TorusGeometry, Vector3,
} from 'three';
import type { Ctx } from './ctx';
import type { Shared } from '../look/style';
import { DECK_PORTALS, RING, SQUARE_PORTAL, type Portal } from './portalPlan';
import { FS_DISC, FS_RING, FS_SPARK, VS_DISC, VS_RING, VS_SPARK } from '../data/portalLook';

/** sparks per portal */
const SPARKS = 36;

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
