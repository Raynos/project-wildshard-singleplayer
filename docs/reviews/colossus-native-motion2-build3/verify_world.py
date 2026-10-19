"""Independent NumPy world-skin oracle, without Three.js or pose reconstruction.
Consumes every captured local bone TRS and mesh-world matrix; all four weights.
"""
import hashlib,json,sys
from pathlib import Path
import numpy as np
native_path=Path('art/driftwood-isle/lowpoly-colossus/runtime-admission/v4-skin1/colossus-v4-native.json')
trace_path=Path(sys.argv[1]); output=Path(sys.argv[2])
native=json.loads(native_path.read_text()); trace=json.loads(trace_path.read_text())
assert hashlib.sha256(native_path.read_bytes()).hexdigest()=='32c4f9b55c5303e75877c8abae7765947a3814c39bb15d3c7a0046e61cb93641'
def trs(v):
 x,y,z,w=v[3:7]
 rotation=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
 [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
 [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
 result=np.eye(4);result[:3,:3]=rotation@np.diag(v[7:10]);result[:3,3]=v[:3];return result
parts=[];weighted=0;vertices=0
for part in native['parts']:
 p=np.asarray(part['positions']).reshape(-1,3);w=np.asarray(part['skinWeights']).reshape(-1,4);i=np.asarray(part['skinIndices']).reshape(-1,4)
 assert np.allclose(w.sum(axis=1),1,atol=1e-6);assert (w>=0).all()
 parts.append((part['name'],np.column_stack([p,np.ones(len(p))]),w,i));weighted+=int((np.count_nonzero(w,axis=1)>1).sum());vertices+=len(p)
assert (vertices,weighted)==(15600,4384)
rows=[]
for row in trace:
 world=np.asarray(row['world']).reshape(4,4,order='F');posed={};matrices=[]
 for bone in native['bones']:
  v=row['bones'][bone['name']];assert len(v)==10 and np.isfinite(v).all()
  local=trs(v);parent=bone['parent'];posed[bone['name']]=posed[parent]@local if parent is not None else local
  inv=np.eye(4);inv[:3,3]=-np.asarray(bone['pos']);matrices.append(world@posed[bone['name']]@inv)
 matrices=np.asarray(matrices);mins=[];below=0
 for name,p,w,i in parts:
  # The Y row of each influence matrix dotted with the original homogeneous vertex.
  heights=(np.einsum('vkc,vc->vk',matrices[i,1,:],p)*w).sum(axis=1)-900
  assert np.isfinite(heights).all();mins.append({'part':name,'min':float(heights.min())});below+=int((heights<-.005).sum())
 rows.append({'frame':row['frame'],'alive':row['alive'],'minimum':min(p['min'] for p in mins),'below':below,'parts':mins})
summary={'frames':len(rows),'livingMinimum':min(r['minimum'] for r in rows if r['alive']), 'deadMinimum':min(r['minimum'] for r in rows if not r['alive']),'framesBelow':sum(r['below']>0 for r in rows),'vertices':vertices,'multiweightVertices':weighted}
output.write_text(json.dumps({'method':'Independent NumPy quaternion TRS, full hierarchy, inverse bind and four-weight world sum; ground900. No Three.js dependency.','traceSha256':hashlib.sha256(trace_path.read_bytes()).hexdigest(),'summary':summary,'frames':rows},separators=(',',':'))+'\n')
print(json.dumps(summary))
