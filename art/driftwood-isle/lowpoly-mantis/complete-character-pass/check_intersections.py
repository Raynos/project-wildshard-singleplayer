"""Complete paired cross-object intersection report; not contact approval."""
from pathlib import Path
import importlib.util,json
from collections import Counter
H=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('x',H.parent/'cervical-frame-repair/check_geometry.py');x=importlib.util.module_from_spec(s);s.loader.exec_module(x)
result={}
for role,suffix in [('baseline','complete-proportion-study'),('candidate','complete-character-pass')]:
 folder=H.parent/suffix
 p={p['name']:p for p in json.loads((folder/('mantis-mesh-'+suffix+'.json')).read_text())['parts']}
 ts=x.triangles(folder/('mantis-study-'+suffix+'.glb'),p)
 for t in ts:t['lo']=[min(v[k] for v in t['points']) for k in range(3)];t['hi']=[max(v[k] for v in t['points']) for k in range(3)]
 ts.sort(key=lambda t:t['lo'][0]);active=[];hits=Counter();selfhits=Counter();tested=0
 for a in ts:
  active=[b for b in active if b['hi'][0]>=a['lo'][0]-1e-9]
  for b in active:
   if any(a['hi'][k]<b['lo'][k]-1e-9 or b['hi'][k]<a['lo'][k]-1e-9 for k in [1,2]):continue
   if a['name']==b['name'] and set(a['ids'])&set(b['ids']):continue
   tested+=1
   if x.intersects(a['points'],b['points']):
    if a['name']==b['name']:selfhits[a['name']]+=1
    else:hits[' | '.join(sorted([a['name'],b['name']]))]+=1
  active.append(a)
 result[role]=dict(broadPhasePairsTested=tested,nonAdjacentWithinPartIntersections=dict(selfhits),crossObjectTrianglePairIntersections=sum(hits.values()),crossObjectPairs=dict(sorted(hits.items())))
assert not result['candidate']['nonAdjacentWithinPartIntersections']
result['limitations']='Inclusive coplanar and noncoplanar triangle intersection. Shared-topology triangle pairs excluded within parts. Layered shell overlaps intentionally remain, not a penetration-depth, contact, pose, rig or animation acceptance.'
(H/'intersection-audit.json').write_text(json.dumps(result,indent=2)+'\n');print({r:{k:v for k,v in d.items() if k!='crossObjectPairs'} for r,d in result.items() if isinstance(d,dict)})
