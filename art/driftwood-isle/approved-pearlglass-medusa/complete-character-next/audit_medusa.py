"""Finite/triangle/skin/codec and GLB audit; no visual or runtime acceptance."""
import json,math,struct,zlib,hashlib,sys
from pathlib import Path
p=Path(sys.argv[1]);d=json.loads((p/'native-source.json').read_text());m=json.loads((p/'metadata.json').read_text());raw=zlib.decompress((p/'payload.bin').read_bytes());checks={};degenerate=0;blend=0;bounds=[[math.inf]*3,[-math.inf]*3];maxskin=0
for part,row in zip(d['parts'],m['bodies'][0]['hard'],strict=True):
 count=len(part['positions'])//3
 for i in range(count):
  pos=part['positions'][i*3:i*3+3];weights=part['skinWeights'][i*4:i*4+4];indices=part['skinIndices'][i*4:i*4+4];assert abs(sum(weights)-1)<1e-6;assert all(0<=j<len(d['bones']) for j in indices)
  if sum(w>0 for w in weights)>1:blend+=1
  maxskin=max(maxskin,sum(w>0 for w in weights))
  for j,x in enumerate(pos):assert math.isfinite(x);bounds[0][j]=min(bounds[0][j],x);bounds[1][j]=max(bounds[1][j],x)
 for i in range(0,count,3):
  a,b,c=[part['positions'][j*3:j*3+3] for j in (i,i+1,i+2)];u=[b[j]-a[j] for j in range(3)];v=[c[j]-a[j] for j in range(3)];cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
  if sum(x*x for x in cross)<1e-16:degenerate+=1
 for offset,key,kind in zip(row['offsets'],['positions','colorsLinear','skinIndices','skinWeights','furLen','normals'],['f','f','H','f','f','f'],strict=True):
  expected=struct.pack('<'+kind*len(part[key]),*part[key]);assert raw[offset:offset+len(expected)]==expected
assert degenerate==0
components=json.loads((p/'construction.json').read_text())['components'];offsets={x['name']:0 for x in d['parts']};partmap={x['name']:x for x in d['parts']};topology=[]
for component in components:
 name=component['part'];ar=partmap[name]['positions'];start=offsets[name];end=start+component['triangles']*9;offsets[name]=end;edges={};directed={};volume=0
 for i in range(start,end,9):
  tri=[tuple(round(x,7) for x in ar[j:j+3]) for j in [i,i+3,i+6]];a,b,c=tri
  volume+=sum(a[k]*(b[(k+1)%3]*c[(k+2)%3]-b[(k+2)%3]*c[(k+1)%3]) for k in range(3))/6
  for k in range(3):
   edge=tuple(sorted([tri[k],tri[(k+1)%3]]));edges[edge]=edges.get(edge,0)+1;direction=(tri[k],tri[(k+1)%3]);directed[direction]=directed.get(direction,0)+1
 boundary=sum(v==1 for v in edges.values());nonmanifold=sum(v>2 for v in edges.values());assert nonmanifold==0
 orientationConflicts=sum(1 for edge,count in edges.items() if count==2 and (directed.get(edge,0)!=1 or directed.get(tuple(reversed(edge)),0)!=1));assert orientationConflicts==0
 closed='barnacle' not in component['name'];assert not closed or boundary==0;assert not closed or volume>0
 topology.append({'name':component['name'],'boundaryEdges':boundary,'nonmanifoldEdges':nonmanifold,'inconsistentWindingEdges':orientationConflicts,'closedExpected':closed,'signedVolume':volume})

blob=(p/('pearlglass-medusa-complete-character-next.glb')).read_bytes();magic,version,length=struct.unpack_from('<III',blob);assert magic==0x46546c67 and version==2 and length==len(blob)
size,kind=struct.unpack_from('<II',blob,12);g=json.loads(blob[20:20+size]);assert g['skins'];joints={g['nodes'][j]['name'] for skin in g['skins'] for j in skin['joints']};assert joints=={b['name'] for b in d['bones']}
for mesh in g['meshes']:
 for prim in mesh['primitives']:assert 'JOINTS_0' in prim['attributes'] and 'WEIGHTS_0' in prim['attributes']
report={'topology':topology,'checks':'finite geometry, nondegenerate triangles, normalized skin, exact typed pack bytes, GLB scene with actual skin/joints','degenerateTriangles':degenerate,'blendedVertices':blend,'maxInfluences':maxskin,'boundsNativeYUp':bounds,'boneCount':len(d['bones']),'glbSkinCount':len(g['skins']),'glbMeshCount':len(g['meshes']),'visualAcceptance':False,'runtimeAcceptance':False,'files':{f.name:{'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in p.iterdir() if f.is_file() and f.name!='audit.json'}}
(p/'audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
