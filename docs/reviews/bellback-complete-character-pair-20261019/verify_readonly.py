import json,struct,hashlib,math
from pathlib import Path
from PIL import Image
R=Path(__file__).resolve().parents[3];H=R/'art/driftwood-isle/lowpoly-bellback/complete-character-pass';T=R/'tmp/bellback-complete-character-pass'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert (H/'capture_review.py').read_bytes()==(H.parent/'woody-character-integration/capture_review.py').read_bytes()
r=(H/'bellback-complete-character-pass.glb').read_bytes();n=struct.unpack_from('<I',r,12)[0];d=json.loads(r[20:20+n]);b=r[28+n:]
def vals(i):
 a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];f='<'+{5126:'f',5123:'H',5125:'I'}[a['componentType']]*{'VEC3':3,'SCALAR':1}[a['type']];s=v.get('byteOffset',0)+a.get('byteOffset',0);return [struct.unpack_from(f,b,s+j*v.get('byteStride',struct.calcsize(f))) for j in range(a['count'])]
mini=math.inf;mindot=math.inf;count=0
for m in d['meshes']:
 for p in m['primitives']:
  vs=vals(p['attributes']['POSITION']);ns=vals(p['attributes']['NORMAL']);ix=[x[0] for x in vals(p['indices'])]
  for k in range(0,len(ix),3):
   a,c,e=[vs[ix[k+j]] for j in range(3)];u=[c[j]-a[j] for j in range(3)];v=[e[j]-a[j] for j in range(3)];cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];area=math.sqrt(sum(x*x for x in cross))/2;mini=min(mini,area)
   dots=[sum(cross[j]*ns[ix[k+i]][j] for j in range(3)) for i in range(3)];mindot=min(mindot,*dots);assert area>1e-10 and min(dots)>0;count+=1
for role,name in [('candidate','bellback-complete-character-pass.glb'),('baseline','bellback-woody-character-integration.glb')]:
 pin=H/name if role=='candidate' else H.parent/'woody-character-integration'/name
 for mode in ['hero','nine']:assert (T/'final'/role/mode/name).read_bytes()==pin.read_bytes()
views=[]
for p in sorted((T/'final/baseline').rglob('*.png')):
 old=R/'tmp/bellback-woody-character-integration/final'/p.relative_to(T/'final/baseline')
 a=Image.open(p).convert('RGB');bb=Image.open(old).convert('RGB');assert a.size==bb.size and a.tobytes()==bb.tobytes();views.append(p.stem)
audit=json.loads((H/'intersection-audit.json').read_text());c=audit['candidate'];assert not c['nonadjacent_self_intersections'] and not c['proper_self_crossings_including_adjacent'];assert c['source_sha256']==sha(H/'build_bellback_complete.py')
clapper={k:v for k,v in c['cross_object_pairs'].items() if 'Clapper' in k}
for name in ['failed-inherited-loop-seams','failed-assembly-clearance']:
 assert (H/name/'build_bellback_complete.py').is_file() and (H/name/'bellback-complete-character-pass.glb').is_file()
assert len(list((T/'failed-assembly-clearance').rglob('*.png')))==10
result={'source_sha256':sha(H/'build_bellback_complete.py'),'glb_sha256':sha(H/'bellback-complete-character-pass.glb'),'glb_bytes':len(r),'meshes':len(d['meshes']),'triangles':count,'minimum_triangle_area':mini,'minimum_geometric_normal_dot':mindot,'baseline_exact_rgb_views':views,'capture_script_byte_identical':True,'final_capture_exports_byte_identical':True,'clapper_inventory_as_recorded':clapper,'cross_object_triangle_pairs_as_recorded':c['cross_object_triangle_pairs'],'preserved_failed_attempts':True,'limits':'No build or render; native/source geometry audits inspected and pinned, not rerun. Exported normal/area and RGB comparisons independently recomputed.'}
print(json.dumps(result,indent=2))
