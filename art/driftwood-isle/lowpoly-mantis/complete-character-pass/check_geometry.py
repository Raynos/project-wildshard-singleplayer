"""Read-only exact-source export, facets, topology and intersection audit."""
from collections import Counter
import hashlib, importlib.util, json, math
from pathlib import Path
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
def module(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
g=module('normal_diagnostic',ROOT/'docs/reviews/mantis-curved-normal-diagnosis/diagnose.py')
x=module('intersection_diagnostic',HERE.parent/'cervical-frame-repair/check_geometry.py')
def audit(folder,suffix):
 src={p['name']:p for p in g.read(folder/('mantis-mesh-'+suffix+'.json'))['parts']}
 doc,buf=g.glb_read(folder/('mantis-study-'+suffix+'.glb'))
 rows=[];tris=[];deviations=[];opposed=[];min_cos=1;min_source_cos=1
 for node in doc['nodes']:
  if 'mesh' not in node:continue
  name=node['name'];p=src[name];points=list(map(g.game,p['vertices']));found=set();edges=Counter();volume=0;objtris=[]
  assert not any(k in node for k in ['matrix','rotation','scale','children','translation'])
  counts=Counter()
  for prim in doc['meshes'][node['mesh']]['primitives']:
   pos=g.accessor(doc,buf,prim['attributes']['POSITION']);normals=g.accessor(doc,buf,prim['attributes']['NORMAL']);idx=[v[0] for v in g.accessor(doc,buf,prim['indices'])]
   color=doc['materials'][prim['material']]['pbrMetallicRoughness']['baseColorFactor']
   for offset in range(0,len(idx),3):
    ids=idx[offset:offset+3];ps=[pos[i] for i in ids];source_ids=[points.index(q) for q in ps];found.update(source_ids)
    faces=[fi for fi,f in enumerate(p['faces']) if set(source_ids)<=set(f) and p['colors'][p['materialIndices'][fi]]==color]
    assert len(faces)==1,(name,faces);fi=faces[0];counts[fi]+=1
    area=g.norm(g.facet(ps))/2;assert area>1e-10
    fn=g.unit(g.facet(ps));pn=g.newell([points[i] for i in p['faces'][fi]])
    cos=[g.dot(fn,normals[i]) for i in ids];sourcecos=[g.dot(pn,g.unit(normals[i])) for i in ids]
    min_cos=min(min_cos,*cos);min_source_cos=min(min_source_cos,*sourcecos)
    if min(cos)<.999:deviations.append(dict(name=name,polygon=fi,minimumCosine=min(cos)))
    if min(cos)<-1e-7:opposed.append(dict(name=name,polygon=fi,minimumCosine=min(cos)))
    edges.update(zip(source_ids,source_ids[1:]+source_ids[:1]));volume+=g.dot(ps[0],g.cross(ps[1],ps[2]))/6
    objtris.append(dict(name=name,ids=source_ids,points=ps,area=area));tris.append(objtris[-1])
  assert found==set(range(len(points)))
  assert all(counts[i]==len(f)-2 for i,f in enumerate(p['faces']))
  assert all(v==1 and edges[(b,a)]==1 for (a,b),v in edges.items()),name
  assert volume>0,(name,volume)
  selfhits=[(i,j) for i,a in enumerate(objtris) for j,b in enumerate(objtris[:i]) if not set(a['ids'])&set(b['ids']) and x.intersects(a['points'],b['points'])]
  rows.append(dict(name=name,triangles=len(objtris),signedVolume=volume,minimumTriangleArea=min(t['area'] for t in objtris),nonAdjacentSelfIntersections=selfhits))
 neck=[t for t in tris if t['name']=='Rising prothorax curved cervical arch']
 hits=Counter(b['name'] for a in neck for b in tris if b['name']!=a['name'] and x.intersects(a['points'],b['points']))
 return dict(meshObjects=len(rows),triangles=len(tris),minimumNormalFacetCosine=min_cos,minimumStoredNormalSourcePolygonCosine=min_source_cos,facetDeviations=deviations,opposedTriangles=opposed,parts=rows,neckIncidentCrossObjectIntersections=dict(hits),boundaryEdges=0,nonmanifoldEdges=0,degenerateTriangles=0,exactPositionMaterialTriangleCorrespondence=True)
base=audit(HERE.parent/'complete-proportion-study','complete-proportion-study');candidate=audit(HERE,'complete-character-pass')
print('OPPOSED',candidate['opposedTriangles'],flush=True)
assert not candidate['opposedTriangles']
assert not next(p for p in candidate['parts'] if p['name'].startswith('Rising prothorax'))['nonAdjacentSelfIntersections']
assert candidate['minimumStoredNormalSourcePolygonCosine']>.9999
result=dict(status='PASS_STATIC_SOURCE_EXPORT',candidate=candidate,baseline=base,limitations='Static geometry only. Nonadjacent self intersections and neck-incident cross-object intersections are reported; layered-shell overlap is not contact/articulation approval. Shared-vertex pairs are excluded. No score, native admission or runtime changes.')
(HERE/'geometry-audit.json').write_text(json.dumps(result,indent=2)+'\n')
metrics=g.read(HERE/'metrics-complete-character-pass.json')
parts=g.read(HERE/'mantis-mesh-complete-character-pass.json')['parts']
(HERE/'pivots.json').write_text(json.dumps(dict(coordinateFrame='X right, -Y forward, Z up',staticPivots=metrics['pivots'],parts=[dict(name=p['name'],joint=p['joint'],pivot=metrics['pivots'][p['joint']]) for p in parts],limitations='20 static labels only, no native rig compatibility claimed. Derived neck/abdomen joints and tested 22-joint remapping remain separate.'),indent=2)+'\n')
print(json.dumps({k:v for k,v in candidate.items() if k not in ['parts','facetDeviations']},indent=2))
print('Self-intersection parts',[(p['name'],len(p['nonAdjacentSelfIntersections'])) for p in candidate['parts'] if p['nonAdjacentSelfIntersections']])
