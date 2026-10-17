import {fileURLToPath} from 'node:url';
import {NALATI_FEATS} from '../data/feats.ts';
import {NALATI_QUEST_FEATS} from '../data/ledger.ts';
import policy from '../data/persistence.json' with {type:'json'};
import {encodeCanonicalJson} from '@wildshard/sdk/immutable';
import {byteWriter} from '../../../../scripts/bake-output.mjs';

// Chained quests own their completion witnesses; their legacy counts never pay them again.
const chapters=new Set(Object.values(NALATI_QUEST_FEATS));
const feats=NALATI_FEATS.map(({id,count,event,kind,variant})=>{
  const row={id,count,fact:chapters.has(id)?null:`nalati.feat.${id}`};
  return Object.assign(row,event===undefined?{}:{event},kind===undefined?{}:{kind},variant===undefined?{}:{variant});
});
const writer=byteWriter(process.argv.includes('--check'),'persistence');
writer.put(fileURLToPath(new URL('../data/persistence.generated.json',import.meta.url)),
  encodeCanonicalJson({...policy,counters:{...policy.counters,feats}}));
writer.finish();
