import {fileURLToPath} from 'node:url';
import {byteWriter,jsonBytes} from '../../../../scripts/bake-output.mjs';
import stealth from '../data/stealth.json' with {type:'json'};
import species from '../data/species.generated.json' with {type:'json'};
import profile from '../data/weaponPowers.json' with {type:'json'};

const program=species.program;
const programs=Object.fromEntries(['polearm','blade','power'].map(signal=>[signal,{...program,signal}]));
const writer=byteWriter(process.argv.includes('--check'),'nalati-held-weapons');
writer.put(fileURLToPath(new URL('../data/heldWeapons.generated.json',import.meta.url)),jsonBytes({...profile,program,programs}));writer.put(fileURLToPath(new URL('../data/stealth.generated.json',import.meta.url)),jsonBytes({...stealth,program}));writer.finish();
