// G224 (E435): the portals' look, in the shard's neon: each a floating iris ring with a slow cyan-to-magenta swirl inside
// it and sparks drawn in along a spiral. Five portals (one on each deck, one in Lantern Square) in three draws for the
// lot: the rings and the swirl discs are instanced, the sparks one point cloud, all animated in their shaders off the
// graph clock (no per-frame CPU work, no full-screen pass). Two paper lanterns hang on each deck's end wall behind its
// ring (the fragment's lantern batch). The ride itself is world/portalRide.ts; the plan world/portalPlan.ts.
// SHARD-PLATFORM M3: the three draws are the look graphs 'nine-portal-ring', 'nine-portal-disc' (additive, double-sided)
// and 'nine-portal-sparks' (additive points) in data/lookGraphs.json; the disc and the sparks read the ring's radius.
import { BufferGeometry, CircleGeometry, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Points, Quaternion, TorusGeometry, Vector3 } from 'three';
import { lentLook, setLentParam } from '@wildshard/sdk/looks/lentLooks';
import portalPlan from './portalPlan.generated.json' with { type: 'json' };

type Portal = typeof portalPlan.square;

/** sparks per portal */
const SPARKS = 36;

/** the portals' drawn parts (named for the budget lanes) */
export interface PortalLook { readonly root: Group; readonly portals: readonly Portal[] }

/** every portal's ring centre and its orientation (the ring's plane faces along the portal's normal) */
function frames(portals: readonly Portal[]): Matrix4[] {
  const up = new Vector3(0, 1, 0);
  return portals.map((p) => new Matrix4().compose(new Vector3(p.x, p.y + portalPlan.ring.lift, p.z), new Quaternion().setFromAxisAngle(up, Math.atan2(p.nx, p.nz)), new Vector3(1, 1, 1)));
}

/** build the five portals' look under one group */
export function buildPortals(): PortalLook {
  const portals: Portal[] = [...portalPlan.decks, portalPlan.square];
  const root = new Group(); root.name = 'portals';
  const at = frames(portals);
  setLentParam('nine-portal-disc', 'r', portalPlan.ring.r);
  setLentParam('nine-portal-sparks', 'r', portalPlan.ring.r);
  const ring = new InstancedMesh(new TorusGeometry(portalPlan.ring.r, portalPlan.ring.tube, 8, 48), lentLook('nine-portal-ring'), portals.length);
  const disc = new InstancedMesh(new CircleGeometry(portalPlan.ring.r - portalPlan.ring.tube * 0.5, 40), lentLook('nine-portal-disc'), portals.length);
  at.forEach((m, i) => { ring.setMatrixAt(i, m); disc.setMatrixAt(i, m); });
  for (const mesh of [ring, disc]) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
  disc.renderOrder = 4;
  // the sparks: one point cloud for every portal, each spark knowing its portal's centre and across axis
  const pos: number[] = [], across: number[] = [], seed: number[] = [];
  portals.forEach((p, i) => {
    for (let s = 0; s < SPARKS; s++) {
      pos.push(p.x, p.y + portalPlan.ring.lift, p.z); across.push(-p.nz, 0, p.nx);
      // a fixed, even spread (no random draw: the same sparks every load)
      seed.push(((s * 0.618034) + i * 0.13) % 1, ((s * 0.381966) + i * 0.29) % 1);
    }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aAcross', new Float32BufferAttribute(across, 3));
  g.setAttribute('aSeed', new Float32BufferAttribute(seed, 2));
  const sparks = new Points(g, lentLook('nine-portal-sparks'));
  // the spread spans the whole cell: one sphere round it all (three culls the cloud whole)
  g.computeBoundingSphere();
  sparks.renderOrder = 5;
  ring.name = 'portal-rings'; disc.name = 'portal-swirls'; sparks.name = 'portal-sparks';
  root.add(ring, disc, sparks);
  return { root, portals };
}
