"""Independent read-only audit: matrix-vector skinning, exact pins and event clocks."""
import json, hashlib, pathlib, collections
import numpy as np
R=pathlib.Path('.'); B=R/'tmp/puffer-full-lifecycle-attempt2'; O=R/'tmp/puffer-full-lifecycle-independent-review'
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
r=read(B/'report.json'); rows=read(B/'initial-frames.json')+read(B/'final-frames.json');s=r['renderer']['runtimeSkin']
p=np.asarray(s['positions']).reshape(-1,3);hom=np.column_stack([p,np.ones(len(p))]);idx=np.asarray(s['skinIndices']).reshape(-1,4);weights=np.asarray(s['skinWeights']).reshape(-1,4)
def mat(a):return np.asarray(a).reshape(4,4,order='F')
bind=mat(s['bindMatrix']); invs=[mat(m) for m in s['boneInverses']]
# Bone-group accumulation instead of the prior analyzer's four-slot einsum.
def world(row):
 out=np.zeros_like(hom)
 for b,inv in enumerate(invs):
  weight=np.where(idx==b,weights,0).sum(axis=1); pick=weight!=0
  out[pick]+=((mat(row['enemy']['bones'][b]['world'])@inv@bind@hom[pick].T).T)*weight[pick,None]
 return out
source=read(R/read(B/'pins-before.json')['preview']['source']); parts=[];off=0
for part in source['parts']:
 n=len(part['positions'])//3; parts.append((off,off+n,part['name']));off+=n
src=np.concatenate([np.asarray(x['positions']).reshape(-1,3) for x in source['parts']]); sourceMatch=src.shape==p.shape and np.max(np.abs(src-p))<1e-6
floor=r['renderer']['arena'][0]['y']+r['renderer']['arena'][0]['hy']; results=[]
for row in rows:
 v=world(row);bad=np.where(v[:,1]<floor-.001)[0];item={'epoch':row['epoch'],'frame':row['frame'],'alive':row['enemy']['alive'],'minGap':float(v[:,1].min()-floor),'below1mm':len(bad),'frozen':(row['enemy']['ragdoll']or{}).get('state')=='frozen'}
 results.append(item)
frozen=next(row for row in rows if (row['enemy']['ragdoll']or{}).get('state')=='frozen');v=world(frozen);bad=np.where(v[:,1]<floor-.001)[0]
offenders=[{'vertex':int(i),'part':next(n for lo,hi,n in parts if lo<=i<hi),'partVertex':int(i-next(lo for lo,hi,n in parts if lo<=i<hi)),'gap':float(v[i,1]-floor),'world':v[i,:3].tolist(),'bones':[(frozen['enemy']['bones'][int(j)]['name'],float(w))for j,w in zip(idx[i],weights[i])if w]}for i in bad]
pins=read(B/'pins-before.json');after=read(B/'pins-after.json');app=R/'tmp/puffer-closed-anatomy-rig1-app-attempt1';product=R/'tmp/puffer-closed-anatomy-rig1-product-attempt1';prod=read(R/'tmp/puffer-closed-anatomy-rig1-app-attempt1-audit/product-freeze-before.json')['files']
audit={'movieSha256':sha(pathlib.Path(r['video'])),'rawReportSha256':sha(B/'report.json'),'pinsBeforeAfterEqual':pins==after,'appExactCount':len(list(x for x in app.rglob('*')if x.is_file())),'app137HashesMatch':len(pins['app'])==137 and all(sha(app/k)==h for k,h in pins['app'].items()),'product50HashesMatch':len(prod)==50 and all(sha(product/k)==h for k,h in prod.items()),'runtimeVertices':len(p),'sourcePositionsMatch':bool(sourceMatch),'sourcePositionMaxError':float(np.max(np.abs(src-p))),'weightsMaxSumError':float(abs(weights.sum(axis=1)-1).max()),'floorY':floor,'rows':len(rows),'liveNormalClocks':all(x['clock']['captureFps']is None and x['clock']['scale']==1 and not x['clock']['paused'] for x in rows),'frameTimeEqualsClockElapsed':all(x['frameTime']==x['clock']['elapsed']for x in rows),'frozenFirstFrame':frozen['frame'],'frozenRagdoll':frozen['enemy']['ragdoll'],'offenders':offenders,'summary':{}}
for name,sel in [('living',[x for x in results if x['alive']]),('dead',[x for x in results if not x['alive']]),('frozen',[x for x in results if x['frozen']])]:audit['summary'][name]={'count':len(sel),'minGap':min(x['minGap']for x in sel),'penetratingRows':sum(x['below1mm']>0 for x in sel),'maxBelow1mm':max(x['below1mm']for x in sel)}
audit['offendingParts']=dict(collections.Counter(x['part']for x in offenders));audit['priorAnalysisMaxDifference']=max(abs(a['floorGap']-b['minGap'])for a,b in zip(read(B/'world-contact.json'),results))
(O/'independent-audit.json').write_text(json.dumps(audit,indent=2)+'\n');(O/'independent-contact-rows.json').write_text(json.dumps(results)+'\n');print(json.dumps({k:v for k,v in audit.items()if k!='offenders'},indent=2))
