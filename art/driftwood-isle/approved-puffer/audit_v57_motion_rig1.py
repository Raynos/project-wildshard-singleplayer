"""Lightweight actual-export validation; run from repository root after rig1 build."""
import hashlib,itertools,json,math
from pathlib import Path
import numpy as np
base=Path('tmp/puffer-v57-motion-rig1')
data=json.loads((base/'puffer-native-v57-motion-rig1.json').read_text())
reference=json.loads(Path('tmp/puffer-lowpoly-v57-from-v9/puffer-native-v57.json').read_text())
assert data['bones']==reference['bones']
bones={b['name']:np.array(b['pos']) for b in data['bones']};names=[b['name'] for b in data['bones']]
records=[]
for part,prior in zip(data['parts'],reference['parts']):
 for key in ('name','positions','colorsLinear','furLen'):assert part[key]==prior[key],key
 ids=np.array(part['skinIndices']).reshape(-1,4);weights=np.array(part['skinWeights']).reshape(-1,4)
 assert np.isfinite(weights).all() and weights.min()>=0 and abs(weights.sum(axis=1)-1).max()<1e-7
 if not part['name'].startswith('Volumetric connected '):continue
 name=part['name'].split()[-1];v=np.array(part['positions']).reshape(-1,3);pivot=bones[name]
 belly_weight=np.where(ids==names.index('belly'),weights,0).sum(axis=1)
 root=v[:,1]>(.475 if name.startswith('fin') else .487)
 assert np.all(belly_weight[root]==1)
 t=v.reshape(-1,3,3);normal=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);area=np.linalg.norm(normal,axis=1)
 assert area.min()>1e-10
 worst_area=1.;worst_cos=1.;min_y=1e9;cap_error=0.;samples=0
 for shift,pitch,yaw,swell in itertools.product(np.linspace(-.06,.06,7),(0,-.09,-.18),(-.11,0,.11),(1,1.05,1.1)):
  cx,sx=math.cos(pitch),math.sin(pitch);cy,sy=math.cos(yaw),math.sin(yaw)
  R=np.array([[1,0,0],[0,cx,-sx],[0,sx,cx]])@np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]])
  distal=(v-pivot)@R.T+pivot+[0,0,shift];body=(v-bones['belly'])*swell+bones['belly']
  w=body*belly_weight[:,None]+distal*(1-belly_weight[:,None]);cap_error=max(cap_error,float(np.linalg.norm(w[root]-body[root],axis=1).max()))
  tri=w.reshape(-1,3,3);n=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);a=np.linalg.norm(n,axis=1)
  worst_area=min(worst_area,float((a/area).min()));worst_cos=min(worst_cos,float(((n*normal).sum(axis=1)/(a*area)).min()));min_y=min(min_y,float(w[:,1].min()));samples+=1
 print(name,worst_area,worst_cos,cap_error,min_y)
 assert worst_area>1e-6 and worst_cos>0 and cap_error<1e-9
 records.append({'bone':name,'samples':samples,'minimumTriangleAreaRatio':worst_area,'conservativeHalfAreaWarning':worst_area<.5,'minimumNormalCosine':worst_cos,'minimumLocalY':min_y,'maximumRootToBellyError':cap_error,'weightPairs':sorted(set(map(tuple,weights.tolist())))})
receipt={'status':'rig-only prototype; numerical deformation envelope, not planted-foot or visual acceptance','nativeSha256':hashlib.sha256((base/'puffer-native-v57-motion-rig1.json').read_bytes()).hexdigest(),'exactRestBuffersAndBones':True,'normalizedWeights':True,'translationRangeZ':[-.06,.06],'pitchRangeX':[-.18,0],'yawRangeY':[-.11,.11],'bellyScales':[1,1.05,1.1],'fins':records}
(base/'motion-rig1-weight-audit.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt,indent=2))
