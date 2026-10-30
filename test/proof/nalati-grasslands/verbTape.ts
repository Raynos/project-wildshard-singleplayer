import type {HeadlessTapePlan} from '../../../src/sdk/headlessTape';
import type {HeadlessCommand} from '../../../src/sdk/tickProtocol';

const press=(value:number):HeadlessCommand=>({kind:'script',actorId:'nalati.talk',value});
const campRoad:readonly [number,number][]=[[20,216],[40,218],[60,214],[66,209.5],[73,206.1],[83,206],[84.8,203.8],[88,204.5],[95,204],
  [94,210],[91,216],[86.6,219.5]];
/** The real north-road approach and camp yard, followed by USE presses. No
 * teleport, planted flag, horse, score or quest completion enters the tape. */
export function nalatiCampIntroTape(start:{readonly x:number;readonly z:number}):HeadlessTapePlan {
  return {version:1,observe:['nalati.talk'],segments:[
    {id:'elder-out-of-reach',ticks:1,commands:[press(0)]},
    {id:'walk-to-elder',ticks:6000,commands:[],route:[{x:start.x,z:start.z},
      ...campRoad.map(([x,z])=>({x,z}))]},
    {id:'open-elder-reading',ticks:1,commands:[press(0)]},
    {id:'cancel-elder-reading',ticks:1,commands:[press(-1)]},
    {id:'finish-elder-reading',ticks:160,commands:[],frames:Array.from({length:160},(_,tick)=>tick%16===0?[press(0)]:[])},
  ]};
}
