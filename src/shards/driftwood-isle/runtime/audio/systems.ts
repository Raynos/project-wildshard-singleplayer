import { audioObserverSystems, type AudioObserverHost } from '@wildshard/game/plugin/audio';
import type { Camera } from 'three';

interface AudioParts {
  clock: () => { readonly dusk: number; readonly night: number } | null;
  shrine: { setDusk: (value: number) => void } | null;
  hum: { update: (camera: Camera) => void } | null;
  ambience: { night: number; update: (dt: number, camera: Camera) => void };
}

/** The current shell ticks enemies in worldUpdate after the hands; dusk precedes both. */
export function driftwoodAudioSystems(ctx:AudioObserverHost,camera:Camera,parts:AudioParts,rows:Parameters<typeof audioObserverSystems>[0]):void {
  const observers=audioObserverSystems(rows,{
    read:id=>{const clock=parts.clock();switch(id){case 'hasClock':return clock===null?0:1;case 'night':return clock?.night??0;case 'dusk':return clock?.dusk??0;default:throw new Error('Unknown audio observation');}},
    write:(id,value)=>{switch(id){case 'shrine.dusk':parts.shrine?.setDusk(value);break;case 'ambience.night':parts.ambience.night=value;break;default:throw new Error('Unknown audio observation target');}},
    commands:new Map<string,NonNullable<ReturnType<Parameters<typeof audioObserverSystems>[1]['commands']['get']>>>([['hum',()=>{parts.hum?.update(camera);}],['ambience',(dt)=>{parts.ambience.update(dt,camera);}]])
  });
  for(let index=0;index<16;index++){const system=observers.systems[index];if(system!==undefined)ctx.system(system);}
}
