"""Exact convex mesh support recipe, existing <=8-hull rigid corpse API.
Static limb descendants have no pose channels and belong to the body hull.
No padding, root translation, solver changes or runtime publication.
"""
import json
from pathlib import Path
import numpy as np
from scipy.spatial import ConvexHull
p=Path(__file__).resolve().parent/'v1';s=json.loads((p/'native-source.json').read_text());m=json.loads((p/'metadata.json').read_text());parts=[];audit=[]
for name in ['body','neck1','head','jaw','tail1','tail2','tail3']:
 selected=[x for x in s['parts'] if x['name']==name or name=='body' and x['name'].startswith(('FL_','FR_','BL_','BR_'))]
 points=np.unique(np.array([v for x in selected for v in x['positions']]).reshape((-1,3)),axis=0);hull=ConvexHull(points);support=points[hull.vertices];bind=np.array(next(b['pos'] for b in s['bones'] if b['name']==name));local=support-bind
 assert len(local)<=128,(name,len(local))
 parts.append({'bone':name,'points':local.tolist()});audit.append({'bone':name,'hullPoints':len(local),'sourceParts':[x['name'] for x in selected],'maximumOutsideDistance':float(np.max(points@hull.equations[:,:3].T+hull.equations[:,3]))})
assert sum(len(x['points']) for x in parts)<=512
m['bodies'][0]['dims']['rigidCorpse']={'parts':parts};(p/'metadata.json').write_text(json.dumps(m,indent=2)+'\n');(p/'corpse-hull-audit.json').write_text(json.dumps({'method':'Exact convex hull vertices, not bounding boxes or padded contacts. Body includes static planted limbs; all animated joints separate. Existing one rigid body; seven shape budget.','parts':audit,'runtimeAcceptance':False},indent=2)+'\n');print(audit)
