/** Native batch reservations, LOD bounds, hull words and roof-cell selection, authored once. */
import * as THREE from 'three';
import type { NativeTerrainSource } from '@wildshard/sdk/bake/terrain';
import { pineCragScene } from './cragScene';
import type { CragPlace, CragTier } from './cragRows';
import type { SkinBake } from './crags';
import { BEAR_CAVE } from '../data/layout';

interface CaveMeta { cuts: { lx: number; lz: number; hw: number; hd: number; below: number }[]; holes: { lx: number; lz: number; hw: number; hd: number; y0: number; y1: number }[] }
interface Plan { lod0: number; lod1: number; near: number; far: number; r: number; x: number; y: number; z: number; cave: boolean }
interface AssemblyTier { slots: { skin: number; cave: string }[]; plans: Plan[]; reserve: { instances: number; vertices: number; indices: number } }
interface CragAssembly { hulls: Record<string, { cap: number; points: number[] }>; tiers: Record<CragTier, AssemblyTier>; roof: { resolution: number; size: number; triangles: number[] } }
const cliff = ['cliff-a','cliff-b','cliff-c','buttress','slab','tor-a','tor-b','hero'];
const boulder = ['boulder-a','boulder-b','boulder-c'];
const scree = ['scree-a','scree-b'];
/** Original source counts and bounds; geometry and materials remain the native owners'. */
export function pineCragAssembly(kit: ReadonlyMap<string, THREE.BufferGeometry>, cave: ReadonlyMap<string, THREE.BufferGeometry>, meta: CaveMeta,
  skin: Record<CragTier, SkinBake>, places: readonly CragPlace[], ground: NativeTerrainSource): CragAssembly {
  const hulls: Record<string, {cap:number;points:number[]}> = {};
  for (const id of [...cliff,...boulder]) {
    const geometry = kit.get(`${id}-lod1`) ?? kit.get(id); if (geometry === undefined) continue;
    const cap = cliff.includes(id) ? 110 : 60, position = geometry.getAttribute('position'), step = Math.max(1, Math.floor(position.count / cap));
    const points: number[] = [];
    for (let i=0;i<position.count;i+=step) points.push(position.getX(i),position.getY(i),position.getZ(i));
    hulls[id]={cap,points};
  }
  const source = pineCragScene(skin), tiers: Record<CragTier, AssemblyTier> = {
    phone: {slots:[],plans:[],reserve:{instances:0,vertices:0,indices:0}}, desktop: {slots:[],plans:[],reserve:{instances:0,vertices:0,indices:0}} };
  const size = (geometry: THREE.BufferGeometry | undefined) => geometry === undefined ? {v:0,i:0} : {v:geometry.getAttribute('position').count,i:geometry.index?.count ?? geometry.getAttribute('position').count};
  const caveMatrix = new THREE.Matrix4().makeRotationY(BEAR_CAVE.rot).setPosition(BEAR_CAVE.x,0,BEAR_CAVE.z);
  for (const tier of ['phone','desktop'] as const) {
    const row=tiers[tier], geometries: THREE.BufferGeometry[] = [], near=tier==='phone'?95:170;
    for (const piece of source.children) {
      if (!piece.name.startsWith(`pine-crag-${tier}-`)) continue;
      const pair = piece.children;
      if (!(pair[0] instanceof THREE.Mesh) || !(pair[1] instanceof THREE.Mesh)) throw new Error('Crag assembly omitted skin pair');
      const g0: unknown = pair[0].geometry, g1: unknown = pair[1].geometry;
      if (!(g0 instanceof THREE.BufferGeometry) || !(g1 instanceof THREE.BufferGeometry)) throw new Error('Crag assembly omitted skin geometry');
      const first=geometries.length;geometries.push(g0 as THREE.BufferGeometry,g1 as THREE.BufferGeometry);
      row.slots.push({skin:first,cave:''},{skin:first+1,cave:''});
      const sphere=g0.boundingSphere;
      if (sphere===null) throw new Error('Crag assembly omitted skin bounds');
      row.plans.push({lod0:first,lod1:first+1,near:near*.8,far:900,r:sphere.radius,x:sphere.center.x,y:sphere.center.y,z:sphere.center.z,cave:false});
    }
    const interior=cave.get('cave'), hood=cave.get('cave-far');
    if (interior!==undefined) {
      const sphere=interior.boundingSphere;
      if (sphere===null) throw new Error('Crag assembly omitted cave bounds');
      const center=sphere.center.clone().applyMatrix4(caveMatrix), first=geometries.length;
      geometries.push(interior);row.slots.push({skin:-1,cave:'cave'});
      row.plans.push({lod0:first,lod1:first,near:1e9,far:tier==='phone'?70:110,r:sphere.radius,x:center.x,y:center.y,z:center.z,cave:true});
      if(hood!==undefined){const at=geometries.length;geometries.push(hood);row.slots.push({skin:-1,cave:'cave-far'});row.plans.push({lod0:at,lod1:at,near:1e9,far:1200,r:sphere.radius,x:center.x,y:center.y,z:center.z,cave:true});}
    }
    const groups=[cliff,boulder,scree].map(ids=>places.filter(place=>ids.includes(place.id)&&kit.has(place.id)));
    row.reserve.instances=row.plans.length;
    for(const group of groups){row.reserve.instances+=group.length;for(const id of new Set(group.map(place=>place.id)))for(const geometry of [kit.get(id),kit.get(`${id}-lod1`)??kit.get(id)]){const n=size(geometry);row.reserve.vertices+=n.v;row.reserve.indices+=n.i;}}
    for(const geometry of geometries){const n=size(geometry);row.reserve.vertices+=n.v;row.reserve.indices+=n.i;}
  }
  const {grid}=ground, res=grid.res, chunk=grid.size, d=chunk/(res-1), half=chunk/2, cos=Math.cos(BEAR_CAVE.rot), sin=Math.sin(BEAR_CAVE.rot);
  const world=(x:number,z:number)=>[BEAR_CAVE.x+x*cos+z*sin,BEAR_CAVE.z-x*sin+z*cos] as const;
  const cells=new Set<number>(), triangles:number[]=[];
  for(const cut of meta.cuts){const [x,z]=world(cut.lx,cut.lz),r=Math.hypot(cut.hw,cut.hd)+3*d;
    const i0=Math.max(0,Math.floor((x-r+half)/d)),i1=Math.min(res-2,Math.ceil((x+r+half)/d)),k0=Math.max(0,Math.floor((z-r+half)/d)),k1=Math.min(res-2,Math.ceil((z+r+half)/d));
    for(let iz=k0;iz<=k1;iz++)for(let ix=i0;ix<=i1;ix++){const dx=ix*d-half-x,dz=iz*d-half-z,lx=dx*cos-dz*sin,lz=dx*sin+dz*cos;if(Math.abs(lx)<=cut.hw+2.5*d&&Math.abs(lz)<=cut.hd+2.5*d)cells.add(iz*res+ix);}
  }
  const local=(x:number,z:number)=>{const dx=x-BEAR_CAVE.x,dz=z-BEAR_CAVE.z;return [dx*cos-dz*sin,dx*sin+dz*cos] as const;};
  for(const cell of cells){const ix=cell%res,iz=Math.floor(cell/res),x0=ix*d-half,x1=x0+d,z0=iz*d-half,z1=z0+d;
    const pairs=[[[x0,z0],[x0,z1],[x1,z0]],[[x0,z1],[x1,z1],[x1,z0]]] as const;
    for(const [side,points]of pairs.entries()){const localPoints=points.map(([x,z])=>local(x,z)),ys=points.map(([x,z])=>ground.heightAt(x,z)),minX=Math.min(...localPoints.map(p=>p[0])),maxX=Math.max(...localPoints.map(p=>p[0])),minZ=Math.min(...localPoints.map(p=>p[1])),maxZ=Math.max(...localPoints.map(p=>p[1])),y0=Math.min(...ys),y1=Math.max(...ys);
      if(!meta.holes.some(h=>!(maxX<h.lx-h.hw||minX>h.lx+h.hw||maxZ<h.lz-h.hd||minZ>h.lz+h.hd||y1<h.y0||y0>h.y1)))triangles.push(cell*2+side);
    }
  }
  source.traverse(node=>{if(node instanceof THREE.Mesh){const geometry: unknown = node.geometry;if(geometry instanceof THREE.BufferGeometry)geometry.dispose();if(node.material instanceof THREE.Material)node.material.dispose();}});
  return {hulls,tiers,roof:{resolution:res,size:chunk,triangles}};
}
