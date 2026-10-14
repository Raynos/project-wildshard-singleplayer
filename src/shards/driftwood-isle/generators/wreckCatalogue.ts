import * as THREE from 'three';
import type { Placement } from '@wildshard/engine/models/model';
import type { CargoCopy } from './shipwreck';
import { cargoBox } from '../models/cargo';
import { driftLogBox } from '../models/driftLog';

interface CatalogueGroup<P extends object> { placements: Placement<P>[]; boxes: number[] }
/** Compact registration data for the five families already drawn by the wreck. */
export interface WreckCatalogue {
  barrels: CatalogueGroup<{lying:boolean}>;
  crates: CatalogueGroup<{size:number;broken:boolean}>;
  coils: CatalogueGroup<{r:number}>;
  logs: CatalogueGroup<{len:number;r0:number;r1:number;tone:number}>;
  rocks: CatalogueGroup<{r:number;squash:number;moss:number}>;
}

/** Catalogue rows for models already drawn into the wreck: positions and bounds, never another geometry copy. */
export function wreckCatalogue(cargo: readonly CargoCopy[], logs: readonly {a:THREE.Vector3;b:THREE.Vector3;r:number;tone:number}[], rocks: readonly {m:THREE.Matrix4;r:number;moss:number;box:THREE.Box3}[]): WreckCatalogue {
  const box=new THREE.Box3();
  const bounds=(b:THREE.Box3):number[]=>[...b.min,...b.max];
  const at=(matrix:THREE.Matrix4):{x:number;y:number;z:number}=>{const p=new THREE.Vector3().setFromMatrixPosition(matrix);return {x:p.x,y:p.y,z:p.z};};
  const group=<P extends object>(kinds:readonly CargoCopy['kind'][],placement:(c:CargoCopy)=>Placement<P>)=>{
    const copies=cargo.filter(c=>kinds.includes(c.kind));
    return {placements:copies.map(placement),boxes:copies.flatMap(c=>bounds(box.copy(cargoBox(c.kind,c.size)).applyMatrix4(c.matrix)))};
  };
  return {
    barrels:group<{lying:boolean}>(['barrel','lying'],c=>({...at(c.matrix),variant:c.kind==='lying'?'lying':'standing'})),
    crates:group<{size:number;broken:boolean}>(['crate','broken'],c=>({...at(c.matrix),params:{size:c.size,broken:c.kind==='broken'}})),
    coils:group<{r:number}>(['coil'],c=>({...at(c.matrix),params:{r:c.size}})),
    logs:{placements:logs.map(l=>{const d=l.b.clone().sub(l.a);return {x:(l.a.x+l.b.x)/2,y:(l.a.y+l.b.y)/2,z:(l.a.z+l.b.z)/2,yaw:Math.atan2(-d.z,d.x),params:{len:d.length(),r0:l.r,r1:l.r*.7,tone:l.tone%3}};}),boxes:logs.flatMap(l=>bounds(driftLogBox(l.a,l.b,l.r,box)))},
    rocks:{placements:rocks.map(k=>({...at(k.m),params:{r:k.r,squash:.62,moss:k.moss}})),boxes:rocks.flatMap(k=>bounds(k.box))},
  };
}
