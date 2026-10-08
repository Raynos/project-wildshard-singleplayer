import json,statistics,datetime,bisect,collections,lzma,sys
from pathlib import Path
S=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parent.parent/'soak'
def opened(name):
 p=S/name
 return p.open('rt') if p.is_file() else lzma.open(S/(name+'.xz'),'rt')
def text(name):
 with opened(name) as f:return f.read()
r=json.loads(text('dev-cells.json')); pid=str(r['gamePid'])
gls=[json.loads(l) for l in opened('dev-cells-gl.jsonl')]; ts=[g['at'] for g in gls]
def closest(t):
 i=bisect.bisect_left(ts,t); q=min(gls[max(i-1,0):i+1],key=lambda a:abs(a['at']-t));return q if abs(q['at']-t)<=1.5 else None
joined=[]
for l in opened('dev-cells-native.jsonl'):
 n=json.loads(l)
 if n.get('type')!='sample':continue
 t=datetime.datetime.fromisoformat(n['t']).timestamp();g=closest(t)
 if not g:continue
 wc=n.get('pids',{}).get(pid,[0])[0]
 joined.append({'at':t,'wc':wc,'gl':g['totalBytes'],'gpu':n['gpu'],'accounted':g.get('accountedBytes'),'wasm':sum(v['bytes'] for v in g['wasm']),'combined':wc+g['totalBytes'],'phase':n['phase'],'g':g})
KEYS=['wc','gl','gpu','accounted','wasm','combined']
def median(rows,k):
 a=sorted(v[k] for v in rows);return a[len(a)//2]
def window(start,end):
 rows=[v for v in joined if start<=v['at']<=end]
 assert rows
 return {'start':start,'end':end,'samples':len(rows),**{k:median(rows,k) for k in KEYS}}
settles=[{'cycle':w['cycle'],**window(w['start'],w['end'])} for w in r['windows']]
start=datetime.datetime.fromisoformat(r['driveStarted'].replace('Z','+00:00')).timestamp()
logs=[]
for l in text('driver.log').splitlines():
 try:a=json.loads(l)
 except json.JSONDecodeError:continue
 if isinstance(a,dict) and 'route' in a and 'seconds' in a:logs.append(a)
assert len(logs)==len(r['routes'])
endpoints=[]
for i,(w,log) in enumerate(zip(r['routes'],logs)):
 assert w['cycle']==log['cycle'] and w['plan']['name']==log['route']
 a=start+log['seconds'];b=a+w['elapsedSeconds']
 rows=window(b-5,b)
 endpoints.append({'routeIndex':i,'cycle':w['cycle'],'route':log['route'],'from':w['plan']['from'],'to':w['plan']['to'],'start':a,'end':b,'endpoint':rows,'gameplayReady':w['after']['live']['live']['gameplayReady'],'failures':w['failures']})
parts=[]
for cycle in range(2,6):
 es=[e for e in endpoints if e['cycle']==cycle];assert len(es)==4
 before=settles[cycle]
 for e in es:
  after=e['endpoint'];parts.append({'cycle':cycle,'leg':e['route'],'before':before,'after':after,'delta':{k:after[k]-before[k] for k in KEYS}});before=after
 after=settles[cycle+1]
 parts.append({'cycle':cycle,'leg':'return-home-to-settled-window','before':before,'after':after,'delta':{k:after[k]-before[k] for k in KEYS}})
aggregates=[]
for leg in dict.fromkeys(p['leg'] for p in parts):
 ps=[p for p in parts if p['leg']==leg]
 aggregates.append({'leg':leg,'circuits':len(ps),'sumDelta':{k:sum(p['delta'][k] for p in ps) for k in KEYS},'medianDelta':{k:statistics.median(p['delta'][k] for p in ps) for k in KEYS}})
def regression(points,key):
 xs=[p['cycle'] for p in points];ys=[p[key] for p in points];xm=statistics.mean(xs);ym=statistics.mean(ys)
 slope=sum((x-xm)*(y-ym) for x,y in zip(xs,ys))/sum((x-xm)**2 for x in xs);intercept=ym-slope*xm
 resid=sum((y-(intercept+slope*x))**2 for x,y in zip(xs,ys));total=sum((y-ym)**2 for y in ys)
 return {'slopeBytesPerCircuit':slope,'rSquared':1-resid/total if total else None,'points':len(xs)}
def assets(cycle):
 w=r['windows'][cycle];gs=[g for g in gls if w['start']<=g['at']<=w['end']];g=gs[len(gs)//2]
 return {(a['owner'],a['asset']):(a['bytes'],a['resources']) for a in g['assets']}
a,b=assets(2),assets(6)
diffs=[{'owner':k[0],'asset':k[1],'bytesBefore':a.get(k,(0,0))[0],'bytesAfter':b.get(k,(0,0))[0],'deltaBytes':b.get(k,(0,0))[0]-a.get(k,(0,0))[0],'resourcesBefore':a.get(k,(0,0))[1],'resourcesAfter':b.get(k,(0,0))[1]} for k in a.keys()|b.keys() if a.get(k)!=b.get(k)]
diffs.sort(key=lambda d:abs(d['deltaBytes']),reverse=True)
# Preserve complete exact PMREM allocation-state history, including zero-byte deletes.
pmrem=[]
for l in opened('dev-cells-gl-events.jsonl'):
 e=json.loads(l)
 if e['op']!='allocation' or 'PMREM.cubeUv' not in e.get('asset',''):continue
 route=next((a for a in endpoints if a['start']<=e['at']<=a['end']),None)
 e['routeIndex']=route['routeIndex'] if route else None;e['route']=route['route'] if route else None;e['cycle']=route['cycle'] if route else None
 pmrem.append(e)
result={'method':'Original grader windows; fixed game PID; actual closest GL census within unchanged 1.5s fence (no reconstruction/interpolation). Upper median matches grader. Endpoint windows use last5s of recorded route start+elapsed, not guaranteed settled. Cycles2..5 sum to settled2->6. Component medians are separate; identical window GL is constant here so WC+GL reconciles. GPU-process independent, never added. No JS heap/SF64 owner census captured.', 'settled':settles,'delta2to6':{k:settles[6][k]-settles[2][k] for k in KEYS},'regression2to6':{k:regression(settles[2:],k) for k in ['wc','gl','gpu','combined']},'endpoints':endpoints,'legPartitions':parts,'legAggregates':aggregates,'assetDifferences2to6':diffs,'pmremAllocations':pmrem}
assert [a['combined'] for a in settles]==[a['bytes'] for a in r['grade']['baselines']], 'Original grader must reproduce byte-for-byte'
for k in KEYS:
 assert sum(p['delta'][k] for p in parts)==result['delta2to6'][k], (k,'Partition must telescope exactly')
assert all(settles[i]['combined']==settles[i]['wc']+settles[i]['gl'] for i in range(2,7))
assert sum(d['deltaBytes'] for d in diffs)==result['delta2to6']['gl']
for cycle in range(2,6):
 for k in KEYS:
  assert sum(p['delta'][k] for p in parts if p['cycle']==cycle)==settles[cycle+1][k]-settles[cycle][k]
claims=[]
for route in r['routes']:
 if route['cycle']>=1 and route['plan']['name']=='template-2-to-driftwood-isle':
  cs=route['after']['claims'];owners=collections.Counter()
  for c in cs: owners[(c['category'],c['owner'])]+=c['accountedBytes']
  claims.append({'cycle':route['cycle'],'count':len(cs),'accountedBytes':sum(c['accountedBytes'] for c in cs),'categoriesAndOwners':[{'category':k[0],'owner':k[1],'bytes':v} for k,v in sorted(owners.items())]})
assert all(a['accountedBytes']==488478226 and a['count']==39 for a in claims)
result['returnPoseClaims']=claims
snapshots={}
for cycle in [2,6]:
 w=settles[cycle]; t=(w['start']+w['end'])/2; active={}
 for e in pmrem:
  if e['at']>t:break
  key=(e['document'],e['context'],e['id'])
  if e['bytes']:active[key]=e
  else:active.pop(key,None)
 snapshots[cycle]=active
result['pmremLiveAtSettled']=[{'cycle':k,'count':len(a),'bytes':sum(e['bytes'] for e in a.values()),'allocations':list(a.values())} for k,a in snapshots.items()]
result['newPmremStillLiveAt6']=[e for k,e in snapshots[6].items() if k not in snapshots[2]]
result['notCaptured']=['JS heap size or heap snapshot','__wildshard.memory() / SF64 CPU ownership census','native WebContent VM categories','WebGL program/compiler backing bytes','allocation call-site stacks (raw OFF by protocol)']
O=Path(sys.argv[2]) if len(sys.argv)>2 else Path(__file__).resolve().parent/'attribution.json';O.write_text(json.dumps(result,indent=2)+'\n')
print('REGRESSION',result['regression2to6'])
print('PARTITION (sum MB)',[(a['leg'],{k:round(a['sumDelta'][k]/1e6,3) for k in ['wc','gl','gpu','combined']}) for a in aggregates])
print('PMREM allocation changes',len(pmrem));print('Original grader and component partitions verified')
