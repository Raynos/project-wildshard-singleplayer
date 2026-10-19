"""Read-only static closure check; no Blender, image changes or rendering."""
import hashlib
import json
import math
from pathlib import Path
import struct
from decimal import Decimal

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
PKG = ROOT / 'art/driftwood-isle/lowpoly-bellback/woody-character-integration'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def read(path):
    return json.loads(path.read_text())

def verify():
    pins = {
        PKG / 'build_bellback_complete.py': 'e67b9e3ea01996bc5f0dfb9da07ed8800bb3d0052c7d3cc08c77c985732f0aa3',
        PKG / 'bellback-woody-character-integration.glb': 'efaf7ebf07d6f18d0c71185ebd2d696e2554af2df57128a484bd7e9d5089135a',
        PKG / 'paired-captures.json': '97f7a086259dcdb06420abb31f9bb066d00dc165412705a754c5a2964e142557',
        ROOT / 'art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/bellback-lowpoly.webp': '92b3a72c20b2e820d843956f8d076fb981af9d4ec9e5669794cb717dd552f4ae',
    }
    for path, expected in pins.items():
        assert sha(path) == expected, str(path.relative_to(ROOT))
    closure = read(PKG / 'closure.json')
    checked = set()
    for row in closure['files'] + closure['raw_pngs']:
        path = ROOT / row['path']
        assert path.stat().st_size == row['bytes'], row['path']
        assert sha(path) == row['sha256'], row['path']
        checked.add(row['path'])
    pairs = read(PKG / 'paired-captures.json')['pairs']
    assert len(pairs) == 10
    for pair in pairs:
        for role in ['baseline', 'candidate', 'pair']:
            row = pair[role]
            path = ROOT / row['path']
            assert sha(path) == row['sha256'] and path.stat().st_size == row['bytes']
            checked.add(row['path'])
        group = 'hero' if pair['view'] == 'hero' else 'nine'
        baseline = read(ROOT / f'tmp/bellback-complete-pass3/{group}/capture-{group}.json')
        candidate = read(PKG / f'capture-{group}.json')
        raw_receipt = ROOT / f'tmp/bellback-woody-character-integration/final/{group}/capture-{group}.json'
        assert raw_receipt.read_bytes() == (PKG / f'capture-{group}.json').read_bytes()
        assert baseline['lights'] == candidate['lights']
        for receipt in [baseline, candidate]:
            assert sha(ROOT / receipt['source']) == receipt['source_sha256']
            assert sha(PKG / 'capture_review.py') == receipt['capture_script_sha256']
        a = next(x for x in baseline['shots'] if x['name'] == pair['view'])
        b = next(x for x in candidate['shots'] if x['name'] == pair['view'])
        for key in ['camera', 'target', 'ortho_scale']:
            assert a[key] == b[key] == pair[key]
        assert a['image_sha256'] == pair['baseline']['sha256']
        assert b['image_sha256'] == pair['candidate']['sha256']
    raw = (PKG / 'bellback-woody-character-integration.glb').read_bytes()
    for group in ['hero', 'nine']:
        assert raw == (ROOT / f'tmp/bellback-woody-character-integration/final/{group}/bellback-woody-character-integration.glb').read_bytes()
    assert struct.unpack_from('<4sII', raw) == (b'glTF', 2, len(raw))
    length, kind = struct.unpack_from('<II', raw, 12)
    assert kind == 0x4e4f534a
    doc = json.loads(raw[20:20+length])
    size, kind = struct.unpack_from('<II', raw, 20+length)
    assert kind == 0x004e4942
    binary = raw[28+length:28+length+size]
    assert not any('uri' in x for x in doc.get('buffers', []) + doc.get('images', []))
    def accessor(index):
        a = doc['accessors'][index]
        assert 'sparse' not in a
        view = doc['bufferViews'][a['bufferView']]
        fmt = '<' + {5126:'f',5123:'H',5125:'I',5121:'B'}[a['componentType']] * {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        width = struct.calcsize(fmt)
        offset = view.get('byteOffset',0) + a.get('byteOffset',0)
        stride = view.get('byteStride',width)
        assert offset + max(a['count']-1,0)*stride + width <= view.get('byteOffset',0)+view['byteLength']
        values = [struct.unpack_from(fmt,binary,offset+i*stride) for i in range(a['count'])]
        assert all(math.isfinite(v) for row in values for v in row)
        return values
    triangles = 0
    minimum_area = math.inf
    minimum_dot = math.inf
    max_normal_error = 0
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            assert primitive.get('mode',4) == 4
            points = accessor(primitive['attributes']['POSITION'])
            normals = accessor(primitive['attributes']['NORMAL'])
            indices = [x[0] for x in accessor(primitive['indices'])]
            assert len(indices)%3 == 0 and min(indices)>=0 and max(indices)<len(points)
            assert len(normals)==len(points)
            max_normal_error=max(max_normal_error,max(abs(math.sqrt(sum(v*v for v in n))-1) for n in normals))
            for j in range(0,len(indices),3):
                ids=indices[j:j+3]
                a,b,c=[points[i] for i in ids]
                u=[b[k]-a[k] for k in range(3)]; v=[c[k]-a[k] for k in range(3)]
                cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
                area=math.sqrt(sum(x*x for x in cross))/2
                dots=[sum(cross[k]*normals[i][k] for k in range(3)) for i in ids]
                assert area>1e-10 and min(dots)>0
                minimum_area=min(minimum_area,area); minimum_dot=min(minimum_dot,*dots)
                triangles+=1
    assert max_normal_error<1e-5
    visual=read(HERE/'visual-freeze.json'); comparison=read(HERE/'comparison.json')
    for key,score in [('candidate_scores',visual['candidate_exact_total']),('baseline_scores',comparison['baseline_exact_total'])]:
        values=visual[key] if key in visual else comparison[key]
        assert sum(Decimal(str(v))*Decimal(str(visual['weights'][k])) for k,v in values.items())==Decimal(str(score))
    return {'status':'PASS','hash_checked_files':len(checked),'pairs':len(pairs),'camera_light_parity':True,'candidate_glb_matches_both_capture_exports':True,'triangles':triangles,'meshes':len(doc['meshes']),'primitives':sum(len(m['primitives']) for m in doc['meshes']),'minimum_triangle_area':minimum_area,'minimum_geometric_normal_dot':minimum_dot,'maximum_unit_normal_error':max_normal_error,'original_sha256':sha(ROOT/'art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/bellback-lowpoly.webp'),'candidate_source_sha256':sha(PKG/'build_bellback_complete.py'),'candidate_glb_sha256':hashlib.sha256(raw).hexdigest(),'limitations':'Existing source-to-render receipts and byte closure verified; source was not executed or re-rendered. No runtime, animation, intersection or performance acceptance. Structural checks do not alter visual scores.'}

if __name__ == '__main__':
    print(json.dumps(verify(),indent=2))
