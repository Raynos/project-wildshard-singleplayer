"""Read-only independent source/GLB/packed audit; writes only sibling results.json."""
import ast
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import struct
import zlib

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
BASE = ROOT / 'art/driftwood-isle/lowpoly-mantis'
SOURCE = BASE / 'complete-pass2'
NATIVE = BASE / 'complete-pass2-native'
def read(p): return json.loads(p.read_text())
def sub(a,b): return [x-y for x,y in zip(a,b)]
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def cross(a,b): return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def norm(a): return math.sqrt(dot(a,a))
def unit(a): return [x/norm(a) for x in a]
def facet(p): return cross(sub(p[1],p[0]),sub(p[2],p[0]))
def game(p): return [p[0],p[2],-p[1]]
def newell(p): return unit([sum(cross(a,b)[i] for a,b in zip(p,p[1:]+p[:1])) for i in range(3)])
def glb_read(path):
 raw=path.read_bytes();magic,version,size=struct.unpack_from('<III',raw)
 assert magic==0x46546c67 and version==2 and size==len(raw)
 chunks={};o=12
 while o<len(raw):
  n,k=struct.unpack_from('<II',raw,o);chunks[k]=raw[o+8:o+8+n];o+=8+n
 return json.loads(chunks[0x4e4f534a]),chunks[0x004e4942]
def accessor(doc,buf,index):
 a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
 typ={5126:'f',5123:'H',5125:'I'}[a['componentType']];width={'VEC3':3,'SCALAR':1}[a['type']]
 fmt='<'+typ*width;stride=v.get('byteStride',struct.calcsize(fmt));start=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [list(struct.unpack_from(fmt,buf,start+i*stride)) for i in range(a['count'])]

def main():
 for path,digest in read(NATIVE/'input-pins.json').items():
  assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==digest, path
 doc,buf=glb_read(SOURCE/'mantis-study-complete-pass2.glb')
 src={p['name']:p for p in read(SOURCE/'mantis-mesh-complete-pass2.json')['parts']}
 native=read(NATIVE/'mantis-native.json');mapping=read(NATIVE/'mesh-map.json');auth=read(NATIVE/'authored-mapping.json')
 parts={p['name']:p for p in native['parts']};rows={r['node']:r for r in mapping}
 authored={p['name']:p for p in auth['parts']};alltris=[];opposed=[];polys={};point_count=0
 for ni,node in enumerate(doc['nodes']):
  if 'mesh' not in node: continue
  assert not any(k in node for k in ['matrix','rotation','scale','children'])
  s=src[node['name']];r=rows[ni];p=parts[r['joint']];offset=r['vertexStart'];points=list(map(game,s['vertices']))
  assert authored[node['name']]['nativeJoint']==r['joint']
  translated=node.get('translation',[0,0,0]);found=set();edges={i:Counter() for i in range(len(s['faces']))};counts=Counter()
  for pi,primitive in enumerate(doc['meshes'][node['mesh']]['primitives']):
   pos=accessor(doc,buf,primitive['attributes']['POSITION']);ns=accessor(doc,buf,primitive['attributes']['NORMAL']);ids=[v[0] for v in accessor(doc,buf,primitive['indices'])]
   color=doc['materials'][primitive['material']]['pbrMetallicRoughness']['baseColorFactor']
   for t in range(0,len(ids),3):
    ii=ids[t:t+3];ps=[pos[i] for i in ii];normals=[ns[i] for i in ii];sourceids=[points.index(q) for q in ps]
    fis=[i for i,f in enumerate(s['faces']) if set(sourceids)<=set(f) and s['colors'][s['materialIndices'][i]]==color]
    assert len(fis)==1;fi=fis[0];counts[fi]+=1
    edges[fi].update(zip(sourceids,sourceids[1:]+sourceids[:1]));found.update(sourceids)
    fn=unit(facet(ps));cos=[dot(fn,n) for n in normals]
    for j,i in enumerate(ii):
     q=offset+j;assert p['positions'][q*3:q*3+3]==[a+b for a,b in zip(pos[i],translated)]
     assert p['normals'][q*3:q*3+3]==ns[i] and p['colorsLinear'][q*3:q*3+3]==color[:3]
     assert p['skinIndices'][q*4:q*4+4]==[list(parts).index(r['joint']),0,0,0]
     assert p['skinWeights'][q*4:q*4+4]==[1,0,0,0] and p['furLen'][q]==0
    row=dict(node=ni,name=node['name'],polygon=fi,primitive=pi,triangle=t//3,material=primitive['material'],materialName=doc['materials'][primitive['material']]['name'],sourceVertexIds=sourceids,nativeJoint=r['joint'],nativeVertexStart=offset,cosines=cos,geometricNormal=fn,storedNormals=normals)
    alltris.append(row);polys.setdefault((ni,fi),[]).append(row)
    if min(cos)<-1e-7: opposed.append(row)
    offset+=3;point_count+=3
   assert r['primitives'][pi]['vertexCount']==len(ids)
  assert found==set(range(len(points)))
  for fi,f in enumerate(s['faces']):
   assert counts[fi]==len(f)-2
   actual=edges[fi];expect=Counter(zip(f,f[1:]+f[:1]))
   signed=lambda e:{k:v-e[k[::-1]] for k,v in e.items() if v-e[k[::-1]]>0}
   assert signed(actual)==signed(expect)
  assert offset==r['vertexStart']+r['vertexCount']
 # Independently decode every native packed channel, rather than trusting JSON or adapter.
 meta=read(NATIVE/'metadata.json');packed=zlib.decompress((NATIVE/'payload.bin').read_bytes());cursor=0;channels=0
 assert len(packed)==meta['bytes']
 keys={'position':'positions','normal':'normals','color':'colorsLinear','skinIndex':'skinIndices','skinWeight':'skinWeights','furLen':'furLen'}
 for p,record in zip(native['parts'],meta['bodies'][0]['hard']):
  for name,kind,width,normalized in record['row']['attrs']:
   assert not normalized;values=p[keys[name]];fmt='<'+('H' if kind=='u16' else 'f')*len(values)
   decoded=struct.unpack_from(fmt,packed,cursor);expected=struct.unpack(fmt,struct.pack(fmt,*values));assert decoded==expected
   cursor+=struct.calcsize(fmt);cursor=(cursor+3)//4*4;channels+=1
 assert cursor==len(packed)
 details=[]
 for row in opposed:
  s=src[row['name']];face=s['faces'][row['polygon']];ps=[game(s['vertices'][i]) for i in face];pn=newell(ps)
  options=[]
  for tris in [[(0,1,2),(0,2,3)],[(0,1,3),(1,2,3)]]:
   normals=[unit(facet([ps[i] for i in tri])) for tri in tris]
   options.append(dict(triangles=[[face[i] for i in tri] for tri in tris],facetMutualCosine=dot(*normals),cosinesToPolygon=[dot(pn,n) for n in normals]))
  plane_distance=abs(dot(sub(ps[3],ps[0]),unit(facet(ps[:3]))))
  details.append(dict(**row,sourcePolygonVertices=face,sourcePositionsBlender=[s['vertices'][i] for i in face],polygonNewellNormal=pn,storedVsNewellCosine=dot(pn,unit(row['storedNormals'][0])),fourthPointPlaneDistance=plane_distance,triangulations=options,polygonExportTriangles=polys[(row['node'],row['polygon'])]))
 # Extract profile literally without importing bpy / executing construction source.
 tree=ast.parse((SOURCE/'build_mantis_complete.py').read_text());neck=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='neck' for t in n.targets))
 frames=[]
 for j,(p,w,d) in enumerate(neck):
  tangent=unit(sub(neck[min(j+1,len(neck)-1)][0],neck[max(j-1,0)][0]));u=cross(tangent,[0,1,0])
  if norm(u)<.01:u=cross(tangent,[0,0,1])
  u=unit(u);v=unit(cross(tangent,u));frames.append(dict(station=j,center=p,width=w,depth=d,tangent=tangent,u=u,v=v))
 for j in range(1,len(frames)):
  frames[j]['previousUCosine']=dot(frames[j-1]['u'],frames[j]['u']);frames[j]['previousVCosine']=dot(frames[j-1]['v'],frames[j]['v'])
 # Counterfactual only: continuous frame at terminal station, never export/model edits.
 arch=src['Rising prothorax curved cervical arch'];fixed=[v[:] for v in arch['vertices']]
 center=neck[-1][0]
 for i in range(42,49): fixed[i]=[2*c-x for c,x in zip(center,fixed[i])]
 # Inverting both transverse axes preserves the station plane, center, widths/depths.
 affected=[]
 for fi,face in enumerate(arch['faces']):
  if not any(i>=42 for i in face):continue
  ps=[game(fixed[i]) for i in face];pn=newell(ps)
  if len(face)==4:
   opts=[]
   for tris in [[(0,1,2),(0,2,3)],[(0,1,3),(1,2,3)]]:
    nn=[unit(facet([ps[i] for i in t])) for t in tris]
    opts.append(dict(mutualCosine=dot(*nn),minimumToPolygon=min(dot(pn,n) for n in nn)))
   affected.append(dict(polygon=fi,diagonals=opts))
 simulation=dict(kind='numeric counterfactual only, no source repair',changedVertexIds=list(range(42,49)),maxDisplacement=max(norm(sub(a,b)) for a,b in zip(fixed,arch['vertices'])),fixedQuads=affected)
 deviations=[r for r in alltris if min(r['cosines'])<.999]
 deviation_geometry=[]
 for row in deviations:
  s=src[row['name']];face=s['faces'][row['polygon']];pn=newell([game(s['vertices'][i]) for i in face])
  deviation_geometry.append(dict(vertices=len(face),storedVsPolygonCosine=min(dot(pn,unit(n)) for n in row['storedNormals'])))
 deviation_classification=dict(sourcePolygonSizes=dict(Counter(r['vertices'] for r in deviation_geometry)),minimumStoredVsPolygonCosine=min(r['storedVsPolygonCosine'] for r in deviation_geometry),note='All 603 compared independently to source polygon Newell normals; facet deviations are not all opposition.')
 audit=read(NATIVE/'normal-audit.json');assert len(deviations)==len(audit['facetNormalDeviations'])==603 and len(opposed)==4
 assert {(r['node'],r['primitive'],r['triangle']) for r in opposed}=={(r['node'],r['primitive'],r['triangle']) for r in audit['opposedTriangles']}
 result=dict(schema='mantis-curved-normal-diagnosis.v1',summary=dict(objects=len(src),triangles=len(alltris),vertices=point_count,packedChannels=channels,facetDeviations=len(deviations),nonOpposedDeviations=len(deviations)-len(opposed),opposed=len(opposed),minimumCosine=min(min(r['cosines']) for r in alltris),pointMaterialBoundaryCorrespondence=True,sixChannelCorrespondence=True),opposedFacets=details,sourceLoftFrames=frames,deviationClassification=deviation_classification,continuousFrameCounterfactual=simulation,deviationsByObject=dict(Counter(r['name'] for r in deviations)),inputs={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [SOURCE/'build_mantis_complete.py',SOURCE/'mantis-mesh-complete-pass2.json',SOURCE/'mantis-study-complete-pass2.glb',NATIVE/'mantis-native.json',NATIVE/'payload.bin',NATIVE/'metadata.json',NATIVE/'authored-mapping.json',NATIVE/'mesh-map.json',NATIVE/'normal-audit.json']})
 (HERE/'results.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result['summary'],indent=2))
 for d in details:print('polygon',d['polygon'],'point ids',d['sourceVertexIds'],'stored/Newell',d['storedVsNewellCosine'],'distance',d['fourthPointPlaneDistance'],'diagonals',d['triangulations'])
 print('Final frame',frames[-1])
if __name__=='__main__':main()
