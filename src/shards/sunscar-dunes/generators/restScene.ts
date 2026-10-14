import { REST_URLS } from '../data/restFiles';
import { CylinderGeometry, PlaneGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { clientSceneGlb, type ClientSceneBake } from '@wildshard/sdk/bake/glb';
import { WELL_RIG, HD, CAMP_HD, COOK, LANTERN, WAYMARK_HD, DECK_BRAZIER } from '../data/places';
import { BRAZIERS, CARAVAN, TOWER, WELL } from '../data/layout';
import { signalDunesTiles, signalDunesField } from './tiles';
import { decodeTerrainTile, terrainTileHeight } from '@wildshard/format/terrainTileBytes';
import { fireRows, lampRows, COOKFIRE, WAYMARK_FIRE, type FirePool } from '../data/fire';
import { towerAnchors } from './tower';
import { waymarkFrame } from './places';
import { parsePrivateScene, parseWorldScene, type PrivateScene, type WorldSceneRecipe } from '@wildshard/format/clientChannels';

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
export function restScenes(): { well: ClientSceneBake['scene']; oil: ClientSceneBake['scene']; frames: PlaceFrames; places: ReturnType<typeof placeRecipes> } { return { well: wellRest().scene, oil: oilRest().scene, frames: placeFrames(), places: placeRecipes() }; }
export function restPools(): readonly { readonly url: string; readonly parts: readonly string[] }[] { return [wellRest(), oilRest(), fireRest()].map((made,index) => {
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

/** Prefix independent rest fragments so their owned materials and part IDs cannot cross. */
function restFragment(scene: PrivateScene, prefix: string): PrivateScene {
  return parsePrivateScene({ ...scene, root: prefix + scene.root,
    materials: scene.materials.map(material => ({ ...material, id: prefix + material.id })),
    nodes: scene.nodes.map(node => ({ ...node, id: prefix + node.id, children: node.children.map(id => prefix + id),
      ...(node.kind === 'mesh' ? { material: prefix + node.material } : {}),
      ...(node.kind === 'object' || node.kind === 'anchor' ? { source: prefix + node.source } : {}),
    })),
  });
}
interface PlaceRecipes {
  caravan: WorldSceneRecipe & { anchors: { y: number; logbook: number[]; lamp: number[]; cook: readonly [number,number,number] } };
  tower: WorldSceneRecipe & { anchors: ReturnType<typeof towerAnchors> & { brazier: readonly [number,number,number] } };
  well: WorldSceneRecipe & { anchors: { crank: number[]; jar: number[]; drop: number } };
  braziers: (WorldSceneRecipe & { anchors: { bowl: number[]; flame: number[]; light: number[] } })[];
}
/** Existing material and animation owners bind only these named, baked rest hierarchies. */
export function placeRecipes(): PlaceRecipes {
  const frames = placeFrames(), field = signalDunesField(), wellY = field.heightAt(WELL.x,WELL.z);
  const frameRecipe = (piece: 'caravan' | 'tower', frame: PrivateScene, models: readonly (typeof CAMP_HD)[number][]) => {
    const live = restFragment(frame,'live.');
    return parseWorldScene({ scene: parsePrivateScene({ version:1, root:'root', materials:live.materials, nodes:[
      {kind:'group',id:'root',children:['baked',live.root]},
      {kind:'object',id:'baked',source:'baked',missing:'refuse'}, ...live.nodes,
    ] }), imports:[{id:'baked',kind:'baked',piece}, ...models.map(row=>({id:`live.${row.model}`,kind:'model',model:row.model,fit:row.fit}))] });
  };
  const y = field.heightAt(CARAVAN.x,CARAVAN.z), world = (x:number,dy:number,z:number):[number,number,number] => { const v=new Vector3(x,dy,z).applyAxisAngle(new Vector3(0,1,0),CARAVAN.yaw).add(new Vector3(CARAVAN.x,y,CARAVAN.z));return [v.x,v.y,v.z]; };
  const towerFrame=towerAnchors(field.heightAt(TOWER.x,TOWER.z));
  const well = restFragment(wellRest().scene,'live.');
  for (const node of well.nodes) if (node.id === well.root && node.kind === 'group') node.position = [WELL.x,wellY,WELL.z];
  const wellRecipe = { ...parseWorldScene({ scene:parsePrivateScene({version:1,root:'root',materials:well.materials,nodes:[
    {kind:'group',id:'root',children:['baked',well.root]}, {kind:'object',id:'baked',source:'baked',missing:'refuse'},
    ...well.nodes,
  ]}), imports:[{id:'baked',kind:'baked',piece:'well'}]}), anchors:{crank:[WELL.x+WELL_RIG.r+0.32,wellY+WELL_RIG.axleY,WELL.z],jar:[WELL.x,wellY+1,WELL.z],drop:WELL_RIG.drop} };
  const braziers = BRAZIERS.map((at,index)=>{
    const baseY=waymarkFrame(at.x,at.z,field.heightAt).y, models=restFragment(frames.waymark,'live.'), oil=restFragment(oilRest().scene,'live.');
    const recipe = parseWorldScene({scene:parsePrivateScene({version:1,root:'root',materials:oil.materials,nodes:[
      {kind:'group',id:'root',position:[at.x,baseY,at.z],children:[models.root,oil.root,'baked','fire']},
      ...models.nodes,...oil.nodes,{kind:'object',id:'baked',source:'baked',missing:'refuse'},
      {kind:'group',id:'fire',position:[0,HD.brazier*HD.bowlAt,0],visible:false},
    ]}),imports:[{id:'baked',kind:'baked',piece:'braziers',only:{brazier:index},materials:'embers'},
      ...WAYMARK_HD.map(row=>({id:`live.${row.model}`,kind:'model',model:row.model,fit:row.fit}))]});
    return Object.assign(recipe, { anchors:{bowl:[at.x,baseY+1.6,at.z],flame:[at.x,baseY+HD.brazier*HD.bowlAt,at.z],light:[at.x,baseY+HD.brazier*HD.bowlAt+0.4,at.z]} });
  });
  return { caravan:{...frameRecipe('caravan',frames.camp,CAMP_HD),anchors:{y,logbook:world(0.35,1.12,-2.55),lamp:world(LANTERN.x,LANTERN.y,LANTERN.z),cook:frames.cookAt}},
    tower:{...frameRecipe('tower',frames.tower,[DECK_BRAZIER]),anchors:{...towerFrame,brazier:frames.brazierAt}},well:wellRecipe,braziers };
}

/** Fire cards and draped light pools are author meshes; their live materials and clock remain native. */
export function fireRest(): ClientSceneBake {
  const root = new Group(), material = new MeshStandardMaterial(); root.name = 'fire-rest';
  const add = (id: string, geometry: PlaneGeometry): void => { const mesh = new Mesh(geometry,material); mesh.name = id; root.add(mesh); };
  add('fire-flame',new PlaneGeometry(1,1).translate(0,0.5,0));
  add('fire-wisp',new PlaneGeometry(1,1,1,16).translate(0,0.5,0));
  add('fire-glow',new PlaneGeometry(2,2));
  const terrain = signalDunesTiles(), collider = terrain.terrain.collider;
  const bytes = terrain.assets.get(collider);
  if (bytes === undefined) throw new Error('Fire pools require baked terrain');
  const ground = decodeTerrainTile(bytes), heightAt = (x:number,z:number):number => terrainTileHeight(ground,x,z);
  const pool = (id:string,row:FirePool,height:(x:number,z:number)=>number):void => {
    const geometry = new PlaneGeometry(row.r*2,row.r*2,row.n,row.n).rotateX(-Math.PI/2), positions=geometry.getAttribute('position');
    for(let i=0;i<positions.count;i++) positions.setY(i,height(positions.getX(i),positions.getZ(i))+0.06);
    add(id,geometry);
  };
  const frames=placeFrames(), field=signalDunesField(), y=field.heightAt(CARAVAN.x,CARAVAN.z), cos=Math.cos(CARAVAN.yaw), sin=Math.sin(CARAVAN.yaw);
  pool('pool-caravan-lamp',lampRows(0.5).pool,(lx,lz)=>{const x=LANTERN.x+lx,z=LANTERN.z+lz;return heightAt(CARAVAN.x+x*cos+z*sin,CARAVAN.z-x*sin+z*cos)-(y+LANTERN.y);});
  pool('pool-cook',fireRows(COOKFIRE).pool,(x,z)=>heightAt(frames.cookAt[0]+x,frames.cookAt[2]+z)-frames.cookAt[1]);
  const tower=towerAnchors(field.heightAt(TOWER.x,TOWER.z));
  pool('pool-keeper-lamp',lampRows(1.1).pool,()=>tower.deckY-tower.lampY);
  BRAZIERS.forEach((at,i)=>{const flameY=waymarkFrame(at.x,at.z,field.heightAt).y+HD.brazier*HD.bowlAt;
    pool(`pool-brazier-${String(i)}`,fireRows(WAYMARK_FIRE).pool,(x,z)=>heightAt(at.x+x,at.z+z)-flameY);});
  return clientSceneGlb(root,new Map([[material,'fire-geometry']]));
}
export function fireGlb(): Uint8Array { return fireRest().glb; }
