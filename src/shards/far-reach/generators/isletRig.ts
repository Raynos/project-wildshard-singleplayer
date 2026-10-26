import { boxDesc, type ColliderDesc } from '@wildshard/sdk/bake/placement';
import { BoxGeometry, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { PieceBake } from '@wildshard/sdk/bake/kinds';
import { bakeSkyPiece, SkyPiece } from './piece';
import { RISING_ISLETS } from './risingIslets';
import type { RisingIslet } from './rows/isletDesign';
import { PALETTE, flat } from './palette';
import { ISLET_POST as POST, isletRigAnchors, skyIsletRigRows, type IsletRigRows } from './isletRigRows';

/**
 * Build-time only (SHARD-PLATFORM M3): the Rising Islets' static rig, baked by `bake-sky-world.mjs` into
 * `baked/islet-rig.glb` + `data/isletRig.json`; the client draws the bake and reads the rows (`world/risingIslet.ts`).
 * - the two lantern posts on each gate isle's rim (one instanced draw of posts, one of lanterns) and their colliders;
 * - where each entry's four chains meet its posts and its islet (`rigs`: the chains are drawn live, at the islet's pose);
 * - each entry's rail round its resting islet (`rails`: a box per closed rim edge, collided always, drawn while it rests).
 */
/** The posts and lanterns of every entry as two instanced meshes, with the posts' colliders. */
export function buildIsletRig(entries: readonly RisingIslet[] = RISING_ISLETS): { posts: InstancedMesh; lanterns: InstancedMesh; colliders: ColliderDesc[] } {
  const posts = new InstancedMesh(new BoxGeometry(0.36, POST.h, 0.36), flat(PALETTE.trunk), entries.length * 2);
  const lanterns = new InstancedMesh(new BoxGeometry(0.34, 0.42, 0.34), flat(0xffc56a, { emissive: 0xffa040, emissiveIntensity: 1.4 }), entries.length * 2);
  const m = new Matrix4(), q = new Quaternion(), one = new Vector3(1, 1, 1), colliders: ColliderDesc[] = [];
  entries.forEach((entry, i) => {
    isletRigAnchors(entry).tops.forEach(([x, , z], k) => {
      posts.setMatrixAt(i * 2 + k, m.compose(new Vector3(x, entry.gate.y + POST.h / 2, z), q, one));
      lanterns.setMatrixAt(i * 2 + k, m.compose(new Vector3(x, entry.gate.y + POST.h + 0.2, z), q, one));
      colliders.push(boxDesc({ x, z, hw: 0.18, hd: 0.18, rot: 0, yBottom: entry.gate.y, yTop: entry.gate.y + POST.h }, 'wood'));
    });
  });
  posts.computeBoundingSphere(); lanterns.computeBoundingSphere();
  return { posts, lanterns, colliders };
}

/** The rig's bake: the posts and lanterns as two kinds with the posts' colliders, plus each entry's chain ends and rail rows. */
export interface IsletRigBake extends PieceBake, IsletRigRows {}
export function skyIsletRigPiece(): SkyPiece<IsletRigRows> {
  const built = buildIsletRig();
  return new SkyPiece('far.islet.posts', [['post', built.posts], ['lantern', built.lanterns]], built.colliders, {}, skyIsletRigRows());
}
export function bakeSkyIsletRig(): IsletRigBake { return bakeSkyPiece(skyIsletRigPiece()); }
