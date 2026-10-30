import * as v from 'valibot';
import {SaveStore,type SaveStorage} from '../../src/engine/saves/store';
import type {SimHost} from '../../src/engine/sim';
import {AdventurePersistenceSchema} from '../../src/format/namedJsonContracts';
import type {ShardProduct} from '../../src/game/shardfile/shardProduct';
import {installRuntimeState} from '../../src/game/shardfile/runtimeState';
import type {ObservedRecords} from '../../src/game/quest/questObservation';

interface BossRecord { defeated:boolean;rewardTaken:boolean;kills:number }
/** The actual declared boss field and the existing elite continuation, borrowed
 * by chapter observations. Only encounter owners may publish boss outcomes. */
export interface NalatiChapterRecords extends ObservedRecords {
  readonly bosses:ObservedRecords['bosses'] & {
    readonly write:(value:Readonly<Record<string,BossRecord>>)=>boolean;
  };
}
export type InstallNalatiChapterRecords=(host:SimHost)=>NalatiChapterRecords;

/** Fresh native sessions start from the admitted field default. Checkpoint
 * restore writes that same validated field; it never manufactures a boss,
 * imports a page's global save, or substitutes zero for a missing owner. */
export async function prepareNalatiChapterRecords(product:Pick<ShardProduct,'json'|'shardfile'>):Promise<InstallNalatiChapterRecords> {
  const source=product.shardfile,rows=v.parse(AdventurePersistenceSchema,await product.json('quests/persistence.json'));
  const finite=v.pipe(v.number(),v.finite()),number=rows.nonnegative?v.pipe(finite,v.minValue(0)):finite;
  const bosses=v.record(v.string(),v.object({defeated:v.boolean(),rewardTaken:v.boolean(),kills:number}));
  const elites=v.object({records:v.record(v.string(),v.object({kills:number}))});
  return host=>{
    if(host.level.id!==source.identity.slug||host.scope.disposed||host.scope.disposing||host.hasStep('nalati.chapter-records'))
      throw new Error('Chapter records require their unique live native entry');
    const eliteOwner=host.adapters.get('nalati.elites');
    if(eliteOwner===undefined)throw new Error('Chapter records require the installed native elite owner');
    // This native entry owns real storage for its lifetime. The adapter below
    // carries the admitted field into a fresh owner; no page globals or disk
    // saves leak between proofs, and SaveStore's refused-write law is intact.
    const documents=new Map<string,string>();
    const local:SaveStorage={get length(){return documents.size;},key:index=>[...documents.keys()][index]??null,
      getItem:key=>documents.get(key)??null,setItem:(key,value)=>{documents.set(key,value);},
      removeItem:key=>{documents.delete(key);}};
    const saves=new SaveStore({local,session:null});host.scope.onDispose(()=>{documents.clear();});
    const field=installRuntimeState(saves,host.scope,source,source.identity.slug,rows.bosses.key,()=>null);
    const live=():void=>{
      if(host.scope.disposed||host.scope.disposing||host.adapters.get('nalati.elites')!==eliteOwner)
        throw new Error('Chapter record owners retired or changed');
    };
    const read=():Record<string,BossRecord>=>{
      live();const text=field.read();
      if(typeof text!=='string')throw new Error('Chapter boss field must retain its declared JSON wire');
      const input:unknown=JSON.parse(text);return v.parse(bosses,input);
    };
    // Admit the source default before installing a continuation adapter.
    read();
    const write=(value:Readonly<Record<string,BossRecord>>):boolean=>{
      live();const admitted=v.parse(bosses,value),result=field.write(JSON.stringify(admitted));
      if(!result&&rows.refuseWrites)throw new Error('Chapter boss record could not be saved');
      if(result&&rows.bosses.flagPrefix!==undefined)for(const [id,saved]of Object.entries(admitted))
        if(saved.defeated)host.flags.set(rows.bosses.flagPrefix+id);
      return result;
    };
    const owner:NalatiChapterRecords={bosses:{read,write},elites:{read:()=>{
      live();return v.parse(elites,eliteOwner.snapshot()).records;
    }}};
    host.onStep('nalati.chapter-records',()=>{/* Encounters own all writes; this adapter adds no tick work. */}, {
      snapshot:()=>JSON.stringify(read()),restore:value=>{
        if(typeof value!=='string')throw new Error('Chapter boss continuation requires its JSON wire');
        const input:unknown=JSON.parse(value);write(v.parse(bosses,input));
      },
    });
    return owner;
  };
}
