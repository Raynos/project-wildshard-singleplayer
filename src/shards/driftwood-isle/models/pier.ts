import * as THREE from 'three';
import {SEED} from '@wildshard/engine/core/config';
import {defineModel,type ModelContext,type ModelPart} from '@wildshard/engine/models/model';
import {loadingSpecimen} from '@wildshard/engine/models/gear';
import {lowPolyLookMaterial} from '@wildshard/engine/world/lowpolyKit';
import {boxDesc,type ColliderDesc} from '@wildshard/engine/world/registry';
import {pierBoxes} from '../world/pierLayout';
import {pierParamsKey,pierSpecKey,type PierParams,type PierSpec} from '../assets/contracts/pier';
import {PIER_DEFAULTS,PIER_VARIANTS} from '../data/pierRows';
import rows from '../data/piers.generated.json' with {type:'json'};
import {fixedGeometryReady,loadFixedGeometry,PIER_GEOMETRIES} from '../boot/fixedGeometry';

const pair=(v:readonly number[]):[number,number]=>{const [a,b]=v;if(a===undefined||b===undefined||v.length!==2)throw new Error('Pier row requires a pair');return [a,b];};
/** Read the canonical measured parameters; tuples are admitted before lending them to native code. */
export function pierWorldParams(spec:PierSpec):PierParams {
 const row=rows.find(r=>r.specKey===pierSpecKey(spec));
 if(row===undefined)throw new Error('Pier site changed; regenerate its authored geometry');
 const p=row.params;
 return {length:p.length,width:p.width,pileDepth:p.pileDepth,pennantDir:pair(p.pennantDir),
  landing:p.landing===null?null:{...p.landing,postGround:pair(p.landing.postGround)},
  ...(p.pennantAt===undefined?{}:{pennantAt:p.pennantAt}),...(p.seaRamp===undefined?{}:{seaRamp:p.seaRamp})};
}
/** Resolve one of the seven authored parameter sets; there is no procedural fallback. */
export function pierGeometryKey(p:PierParams):string {
 const row=rows.find(r=>r.paramKey===pierParamsKey(p));
 if(row===undefined)throw new Error('Pier parameters changed; regenerate its authored geometry');
 return row.id;
}
function pierParts(ctx:ModelContext,p:PierParams):ModelPart[] {
 const geometry=PIER_GEOMETRIES.get(pierGeometryKey(p));if(geometry===undefined)throw new Error('Missing authored pier geometry');
 const deck=lowPolyLookMaterial(ctx.sky,'still');
 const parts:ModelPart[]=[{geometry:geometry.deck.copy(),material:deck,castShadow:true,receiveShadow:true}];
 // the pennant flutters in its graph, its shadow too (data/kitLook.ts)
 if(geometry.cloth!==null)parts.push({geometry:geometry.cloth.copy(),material:lowPolyLookMaterial(ctx.sky,'pennant'),castShadow:true,receiveShadow:false});
 return parts;
}
/**
 * PHYSICS P4, own space: the posts and bollards (the legacy boxes) and every floor the deck describes, as real geometry.
 * The flat deck is one slab (0.3 m: the planks and the bearers under them); the landing's step-down (the south pier,
 * E43) is a real ramp — the planks follow one straight line from the deck to the sand — so it is a thin box pitched to
 * that line, plus the 0.2 m of flat sand-level deck past it.
 */
export function pierColliders(p: PierParams): ColliderDesc[] {
  const halfW = p.width / 2 + 0.25;
  const out: ColliderDesc[] = pierBoxes(p).map((c) => boxDesc(c));
  // a box along the pier: `a0`‥`a1` metres from the sea end, top at `top`, `hy` half thick
  const slab = (a0: number, a1: number, top: number, hy: number, hx = halfW): ColliderDesc => ({ kind: 'box', x: 0, y: top - hy, z: (a0 + a1) / 2, hx, hy, hz: (a1 - a0) / 2, yaw: 0 });
  const length = p.length, rampFrom = p.landing?.rampFrom ?? length, landY = p.landing?.landY ?? 0;
  const ramped = length > rampFrom + 0.1, sea = p.seaRamp;
  out.push(slab(sea === undefined ? -0.2 : sea.run, ramped ? rampFrom : length + 0.2, 0, 0.15));
  if (sea !== undefined) {
    // SF72: the flared sea-end ramp, a trapezoid slab (a hull): its top face on the line (0, landY) → (run, 0), half the
    // flare wide at the sea end narrowing to half the deck at the top (each + 0.25, as the deck's slab), 0.2 m thick; plus
    // 0.2 m of flat sand-level deck before it, the flare's width
    const wide = sea.flare / 2 + 0.25, hy = 0.2, points: number[] = [];
    for (const [along, half, top] of [[0, wide, sea.landY], [sea.run, halfW, 0]] as const) {
      for (const s of [-1, 1]) for (const dy of [0, -hy]) points.push(s * half, top + dy, along);
    }
    out.push({ kind: 'hull', x: 0, y: 0, z: 0, points: new Float32Array(points) });
    out.push(slab(-0.2, 0, sea.landY, 0.1, wide));
  }
  if (ramped) {
    // the ramp: its top face on the line (rampFrom, 0) → (length, landY); pitched about the pier's across axis
    const run = length - rampFrom, drop = -landY, pitch = Math.atan2(drop, run), half = Math.hypot(run, drop) / 2, hy = 0.1;
    const sx = Math.sin(pitch / 2), cx = Math.cos(pitch / 2);
    // top-face centre, then down the box's own up axis ((0, cos, sin) along the pier) by its half thickness
    const along = (rampFrom + length) / 2, topY = landY / 2;
    const nAlong = Math.sin(pitch), nUp = Math.cos(pitch);
    out.push({ kind: 'box', x: 0, y: topY - hy * nUp, z: along - hy * nAlong, hx: halfW, hy, hz: half, rot: { x: sx, y: 0, z: 0, w: cx } });
    out.push(slab(length, length + 0.2, landY, 0.1));
  }
  return out;
}


export const pier=defineModel<PierParams>({
 id:'driftwood-isle/pier',name:'Pier',category:'buildings',pipeline:'code',file:'src/shards/driftwood-isle/models/pier.ts',surface:'planks',
 defaults:PIER_DEFAULTS,variants:PIER_VARIANTS,seed:SEED^0x9e37,prepare:loadFixedGeometry,
 build:(ctx,p)=>{
  pierGeometryKey(p);
  if(fixedGeometryReady())return pierParts(ctx,p);
  return loadingSpecimen('driftwood-isle/pier',[p.width+2,10,p.length],async()=>{await loadFixedGeometry();const group=new THREE.Group();
   for(const part of pierParts(ctx,p)){const mesh=new THREE.Mesh(part.geometry,part.material);mesh.castShadow=part.castShadow??false;mesh.receiveShadow=part.receiveShadow??false;group.add(mesh);}return group;});
 },colliders:p=>pierColliders(p),
});
