"""Whole carrier facet semantic paint: no cuts, exact geometry/area conservation.
Diagonal fields are quantized to authored carrier facets; that visible tradeoff
must be judged honestly. The failed fine-cut producer remains reproducible.
"""
import copy,json,sys,hashlib
from pathlib import Path
import numpy as np
from collections import Counter
from geometry_tools import component_ids,ordered_indexed
H=Path(__file__).resolve().parent;A=H.parents[1];sys.path.insert(0,str(A/'puffer-remaster-guided'))
from paint_semantic_face_diagonal_robust import COLORS,inside
n=json.loads((H/'prepaint-native.json').read_text());b=copy.deepcopy(n);p=n['parts'][0];t=np.array(p['positions']).reshape(-1,3,3);v,f=ordered_indexed(t);core=set(component_ids(f)[0]);own=json.loads((H/'surface-ownership.json').read_text())['carrierFaces'];rows=[];counts=Counter()
for fi,tri in enumerate(t):
 if fi not in core:continue
 src=own[fi]['sourceFace'];patch=own[fi]['patch'];x,y,z=tri.mean(0)
 if 1003<=src<1051 or 1094<=src<1142 or (patch and patch.startswith('orbital-back-wall')):region='socket'
 elif z>.10000000149011612:
  if inside(abs(x),y):region='ochre'
  elif y<.82-.20*abs(x)+.05*z and y<.73-.40*abs(x)+.35*z:region='ivory'
  elif z>.16+.45*abs(x)+.25*y and y<.96+.12*abs(x)-.02*z and y>.60:region='ochre'
  else:region='teal'
 else:region='teal'
 p['colorsLinear'][fi*9:(fi+1)*9]=list(COLORS[region])*3;counts[region]+=1;rows.append({'carrierFace':fi,'sourceFace':src,'patch':patch,'region':region})
head=n['parts'][1]
for fi in range(1005,1069):head['colorsLinear'][fi*9:(fi+1)*9]=list(COLORS['mouth'if 16<=fi-1005<32 else 'ivory'])*3
n['status']='UNACCEPTED complete guided carrier assembly; whole-facet semantic quantization; static only'
(H/'candidate-native.json').write_text(json.dumps(n,separators=(',',':'),allow_nan=False)+'\n')
(H/'paint-receipt.json').write_text(json.dumps({'method':'Whole-carrier-facet ownership by diagonal semantic field; no geometric cuts','tradeoff':'Semantic boundary is quantized to carrier facets rather than exact planar clipping; visible likeness not assumed','allPositionsExact':all(p['positions']==q['positions']for p,q in zip(n['parts'],b['parts'])),'perSourceTriangleAreaChange':0,'counts':dict(counts),'faceOwnership':rows,'bonesExact':n['bones']==b['bones'],'appendagesExact':n['parts'][2:]==b['parts'][2:]},separators=(',',':'))+'\n')
print(dict(counts))
