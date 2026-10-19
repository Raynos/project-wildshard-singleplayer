import json,numpy as np
from pathlib import Path
from scipy.spatial.transform import Rotation
p=Path('tmp/bellback-native-corpse-baseline2-run2/render-trace.json');trace=json.loads(p.read_text())
params=[[-.4,-.40,.10],[-.4,.40,.10],[.70,-1.30,.10],[.70,1.30,.10]]
for row in trace:
 if row['alive']:continue
 d=np.clip(row['deathT'],0,1);old=d*d*(3-2*d);d=np.clip(row['deathT']*3,0,1);fast=d*d*(3-2*d)
 for index,(rx,rz,dy) in enumerate(params):
  v=row['bones'][f'leg{index}'];angles=Rotation.from_quat(v[3:]).as_euler('XYZ');angles[0]+=fast*rx-old*(-.4 if index<2 else .4);angles[2]=fast*rz
  v[1]=v[1]*(1-fast)+(.2599999904632568+dy)*fast;v[3:]=Rotation.from_euler('XYZ',angles).as_quat().tolist()
Path('tmp/bellback-corpse-pose-study/simple-trace.json').write_text(json.dumps(trace))
