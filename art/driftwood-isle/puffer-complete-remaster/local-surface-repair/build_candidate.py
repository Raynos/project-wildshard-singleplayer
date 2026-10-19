"""One boundary-fixed, topology-preserving local surface fairing candidate.
No remesh, face deletion, normal flip, global reshape, or attachment motion.
The source and all outputs are retained. A failed gate is not admission.
"""
import copy,hashlib,json
from pathlib import Path
from collections import defaultdict
import numpy as np
H=Path(__file__).resolve().parent;ROOT=H.parents[3]
SOURCE=H.parent/'closed-anatomy-study/closed-anatomy-native.json'
raw=SOURCE.read_bytes();assert hashlib.sha256(raw).hexdigest()=='98c4855852fc77ef385b0998e98dc5bdbabf40bb32b815f598c9a922525e5006', 'Selected source hash changed'
n=json.loads(raw)
neighborhoods=json.loads((ROOT/'docs/reviews/puffer-hull-crossing-diagnosis/neighborhoods.json').read_text())
t=np.array(n['parts'][0]['positions'][:9198]).reshape(-1,3,3)
lookup={};verts=[];faces=[]
for face in t:
 row=[]
 for p in face:
  k=tuple(p)
  if k not in lookup:lookup[k]=len(verts);verts.append(p)
  row.append(lookup[k])
 faces.append(row)
v=np.array(verts);f=np.array(faces);before=v.copy();records=[]
# Preserve explicit cheek/cavity-depth anchors; only fold/contact neighborhoods move.
anchors={'leftLowerFlank':[148,175,180,431], 'positiveXOrbitalMouth':[234,429,494], 'negativeXOrbitalMouth':[243,245,246,255,433,477]}
for label,patch in neighborhoods.items():
 if not isinstance(patch,dict) or 'faces' not in patch:continue
 interior=sorted({x['id'] for x in patch['interiorVertices']}-set(anchors[label]));idx={j:i for i,j in enumerate(interior)};adj=defaultdict(set)
 for face in f[patch['faces']]:
  for a,b in zip(face,np.roll(face,-1)):adj[a].add(b);adj[b].add(a)
 matrix=np.zeros((len(interior),len(interior)));rhs=np.zeros((len(interior),3))
 for j,i in idx.items():
  matrix[i,i]=len(adj[j])
  for k in adj[j]:
   if k in idx:matrix[i,idx[k]]-=1
   else:rhs[i]+=before[k]
 v[interior]=np.linalg.solve(matrix,rhs)
 records.append({'patch':label,'movedVertexIds':interior,'fixedMacroAnchors':anchors[label],'maxDisplacement':float(np.linalg.norm(v[interior]-before[interior],axis=1).max())})
n['parts'][0]['positions'][:9198]=v[f].reshape(-1).tolist()
n['status']='UNACCEPTED local surface repair study; validation governs admission'
p=H/'local-repair-native.json';p.write_text(json.dumps(n,separators=(',',':'),allow_nan=False)+'\n')
(H/'construction-receipt.json').write_text(json.dumps({'source':str(SOURCE.relative_to(ROOT)),'sourceSha256':hashlib.sha256(raw).hexdigest(),'candidateSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'method':'Uniform discrete harmonic interior solve inside three fixed-boundary disks, retaining listed macro and cavity anchors; topology and semantic face ownership unchanged.','patches':records,'runtimeAdmitted':False},indent=2)+'\n')
print(records)
