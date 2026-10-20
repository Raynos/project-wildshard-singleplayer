"""Independent current-camera projection; supersedes stale pre-render Blender matrix bounds."""
from pathlib import Path
import numpy as np
import json,sys,hashlib,math
p=Path(sys.argv[1]);s=json.loads((p/'native-source.json').read_text());pts=np.array([v for part in s['parts'] for v in part['positions']]).reshape((-1,3));pts=pts[:,[0,2,1]];pts[:,1]*=-1
rows=[]
for c in json.loads((p/'cameras.json').read_text()):
 eye=np.array(c['cameraBlender']);target=np.array(c['targetBlender']);forward=target-eye;forward/=np.linalg.norm(forward);right=np.cross(forward,np.array([0.,0.,1.]));right/=np.linalg.norm(right);up=np.cross(right,forward)
 roll=math.radians(c['cameraRollDegrees']);r=right*math.cos(roll)+up*math.sin(roll);u=-right*math.sin(roll)+up*math.cos(roll)
 horizontal=c['orthoScale']*c['resolution'][0]/c['resolution'][1];vertical=c['orthoScale'];delta=pts-target
 x=.5+delta@r/horizontal;y=.5+delta@u/vertical;bounds={'minX':float(x.min()),'maxX':float(x.max()),'minY':float(y.min()),'maxY':float(y.max())};assert 0<bounds['minX']<bounds['maxX']<1 and 0<bounds['minY']<bounds['maxY']<1,(c['name'],bounds)
 rows.append({'view':c['name'],'framingNDC':bounds,'allVerticesInside':True,'minimumMarginPixels':float(min(x.min()*600,(1-x.max())*600,y.min()*720,(1-y.max())*720))})
report={'method':'Independent orthographic projection using explicit camera eye/target, +Z Blender up, 90-degree top local-Z roll, 600x720 aspect, and all native vertices mapped (x,-z,y).','supersedes':'Raw cameras.json framingNDC was sampled before Blender depsgraph update and can use the previous camera transform. Those bounds are invalid evidence and retained only as raw history. Actual PNG renders use evaluated current camera. This independently computed report supplies framing evidence.','sourceSha256':hashlib.sha256((p/'native-source.json').read_bytes()).hexdigest(),'views':rows}
(p/'verified-framing.json').write_text(json.dumps(report,indent=2)+'\n');print([(r['view'],round(r['minimumMarginPixels'],2)) for r in rows])
