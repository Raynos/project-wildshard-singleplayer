"""Independent NumPy four-weight reconstruction; run from repository root."""
import json, pathlib, hashlib, numpy as np, itertools
base=pathlib.Path('tmp/conch-motion-observer-event-order1'); out=pathlib.Path('tmp/conch-independent-event-order1-review')
hashfile=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
trace=json.loads((base/'render-trace.json').read_text()); geo=json.loads((base/'runtime-geometry.json').read_text())[0]
mat=lambda a:np.array(a,dtype=float).reshape((4,4),order='F')
v=np.array(geo['positions']).reshape((-1,3)); n=len(v); v=np.column_stack([v,np.ones(n)]) @ mat(geo['bind']).T
ix=np.array(geo['indices']).reshape((-1,4)); w=np.array(geo['weights']).reshape((-1,4)); inv=np.array([mat(x) for x in geo['inverses']]); results=[]
assert n==7338 and np.max(abs(w.sum(1)-1))<1e-6
for r in trace:
 m=r['meshes'][0]; skin=np.array([mat(x) for x in m['boneWorld']])@inv
 acc=np.zeros((n,4))
 for k in range(4): acc+=np.einsum('nij,nj->ni',skin[ix[:,k]],v)*w[:,k,None]
 world=acc@(mat(m['world'])@mat(m['bindInverse'])).T; y=world[:,1]/world[:,3]-900
 results.append(dict(frame=r['frame'],minimum=float(y.min()),maximum=float(y.max()),belowZero=int(sum(y<0)),below5mm=int(sum(y<-.005)),near2cm=int(sum(abs(y)<=.02))))
prior=json.loads((base/'weighted-contact.json').read_text())['frames']
dead=[(r,m) for r,m in zip(trace,results) if not r['alive']]; settled=[m for r,m in dead if r['deathT']>=1]; living=[m for r,m in zip(trace,results) if r['alive']]
def summary(rows):return dict(samples=len(rows),min=min(x['minimum'] for x in rows),maxMinimum=max(x['minimum'] for x in rows),belowZero=sum(x['belowZero']>0 for x in rows),withoutNear2cm=sum(x['near2cm']==0 for x in rows))
ranges=[]
for key,items in itertools.groupby(trace,lambda r:(r['alive'],r['stage'],r['guard'],r['strike']['currentId'],r['strike']['phase'])):
 a=list(items); ranges.append(dict(alive=key[0],stage=key[1],guard=key[2],strike=key[3],phase=key[4],renderFrame=[a[0]['frame'],a[-1]['frame']],wallSeconds=[a[0]['wallTime']/1000,a[-1]['wallTime']/1000],gameSeconds=[a[0]['gameTime'],a[-1]['gameTime']],strikeClock=[a[0]['strike']['clock'],a[-1]['strike']['clock']]))
closure=pathlib.Path('art/driftwood-isle/approved-conch/runtime-admission/arena-motion2/evidence/motion-observer-event-order1-closure.json')
manifest=json.loads(closure.read_text()); mismatches=[str(p) for p,d in manifest['files'].items() if hashfile(pathlib.Path(p))!=d['sha256']]
report=dict(schema='conch.independent-review.numeric.v1',inputs={str(base/x):hashfile(base/x) for x in ['render-trace.json','runtime-geometry.json','weighted-contact.json']},closureSha256=hashfile(closure),closureMismatches=mismatches,method='Independent Python/NumPy column-major matrices; all four skin weights on captured merged geometry; homogeneous coordinates normalized. No use of original JS analyzer.',vertices=n,blendedVertices=int(sum((w>0).sum(1)>1)),all=summary(results),living=summary(living),settledCorpse=summary(settled),maxAbsoluteDifferenceFromPrior=float(max(abs(a['minimum']-b['minimum']) for a,b in zip(results,prior))),postDeath=dict(samples=len(dead),healthRange=[min(r['playerHp'] for r,m in dead),max(r['playerHp'] for r,m in dead)],healthDecreases=sum(b[0]['playerHp']<a[0]['playerHp'] for a,b in zip(dead,dead[1:])),strikePhases=sorted(set(r['strike']['phase'] for r,m in dead))),cadence=dict(renderSamples=len(trace),firstRenderFrame=trace[0]['frame'],lastRenderFrame=trace[-1]['frame'],wallSpan=(trace[-1]['wallTime']-trace[0]['wallTime'])/1000,gameSpan=trace[-1]['gameTime']-trace[0]['gameTime'],medianRenderIntervalMs=float(np.median(np.diff([r['wallTime'] for r in trace]))),maxRenderIntervalMs=float(max(np.diff([r['wallTime'] for r in trace])))),eventRanges=ranges,frames=results)
(out/'numeric-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['frames','eventRanges']},indent=2))
