"""Read-only package, raw capture and exported geometry verification."""
import json,hashlib,struct,math
from pathlib import Path
H=Path(__file__).resolve().parent;R=H.parents[3]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def check(e):
 p=R/e['path'];assert p.is_file() and p.stat().st_size==e['bytes'] and sha(p)==e['sha256'],e['path']
manifest=json.loads((H/'closure.json').read_text())
for e in manifest['files']+manifest['raw_pngs']:check(e)
pins=json.loads((H/'input-pins.json').read_text())
for e in pins.values():check(e)
pairs=json.loads((H/'paired-captures.json').read_text());assert len(pairs['pairs'])==10
for row in pairs['pairs']:
 for role in ['baseline','candidate','pair']:check(row[role])
for kind in ['hero','nine']:
 a=json.loads((H/f'baseline-capture-{kind}.json').read_text());b=json.loads((H/f'candidate-capture-{kind}.json').read_text())
 assert a['lights']==b['lights'];assert a['capture_script_sha256']==b['capture_script_sha256']==sha(H/'capture_review.py')
 assert a['source_sha256']==pins['baseline_source']['sha256'];assert b['source_sha256']==pins['candidate_source']['sha256']
 for u,v in zip(a['shots'],b['shots']):
  for k in ['name','camera','target','ortho_scale']:assert u[k]==v[k]
# Every actual accessor, not an author's count.
r=(H/'bellback-complete-wreck-anatomy.glb').read_bytes();n=struct.unpack_from('<I',r,12)[0];doc=json.loads(r[20:20+n]);buf=r[28+n:]
assert not doc.get('skins') and not doc.get('animations');assert all('uri' not in x for x in doc.get('buffers',[])+doc.get('images',[]))
def values(i):
 a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']];fmt='<'+{5126:'f',5123:'H',5125:'I'}[a['componentType']]*{'VEC3':3,'SCALAR':1}[a['type']];width=struct.calcsize(fmt);start=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from(fmt,buf,start+j*v.get('byteStride',width)) for j in range(a['count'])]
triangles=0;error=0
for mesh in doc['meshes']:
 for prim in mesh['primitives']:
  pos=values(prim['attributes']['POSITION']);norm=values(prim['attributes']['NORMAL']);idx=[r[0] for r in values(prim['indices'])]
  assert all(math.isfinite(v) for row in pos+norm for v in row);assert len(pos)==len(norm);assert all(0<=i<len(pos) for i in idx);assert len(idx)%3==0
  error=max(error,max(abs(math.sqrt(sum(v*v for v in row))-1) for row in norm));triangles+=len(idx)//3
assert error<1e-5
for filename,expected in [('geometry-checks.json','PASS'),('native-geometry-checks.json','PASS'),('intersection-audit.json','PASS_SELF'),('coplanar-audit.json','PASS'),('quad-diagonal-audit.json','PASS')]:assert json.loads((H/filename).read_text())['status']==expected
assert json.loads((H/'consumer-checks.json').read_text())['status']=='PASS'
assert json.loads((H/'exact-topology-parity.json').read_text())['status']=='PASS'
assert json.loads((H/'baseline-reproduction.json').read_text())['status']=='PASS'
for p in H.rglob('*'):
 if not p.is_file():continue
 cap=5000000 if p.suffix=='.json' else (500000 if 'board' in p.name else 250000) if p.suffix in ('.webp','.png','.jpg') else 1000000
 assert p.stat().st_size<=cap,(p.name,p.stat().st_size,cap)
print('VERIFIED',triangles,'triangles,',len(doc['meshes']),'meshes, 20 actual renders / 10 exact pairs, max normal unit error',error)
