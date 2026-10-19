"""Static topology, exact root/pivot, winding containment and floor checks. No motion claims."""
import json,collections
import numpy as np
from build_refined_fins import build,BASE,HERE
from build_fins import build as compact_base
previous,_=compact_base()
m,n=build();base=json.loads(BASE.read_text());body=np.array(base['parts'][0]['positions']).reshape(-1,3,3)
def winding(p):
 q=body-p;a,b,c=q[:,0],q[:,1],q[:,2];la=np.linalg.norm(a,axis=1);lb=np.linalg.norm(b,axis=1);lc=np.linalg.norm(c,axis=1)
 return float(np.sum(2*np.arctan2(np.einsum('ij,ij->i',a,np.cross(b,c)),la*lb*lc+np.einsum('ij,ij->i',a,b)*lc+np.einsum('ij,ij->i',b,c)*la+np.einsum('ij,ij->i',c,a)*lb))/(4*np.pi))
report={'status':'static checks only; animation and independent visual acceptance pending','bonesExact':n['bones']==base['bones'],'meshes':[]}
for mesh in m['meshes']:
 v=np.array(mesh['vertices']);f=np.array(mesh['triangles']);edges=collections.Counter();direction=collections.Counter()
 for face in f:
  for a,b in zip(face,np.roll(face,-1)):edges[tuple(sorted((int(a),int(b))))]+=1;direction[(int(a),int(b))]+=1
 areas=np.linalg.norm(np.cross(v[f[:,1]]-v[f[:,0]],v[f[:,2]]-v[f[:,0]]),axis=1)/2
 volume=np.einsum('ij,ij->i',v[f[:,0]],np.cross(v[f[:,1]],v[f[:,2]])).sum()/6
 root=v[mesh['rootVertexIndices']];ws=[winding(p)for p in root];ws.append(winding(root.mean(axis=0)))
 old=next(p for p in base['parts']if p['name']==mesh['name']);ov=np.array(old['positions']).reshape(-1,3)
 exact=all(any(np.array_equal(p,q)for q in v)for p in ov[ov[:,1]==ov[:,1].max()])
 checks={'finite':bool(np.isfinite(v).all()),'closedTwoFacesPerEdge':all(c==2 for c in edges.values()),'consistentOrientation':all(direction[(b,a)]==1 for a,b in direction),'positiveVolume':bool(volume>0),'nondegenerate':bool(areas.min()>1e-10),'exactRootCorners':exact,'rootAndMidpointsInsideV71':all(abs(abs(w)-1)<1e-4 for w in ws),'floorPreserved':bool(abs(v[:,1].min()-ov[:,1].min())<1e-8),'noBelowFloor':bool(v[:,1].min()>=0)}
 prior=next(x for x in previous['meshes'] if x['name']==mesh['name']);priorv=np.array(prior['vertices']);checks['compactReachAndSoleExact']=bool(np.array_equal(v.min(axis=0),priorv.min(axis=0)) and np.array_equal(v.max(axis=0),priorv.max(axis=0)))
 report['meshes'].append({'name':mesh['name'],'checks':checks,'vertices':len(v),'triangles':len(f),'volume':float(volume),'minArea':float(areas.min()),'rootWindingRange':[min(ws),max(ws)],'bounds':[v.min(axis=0).tolist(),v.max(axis=0).tolist()],'baselineBounds':[ov.min(axis=0).tolist(),ov.max(axis=0).tolist()]})
report['allPassed']=report['bonesExact'] and all(all(x['checks'].values())for x in report['meshes'])
(HERE/'refined-structural-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));assert report['allPassed']
