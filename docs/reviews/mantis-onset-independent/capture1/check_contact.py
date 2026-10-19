import json,hashlib
from pathlib import Path
import numpy as np
out=Path(__file__).parent
native=Path('art/driftwood-isle/lowpoly-mantis/runtime-admission/v7-rigid1/mantis-v7-native.json');n=json.loads(native.read_text());bs={b['name']:b for b in n['bones']}
trace=Path('tmp/mantis-onset-capture1/qa/render-trace.json');t=json.loads(trace.read_text());rows=[]
def mat(v):
 x,y,z,w=v[3:];m=np.eye(4);m[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]];m[:3,3]=v[:3];return m
for i,r in enumerate(t):
 posed={};world=np.array(r['world']).reshape(4,4).T
 for b in n['bones']:
  m=mat(r['bones'][b['name']]);posed[b['name']]=posed[b['parent']]@m if b['parent'] else m
 vals=[]
 for part in n['parts']:
  name=part['name'];v=np.array(part['positions']).reshape(-1,3)-bs[name]['pos'];v=np.column_stack((v,np.ones(len(v))));yy=(world@posed[name]@v.T)[1]-r['floor'];vals.append((float(yy.min()),name,int((yy<0).sum()),int((yy<-.005).sum())))
 low=min(vals);rows.append({'index':i,'frame':r['frame'],'phase':r['phase'],'alive':r['alive'],'stage':r['stage'],'deathT':r['deathT'],'gameTime':r['gameTime'],'minimum':low[0],'lowestPart':low[1],'belowVertices':sum(v[2] for v in vals),'below5mmVertices':sum(v[3] for v in vals),'rootY':r['world'][13]})
summary={'frames':len(rows),'minimum':min(r['minimum'] for r in rows),'livingMinimum':min(r['minimum'] for r in rows if r['alive']),'deadMinimum':min(r['minimum'] for r in rows if not r['alive']),'framesBelowFloor':sum(r['minimum']<0 for r in rows),'framesBelow5mm':sum(r['minimum']<-.005 for r in rows)}
rec={'method':'Independent NumPy hierarchy of captured local xyz quaternion xyzw, native absolute bind subtraction, full column-major mesh world; exact rigid part vertices relative to recorded floor. No collider or stance assertion.','nativeSha256':hashlib.sha256(native.read_bytes()).hexdigest(),'traceSha256':hashlib.sha256(trace.read_bytes()).hexdigest(),'summary':summary,'failures':[r for r in rows if r['minimum']<0],'frames':rows};(out/'world-contact-independent.json').write_text(json.dumps(rec,indent=2)+'\n');print(summary);print(rec['failures'])
