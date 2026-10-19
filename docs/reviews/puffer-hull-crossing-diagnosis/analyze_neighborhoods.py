"""Read-only source-contact and bounded patch-stencil analysis. No mesh is altered."""
import json
from pathlib import Path
from collections import Counter,defaultdict
import numpy as np
HOME=Path(__file__).resolve().parent;ROOT=HOME.parents[2]
r=json.loads((HOME/'diagnosis.json').read_text())
t=np.array(json.loads((ROOT/r['selected']['source']).read_text())['parts'][0]['positions'][:9198]).reshape(-1,3,3)
lookup={};verts=[];faces=[]
for face in t:
 ids=[]
 for p in face:
  key=tuple(p)
  if key not in lookup:lookup[key]=len(verts);verts.append(p)
  ids.append(lookup[key])
 faces.append(ids)
edgeuses=defaultdict(list)
for i,face in enumerate(faces):
 for a,b in zip(face,face[1:]+face[:1]):edgeuses[tuple(sorted((a,b)))].append(i)
adj=defaultdict(set)
for ids in edgeuses.values():
 for i in ids:adj[i].update(ids)
result={'note':'Candidate repair stencils only, not an implemented or validated correction; exact boundary vertex coordinates must stay fixed.'}
for label,seeds in [('leftLowerFlank',[726,776,781,847]),('positiveXOrbitalMouth',[813,866,870,875,876,877,878,879,897,994,996,998]),('negativeXOrbitalMouth',[814,817,820,884,886,898,935])]:
 keys={v for i in seeds for v in faces[i]};patch={i for i,f in enumerate(faces)if keys.intersection(f)}
 # Fill only enclosed complementary components, retaining the largest exterior.
 todo=set(range(len(t)))-patch;components=[]
 while todo:
  first=todo.pop();c={first};q=[first]
  while q:
   for j in adj[q.pop()]:
    if j in todo:todo.remove(j);c.add(j);q.append(j)
  components.append(c)
 added=set().union(*sorted(components,key=len)[:-1]);patch.update(added)
 edges=Counter(tuple(sorted((a,b)))for i in patch for a,b in zip(faces[i],faces[i][1:]+faces[i][:1]));boundary=[e for e,n in edges.items()if n==1];degrees=Counter(v for e in boundary for v in e);vs={v for i in patch for v in faces[i]};euler=len(vs)-len(edges)+len(patch)
 if set(degrees.values())!={2}:
  pinches={v for v,n in degrees.items()if n!=2}
  extra={i for i,f in enumerate(faces)if pinches.intersection(f)}-patch
  added.update(extra);patch.update(extra)
  edges=Counter(tuple(sorted((a,b)))for i in patch for a,b in zip(faces[i],faces[i][1:]+faces[i][:1]));boundary=[e for e,n in edges.items()if n==1];degrees=Counter(v for e in boundary for v in e);vs={v for i in patch for v in faces[i]};euler=len(vs)-len(edges)+len(patch)
 assert euler==1 and set(degrees.values())=={2}
 result[label]={'seedFaces':seeds,'faces':sorted(patch),'faceCount':len(patch),'filledHoleFaces':sorted(added),'Euler':euler,'boundaryEdges':boundary,'boundaryVertices':[{'id':i,'position':verts[i].tolist()}for i in sorted(degrees)],'interiorVertices':[{'id':i,'position':verts[i].tolist()}for i in sorted(vs-set(degrees))],'bounds':[t[sorted(patch)].min((0,1)).tolist(),t[sorted(patch)].max((0,1)).tolist()]}
fs={f['face']:f for f in r['affectedFaces']}
vs={j:np.array(p)for f in r['affectedFaces']for j,p in zip(f['weldedVertexIds'],f['v71Coordinates'])}
contacts=[]
for point,face in [(280,813),(173,776),(174,847),(286,814),(439,866),(463,998),(468,876)]:
 a=np.array(fs[face]['v71Coordinates']);uv=np.linalg.lstsq(np.stack([a[1]-a[0],a[2]-a[0]],axis=1),vs[point]-a[0],rcond=None)[0];b=np.array([1-uv.sum(),*uv])
 contacts.append({'vertex':point,'face':face,'v71Barycentric':b.tolist(),'v71PlaneResidual':float(np.linalg.norm(b@a-vs[point])),'strictInterior':bool(min(b)>0),'meaning':'geometric contact/near-contact without incidence; not a valid shared corner' if min(b)>0 else 'extension/near-collinear witness, not an interior contact'})
result['sourceContactWitnesses']=contacts
(HOME/'neighborhoods.json').write_text(json.dumps(result,indent=2)+'\n')
for k,v in result.items():
 if isinstance(v,dict):print(k,v['faceCount'],v['filledHoleFaces'],len(v['boundaryVertices']))
