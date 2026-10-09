import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const ROOT='/Users/raynos/projects/games/wildshard-singleplayer';
const { compare, normalize } = await import(`${ROOT}/scripts/parity/compare.mjs`);
const lane=process.argv[2], pairs=process.argv.slice(3);
for(const p of pairs){
  const a=JSON.parse(execFileSync('git',['show',`HEAD:test/parity/baselines/${lane}/${p}.json`],{cwd:ROOT,encoding:'utf8',maxBuffer:1<<28}));
  const b=JSON.parse(readFileSync(`${ROOT}/test/parity/baselines/${lane}/${p}.json`,'utf8'));
  const r=compare(a,normalize(b),{pending:[],quarantine:[],renames:[],ambientInfo:[],lanePending:false,ignore:[]});
  console.log('==',lane,p);
  for(const row of r.rows.filter(x=>x.verdict==='red'))console.log(' red',row.field,JSON.stringify(row.baseline).slice(0,70),'->',JSON.stringify(row.now).slice(0,70));
}
