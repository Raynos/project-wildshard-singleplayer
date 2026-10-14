import { REST_URLS } from '../data/restFiles';
import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import { clientSceneGlb, type ClientSceneBake } from '@wildshard/sdk/bake/glb';
import { WELL_RIG, HD, CAMP_HD, COOK, LANTERN, WAYMARK_HD, DECK_BRAZIER } from '../data/places';
import { CARAVAN, TOWER } from '../data/layout';
import { signalDunesField } from './tiles';
import { towerAnchors } from './tower';
import { parsePrivateScene, type PrivateScene } from '@wildshard/format/clientChannels';

/** Bucket-local rope, open pail and jar; stable part identities stay with the existing well motion owner. */
export function wellRest(): ClientSceneBake {
  const root = new Group(), bucket = new Group(), wood = new MeshStandardMaterial(), cord = new MeshStandardMaterial(), clay = new MeshStandardMaterial();
  root.name = 'well'; bucket.name = 'bucket'; bucket.position.set(0, WELL_RIG.axleY - WELL_RIG.drop, 0); root.add(bucket);
  const ropeGeometry = new CylinderGeometry(0.02, 0.02, WELL_RIG.drop, 4); ropeGeometry.translate(0, WELL_RIG.drop / 2, 0);
  const rope = new Mesh(ropeGeometry, cord); rope.name = 'rope'; bucket.add(rope);
  const pail = new Mesh(new CylinderGeometry(0.26, 0.2, 0.36, 8, 1, true), wood); pail.name = 'pail'; bucket.add(pail);
  const jar = new Mesh(new SphereGeometry(0.17, 8, 6), clay); jar.name = 'jar'; jar.scale.set(1, 1.3, 1); jar.position.y = 0.14; bucket.add(jar);
  const made = clientSceneGlb(root, new Map([[wood, 'wood'], [cord, 'rope'], [clay, 'clay']]));
  for (const node of made.scene.nodes) if (node.kind === 'mesh' && node.id === 'rope') node.instances = 1;
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
export function restScenes(): { well: ClientSceneBake['scene']; oil: ClientSceneBake['scene']; frames: PlaceFrames } { return { well: wellRest().scene, oil: oilRest().scene, frames: placeFrames() }; }
export function restPools(): readonly { readonly url: string; readonly parts: readonly string[] }[] { return [wellRest(), oilRest()].map((made,index) => {
  const url = REST_URLS[index]; if (url === undefined) throw new Error('Undeclared place pool');
  return { url, parts: made.scene.nodes.flatMap(node => node.kind === 'mesh' ? [node.geometry] : []) };
}); }
export function wellGlb(): Uint8Array { return wellRest().glb; }
export function oilGlb(): Uint8Array { return oilRest().glb; }

/** The static place frames and model placements, authored beside the existing geometry pools. */
interface PlaceFrames { readonly camp: PrivateScene; readonly tower: PrivateScene; readonly waymark: PrivateScene; readonly cookAt: readonly [number,number,number]; readonly brazierAt: readonly [number,number,number] }
export function placeFrames(): PlaceFrames {
  const field = signalDunesField(), y = field.heightAt(CARAVAN.x,CARAVAN.z), cos = Math.cos(CARAVAN.yaw), sin = Math.sin(CARAVAN.yaw);
  const tower = towerAnchors(field.heightAt(TOWER.x,TOWER.z));
  const brazier: [number,number,number] = [TOWER.x - 0.4, tower.deckY + 1.1, TOWER.z - 0.5];
  return {
    camp: parsePrivateScene({ version: 1, root: 'camp', materials: [], nodes: [
      { kind: 'group', id: 'camp', position: [CARAVAN.x, y, CARAVAN.z], rotation: [0, CARAVAN.yaw, 0], children: ['models', 'lamp', 'cook'] },
      { kind: 'group', id: 'models', children: CAMP_HD.map((_, index) => `model-${String(index)}`) },
      ...CAMP_HD.map((row,index) => ({ kind: 'object', id: `model-${String(index)}`, source: row.model, missing: 'omit', position: row.at ?? [0,0,0], rotation: row.rot ?? [0,0,0] })),
      { kind: 'group', id: 'lamp', position: [LANTERN.x,LANTERN.y,LANTERN.z] },
      { kind: 'group', id: 'cook', position: [COOK.x,0.15,COOK.z] },
    ] }),
    cookAt: [CARAVAN.x + COOK.x*cos + COOK.z*sin,y+0.15,CARAVAN.z-COOK.x*sin+COOK.z*cos],
    tower: parsePrivateScene({ version: 1, root: 'tower-live', materials: [], nodes: [
      { kind:'group', id:'tower-live', children:['keeper-lamp','brazier','fire'] },
      { kind:'group', id:'keeper-lamp', position:[TOWER.x,tower.lampY,TOWER.z], children:['lamp-flame'] },
      { kind:'group', id:'lamp-flame', position:[0,0.5,0] },
      { kind:'object', id:'brazier', source:DECK_BRAZIER.model, missing:'omit', position:[brazier[0],tower.deckY,brazier[2]] },
      { kind:'group', id:'fire', position:brazier, visible:false },
    ] }),
    brazierAt:brazier,
    waymark: parsePrivateScene({ version:1, root:'waymark-models', materials:[], nodes:[
      {kind:'group',id:'waymark-models',children:WAYMARK_HD.map((_,index)=>`model-${String(index)}`)},
      ...WAYMARK_HD.map((row,index)=>({kind:'object',id:`model-${String(index)}`,source:row.model,missing:'omit',position:row.at??[0,0,0],rotation:row.rot??[0,0,0]})),
    ] }),
  };
}
