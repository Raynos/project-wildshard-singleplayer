// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the offline collector against an isolated Git repository.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures own only their temporary repositories and bundle outputs.
import { mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep committed-report fixtures outside the shared tree.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve test-owned files.
import { dirname,join } from 'node:path';
import { expect,it } from 'vitest';
import { committedAdminTree,exportedAdminTree,writeAdminData } from '../scripts/admin-data.mjs';
import { collectAdminData,stableJson } from '../scripts/admin-data/collect.mjs';
import { markdownTables,parsePlan,tableCells } from '../scripts/admin-data/markdown.mjs';
import { readAdminBundle,readLoadingReport } from '../scripts/admin-data/validate.mjs';

const pin='a'.repeat(40);
const plan=`# Plan: TEST

**State:** in progress — whole plan ≈ 53 %; Part A ≈ 70 %; M1 ≈ 99 %.

| Step | Owner | Work | Proof | Size |
|---|---|---|---|---|
| SF1 | X | waiting for Jake's pick | pending | M |
| SF2 | X | done | yes | S |

## 6. Done when
- **M1:** a package.
- **M2:** a grid and Jake's yes.

Effort by milestone (agent-days, dated 2026-10-04):

| | Total | Done | Left | Basis |
|---|---|---|---|---|
| M1 | ≈ 100 | ≈ 90 | ≈ 10 | old table |

## 10. Decisions
| ID | Topic | Decision |
|---|---|---|
| G1 | A | **needs pick**: yes/no |
| G2 | B | **dropped**: used to be needs pick |

## Handoff (old)
| ID | Topic | Decision |
|---|---|---|
| G99 | History | needs pick |
`;
const playtest=`# Playtest
## Build, setup
- **Build:** \`abcdef123\`, version \`abcdef1-xyz\`.
## Top 10 problems
1. **Crash**
   Files: \`clip-01\`, \`still.jpg\`.
2. **Slow**
   No claim this is fixed.
## Previous status
| # | Now | Evidence |
|---|---|---|
| 1 | **Not reproduced** | still.jpg |
`;
const memory={schema:'memory-report/1',pin,device:'Simulator',settings:{cold:true},cap:{bytes:1_000_000_000},poses:[{name:'worst-crossing',measured:null,accounted:{total:null,allocations:[],storageTotals:{ram:null,gpu:null},unattributed:{ram:null,gpu:null}},missing:['No complete crossing observation']}]};
const itemized={protocol:'Historical capacity is not resident RAM',situations:[{id:'road',title:'Road',subtitle:'Historical',pin,build:'aaaaaaa-xyz',settings:'phone',heapSource:'other-process',wcBytes:600,glBytes:100,totalBytes:700,vmmapRegionsDirtyBytes:{overlapping:700.5},blocks:[{side:'RAM',owner:'unattributed',system:'resident remainder',conf:'U',bytes:400.5}]}]};
const loading={schema:'loading-benchmark/1',pin,device:'Simulator',runs:[{shard:'sample',cache:'cold',timeToPlayableMs:100,phases:[{name:'kit',startMs:20,endMs:80,owner:'sample/kit'}],longTasks:[{startMs:20,durationMs:60,owner:'sample/kit'}]}],missing:[]};
function inputs():Map<string,string>{return new Map([
  ['docs/plans/SHARD-PLATFORM.md',plan],
  ['art/playtest/round-1/README.md',playtest],
  ['art/playtest/round-1/still.jpg','image'],
  ['art/playtest/round-1/clip-01-crash.mp4','video'],
  ['progress/memory/sf64-report/pages/report.json',JSON.stringify(memory)],
  ['progress/memory/sf64-report/pages/road.jpg','image'],
  ['progress/memory/itemized-2026-10-08/itemized.json',JSON.stringify(itemized)],
]);}
function tree(files=inputs()){return {revision:pin,paths:[...files.keys()],read:(path:string)=>{const value=files.get(path);if(value===undefined)throw new Error('Missing fixture');return new TextEncoder().encode(value);}};}

it('collects typed reports without merging native footprint, storage estimates or missing values',()=>{
  const {bundle,files}=collectAdminData(tree());
  expect(bundle.loading).toMatchObject({status:'unavailable',reports:[]});
  expect(bundle.loading.missing).toHaveLength(1);
  const sf64=bundle.memory.find(row=>row.format==='sf64');
  if(sf64?.format!=='sf64')throw new Error('Missing SF64');
  expect(sf64.data.poses[0]?.measured).toBeNull();
  expect(sf64.data.poses[0]?.accounted.total).toBeNull();
  const legacy=bundle.memory.find(row=>row.format==='itemized');
  if(legacy?.format!=='itemized')throw new Error('Missing legacy');
  expect(legacy.data).toEqual(itemized);
  expect(bundle.plan.reportedPercent[0]?.percent).toBe(53);
  expect(bundle.plan.effort.rows[0]?.percent).toBe(90);
  expect(bundle.plan.effort.context).toContain('2026-10-04');
  expect(bundle.plan.decisions.map(row=>row.id)).toEqual(['G1','G2']);
  expect(bundle.plan.waitingForJake.map(row=>row.id)).toEqual(['SF1','G1']);
  expect(bundle.playtests[0]?.findings[0]?.media).toEqual(['art/playtest/round-1/clip-01-crash.mp4','art/playtest/round-1/still.jpg']);
  expect(bundle.playtests[0]?.tables[0]?.rows[0]?.cells[1]).toBe('**Not reproduced**');
  expect(bundle.media).toHaveLength(3);
  expect(files.size).toBe(2); // Equal image bytes across reports share one output blob.
  expect(readAdminBundle(JSON.parse(stableJson(bundle)))).toEqual(bundle);
});

it('is byte deterministic with permuted input/key order and never emits a wall-clock build date',()=>{
  const first=collectAdminData(tree()),reversed=new Map([...inputs()].reverse());
  const second=collectAdminData(tree(reversed));
  expect(stableJson(first.bundle)).toBe(stableJson(second.bundle));
  expect(stableJson({z:1,a:{b:2,a:3}})).toBe(stableJson({a:{a:3,b:2},z:1}));
  expect(first.bundle).not.toHaveProperty('generatedAt');
});

it('enforces the SF67 build contract and phase/task semantics with a tiny valid fixture',()=>{
  const tiny:unknown=JSON.parse(readFileSync(new URL('../scripts/admin-data/fixtures/loading-benchmark.json',import.meta.url),'utf8'));
  expect(readLoadingReport(tiny).runs[0]?.shard).toBe('fixture');
  const source=inputs();source.set('progress/loading/sf67/sample/report.json',JSON.stringify(loading));
  const bundle=collectAdminData(tree(source)).bundle;
  expect(bundle.loading.status).toBe('available');
  expect(bundle.loading.reports[0]?.data).toEqual(loading);
  expect(()=>readLoadingReport({...loading,pin:''})).toThrow('build');
  expect(()=>readLoadingReport({...loading,runs:[{...loading.runs[0],phases:[{name:'kit',startMs:80,endMs:20,owner:'kit'}]}]})).toThrow('before');
  expect(()=>readLoadingReport({...loading,runs:[{...loading.runs[0],longTasks:[{startMs:0,durationMs:50,owner:'kit'}]}]})).toThrow();
  expect(()=>readLoadingReport({...loading,runs:[],missing:[]})).toThrow('missing');
  expect(()=>readLoadingReport({...loading,optimistic:true})).toThrow('Unknown');
});

it('rejects corrupt memory rulers, invalid confidence and broken references instead of dropping them',()=>{
  const source=inputs();source.set('progress/memory/itemized-2026-10-08/itemized.json',JSON.stringify({...itemized,situations:[{...itemized.situations[0],totalBytes:999}]}));
  expect(()=>collectAdminData(tree(source))).toThrow('WC + GL');
  source.set('progress/memory/itemized-2026-10-08/itemized.json',JSON.stringify({...itemized,situations:[{...itemized.situations[0],blocks:[{side:'RAM',owner:'a',system:'a',conf:'exact',bytes:3}]}]}));
  expect(()=>collectAdminData(tree(source))).toThrow('Invalid admin data');
  const bundle=collectAdminData(tree()).bundle;
  const report=bundle.playtests[0];if(!report)throw new Error('Missing fixture');report.media.push('outside.jpg');
  expect(()=>readAdminBundle(bundle)).toThrow('Unknown playtest media');
  expect(()=>collectAdminData({...tree(),paths:['../private.json']})).toThrow('Unsafe');
});

it('parses escaped/code pipes and ignores fenced fake tables and historical decision handoffs',()=>{
  expect(tableCells('| A | `x|y` | a\\|b |')).toEqual(['A','`x|y`',String.raw`a\|b`]);
  expect(markdownTables('```\n| fake |\n|---|\n| x |\n```')).toEqual([]);
  const parsed=parsePlan(plan,{path:'plan.md',sha256:'a'.repeat(64),bytes:plan.length});
  expect(parsed.milestones[0]?.markdown).toContain('**M2:**');
  expect(parsed.rows[0]?.line).toBe(7);
});

it('pins an immutable Git tree and excludes dirty, staged and untracked report changes',()=>{
  const root=mkdtempSync(join(tmpdir(),'admin-data-'));
  const git=(...args:string[])=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const put=(path:string,value:string)=>{const file=join(root,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,value);};
  try{
    git('init','--quiet');git('config','user.email','fixture@example.test');git('config','user.name','Fixture');
    for(const [path,value]of inputs())put(path,value);
    git('add','.');git('commit','--quiet','-m','Committed evidence');
    const pinned=committedAdminTree(root,'HEAD');
    const before=stableJson(collectAdminData(pinned).bundle);
    put('docs/plans/SHARD-PLATFORM.md','BROKEN WORKING TREE');git('add','docs/plans/SHARD-PLATFORM.md');
    put('progress/loading/sf67/untracked/report.json',JSON.stringify(loading));
    expect(stableJson(collectAdminData(committedAdminTree(root,'HEAD')).bundle)).toBe(before);
    git('commit','--quiet','-m','Later broken plan');
    expect(stableJson(collectAdminData(pinned).bundle)).toBe(before);
    const out=join(root,'output');writeAdminData(pinned,out);
    expect(readFileSync(join(out,'bundle.json'),'utf8')).toBe(before);
    expect(()=>writeAdminData(pinned,out)).toThrow();
    expect(readFileSync(join(out,'bundle.json'),'utf8')).toBe(before);
  }finally{rmSync(root,{recursive:true,force:true});}
});

it('accepts an explicit clean-export snapshot with a full pin, never a silent checkout fallback',()=>{
  const root=mkdtempSync(join(tmpdir(),'admin-export-'));
  try{
    for(const [path,value]of inputs()){const file=join(root,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,value);}
    expect(stableJson(collectAdminData(exportedAdminTree(root,pin)).bundle)).toBe(stableJson(collectAdminData(tree()).bundle));
    expect(()=>exportedAdminTree(root,'HEAD')).toThrow('full committed revision');
    mkdirSync(join(root,'.git'));
    expect(()=>exportedAdminTree(root,pin)).toThrow('Git checkout');
  }finally{rmSync(root,{recursive:true,force:true});}
});

it('refuses incompatible SF64 versions and identifies builds without treating included-fix commits as builds',()=>{
  const source=inputs();source.set('progress/memory/sf64-report/pages/report.json',JSON.stringify({...memory,schema:'memory-report/2'}));
  expect(()=>collectAdminData(tree(source))).toThrow('Unsupported memory report');
  const clean=inputs();clean.set('art/playtest/round-1/README.md',playtest.replace('## Top 10 problems', 'Includes fix `123456789`.\n## Top 10 problems'));
  expect(collectAdminData(tree(clean)).bundle.playtests[0]?.builds).toEqual(['abcdef123','abcdef1-xyz']);
});
