import { REST_URLS } from '../data/restFiles';
import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import { clientSceneGlb, type ClientSceneBake } from '@wildshard/sdk/bake/glb';
import { WELL_RIG, HD } from '../data/places';

/** Bucket-local rope, open pail and jar; stable part identities stay with the existing well motion owner. */
export function wellRest(): ClientSceneBake {
  const root = new Group(), bucket = new Group(), wood = new MeshStandardMaterial(), cord = new MeshStandardMaterial(), clay = new MeshStandardMaterial();
  root.name = 'well'; bucket.name = 'bucket'; bucket.position.set(0, WELL_RIG.axleY - WELL_RIG.drop, 0); root.add(bucket);
  const ropeGeometry = new CylinderGeometry(0.02, 0.02, WELL_RIG.drop, 4); ropeGeometry.translate(0, WELL_RIG.drop / 2, 0);
  const rope = new Mesh(ropeGeometry, cord); rope.name = 'rope'; bucket.add(rope);
  const pail = new Mesh(new CylinderGeometry(0.26, 0.2, 0.36, 8, 1, true), wood); pail.name = 'pail'; bucket.add(pail);
  const jar = new Mesh(new SphereGeometry(0.17, 8, 6), clay); jar.name = 'jar'; jar.scale.set(1, 1.3, 1); jar.position.y = 0.14; bucket.add(jar);
  const made = clientSceneGlb(root, new Map([[wood, 'wood'], [cord, 'rope'], [clay, 'clay']]));
  return { ...made, scene: { ...made.scene, materials: [
    { kind: 'standard', id: 'wood', properties: { color: 0xa07656, roughness: 0.92, flatShading: true, side: 2 } },
    { kind: 'standard', id: 'rope', properties: { color: 0x6b5236, roughness: 0.92, flatShading: true } },
    { kind: 'standard', id: 'clay', properties: { color: 0x7a3a22, roughness: 0.92, flatShading: true } },
  ] } };
}

/** The original hidden waymark oil surface, independent of fire and quest authority. */
export function oilRest(): ClientSceneBake {
  const root = new Group(), material = new MeshStandardMaterial(); root.name = 'bowl';
  const oil = new Mesh(new CylinderGeometry(0.33, 0.33, 0.04, 8), material); oil.name = 'oil'; oil.position.y = HD.brazier * HD.bowlAt; oil.visible = false; root.add(oil);
  const made = clientSceneGlb(root, new Map([[material, 'oil']]));
  return { ...made, scene: { ...made.scene, materials: [{ kind: 'standard', id: 'oil', properties: { color: 0x1a120c, roughness: 0.2 } }] } };
}

/** The SDK JSON/byte driver owns I/O for these finite existing declarations. */
export function restScenes(): { readonly well: ClientSceneBake['scene']; readonly oil: ClientSceneBake['scene'] } { return { well: wellRest().scene, oil: oilRest().scene }; }
export function restPools(): readonly { readonly url: string; readonly parts: readonly string[] }[] { return [wellRest(), oilRest()].map((made,index) => {
  const url = REST_URLS[index]; if (url === undefined) throw new Error('Undeclared place pool');
  return { url, parts: made.scene.nodes.flatMap(node => node.kind === 'mesh' ? [node.geometry] : []) };
}); }
export function wellGlb(): Uint8Array { return wellRest().glb; }
export function oilGlb(): Uint8Array { return oilRest().glb; }
