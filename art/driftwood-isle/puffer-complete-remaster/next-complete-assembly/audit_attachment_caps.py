"""Complete finite-predicate cap containment using all-pair geometry evidence.
Distinguish a continuous triangulated-cap check from finite root sampling.
"""
import json,sys,struct,hashlib
from pathlib import Path
import numpy as np
from geometry_tools import *
H=Path(__file__).resolve().parent;A=H.parents[1];sys.path.insert(0,str(A/'puffer-spike-study'));from build_spikes import clearance
n=json.loads((H/'candidate-native.json').read_text());audit_data=json.loads((H/'geometry-audit.json').read_text());out={'formats':{},'method':'Every cap vertex strictly interior and no triangle/hull proper crossing, coplanar area, nonincident vertex-face or edge-edge contact across the complete cap; uses stored full-pair finite-tolerance predicates.'}
for fmt in ['prepaint','exportedFloat32']:
 parts=[np.array(p['positions']).reshape(-1,3,3)for p in n['parts']]
 if fmt=='exportedFloat32':parts=[p.astype('f4').astype(float)for p in parts]
 all_t=np.concatenate(parts);uv,ff=indexed(all_t);bv,bf=ordered_indexed(parts[0]);hullids=component_ids(bf)[0];hull=parts[0][hullids];hullset=set(hullids);hullcoords=set(map(tuple,hull.reshape(-1,3)));hulledges={tuple(sorted((tuple(a),tuple(b))))for tr in hull for a,b in zip(tr,np.roll(tr,-1,axis=0))}
 evidence=audit_data['formats'][fmt];crossings=evidence['withinComponentCrossings']+evidence['separateComponentCrossings'];cs={k:evidence['withinComponentContacts'][k]+evidence['separateComponentContacts'][k]for k in evidence['withinComponentContacts']};offsets=np.cumsum([0]+[len(p)for p in parts]);rows=[]
 for pi in range(2,7):
  t=parts[pi];axis=2 if pi==2 else 1;level=t[:,:,axis].max();local=[i for i,tr in enumerate(t)if all(tr[:,axis]==level)];caps=[i+int(offsets[pi])for i in local];capset=set(caps);captri=all_t[caps];root=np.unique(captri.reshape(-1,3),axis=0);rootcoords=set(map(tuple,root));samples=np.concatenate([root,root.mean(0)[None,:],(root[:,None,:]+root[None,:,:]).reshape(-1,3)/2]);dist=clearance(samples,hull)
  hits=[r for r in crossings if(r['faces'][0]in hullset and r['faces'][1]in capset)or(r['faces'][1]in hullset and r['faces'][0]in capset)];contacts_found=[];capedges={tuple(sorted((tuple(a),tuple(b))))for tr in captri for a,b in zip(tr,np.roll(tr,-1,axis=0))}
  for r in cs['nonincidentVertexFace']:
   coord=tuple(uv[r['vertex']]);face=r['face']
   if(coord in rootcoords and face in hullset)or(coord in hullcoords and face in capset):contacts_found.append(r)
  for r in cs['coplanarAreaOverlap']:
   a,b=r['faces']
   if(a in hullset and b in capset)or(b in hullset and a in capset):contacts_found.append(r)
  for r in cs['nonincidentEdgeEdge']:
   a,b=[tuple(sorted(map(tuple,uv[e])))for e in r['edges']]
   if(a in capedges and b in hulledges)or(a in hulledges and b in capedges):contacts_found.append(r)
  rows.append({'part':n['parts'][pi]['name'],'axis':axis,'rootPlane':float(level),'capTriangleIds':local,'capVertices':root.tolist(),'sampleCount':len(samples),'maximumSignedDistance':max(dist),'properCrossings':hits,'contacts':contacts_found,'continuousCapContainedUnderFinitePredicates':max(dist)<0 and not hits and not contacts_found})
 out['formats'][fmt]=rows
out['allCapsContained']=all(r['continuousCapContainedUnderFinitePredicates']for rows in out['formats'].values()for r in rows);out['limitations']=['Exact arithmetic not established; fixed tolerances inherited from full geometry audit.','This proves only the listed attachment cap, not every animation sweep or the complete overlap volume.'];out['nativeSha256']=hashlib.sha256((H/'candidate-native.json').read_bytes()).hexdigest();(H/'attachment-cap-audit.json').write_text(json.dumps(out,separators=(',',':'))+'\n');print(out['allCapsContained']);print([(fmt,[(r['part'],r['maximumSignedDistance'],len(r['properCrossings']),len(r['contacts']))for r in rows])for fmt,rows in out['formats'].items()])
