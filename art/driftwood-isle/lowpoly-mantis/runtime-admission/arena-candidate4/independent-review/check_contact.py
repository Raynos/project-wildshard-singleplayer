import numpy as np,json,hashlib
from pathlib import Path
out=Path(__file__).parent
native=Path('art/driftwood-isle/lowpoly-mantis/runtime-admission/v7-rigid1/mantis-v7-native.json');n=json.loads(native.read_text());bs={b['name']:b for b in n['bones']}
print(n['parts'][0].keys())
def mat(v):
 x,y,z,w=v[3:];m=np.eye(4);m[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]];m[:3,3]=v[:3];return m
for label,folder in [('combat','motion')]:
 p=Path('art/driftwood-isle/lowpoly-mantis/runtime-admission/arena-candidate4/evidence/observer-render-trace.json');t=json.loads(p.read_text());rows=[]
 for r in t:
  posed={};world=np.array(r['world']).reshape(4,4).T
  for b in n['bones']:
   m=mat(r['bones'][b['name']]);posed[b['name']]=posed[b['parent']]@m if b['parent'] else m
  vals=[]
  for part in n['parts']:
   name=part['name'];v=np.array(part['positions']).reshape(-1,3)-bs[name]['pos'];v=np.column_stack((v,np.ones(len(v))));yy=(world@posed[name]@v.T)[1]-900;vals.append((float(yy.min()),name,int((yy<-.005).sum()),int((abs(yy)<=.02).sum())))
  low=min(vals);rows.append({'frame':r['frame'],'alive':r['alive'],'minimum':low[0],'lowestPart':low[1],'belowVertices':sum(v[2] for v in vals),'rootY':r['world'][13],'nearVertices':sum(v[3] for v in vals)})
 summary={'frames':len(rows),'minimum':min(r['minimum'] for r in rows),'livingMinimum':min(r['minimum'] for r in rows if r['alive']),'deadMinimum':min([r['minimum'] for r in rows if not r['alive']],default=None),'framesBelow5mm':sum(r['minimum']<-.005 for r in rows)}
 rec={'method':'Independent NumPy hierarchy of captured local xyz quaternion xyzw, native absolute bind subtraction, full column-major mesh world; vertex height relative to Y900. No collider or stance assertion.','nativeSha256':hashlib.sha256(native.read_bytes()).hexdigest(),'traceSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'summary':summary,'frames':rows};json.dump(rec,open(out/f'{label}-world-crosscheck.json','w'),indent=2);print(label,summary)
