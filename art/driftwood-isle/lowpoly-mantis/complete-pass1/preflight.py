"""Read-only structural audit of authored mesh JSON, metrics and exported GLB."""
import argparse,collections,hashlib,json,math,struct
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('folder');p.add_argument('--report',required=True);a=p.parse_args();folder=Path(a.folder)
meshpath=folder/'mantis-mesh-complete-pass1.json';metricpath=folder/'metrics-complete-pass1.json';glbpath=folder/'mantis-study-complete-pass1.glb'
model=json.loads(meshpath.read_text());metrics=json.loads(metricpath.read_text());raw=glbpath.read_bytes()
magic,version,size=struct.unpack_from('<III',raw);n,kind=struct.unpack_from('<II',raw,12);gltf=json.loads(raw[20:20+n]);fail=[];rows=[]
def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def dot(a,b):return sum(x*y for x,y in zip(a,b))
names=[part['name'] for part in model['parts']];gnames=[node.get('name') for node in gltf['nodes'] if 'mesh' in node]
for part in model['parts']:
 vertices=part['vertices'];edges=collections.Counter();volume=0;errors=[]
 if not all(math.isfinite(c) for v in vertices for c in v):errors.append('nonfinite vertices')
 if part['joint'] not in metrics['pivots']:errors.append('missing joint')
 if len(part['faces'])!=len(part['materialIndices']):errors.append('material length')
 for face,mi in zip(part['faces'],part['materialIndices']):
  if not 0<=mi<len(part['colors']):errors.append('material index')
  if len(face)<3 or any(not 0<=i<len(vertices) for i in face):errors.append('face index');continue
  for i,j in zip(face,face[1:]+face[:1]):edges[tuple(sorted((i,j)))]+=1
  for j in range(1,len(face)-1):volume+=dot(vertices[face[0]],cross(vertices[face[j]],vertices[face[j+1]]))/6
 if any(v!=2 for v in edges.values()):errors.append('not closed 2-manifold edges')
 if abs(volume)<1e-10:errors.append('zero signed volume')
 if volume<0:errors.append('inward volume')
 rows.append({'name':part['name'],'joint':part['joint'],'signedVolume':volume,'edges':len(edges),'errors':errors})
 if errors:fail.append(part['name']+': '+','.join(errors))
if sorted(names)!=sorted(gnames):fail.append('GLB mesh-node names differ')
if len(names)!=len(set(names)):fail.append('duplicate authored name')
if magic!=0x46546c67 or version!=2 or size!=len(raw):fail.append('invalid GLB header')
if any(metrics[k]!=0 for k in ['boundaryEdges','nonmanifoldEdges','degenerateFaces']):fail.append('builder structural failure')
if gltf.get('animations') or gltf.get('skins'):fail.append('unexpected animation or skin')
# Check actual GLB accessors rather than trusting the portable JSON alone.
bin_size,bin_type=struct.unpack_from('<II',raw,20+n);binary=raw[28+n:28+n+bin_size]
def accessor(index):
 ac=gltf['accessors'][index];bv=gltf['bufferViews'][ac['bufferView']];fmt={5123:'H',5125:'I',5126:'f'}[ac['componentType']];dim={'SCALAR':1,'VEC3':3,'VEC4':4}[ac['type']];step=bv.get('byteStride',struct.calcsize(fmt)*dim);offset=bv.get('byteOffset',0)+ac.get('byteOffset',0)
 return [struct.unpack_from('<'+fmt*dim,binary,offset+i*step) for i in range(ac['count'])]
glbtri=0;partmap={p['name']:p for p in model['parts']}
for node in gltf['nodes']:
 if 'mesh' not in node:continue
 expected={(round(v[0],5),round(v[2],5),round(-v[1],5)) for v in partmap[node['name']]['vertices']};actual=set()
 for prim in gltf['meshes'][node['mesh']]['primitives']:
  positions=accessor(prim['attributes']['POSITION']);normals=accessor(prim['attributes']['NORMAL']);indices=accessor(prim['indices']);glbtri+=len(indices)//3
  if not all(math.isfinite(c) for v in positions+normals for c in v):fail.append(node['name']+': nonfinite GLB values')
  if any(not 0<=v[0]<len(positions) for v in indices):fail.append(node['name']+': invalid GLB index')
  actual.update(tuple(round(c,5) for c in v) for v in positions)
 if actual!=expected:fail.append(node['name']+': GLB authored position mismatch')
if glbtri!=metrics['triangles']:fail.append('GLB triangle count mismatch')

report={'status':'PASS' if not fail else 'FAIL','failures':fail,'meshObjects':len(names),'joints':len(metrics['pivots']),'triangles':metrics['triangles'],'glbNodeMappingExact':sorted(names)==sorted(gnames),'finiteClosedMapped':not fail,'limits':'Intersections are not excluded. Static joint labels are not a rig or runtime admission. No likeness assessment.','parts':rows,'sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [meshpath,metricpath,glbpath]}}
Path(a.report).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['parts','sha256']},indent=2));raise SystemExit(bool(fail))
