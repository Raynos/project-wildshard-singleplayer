"""Read-only independent geometry, contact, preservation and attachment checks.
Includes shared-vertex transverse intersections, coplanar overlap and nonincident
point/face and edge/edge contacts. No producer import or adjacency skip.
"""
import hashlib,json,sys
from pathlib import Path
from collections import defaultdict,Counter
import numpy as np
from intersections import audit,bary
H=Path(__file__).resolve().parent;ROOT=H.parents[3];ART=H.parents[1]
sys.path.insert(0,str(ART/'puffer-spike-study'))
from build_spikes import clearance
n=json.loads((H/'local-repair-native.json').read_text());base=json.loads((H.parent/'closed-anatomy-study/closed-anatomy-native.json').read_text())
hood=json.loads((ROOT/'docs/reviews/puffer-hull-crossing-diagnosis/neighborhoods.json').read_text())
allowed=set(i for p in hood.values()if isinstance(p,dict)and 'faces'in p for i in p['faces'])
t=np.array(n['parts'][0]['positions'][:9198]).reshape(-1,3,3);old=np.array(base['parts'][0]['positions'][:9198]).reshape(-1,3,3)
checks={};out={'checks':checks,'runtimeAdmitted':False,'tolerances':{'contactDistance':1e-9,'coplanarOverlapArea':1e-12}}
checks['883 outside faces exact']=bool(np.array_equal(t[[i for i in range(1022)if i not in allowed]],old[[i for i in range(1022)if i not in allowed]]))
checks['all non-hull components exact']=n['parts'][0]['positions'][9198:]==base['parts'][0]['positions'][9198:]and n['parts'][1:]==base['parts'][1:]
checks['all paint skin fur bones exact']=n['bones']==base['bones']and all(p[k]==q[k]for p,q in zip(n['parts'],base['parts'])for k in p if k!='positions')
checks['fixed boundaries exact']=all(any(np.array_equal(v,p)for v in t.reshape(-1,3))for h in hood.values()if isinstance(h,dict)and 'faces'in h for p in [x['position']for x in h['boundaryVertices']])
checks['all part counts and face counts exact']=len(n['parts'])==len(base['parts'])and all(len(p['positions'])==len(q['positions'])for p,q in zip(n['parts'],base['parts']))
def indexed(a):
 v,f=np.unique(a.reshape(-1,3),axis=0,return_inverse=True);return v,f.reshape(-1,3)
def topology(a):
 v,f=indexed(a);uses=defaultdict(list);neighbors=defaultdict(set);links=defaultdict(list)
 for i,face in enumerate(f):
  for x,y in zip(face,np.roll(face,-1)):uses[tuple(sorted((x,y)))].append((i,int(x),int(y)))
  for k,x in enumerate(face):links[int(x)].append(tuple(face[[ (k+1)%3,(k+2)%3]]))
 for us in uses.values():
  for fi,_,_ in us:neighbors[fi].update(x[0]for x in us)
 valid=all(len(us)==2 and us[0][1:]==us[1][1:][::-1]for us in uses.values());vertexmanifold=True
 for es in links.values():
  adj=defaultdict(set)
  for x,y in es:adj[x].add(y);adj[y].add(x)
  seen=set();q=[next(iter(adj))]
  while q:
   x=q.pop()
   if x not in seen:seen.add(x);q.extend(adj[x]-seen)
  vertexmanifold&=len(seen)==len(adj)and all(len(x)==2 for x in adj.values())
 todo=set(range(len(a)));groups=[];component_vertex_manifold=True
 while todo:
  c={todo.pop()};q=list(c)
  while q:
   for j in neighbors[q.pop()]:
    if j in todo:todo.remove(j);c.add(j);q.append(j)
  local_links=defaultdict(list)
  for face in f[sorted(c)]:
   for k,x in enumerate(face):local_links[int(x)].append(tuple(face[[(k+1)%3,(k+2)%3]]))
  for es in local_links.values():
   adj=defaultdict(set)
   for x,y in es:adj[x].add(y);adj[y].add(x)
   seen=set();q=[next(iter(adj))]
   while q:
    x=q.pop()
    if x not in seen:seen.add(x);q.extend(adj[x]-seen)
   component_vertex_manifold&=len(seen)==len(adj)and all(len(x)==2 for x in adj.values())
  ts=a[sorted(c)];groups.append({'faces':len(c),'volume':float(np.einsum('ij,ij->i',ts[:,0],np.cross(ts[:,1],ts[:,2])).sum()/6)})
 areas=np.linalg.norm(np.cross(a[:,1]-a[:,0],a[:,2]-a[:,0]),axis=1)/2
 return {'edgeManifoldOriented':valid,'vertexManifold':bool(component_vertex_manifold),'weldedUnionVertexManifold':bool(vertexmanifold),'minimumArea':float(areas.min()),'components':groups}
def cross2(a,b):return a[0]*b[1]-a[1]*b[0]
def coplanar_area(a,b,normal):
 drop=int(np.argmax(abs(normal)));aa=np.delete(a,drop,axis=1);bb=np.delete(b,drop,axis=1);poly=list(aa)
 sign=1 if cross2(bb[1]-bb[0],bb[2]-bb[0])>0 else -1
 for u,v in zip(bb,np.roll(bb,-1,axis=0)):
  result=[]
  if not poly:return 0.
  for p,q in zip(poly,poly[1:]+poly[:1]):
   dp=sign*cross2(v-u,p-u);dq=sign*cross2(v-u,q-u)
   if dp>=0:result.append(p)
   if (dp>=0)!=(dq>=0):result.append(p+(q-p)*dp/(dp-dq))
  poly=result
 return abs(sum(cross2(p,q)for p,q in zip(poly,poly[1:]+poly[:1])))/2 if poly else 0.
def contacts(a):
 v,f=indexed(a);norm=np.cross(a[:,1]-a[:,0],a[:,2]-a[:,0]);norm/=np.linalg.norm(norm,axis=1)[:,None]
 lo=a.min(1);hi=a.max(1);point_hits=[];overlap=[];edge_hits=[];eps=1e-9
 for i,p in enumerate(v):
  js=np.where(np.all(p>=lo-eps,axis=1)&np.all(p<=hi+eps,axis=1)&~np.any(f==i,axis=1))[0]
  for j in js:
   d=float((p-a[j,0])@norm[j])
   if abs(d)<eps:
    weights=bary(p,a[j])
    if min(weights)>=-1e-9:point_hits.append({'vertex':i,'face':int(j),'distance':abs(d),'barycentric':weights.tolist()})
 for i,tri in enumerate(a):
  js=np.where((np.arange(len(a))>i)&np.all(hi>=lo[i]-eps,axis=1)&np.all(lo<=hi[i]+eps,axis=1))[0]
  for j in js:
   if np.linalg.norm(np.cross(norm[i],norm[j]))<1e-8 and np.max(abs((a[j]-tri[0])@norm[i]))<eps:
    ar=coplanar_area(tri,a[j],norm[i])
    if ar>1e-12:overlap.append({'faces':[i,int(j)],'projectedArea':ar})
 edges=np.array(sorted({tuple(sorted((x,y)))for face in f for x,y in zip(face,np.roll(face,-1))}));e=v[edges];elo=e.min(1);ehi=e.max(1)
 for i,(p,q) in enumerate(e):
  js=np.where((np.arange(len(e))>i)&np.all(ehi>=elo[i]-eps,axis=1)&np.all(elo<=ehi[i]+eps,axis=1))[0]
  for j in js:
   if set(edges[i])&set(edges[j]):continue
   r,s=e[j];u=q-p;w=s-r;M=np.stack([u,-w],axis=1);pars=np.linalg.lstsq(M,r-p,rcond=None)[0]
   if np.linalg.matrix_rank(M)<2:continue # Collinear interior endpoints captured by vertex/face test.
   if min(pars)>1e-9 and max(pars)<1-1e-9:
    dist=float(np.linalg.norm(p+pars[0]*u-r-pars[1]*w))
    if dist<eps:edge_hits.append({'edges':[edges[i].tolist(),edges[j].tolist()],'distance':dist})
 return {'nonincidentVertexFace':point_hits,'coplanarAreaOverlap':overlap,'nonincidentEdgeEdge':edge_hits}
out['formats']={}
for fmt in ['native','float32']:
 a=t if fmt=='native'else t.astype('f4').astype(float);crossings=audit(a);cs=contacts(a);tops=[]
 for p in n['parts']:
  ts=np.array(p['positions']).reshape(-1,3,3)
  if fmt=='float32':ts=ts.astype('f4').astype(float)
  top=topology(ts);tops.append({'part':p['name'],**top})
 checks[fmt+' zero proper crossings']=len(crossings)==0
 checks[fmt+' zero nonincident contacts']=not any(cs.values())
 checks[fmt+' manifold winding positive volume']=all(x['edgeManifoldOriented']and x['vertexManifold']and x['minimumArea']>1e-12 and all(c['volume']>1e-12 for c in x['components'])for x in tops)
 out['formats'][fmt]={'properCrossings':crossings,'contacts':cs,'topology':tops};print(fmt,{k:len(v)for k,v in cs.items()},flush=True)
vol=lambda a:float(np.einsum('ij,ij->i',a[:,0],np.cross(a[:,1],a[:,2])).sum()/6)
# 4096 deterministic near-uniform support directions plus six exact axes.
i=np.arange(4096);y=1-2*(i+.5)/4096;r=np.sqrt(1-y*y);angle=i*np.pi*(3-np.sqrt(5));directions=np.concatenate([np.stack([r*np.cos(angle),y,r*np.sin(angle)],1),np.eye(3),-np.eye(3)])
oldv=old.reshape(-1,3);newv=t.reshape(-1,3);support_before=(oldv@directions.T).max(0);support_after=(newv@directions.T).max(0)
out['shape']={'hullVolumeBefore':vol(old),'hullVolumeAfter':vol(t),'volumeRelativeChange':vol(t)/vol(old)-1,'maximumSampledSupportDelta':float(abs(support_after-support_before).max()),'supportDirections':len(directions),'changedFaces':np.where(np.any(t!=old,axis=(1,2)))[0].tolist(),'maximumCornerMovement':float(np.linalg.norm(t-old,axis=2).max())}
checks['exact volume preserved']=vol(old)==vol(t);checks['sampled exterior support preserved']=bool(np.array_equal(support_before,support_after))
rootchecks=[]
spikes=json.loads((H.parent/'pass2/construction-receipt.json').read_text())['spikes']
for spike in spikes:
 v=np.array(spike['vertices']);r=v[spike['rootIndices']];samples=np.concatenate([r,(r[:,None,:]+r[None,:,:]).reshape(-1,3)/2,r.mean(0)[None,:]])
 before=clearance(samples,old);after=clearance(samples,t);rootchecks.append({'spike':spike['index'],'maximumBefore':max(before),'maximumAfter':max(after),'sampleCount':len(samples)})
for i in range(2,7):
 p=n['parts'][i];v=np.array(p['positions']).reshape(-1,3)
 if i==2:v=v[:132];r=np.unique(v[np.isclose(v[:,2],v[:,2].max(),atol=1e-8,rtol=0)],axis=0)
 else:r=np.unique(v[np.isclose(v[:,1],v[:,1].max(),atol=1e-8,rtol=0)],axis=0)
 samples=np.concatenate([r,(r[:,None,:]+r[None,:,:]).reshape(-1,3)/2,r.mean(0)[None,:]])
 rootchecks.append({'part':p['name'],'maximumBefore':max(clearance(samples,old)),'maximumAfter':max(clearance(samples,t)),'sampleCount':len(samples)})
norm=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);previous=np.cross(old[:,1]-old[:,0],old[:,2]-old[:,0]);dots=(norm*previous).sum(1)/np.linalg.norm(norm,axis=1)/np.linalg.norm(previous,axis=1)
out['correspondingNormalHemispheres']={'minimumDot':float(dots.min()),'reversedFaces':np.where(dots<0)[0].tolist(),'indicesOrNormalFlagsReversed':False}
checks['no corresponding normal hemisphere reversal']=bool(dots.min()>0)
out['rootSamples']=rootchecks;checks['all finite root samples interior']=all(x['maximumAfter']<0 for x in rootchecks)
out['limitations']=['Contact checks use documented finite tolerances, not exact arithmetic certification.','Finite root and support samples are not continuous attachment or full silhouette proofs.','No matched visual review, animation, render, runtime or aesthetic admission.']
out['allGatesPass']=all(checks.values());out['sourceSha256']=hashlib.sha256((H/'local-repair-native.json').read_bytes()).hexdigest()
(H/'validation.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'checks':checks,'shape':out['shape'],'roots':rootchecks},indent=2))
