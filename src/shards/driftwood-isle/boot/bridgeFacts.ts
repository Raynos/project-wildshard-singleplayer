import bake from '../data/bridgeBake.json' with { type: 'json' };
import type { RopeBridgeSpec } from '../models/ropeBridge';

/** Only the authored island span and Explorer specimen have rest facts. Moving deck poses remain live. */
export function admitBridgeFacts(spec:RopeBridgeSpec,ground:(x:number,z:number)=>number): (typeof bake)[number] {
  const key=JSON.stringify([spec.a,spec.b,spec.width??1.4,spec.sag??1]);
  const row=bake.find(candidate=>candidate.key===key);
  if(row===undefined)throw new Error('Unbaked rope bridge span');
  if(row.ground.some(p=>{const y=ground(p.x,p.z);return !Number.isFinite(y)||Math.abs(y-p.y)>1e-6;}))throw new Error('Rope bridge terrain changed; regenerate rest facts');
  return row;
}
