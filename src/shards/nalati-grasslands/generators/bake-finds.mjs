import {fileURLToPath} from 'node:url';
import policy from '../data/finds.json' with {type:'json'};
import ecology from '../data/ecology.generated.json' with {type:'json'};
import feats from '../data/feats.json' with {type:'json'};
import effects from '../data/weaponEffects.json' with {type:'json'};
import content from '../data/questContent.json' with {type:'json'};
import {parseFindsCatalogue} from '@wildshard/format/findsCatalogue';
import {byteWriter,jsonBytes} from '../../../../scripts/bake-output.mjs';

const elites=policy.elites.map(({id,icon})=>{const skin=ecology.elites[id]?.drop.skin??null,name=skin===null?null:effects.skins.find(row=>row.id===skin)?.name??null;
  const title=feats.find(row=>row.id===id)?.title??null,prize=name===null?policy.labels.horse:`${name} ${policy.labels.skin}`;
  return {label:ecology.elites[id]?.name??id,icon,flag:policy.flags.elite+id,prize:title===null?[prize]:[prize,title]};});
const places=content.places.map(row=>({label:row.label,icon:'pin',flag:policy.flags.place+row.id}));
const rows=parseFindsCatalogue({counters:[{label:policy.labels.elites,flags:elites.map(row=>row.flag)},{label:policy.labels.places,flags:places.map(row=>row.flag)}],sections:[{title:policy.labels.elites,wide:true,items:elites},{title:policy.labels.places,dense:true,items:places}]});
const writer=byteWriter(process.argv.includes('--check'),'nalati-finds');writer.put(fileURLToPath(new URL('../data/finds.generated.json',import.meta.url)),jsonBytes(rows));writer.finish();
