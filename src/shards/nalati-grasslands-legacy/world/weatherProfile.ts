import type { WeatherProfile, WeatherNumbers } from '@wildshard/engine/world/weather';
import type { WeatherOpts } from './Weather';

export type StormPhase = 'clear' | 'building' | 'gust' | 'storm' | 'clearing' | 'after';
export const STORM_PHASES: readonly StormPhase[] = ['clear', 'building', 'gust', 'storm', 'clearing', 'after'];


export const LEN: Record<StormPhase, [number, number]> = {
  clear: [20 * 60, 30 * 60], building: [90, 90], gust: [20, 20], storm: [120, 180], clearing: [60, 60], after: [180, 180],
};
const sm = (e0:number,e1:number,x:number):number => { const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0))); return t*t*(3-2*t); };
const mix=(a:number,b:number,t:number):number => a+(b-a)*t;

export interface SteppeNumbers extends WeatherNumbers { front: number; rainbow: number }
export function steppeProfile(opts: WeatherOpts): WeatherProfile<StormPhase, SteppeNumbers> {
 const first = opts.firstClear ?? [12, 18], clear = opts.clear ?? [20,30];
 return {
 states: STORM_PHASES, next: { clear:'building', building:'gust', gust:'storm', storm:'clearing', clearing:'after', after:'clear' },
 length: { ...LEN, clear: [clear[0]*60, clear[1]*60] }, firstLength: { clear:[first[0]*60,first[1]*60] },
 soak:30, dry:90, holdPolicy:'first', tickHeld:true,
 modes: { live:'none', clear:{hold:'clear'}, storm:{hold:'storm'} },
 initial: () => ({ overcast:0,rain:0,wet:0,wind:0,fog:0,front:0,rainbow:0 }),
 forceWet: (s,t,prev) => s === 'storm' ? Math.max(prev,sm(0,40,t)) : s === 'clearing' || s === 'after' ? 1 : prev,
 numbers: ({state,t,u,dt,prev}) => {
 let wet = prev.wet;

    let front = 0, overcast = 0, rain = 0, rainbow = 0;
    
    switch (state) {
      case 'clear': break;
      case 'building':
        front = mix(0, 0.55, sm(0, 1, u));
        overcast = 0.35 * sm(0.35, 1, u);
        break;
      case 'gust':
        front = mix(0.55, 1, sm(0, 1, u));
        overcast = mix(0.35, 0.88, sm(0, 0.8, u));
        rain = 0.35 * sm(0.45, 1, u);
        break;
      case 'storm':
        front = 1;
        overcast = mix(0.88, 1, sm(0, 10, t));
        rain = mix(0.35, 1, sm(0, 15, t)) * mix(1, 0.8, sm(0.85, 1, u));
        break;
      case 'clearing':
        front = mix(1, 1.5, sm(0, 1, u));
        overcast = mix(1, 0.2, sm(0, 1, u));
        rain = 0.8 * (1 - sm(0, 0.8, u));
        break;
      case 'after':
        front = 1.5;
        overcast = 0.2 * (1 - sm(0, 0.5, u));
        rainbow = sm(0, 0.08, u) * (1 - sm(0.75, 1, u));
        break;
      default: break;
    }
    // wet: soaks up with the rain, holds through the clearing, dries through the after and the first minute of clear
    if (state === 'storm' || state === 'gust') wet = Math.min(1, wet + dt * rain / 30);
    else if (state === 'clearing') wet = Math.max(wet, 0.9);
    else if (state === 'after') wet = Math.min(wet, 1 - 0.4 * sm(0.3, 1, u));
    else wet = Math.max(0, wet - dt / 90);

 return { overcast,rain,wet,wind:0,fog:0,front,rainbow };
 },
 };
}
