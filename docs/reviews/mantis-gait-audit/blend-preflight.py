"""Full native geometry preflight of reach-study Euler blends. NOT a runtime clip."""
import json,math
from pathlib import Path
import numpy as np
out=Path(__file__).parent
n=json.loads(Path('art/driftwood-isle/lowpoly-mantis/runtime-admission/v7-rigid1/mantis-v7-native.json').read_text());reach=json.loads((out/'reach.json').read_text());bones={b['name']:b for b in n['bones']}
def rx(a):
 c,s=math.cos(a),math.sin(a);return np.array([[1,0,0],[0,c,-s],[0,s,c]])
def ry(a):
 c,s=math.cos(a),math.sin(a);return np.array([[c,0,s],[0,1,0],[-s,0,c]])
def rz(a):
 c,s=math.cos(a),math.sin(a);return np.array([[c,-s,0],[s,c,0],[0,0,1]])
samples={name:[s for s in reach['samples'] if s['foot']==name] for name in reach['results']};worst={'minimum':1e9};negative=0;poses=0
for i in range(128):
 for alpha in np.linspace(0,1,21):
  # Stop/resume speed-weighted blend. Both extrema of unchanged idle breath.
  for breath in [-.008,.008]:
   matrices={};bodyY=breath+.02*alpha*abs(math.sin(2*math.pi*(i/256)))
   for b in n['bones']:
    name=b['name'];local=np.eye(4);local[:3,3]=np.array(b['pos'])-(bones[b['parent']]['pos'] if b['parent'] else np.zeros(3))
    if name=='body':local[1,3]+=bodyY
    if name.startswith('leg'):
     knee=name if name.endswith('_knee') else name+'_knee';side=-1 if name.startswith('leg-') else 1;offset=0 if knee in ['leg-1_0_knee','leg1_1_knee'] else 64
     q=np.array(samples[knee][(i+offset)%128]['anglesHipXMirroredZKneeZHipY'])*alpha
     local[:3,:3]=rz(side*q[2]) if name.endswith('_knee') else rx(q[0])@ry(side*q[3])@rz(side*q[1])
    matrices[name]=(matrices[b['parent']]@local if b['parent'] else local)
   minimum=1e9;partname=None
   for p in n['parts']:
    v=np.array(p['positions']).reshape(-1,3);ix=np.array(p['skinIndices']).reshape(-1,4);ww=np.array(p['skinWeights']).reshape(-1,4);deformed=np.zeros_like(v)
    for j in np.unique(ix):
     b=n['bones'][int(j)];h=np.column_stack((v-np.array(b['pos']),np.ones(len(v))));deformed+=(matrices[b['name']]@h.T).T[:,:3]*(ww*(ix==j)).sum(1)[:,None]
    value=float(deformed[:,1].min())
    if value<minimum:minimum=value;partname=p['name']
   poses+=1
   if minimum<0:negative+=1
   if minimum<worst['minimum']:worst={'minimum':minimum,'phase':i/128,'blend':float(alpha),'breath':breath,'part':partname}
report={'poses':poses,'negativePoses':negative,'worst':worst,'scope':'All actual weighted vertices, native hierarchy, identity actor world, both idle-breath extrema; 128 phases x21 speed-to-zero blend weights. No actual terrain/root rotations, attack/death transitions, continuity or anatomical intersection acceptance. Unfitted reach samples remain nonperiodic.'}
(out/'blend-preflight.json').write_text(json.dumps(report,indent=2)+'\n');print(report)
