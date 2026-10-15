import {CHUNK_HALF,ENTRY_WIDTH} from '@wildshard/format/contentBounds';
import {PIER,JETTIES} from '../world/sites';
import {PIER_PENNANT_AT} from '../data/layout';
import {PIER_START,LOWERED_SEA} from '../world/sea';
import {PENNANT_WIND} from '../data/pierRows';
import type {PierSpec,PierParams} from '../assets/contracts/pier';



/** The same four site declarations used by the native world build. */
export function worldPierSites():PierSpec[] {
 const cut=PIER_START,seaRamp={run:9,flare:ENTRY_WIDTH},deckY=LOWERED_SEA+1.2;
 return [{x:0,z:-CHUNK_HALF+cut,length:PIER.length-cut,width:4,deckY,landing:true,pennantAt:PIER_PENNANT_AT-cut,seaRamp},
  ...JETTIES.map(j=>({x:j.x+Math.sin(j.rot)*cut,z:j.z+Math.cos(j.rot)*cut,rot:j.rot,length:j.length-cut,width:3,deckY,landing:j.landing??false,seaRamp}))];
}
/** Original terrain measurement, evaluated once by the author producer. */
export function resolvePierParams(spec:PierSpec,heightAt:(x:number,z:number)=>number,seaLevel:number):PierParams {
 const {width,deckY}=spec,yaw=spec.rot??0,cos=Math.cos(yaw),sin=Math.sin(yaw);
 const toWorld=(along:number,across:number):[number,number]=>[spec.x+across*cos+along*sin,spec.z-across*sin+along*cos];
    let length = spec.length, landing: PierParams['landing'] = null;
    if (spec.landing === true || spec.landing === 'end') {
      // march on over the shallows to the first dry sand, then 5 m more: the last 6 m step down onto the beach
      const wl = seaLevel;
      let a = length;
      while (spec.landing !== 'end' && a < length + 80) { const [x, z] = toWorld(a, 0); if (heightAt(x, z) > wl + 0.1) break; a += 0.5; }
      const end = spec.landing === 'end' ? length : a + 4, [ex, ez] = toWorld(end, 0);
      const ground = (s: number): number => heightAt(...toWorld(end - 0.4, s * (width / 2 + 0.3))) - deckY;
      landing = { rampFrom: end - 5.5, landY: heightAt(ex, ez) + 0.12 - deckY, postGround: [ground(-1), ground(1)] };
      length = end;
    }
    // the pennant streams downwind: the world's wind turned into the pier's frame
    const [wx, wz] = PENNANT_WIND, c = Math.cos(yaw), s = Math.sin(yaw);
    const pennantDir: [number, number] = yaw === 0 ? [wx, wz] : [wx * c - wz * s, wx * s + wz * c];
    const seaRamp = spec.seaRamp === undefined ? {} : { seaRamp: { ...spec.seaRamp, landY: -deckY } };
    return { length, width, pileDepth: spec.pileDepth ?? 8, landing, pennantDir, ...(spec.pennantAt === undefined ? {} : { pennantAt: spec.pennantAt }), ...seaRamp };
}
