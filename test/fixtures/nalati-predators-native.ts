import * as v from 'valibot';
import {nativePopulationOf} from '../../src/game/riding/nativePopulation';
import {PastureCues} from '../../src/game/riding/pastureCues';
import {PastureActorSchema} from '../../src/format/wildlifePopulation';
import {PopulationEffectsSchema} from '../../src/format/creatures';
import {GroupNotices} from '../../src/game/population/groupNotices';
import {decodeTerrainTile} from '../../src/format/terrainTileBytes';
import {prepareHeadlessRuntime as prepareNalati} from './nalati-headless';
import {withNalatiCompanions} from './nalati-companions-native';
import {withNalatiWeapons} from './nalati-weapons-native';
import type {PrepareHeadlessRuntime} from '../../src/sdk/headlessRuntime';

const Signal=v.strictObject({name:v.string(),x:v.pipe(v.number(),v.finite()),z:v.pipe(v.number(),v.finite()),tick:v.pipe(v.number(),v.integer(),v.minValue(0))});
const Cue=v.strictObject({kind:v.string(),text:v.string(),sound:v.nullable(v.string()),actor:v.nullable(v.string())});
const Saved=v.object({signals:v.pipe(v.array(Signal),v.maxLength(64)),cues:v.pipe(v.array(Cue),v.maxLength(64)),
  notices:v.pipe(v.array(v.tuple([v.string(),v.pipe(v.number(),v.finite())])),v.maxLength(64))});

/** Observe the existing actors and native signals. No population command,
 * timer, prey, damage, steering or outcome is supplied by this adapter. */
export const prepareHeadlessRuntime:PrepareHeadlessRuntime=async preparation=>{
  const wildlife=v.parse(v.object({pastureActor:PastureActorSchema,groups:v.object({effects:PopulationEffectsSchema})}),
    await preparation.product.json('actors/wildlife.json'));
  const pasture=new PastureCues(wildlife.pastureActor.cues);
  const prepare=withNalatiWeapons(withNalatiCompanions(input=>prepareNalati(input,decodeTerrainTile,undefined,pasture)));
  const base=await prepare(preparation);
  return {...base,install:(host,context)=>{
    base.install(host,context);
    const population=nativePopulationOf(host);if(population===undefined)throw new Error('Missing actual native pasture');
    const signals:v.InferOutput<typeof Signal>[]=[];
    const cues:v.InferOutput<typeof Cue>[]=[];
    const notices=new GroupNotices(wildlife.groups.effects);
    host.events.on('creature.signal',row=>{
      signals.push({...row,tick:host.state.tick});if(signals.length>64)signals.shift();
      const text=notices.signal(row.name,host.clock.now);if(text!==null)context.emit({kind:'hint',text});
    },host.scope);
    host.onStep('nalati.predators',()=>{
      for(let count=0;count<64;count++){
        const cue=pasture.next();if(cue===undefined)break;
        cues.push(cue);if(cues.length>64)cues.shift();
        if(cue.text.length>0)context.emit({kind:'hint',text:cue.text});
      }
    },{
      snapshot:()=>JSON.stringify({signals,cues,notices:notices.snapshot(),raid:population.raid.snapshot(),
        flocks:population.flocks.map(flock=>({count:flock.n,alive:flock.alive,x:flock.cx,z:flock.cz})),
        wolves:[...host.entities.values()].filter(actor=>actor.kind==='wolf').map(actor=>actor.snapshot()),
        shepherd:population.raid.shepherd?.snapshot()??null,health:host.player.health.attributes}),
      restore:input=>{
        const saved=v.parse(Saved,typeof input==='string'?JSON.parse(input):input);
        signals.splice(0,signals.length,...saved.signals);
        cues.splice(0,cues.length,...saved.cues);
        notices.restore(saved.notices);
      },
    });
  }};
};
