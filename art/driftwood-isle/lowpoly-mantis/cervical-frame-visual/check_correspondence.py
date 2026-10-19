"""Paired point/normal correspondence audit; original folded facets remain disclosed."""
import ast
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import struct
import zlib

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
BASE = ROOT / 'art/driftwood-isle/lowpoly-mantis'
import sys
ROLE = sys.argv[1]
SUFFIX = {"baseline":"complete-pass2", "candidate":"cervical-frame-repair"}[ROLE]
SOURCE = BASE / SUFFIX
NATIVE = BASE / ("complete-pass2-native" if ROLE == "baseline" else SUFFIX)
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
 doc,buf=glb_read(SOURCE/('mantis-study-'+SUFFIX+'.glb'))
 src={p['name']:p for p in read(SOURCE/('mantis-mesh-'+SUFFIX+'.json'))['parts']}
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
 deviations=[r for r in alltris if min(r['cosines'])<.999]
 if ROLE == "candidate": assert not opposed
 result=dict(objects=len(src),triangles=len(alltris),corners=point_count,packedChannels=channels,opposed=len(opposed),deviations=len(deviations),minimumCosine=min(min(r['cosines']) for r in alltris),sourceBoundaryMaterialCorrespondence=True,packedSixChannelCorrespondence=True,opposedFacets=opposed)
 (HERE/(ROLE+'-correspondence.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
if __name__=='__main__':main()
