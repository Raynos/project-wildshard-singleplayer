/** Collision-only chamber dimensions, independent of the arena's view. */
export interface ArenaSealDimensions {
  readonly doorHeight: number; readonly halfWidth: number; readonly doorHalfWidth: number;
}
/** The registered seal's original local box; its owner supplies pose and activity. */
export function arenaSealCollider(rows: ArenaSealDimensions): {kind:'box';x:number;y:number;z:number;hx:number;hy:number;hz:number} {
  return {kind:'box',x:0,y:rows.doorHeight/2,z:rows.halfWidth+0.1,hx:rows.doorHalfWidth+0.3,hy:rows.doorHeight/2+1,hz:0.25};
}
