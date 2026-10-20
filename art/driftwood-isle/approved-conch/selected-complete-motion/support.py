"""Conditional bind support audit, not a physics/contact sweep or a quality gate."""
import json
from pathlib import Path
import numpy as np
from scipy.spatial import ConvexHull
here=Path(__file__).resolve().parent
s=json.loads((here.parent/'selected-native-normals/native/conch-character-pass-native.json').read_text())
r=json.loads((here/'recipe.json').read_text()); groups=json.loads((here/'ownership.json').read_text())
parts={p['name']:p for p in s['parts']}; pivots={b['name']:np.array(b['pos']) for b in s['bones']}
rows=[]
for recipe,group in zip(r['parts'],groups,strict=True):
 owner=recipe['bone']; assert owner==group['owner']
 # Same float32 point conversion as prepareNumericRigidCorpse at actor scale one.
 points=np.array(recipe['points'],dtype=np.float32).astype(np.float64)
 hull=ConvexHull(points)
 visible=np.concatenate([np.array(parts[name]['positions'],dtype=np.float32).reshape(-1,3).astype(np.float64)-pivots[owner] for name in group['parts']])
 residual=float(np.max(visible@hull.equations[:,:3].T+hull.equations[:,3]))
 rows.append({'owner':owner,'corners':len(visible),'float32HullPoints':len(points),'maxOutsidePlaneMeters':max(0,residual)})
report={'scope':'Conditional planar enclosure only. All source corners retained. Convexity includes every triangle. Requires declared locked-relative transforms and unchanged weights. No contact/terrain/weapon/quality claim.', 'rows':rows,'totalCorners':sum(r['corners'] for r in rows),'maxOutsidePlaneMeters':max(r['maxOutsidePlaneMeters'] for r in rows)}
assert report['totalCorners']==6570
(here/'support.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
