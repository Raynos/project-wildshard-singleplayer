"""One categorical skin redesign; stop at failed support, never tune hulls/weights.
Run at repository root. Source-only Python/Qhull audit; no runtime admission.
"""
import copy, hashlib, json, sys
from pathlib import Path
import numpy as np
from scipy.spatial import ConvexHull
sys.dont_write_bytecode=True
BASE=Path('art/driftwood-isle/puffer-complete-remaster/rigid-unit-candidate')
OUT=Path('docs/reviews/puffer-rigid-unit-candidate')
RAW=Path('tmp/puffer-rigid-unit-candidate-source')
SOURCE=Path('art/driftwood-isle/puffer-complete-remaster/closed-anatomy-rig1-study/closed-anatomy-rig1-native.json')
EXPECTED='38e0ad4de8a25827ace7a366e70c3c21a860ce9221de64f4b4afaf0c27ec2b61'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,d):p.write_text(json.dumps(d,indent=2,allow_nan=False)+'\n')
assert sha(SOURCE)==EXPECTED
source=json.loads(SOURCE.read_bytes());candidate=copy.deepcopy(source)
changes=[]; anchors=[]
for pi,part in enumerate(candidate['parts']):
 for vi in range(len(part['positions'])//3):
  lo=vi*4;ids=part['skinIndices'][lo:lo+4];weights=part['skinWeights'][lo:lo+4]
  if sum(w>0 for w in weights)>1:
   assert part['name'].startswith('Volumetric connected ')
   name=part['name'].removeprefix('Volumetric connected ')
   owner=next(i for i,b in enumerate(source['bones']) if b['name']==name)
   assert ids[:2]==[owner,1] and weights==[.8,.2,0.,0.]
   part['skinIndices'][lo:lo+4]=[owner,0,0,0];part['skinWeights'][lo:lo+4]=[1.,0.,0.,0.]
   changes.append({'part':pi,'vertex':vi,'owner':name})
  elif pi>=3 and ids[0]==1:
   anchors.append({'part':pi,'vertex':vi})
assert len(changes)==288 and len(anchors)==264
# All geometry/paint/metadata/binds preserved; only two skin arrays can differ.
protected=copy.deepcopy(candidate)
for p,s in zip(protected['parts'],source['parts']):
 p['skinIndices']=s['skinIndices'];p['skinWeights']=s['skinWeights']
assert protected==source
(BASE/'rigid-unit-native.json').write_text(json.dumps(candidate,separators=(',',':'),allow_nan=False)+'\n')
P=np.concatenate([np.asarray(p['positions']).reshape(-1,3) for p in candidate['parts']])
I=np.concatenate([np.asarray(p['skinIndices']).reshape(-1,4) for p in candidate['parts']])
W=np.concatenate([np.asarray(p['skinWeights']).reshape(-1,4) for p in candidate['parts']])
assert np.all(W==np.array([1,0,0,0]))
owner=I[:,0];T=P.reshape(-1,3,3);O=owner.reshape(-1,3)
ranges=[];off=0
for p in candidate['parts']:
 n=len(p['positions'])//3;ranges.append((off,off+n,p['name']));off+=n

def origin(i):
 for lo,hi,name in ranges:
  if lo<=i<hi:return {'sourceVertex':int(i),'part':name,'partVertex':int(i-lo)}
 raise ValueError(i)

# Check every exact welded duplicate within each source part (never proximity weld).
weld_conflicts=[];duplicate_groups=0
for lo,hi,name in ranges:
 groups={}
 for i in range(lo,hi):groups.setdefault(tuple(P[i]),[]).append(i)
 for point,ids in groups.items():
  if len(ids)>1:duplicate_groups+=1
  if len(set(owner[ids]))!=1:weld_conflicts.append({'part':name,'point':point,'vertices':ids})
assert not weld_conflicts
global_groups={}
for i,point in enumerate(P):global_groups.setdefault(tuple(point),[]).append(i)
oldowners=np.concatenate([np.asarray(p['skinIndices']).reshape(-1,4)[:,0] for p in source['parts']])
global_conflicts=[]
for point,ids in global_groups.items():
 if len(set(owner[ids]))>1:
  assert np.array_equal(owner[ids],oldowners[ids])
  global_conflicts.append({'point':list(point),'owners':[candidate['bones'][j]['name'] for j in sorted(set(owner[ids]))],'vertices':[origin(i) for i in ids],'inheritedExactly':True})
assert len(global_conflicts)==3
# Source stores no normals. Flat diagnostic rest normals derive from unchanged triangles.
cross=np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]);areas=np.linalg.norm(cross,axis=1)*.5
assert np.all(areas>1e-15)

hulls={};recipe={'parts':[]};provenance=[]
for j in np.unique(owner):
 ids=np.flatnonzero(owner==j);points,first=np.unique(P[ids],axis=0,return_index=True);h=ConvexHull(points);hulls[int(j)]=h
 extremes=ids[first[h.vertices]];bone=candidate['bones'][j]
 recipe['parts'].append({'bone':bone['name'],'points':(points[h.vertices]-bone['pos']).tolist()})
 provenance.append({'bone':bone['name'],'memberVertices':len(ids),'uniqueMemberPositions':len(points),'extremeCount':len(h.vertices),'volumeM3':float(h.volume),'extremeSources':[origin(i) for i in extremes]})
write(BASE/'failed-support-recipe.json',recipe)
E=[h.equations for h in hulls.values()]
res=np.stack([(P@e[:,:3].T+e[:,3]).max(axis=1) for e in E],axis=1)
assert float(res.min(axis=1).max())<1e-9
centers=T.mean(axis=1)
centerres=np.stack([(centers@e[:,:3].T+e[:,3]).max(axis=1) for e in E],axis=1)
centerbad=np.flatnonzero(centerres.min(axis=1)>1e-9)

# Subtract every convex hull from every ambiguous triangle. Each retained polygon
# is outside the union; splitting uses actual halfspaces without adding support.
def clip(poly,eq,inside):
 result=[]
 if len(poly)<3:return result
 for a,b in zip(poly,poly[1:]+poly[:1]):
  da=float(a@eq[:3]+eq[3]);db=float(b@eq[:3]+eq[3]);ina=da<=0 if inside else da>=0;inb=db<=0 if inside else db>=0
  if ina:result.append(a)
  if ina!=inb:result.append(a+(b-a)*(da/(da-db)))
 return result

def area(poly):
 if len(poly)<3:return 0.
 return float(sum(np.linalg.norm(np.cross(poly[k]-poly[0],poly[k+1]-poly[0]))*.5 for k in range(1,len(poly)-1)))

def subtract(poly,eqs):
 outside=[];remaining=poly
 for eq in eqs:
  if len(remaining)<3:break
  values=np.asarray(remaining)@eq[:3]+eq[3]
  if values.max()<=1e-12:continue
  if values.min()>=-1e-12:return outside+[remaining]
  out=clip(remaining,eq,False)
  if area(out)>1e-15:outside.append(out)
  remaining=clip(remaining,eq,True)
 return outside

covered=0;failures=[];ambiguous=0
for k,tri in enumerate(T):
 if any((tri@e[:,:3].T+e[:,3]).max()<1e-9 for e in E):covered+=1;continue
 ambiguous+=1;remaining=list(map(lambda x:[*x], [tri]))
 for e in E:
  remaining=[q for poly in remaining for q in subtract(poly,e)]
  if not remaining:break
 uncovered=sum(area(poly) for poly in remaining)
 certificates=[]
 for poly in remaining:
  witness=np.mean(poly,axis=0)
  violations=[float((witness@e[:,:3].T+e[:,3]).max()) for e in E]
  if min(violations)>1e-9:certificates.append({'point':witness.tolist(),'perHullMaxHalfspaceViolationM':dict(zip([candidate['bones'][j]['name'] for j in hulls],violations))})
 if certificates:
  failures.append({'sourceTriangle':k,'corners':[origin(i) for i in range(3*k,3*k+3)],'owners':[candidate['bones'][j]['name'] for j in O[k]],'triangleAreaM2':float(areas[k]),'uncoveredAreaM2':uncovered,'certificates':certificates})
 else:covered+=1
print('triangle scan',len(T),covered,len(failures),flush=True)
# Concavity/bridging diagnostics: exact point-to-source-triangle distance at all
# hull face centroids, not a claim of exact filled volume.
def surface_distance(points):
 a,b,c=T[:,0],T[:,1],T[:,2];ab=b-a;ac=c-a;nn=np.cross(ab,ac);n2=(nn*nn).sum(1)
 d00=(ab*ab).sum(1);d01=(ab*ac).sum(1);d11=(ac*ac).sum(1);den=d00*d11-d01*d01
 answer=[]
 for point in points:
  ap=point-a;plane=(ap*nn).sum(1);projected=ap-nn*(plane/n2)[:,None];d20=(projected*ab).sum(1);d21=(projected*ac).sum(1)
  u=(d11*d20-d01*d21)/den;v=(d00*d21-d01*d20)/den
  distance=np.where((u>=0)&(v>=0)&(u+v<=1),plane*plane/n2,np.inf)
  for x,y in [(a,b),(b,c),(c,a)]:
   edge=y-x;t=np.clip(((point-x)*edge).sum(1)/(edge*edge).sum(1),0,1);d=point-x-t[:,None]*edge;distance=np.minimum(distance,(d*d).sum(1))
  answer.append(float(np.sqrt(distance.min())))
 return answer
for row,h in zip(provenance,hulls.values()):
 centersh=h.points[h.simplices].mean(1);dist=surface_distance(centersh);idx=int(np.argmax(dist));row['maxFacetCentroidToActualSurfaceM']=dist[idx];row['bridgeDiagnosticCentroid']=centersh[idx].tolist()
worst=int(np.argmax(centerres.min(axis=1)))
report={'status':'FAIL at exact unchanged bind pose: complete source surface is not contained in pure-owner hull union',
 'candidateIdentity':'puffer-rigid-unit-categorical-distal-band-v1-unaccepted','source':str(SOURCE),'sourceSha256':sha(SOURCE),'candidateSha256':sha(BASE/'rigid-unit-native.json'),
 'assignment':'Keep every pure-weight row exactly; each formerly mixed semantic fin-band coordinate belongs wholly to its named distal fin. No numerical threshold or coefficient search.',
 'changedRows':len(changes),'preservedPureBellyRootCapRows':len(anchors),'allNonSkinDataExact':True,'weldedDuplicateGroups':duplicate_groups,'weldedDuplicateConflicts':weld_conflicts,'globalCoincidentCrossPartOwnerGroups':global_conflicts,
 'vertices':len(P),'triangles':len(T),'bones':len(candidate['bones']),'hulls':provenance,'totalExtremePoints':sum(len(h.vertices) for h in hulls.values()),
 'budgetPass':len(hulls)<=8 and all(len(h.vertices)<=128 for h in hulls.values()) and sum(len(h.vertices) for h in hulls.values())<=512,
 'maxVertexUnionHalfspaceResidualM':float(res.min(axis=1).max()),'crossBoneTriangles':int(np.sum((O!=O[:,:1]).any(1))),
 'trianglesProvedContainedAtBind':covered,'trianglesWithOutsideCertificatesAtBind':len(failures),'ambiguousTrianglesClipped':ambiguous,
 'outsideTriangleCentroids':len(centerbad),'worstCentroid':{'sourceTriangle':worst,'corners':[origin(i) for i in range(worst*3,worst*3+3)],'point':centers[worst].tolist(),'perHullMaxHalfspaceViolationM':dict(zip([candidate['bones'][j]['name'] for j in hulls],centerres[worst].tolist()))},
 'uncoveredTriangleAreaM2':sum(f['uncoveredAreaM2'] for f in failures),'failures':failures,
 'sourceNormals':'No source normal attribute. Unchanged ordered triangle positions preserve diagnostically computed flat rest normals; codec consumer check is separate.',
 'attachment':'264 existing pure-belly root-cap records remain exactly anchored for any belly transform. Within each part, exact duplicated vertices have identical owner. Three inherited cross-part belly/head coincident groups require identical relative transforms to remain coincident. Cross-owner band triangles remain deformable; rigid vertex ownership does not make whole fin geometry rigid.',
 'animationAuthored':False,'nativeTestAllowed':False,'notes':['Source double precision only; separating halfspace values are not Euclidean distances or floor penetration.','Polygon clipping tolerance1e-12m and witness outside tolerance1e-9m; uncovered area is numerical, positive witnesses certify failure.','Support recipe is failed and unadmitted. No extra hull, enlargement, padding or reassignments attempted.','No all-state skin-normal correctness, dynamic attachment envelope or rendered visual quality claim.','Strict geometry prerequisite failed before authored alternate clips, numeric continuity or physical tests. Living inflation removal remains an unimplemented real visual tradeoff.']}
write(OUT/'geometry-audit.json',report);write(RAW/'assignment-records.json',{'changes':changes,'anchors':anchors})
print(json.dumps({k:report[k] for k in ['status','changedRows','preservedPureBellyRootCapRows','totalExtremePoints','budgetPass','crossBoneTriangles','trianglesProvedContainedAtBind','trianglesWithOutsideCertificatesAtBind','outsideTriangleCentroids','uncoveredTriangleAreaM2','worstCentroid']},indent=2))
