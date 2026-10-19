"""Validate Bellback's self-contained native export; not a visual/performance gate."""
import argparse,hashlib,json,math,struct
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('glb');p.add_argument('--out',required=True);a=p.parse_args();src=Path(a.glb);raw=src.read_bytes()
magic,version,length=struct.unpack_from('<4sII',raw);assert (magic,version,length)==(b'glTF',2,len(raw))
size,kind=struct.unpack_from('<I4s',raw,12);assert kind==b'JSON';doc=json.loads(raw[20:20+size]);offset=20+size;binary_size,binary_kind=struct.unpack_from('<I4s',raw,offset);assert binary_kind==b'BIN\0';binary=raw[offset+8:offset+8+binary_size]
assert len(doc['buffers'])==1 and 'uri' not in doc['buffers'][0];assert not doc.get('images')
formats={5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'};components={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def values(index):
 ac=doc['accessors'][index];bv=doc['bufferViews'][ac['bufferView']];fmt='<'+formats[ac['componentType']]*components[ac['type']];width=struct.calcsize(fmt);start=bv.get('byteOffset',0)+ac.get('byteOffset',0);stride=bv.get('byteStride',width)
 assert start+max(0,ac['count']-1)*stride+width<=bv.get('byteOffset',0)+bv['byteLength']<=len(binary)
 result=[struct.unpack_from(fmt,binary,start+i*stride) for i in range(ac['count'])]
 assert all(math.isfinite(v) for row in result for v in row)
 return result
triangles=0;primitives=0
for mesh in doc['meshes']:
 for pr in mesh['primitives']:
  assert pr.get('mode',4)==4;position=values(pr['attributes']['POSITION']);index=[row[0] for row in values(pr['indices'])];assert len(index)%3==0;assert min(index)>=0 and max(index)<len(position)
  for accessor in pr['attributes'].values():values(accessor)
  triangles+=len(index)//3;primitives+=1
report={'status':'Native GLB structural validation passed; visual acceptance and performance not established','sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'header_valid':True,'external_dependencies':0,'finite_attributes':True,'index_bounds_valid':True,'nodes':len(doc['nodes']),'meshes':len(doc['meshes']),'mesh_primitives':primitives,'triangles':triangles,'materials':len(doc['materials']),'animations':len(doc.get('animations',[])),'skins':len(doc.get('skins',[]))}
Path(a.out).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
