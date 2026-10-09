import { readFileSync, existsSync } from 'node:fs';
const ROOT='/Users/raynos/projects/games/wildshard-singleplayer';
const { compare, normalize } = await import(`${ROOT}/scripts/parity/compare.mjs`);
const [oldF,newF]=process.argv.slice(2);
const a=JSON.parse(readFileSync(oldF,'utf8')),b=JSON.parse(readFileSync(newF,'utf8'));
const r=compare(a,normalize(b),{pending:[],quarantine:[],renames:[],ambientInfo:[],lanePending:false,ignore:[]});
for(const row of r.rows.filter(x=>x.verdict==='red'))console.log(' red',row.field,JSON.stringify(row.baseline).slice(0,80),'->',JSON.stringify(row.now).slice(0,80));
