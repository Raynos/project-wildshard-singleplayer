"""Finite proximal-cap containment on the actual new hull, no runtime claim."""
import json,sys
from pathlib import Path
import numpy as np
H=Path(__file__).resolve().parent;sys.path.insert(0,str(H.parents[1]/'puffer-spike-study'))
from build_spikes import clearance
p=json.loads((H/'pass3-native.json').read_text());count=json.loads((H/'construction-receipt.json').read_text())['hullTriangles'];hull=np.array(p['parts'][0]['positions'][:count*9]).reshape(-1,3,3);out=[]
for part in p['parts'][3:]:
 v=np.unique(np.array(part['positions']).reshape(-1,3),axis=0);root=v[np.isclose(v[:,1],v[:,1].max(),atol=1e-7)];samples=np.concatenate([root,(root[:,None,:]+root[None,:,:]).reshape(-1,3)/2,root.mean(0)[None,:]])
 ds=clearance(samples,hull);out.append({'name':part['name'],'rootSelection':'highest native Y station, original authored proximal cap','rootVertices':root.tolist(),'samples':len(samples),'maximumSignedDistance':max(ds),'allSampledInside':max(ds)<0})
(H/'fin-root-audit.json').write_text(json.dumps(out,indent=2)+'\n');assert all(x['allSampledInside'] for x in out)
