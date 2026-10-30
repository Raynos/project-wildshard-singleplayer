import * as v from 'valibot';
import {nativePopulationOf} from '../../src/game/riding/nativePopulation';
import {prepareHeadlessRuntime as prepareWeapons} from './nalati-weapons-native';
import type {PrepareHeadlessRuntime} from '../../src/sdk/headlessRuntime';

const Signal=v.strictObject({name:v.string(),x:v.pipe(v.number(),v.finite()),z:v.pipe(v.number(),v.finite()),tick:v.pipe(v.number(),v.integer(),v.minValue(0))});
const Saved=v.object({signals:v.pipe(v.array(Signal),v.maxLength(64))});

/** Observe the existing actors and native signals. No population command,
 * timer, prey, damage, steering or outcome is supplied by this adapter. */
export const prepareHeadlessRuntime:PrepareHeadlessRuntime=async preparation=>{
  const base=await prepareWeapons(preparation);
  return {...base,install:(host,context)=>{
    base.install(host,context);
    const population=nativePopulationOf(host);if(population===undefined)throw new Error('Missing actual native pasture');
    const signals:v.InferOutput<typeof Signal>[]=[];
    host.events.on('creature.signal',row=>{
      signals.push({...row,tick:host.state.tick});if(signals.length>64)signals.shift();
    },host.scope);
    host.onStep('nalati.predators',()=>undefined,{
      snapshot:()=>JSON.stringify({signals,raid:population.raid.snapshot(),
        flocks:population.flocks.map(flock=>({count:flock.n,alive:flock.alive,x:flock.cx,z:flock.cz})),
        wolves:[...host.entities.values()].filter(actor=>actor.kind==='wolf').map(actor=>actor.snapshot()),
        shepherd:population.raid.shepherd?.snapshot()??null,health:host.player.health.attributes}),
      restore:input=>{
        const saved=v.parse(Saved,typeof input==='string'?JSON.parse(input):input);
        signals.splice(0,signals.length,...saved.signals);
      },
    });
  }};
};
