import { boxDesc, type ColliderDesc } from '@wildshard/engine/world/registry';
import type { BoxSpec } from '@wildshard/engine/physics/box';
import { ANTE, PASS, ALC, STEPS, ANTE_FLOOR, ALC_FLOOR, CUT, BACKFILL, coveFloorAt, coveWorld, type CoveSpec, type CoveAnchor } from '../world/coveLayout';

/** Existing cave walls, floors, anchors and terrain cut, evaluated against the native authoring ground. */
export function coveNative(spec:CoveSpec,heightAt:(x:number,z:number)=>number): {
  colliders:BoxSpec[]; anchors:Record<string,CoveAnchor>; descs:ColliderDesc[];
  cuts:{x:number;z:number;hw:number;hd:number;yaw:number;below:number}[];
} {
  const cave=spec.cave,colliders:BoxSpec[]=[],anchors:Record<string,CoveAnchor>={};
  const W=(lx:number,lz:number):[number,number]=>coveWorld(cave,lx,lz);
    // ── colliders: the cave walls (a 2.5 m throat at the passage), the back wall, the outer mass ──
    const box = (lx: number, lz: number, hw: number, hd: number, y0: number, y1: number): void => {
      const [x, z] = W(lx, lz);
      colliders.push({ x, z, hw, hd, rot: -cave.yaw, yTop: y1, yBottom: y0 });
    };
    for (const side of [-1, 1]) {
      box(side * (ANTE.hw + 0.6), ANTE.z1 / 2 - 0.3, 0.6, ANTE.z1 / 2 + 0.3, ANTE_FLOOR - 2, ANTE_FLOOR + 7);
      box(side * (PASS.hw + 1.0), (PASS.z0 + PASS.z1) / 2, 1.0, (PASS.z1 - PASS.z0) / 2, ANTE_FLOOR - 2, ANTE_FLOOR + 7);
      box(side * (ALC.hw + 0.6), (ALC.z0 + cave.depth) / 2, 0.6, (cave.depth - ALC.z0) / 2, ANTE_FLOOR - 2, ANTE_FLOOR + 7);
      box(side * (ANTE.hw + 2.6), cave.depth / 2, 1.5, cave.depth / 2 + 0.8, ANTE_FLOOR - 2, ANTE_FLOOR + 7);
    }
    box(0, cave.depth + 0.6, ALC.hw + 1, 0.6, ANTE_FLOOR - 2, ANTE_FLOOR + 7);

    // ── anchors ──
    const anchor = (lx: number, lz: number, yaw: number, floor = true): CoveAnchor => {
      const [x, z] = W(lx, lz);
      return { x, z, y: floor && lz >= -0.3 && lz <= cave.depth ? coveFloorAt(lz) : heightAt(x, z), yaw: cave.yaw + yaw };
    };
    anchors['caveFloor'] = anchor(0, 2.8, Math.PI);
    anchors['gate'] = anchor(0, PASS.z0 + 0.25, Math.PI);
    anchors['alcove'] = anchor(0, 7.9, Math.PI);
    anchors['plateA'] = anchor(-2.9, -4.6, 0, false);
    anchors['plateB'] = anchor(2.9, -4.6, 0, false);
    // the barrel that washed up by the wreck's bow, ~8 m from the plates
    anchors['barrelStart'] = { x: 147.5, y: heightAt(147.5, 3.5), z: 3.5, yaw: 0 };
  const descs=(():ColliderDesc[]=>{
    const c = spec.cave, out: ColliderDesc[] = colliders.map((b) => boxDesc(b, 'rock'));
    const slab = (hw: number, lz0: number, lz1: number, top: number, bottom: number): ColliderDesc => {
      const [x, z] = W(0, (lz0 + lz1) / 2);
      return { kind: 'box', x, y: (top + bottom) / 2, z, hx: hw, hy: (top - bottom) / 2, hz: (lz1 - lz0) / 2, yaw: c.yaw, surface: 'rock' };
    };
    const base = CUT.below - 0.4;
    out.push(slab(ANTE.hw + 0.1, -0.3, PASS.z0, ANTE_FLOOR, base));
    out.push(slab(PASS.hw + 0.1, PASS.z0, STEPS.z0, ANTE_FLOOR, base));
    out.push(slab(ALC.hw + 0.1, STEPS.z1, c.depth, ALC_FLOOR, base));
    const at = (lz: number, y: number) => { const [x, z] = W(0, lz); return { x, y, z }; };
    out.push({ kind: 'treads', from: at(STEPS.z0, ANTE_FLOOR), to: at(STEPS.z1, ALC_FLOOR), width: (ALC.hw + 0.1) * 2, count: 4, surface: 'rock' });
    out.push(slab(BACKFILL.hw, c.depth + 0.8, BACKFILL.z1, ANTE_FLOOR + 7, base));
    return out;
  })();
  const [x,z]=W(0,(CUT.z0+CUT.z1)/2);
  return {colliders,anchors,descs,cuts:[{x,z,hw:CUT.hw,hd:(CUT.z1-CUT.z0)/2,yaw:cave.yaw,below:CUT.below}]};
}
