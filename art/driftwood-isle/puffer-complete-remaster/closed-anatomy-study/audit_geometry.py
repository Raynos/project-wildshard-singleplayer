"""Strict exact native and exported-f32 component topology and attachment audit."""
import hashlib,json,sys
from pathlib import Path
import numpy as np
H=Path(__file__).resolve().parent;ART=H.parents[1]
sys.path.insert(0,str(ART/'puffer-remaster-guided'))
from paint_semantic_face_diagonal_robust import components,triangles,topology,area
sys.path.insert(0,str(ART/'puffer-spike-study'))
from build_spikes import clearance
p=H/'closed-anatomy-native.json';n=json.loads(p.read_text());checks={};results={}
for fmt in ['native','float32']:
 results[fmt]=[]
 for part in n['parts']:
  part=dict(part)
  if fmt=='float32':part['positions']=np.array(part['positions'],dtype=np.float32).astype(float).tolist()
  ts=triangles(part);groups=[]
  for ci,c in enumerate(components(ts)):
   group={'triangles':len(c),'minTriangleArea':min(area(ts[i]) for i in c)}
   try:
    vol=topology([ts[i] for i in c]);group.update(closedOriented=True,signedVolume=vol)
    checks[f'{fmt} {part["name"]} component{ci} closed outward nonzero']=vol>1e-12
   except RuntimeError as e:
    group.update(closedOriented=False,error=str(e));checks[f'{fmt} {part["name"]} component{ci} closed outward nonzero']=False
   groups.append(group)
  results[fmt].append({'part':part['name'],'components':groups})
hull=np.array(n['parts'][0]['positions'][:9198]).reshape(-1,3,3)
rootchecks=[]
# Preserve original spike coordinates, test actual changed hull.
spikes=json.loads((H.parent/'pass2/construction-receipt.json').read_text())['spikes']
for spike in spikes:
 v=np.array(spike['vertices']);r=v[spike['rootIndices']];samples=np.concatenate([r,(r[:,None,:]+r[None,:,:]).reshape(-1,3)/2,r.mean(0)[None,:]])
 d=clearance(samples,hull);rootchecks.append({'spike':spike['index'],'maximumSampledSignedDistance':max(d)});checks[f'spike {spike["index"]} sampled root interior']=max(d)<0
for i in range(2,7):
 part=n['parts'][i];v=np.array(part['positions']).reshape(-1,3)
 if i==2:
  v=v[:132];r=np.unique(v[np.isclose(v[:,2],v[:,2].max(),atol=1e-8,rtol=0)],axis=0)
 else:r=np.unique(v[np.isclose(v[:,1],v[:,1].max(),atol=1e-8,rtol=0)],axis=0)
 samples=np.concatenate([r,(r[:,None,:]+r[None,:,:]).reshape(-1,3)/2,r.mean(0)[None,:]])
 d=clearance(samples,hull);rootchecks.append({'part':part['name'],'maximumSampledSignedDistance':max(d)});checks[part['name']+' sampled root interior']=max(d)<0
base=json.loads((H.parent/'pass2/pass2-native.json').read_text())
before=np.array(base['parts'][0]['positions'][:9198]).reshape(-1,3,3)
a=np.cross(hull[:,1]-hull[:,0],hull[:,2]-hull[:,0]);b=np.cross(before[:,1]-before[:,0],before[:,2]-before[:,0])
dots=(a*b).sum(1)/(np.linalg.norm(a,axis=1)*np.linalg.norm(b,axis=1))
checks['all 1022 hull triangles retain normal hemisphere']=bool(dots.min()>0)
r={'minimumCorrespondingNormalDot':float(dots.min()),'sourceSha256' :hashlib.sha256(p.read_bytes()).hexdigest(),'checks':checks,'passed':sum(checks.values()),'total':len(checks),'componentAudits':results,'rootSamples':rootchecks,'limitations':['Exact edge incidence, reverse orientation, nondegenerate faces and positive component volumes, not a self-intersection proof.','Finite root samples are not continuous overlap or animated attachment.'],'runtimeAdmission':False}
(H/'geometry-audit.json').write_text(json.dumps(r,indent=2)+'\n');print(r['passed'],r['total']);print([k for k,v in checks.items() if not v]);assert all(checks.values())
