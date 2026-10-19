"""Independent NumPy replay. Run from repository root; no runtime mutation."""
import json, hashlib, zlib
from pathlib import Path
import numpy as np
D=Path('tmp/conch-readable-qa/motion4-stop-resume')
O=Path('docs/reviews/conch-motion4-independent/stop-resume')
read=lambda p:json.loads(Path(p).read_text())
hashfile=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
t=read(D/'trace.json'); g=read(D/'geometry.json')[0]; original=Path('art/driftwood-isle/approved-conch/runtime-admission/character-pass-native1')
meta=read(original/'metadata.json'); raw=zlib.decompress((original/'payload.bin').read_bytes()); offset=0; parts=[]
for part in meta['bodies'][0]['hard']:
 n=part['row']['count']; parts.append((offset,offset+n))
 for k,attr in enumerate(part['row']['attrs']):
  name,typ,num=attr[:3]
  if name not in ['position','skinIndex','skinWeight']:continue
  a=np.frombuffer(raw,dtype='<u2' if typ=='u16' else '<f4',count=n*num,offset=part['offsets'][k]).copy().reshape(n,num)
  if name=='position':a[:,0]=-a[:,0];a[:,2]=.05-a[:,2].astype(float)
  b=np.array(g[{'position':'positions','skinIndex':'indices','skinWeight':'weights'}[name]]).reshape(-1,num)[offset:offset+n]
  assert np.array_equal(a,b),(name,offset)
 offset+=n
mat=lambda a:np.array(a).reshape(4,4).T
pos=np.c_[np.array(g['positions']).reshape(-1,3),np.ones(offset)]
w=np.array(g['weights']).reshape(-1,4); ids=np.array(g['indices']).reshape(-1,4)
assert np.max(abs(w.sum(axis=1)-1))<1e-6
bound=pos@mat(g['bind']).T; inv=np.array([mat(x) for x in g['inverses']]); rows=[]; prev=None; slips=[]
for r in t:
 m=r['meshes'][0]; palette=np.array([mat(x) for x in m['boneWorld']])@inv
 weighted=np.zeros_like(bound)
 # Three.js adds weighted xyz then applies affine output to homogeneous w=1.
 for slot in range(4):weighted+=np.einsum('nij,nj->ni',palette[ids[:,slot]],bound)*w[:,slot,None]
 weighted[:,3]=1
 world=weighted@(mat(m['world'])@mat(m['bindInverse'])).T; heights=world[:,1]-900
 row={k:r[k] for k in ['frame','gameTime','wallTime','phase','stage','guard','clock','poseInput','strike','speed','gait','flinch','deathT','hp','alive','playerHp']}
 row.update(minimum=float(heights.min()),belowZero=int((heights<0).sum()),near2cm=int((abs(heights)<=.02).sum()))
 rows.append(row)
 if prev is not None:
  pr,pw,ph=prev
  if r['alive'] and pr['alive'] and r['bout']==pr['bout'] and r['poseInput']['t']>=pr['poseInput']['t']:
   mask=(heights<=.02)&(ph<=.02)
   if mask.any():
    delta=world[mask][:,[0,2]]-pw[mask][:,[0,2]]
    slips.append({'frame':r['frame'],'phase':r['phase'],'speed':r['speed'],'nearVerticesBoth':int(mask.sum()),'maxHorizontalDelta':float(np.linalg.norm(delta,axis=1).max()),'dtGame':r['gameTime']-pr['gameTime']})
 prev=(r,world,heights)
summarize=lambda rr:{'samples':len(rr),'min':min(x['minimum'] for x in rr),'maxMin':max(x['minimum'] for x in rr),'belowZero':sum(x['belowZero'] for x in rr),'withoutNear':sum(x['near2cm']==0 for x in rr)}
closure=[]
c=read('docs/reviews/conch-motion4-capture/stop-resume/evidence-receipt.json');failures=[]
for f,v in c['files'].items():
 if hashfile(D/f)!=v['sha256']:failures.append(f)
closure.append({'path':'docs/reviews/conch-motion4-capture/stop-resume/evidence-receipt.json','files':len(c['files']),'failures':failures})
assert not failures
segments=[]
for r in rows:
 key=[r['phase'],r['stage'],r['strike']['phase'],r['strike']['currentId'],r['alive']]
 if not segments or segments[-1]['key']!=key:segments.append({'key':key,'first':r['frame'],'last':r['frame']})
 else:segments[-1]['last']=r['frame']
result={'schema':'conch.motion4.independent-render-review.v1','vertices':offset,'blendedVertices':int(((w>0).sum(axis=1)>1).sum()),'canonicalExact':True,'closures':closure,'all':summarize(rows),'living':summarize([r for r in rows if r['alive']]),'settled':None,'clock':{'firstFrame':t[0]['frame'],'lastFrame':t[-1]['frame'],'consecutive':all(b['frame']==a['frame']+1 for a,b in zip(t,t[1:])),'gameSpan':t[-1]['gameTime']-t[0]['gameTime'],'wallSpanSeconds':(t[-1]['wallTime']-t[0]['wallTime'])/1000,'medianRenderIntervalMs':float(np.median(np.diff([r['wallTime'] for r in t]))),'maximumRenderIntervalMs':float(np.max(np.diff([r['wallTime'] for r in t])))},'horizontalNearFloorMotion':{'note':'Same vertex within 2cm in adjacent samples; movement is evidence against treating proximity as no-slip, not a stance/contact classification. Resets excluded.','largest':sorted(slips,key=lambda r:r['maxHorizontalDelta'],reverse=True)[:20]},'segments':segments,'samples':rows}
(O/'numeric-verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['samples','segments']},indent=2))
