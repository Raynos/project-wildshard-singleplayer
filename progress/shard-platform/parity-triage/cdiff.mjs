import { readFileSync } from 'node:fs';
const [a,b]=process.argv.slice(2).map(p=>JSON.parse(readFileSync(p,'utf8')));
const norm=(s)=>s.replace(/\?v=[^/]*/g,'').replace(/[0-9a-f]{8,}/g,'#');
const grp=(j,kind)=>{const g=new Map();for(const r of j.census.rows.filter(r=>r.kind===kind)){const k=r.owner+' | '+norm(r.asset);const v=g.get(k)??{n:0,b:0};v.n++;v.b+=r.bytes??0;g.set(k,v);}return g;};
for(const kind of ['texture','renderbuffer']){const A=grp(a,kind),B=grp(b,kind);let da=0;
for(const k of new Set([...A.keys(),...B.keys()])){const x=A.get(k)??{n:0,b:0},y=B.get(k)??{n:0,b:0};if(x.n!==y.n||x.b!==y.b){console.log(kind,`${x.n}->${y.n}`,((y.b-x.b)/1048576).toFixed(2),'MB',k);da+=y.b-x.b;}}
console.log(kind,'total delta MB',(da/1048576).toFixed(2));}
const cnt=(l)=>{const m=new Map();for(const s of l)m.set(s,(m.get(s)??0)+1);return m;};
const NA=cnt(a.census.named),NB=cnt(b.census.named);
for(const k of new Set([...NA.keys(),...NB.keys()]))if(NA.get(k)!==NB.get(k))console.log('mesh',NA.get(k)??0,'->',NB.get(k)??0,k);
console.log('memory',JSON.stringify(a.census.memory),'->',JSON.stringify(b.census.memory));
console.log('boot mem',JSON.stringify(a.boot.render.memory),'->',JSON.stringify(b.boot.render.memory),'programs',a.boot.render.programs,'->',b.boot.render.programs);
const PA=cnt(a.census.progs),PB=cnt(b.census.progs);for(const k of new Set([...PA.keys(),...PB.keys()]))if(PA.get(k)!==PB.get(k))console.log('prog',PA.get(k)??0,'->',PB.get(k)??0,k);
