// transient = a sample's interval high (or footprint) above the median sampled footprint of the 3 s on either side
const fs=require('fs');const [dir,mode]=process.argv.slice(2);
const r=JSON.parse(fs.readFileSync(`${dir}/${mode}.json`,'utf8'));
const nat=fs.readFileSync(`${dir}/${mode}-native.jsonl`,'utf8').trim().split('\n').map(JSON.parse).filter(s=>s.type==='sample'&&s.phase==='drive');
const pidMax={};for(const s of nat)for(const [p,v] of Object.entries(s.pids))pidMax[p]=Math.max(pidMax[p]??0,v[0]);
const pid=Object.entries(pidMax).sort((a,b)=>b[1]-a[1])[0][0];
const fp=nat.map(s=>s.pids[pid]?.[0]??0),hi=nat.map(s=>s.pids[pid]?.[1]??0);
const med=a=>{const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)];};
const out=[];
for(let i=3;i<nat.length-3;i++){const ctx=[...fp.slice(i-3,i),...fp.slice(i+1,i+4)];const t=Math.max(hi[i],fp[i])-med(ctx);const at=Date.parse(nat[i].t)/1000;const route=r.routes.find(x=>at>=x.start&&at<=x.end);out.push({t:+(t/1e6).toFixed(1),at:route?`${route.name} +${(at-route.start).toFixed(1)}s`:'?'});}
out.sort((a,b)=>b.t-a.t);
console.log(mode,'top transients MB:',out.slice(0,6).map(o=>`${o.t} (${o.at})`).join('; '));
console.log(mode,'count >=20 MB:',out.filter(o=>o.t>=20).length,' >=40 MB:',out.filter(o=>o.t>=40).length, ' sum of >=10 MB:', out.filter(o=>o.t>=10).reduce((a,o)=>a+o.t,0).toFixed(0));
