import collections,hashlib,json,struct
from pathlib import Path
root=Path.cwd();p=root/'art/driftwood-isle/approved-conch/complete-character-refinement';out=root/'docs/reviews/conch-complete-character-refinement-independent'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
receipts={}
for name in ['evidence.json','source-freeze.json']:
 d=json.loads((p/name).read_text());receipts[name]=[{'path':x['path'],'matches':(root/x['path']).exists() and sha(root/x['path'])==x['sha256'],'actualSha256':sha(root/x['path']) if (root/x['path']).exists() else None} for x in d['files']]
files=[p/'conch-character-refinement.glb',p/'capture-rebuilt.glb'];docs=[];buffers=[]
for f in files:
 b=f.read_bytes();n=struct.unpack_from('<I',b,12)[0];docs.append(json.loads(b[20:20+n]));buffers.append(b[28+n:])
g=docs[0]
def acc(i,data):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];fmt={5123:'H',5125:'I',5126:'f'}[a['componentType']];nc={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];step=v.get('byteStride',struct.calcsize(fmt)*nc);off=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from('<'+fmt*nc,data,off+j*step) for j in range(a['count'])]
def tris(a):return collections.Counter(min(t,t[1:]+t[:1],t[2:]+t[:2]) for t in [tuple(a[j:j+3]) for j in range(0,len(a),3)])
diffs=[]
for i,a in enumerate(g['accessors']):
 aa,bb=[acc(i,b) for b in buffers]
 if aa!=bb:diffs.append({'accessor':i,'indexOnly':a['type']=='SCALAR' and a['componentType'] in [5123,5125],'sameOrientedTriangles':tris(aa)==tris(bb)})
rows=[]
for m in g['meshes']:
 edges=collections.Counter();deg=0;count=0;points=set()
 for prim in m['primitives']:
  ps=acc(prim['attributes']['POSITION'],buffers[0]);ids=[x[0] for x in acc(prim['indices'],buffers[0])]
  for j in range(0,len(ids),3):
   pts=[tuple(round(x,6) for x in ps[k]) for k in ids[j:j+3]];points.update(pts);count+=1
   u=[pts[1][k]-pts[0][k] for k in range(3)];v=[pts[2][k]-pts[0][k] for k in range(3)];cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
   deg+=sum(x*x for x in cross)<1e-20
   for a,b in zip(pts,pts[1:]+pts[:1]):edges[tuple(sorted((a,b)))]+=1
 rows.append({'mesh':m['name'],'triangles':count,'weldedVertices':len(points),'boundaryEdges':sum(n==1 for n in edges.values()),'nonManifoldEdges':sum(n>2 for n in edges.values()),'degenerateTriangles':deg})
old=root/'art/driftwood-isle/approved-conch/complete-pass2'
a=(p/'build_conch_character_refinement.py').read_text();b=(old/'build_conch_complete_pass2.py').read_text()
na=(p/'render_conch_character_refinement_nine.py').read_text();nb=(old/'render_conch_complete_pass2_nine.py').read_text()
normal=lambda x:x.replace('COMPLETE CHARACTER REFINEMENT','COMPLETE PASS 2').replace('character_refinement','complete_pass2').replace('character-refinement','complete-pass2')
r={'receipts':receipts,'glbMetadataIdentical':docs[0]==docs[1],'glbAccessorDifferences':diffs,'topology':rows,'topologyMatchesStored':rows==json.loads((p/'topology.json').read_text())['meshes'],'meshCount':len(rows),'triangles':sum(x['triangles'] for x in rows),'skins':len(g.get('skins',[])),'animations':len(g.get('animations',[])),'heroCameraLightRenderBlockIdentical':a[a.index('if A.render:'):]==b[b.index('if A.render:'):],'nineRenderSourceIdenticalAfterVariantNames':normal(na)==nb,'nineCameraReceiptsIdentical':json.loads((p/'cameras-character-refinement.json').read_text())==json.loads((old/'cameras-complete-pass2.json').read_text()),'limits':'Read-only retained capture comparison, no fresh renders. Source parity plus camera receipts supports capture match; original concept is not matched-camera evidence. Per-mesh topology does not test intersections between anatomical parts or animation.'}
(out/'verification.json').write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps({k:v for k,v in r.items() if k not in ['receipts','topology']},indent=2));print('Receipt mismatches:',[(k,x['path']) for k,v in receipts.items() for x in v if not x['matches']])
