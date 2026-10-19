"""Independent, unaccepted fan study in V71 native bind coordinates.

Pure Python. Does not write or replace the retained model. The indexed mesh is
an editable source asset; the small native payload is an explicit tail-only part.
"""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
BASE = HERE.parent / 'approved-puffer/unaccepted-native-v71.json'
# Forward offset, vertical offset, inner border fraction, half edge thickness.
# Unequal terminal lobes and shallow valleys; no circular or regular radial grid.
OUTLINE = [(.21,0,.84,.042),(.15,.15,.83,.039),(.045,.285,.78,.034),
           (-.10,.32,.73,.031),(-.225,.275,.75,.034),(-.255,.18,.79,.029),
           (-.345,.13,.74,.038),(-.33,.015,.76,.032),(-.365,-.065,.73,.037),
           (-.31,-.205,.76,.032),(-.23,-.215,.78,.028),(-.17,-.30,.73,.035),
           (-.025,-.285,.77,.031),(.075,-.205,.81,.033),(.16,-.15,.84,.038),
           (.205,-.07,.85,.042)]
COLORS = {'teal': [.014,.131,.124], 'upper': [.027,.188,.172],
          'deep': [.011,.105,.104], 'ochre': [.82,.235,.026],
          'gold': [.94,.46,.095], 'cream': [.91,.70,.36]}


def build():
    base = json.loads(BASE.read_text())
    original = next(p for p in base['parts'] if p['name'] == 'Tail root')
    # The retained native tail begins with the 44 triangles of its root loft.
    # Assert its exact root bounds to avoid relying silently on array order.
    root = {k: v[:132 * (4 if k in ('skinIndices','skinWeights') else 1 if k == 'furLen' else 3)]
            if isinstance(v,list) else v for k,v in original.items()}
    assert min(root['positions'][2::3]) > -.758
    assert max(root['positions'][2::3]) < -.447
    center = [.29,.58,-.8175]
    vertices, faces, regions = [], [], []
    n = len(OUTLINE)
    for side in (-1,1):
        # Radial origin pulled toward the root: the fan flows outward, not a coin hub.
        vertices.append([center[0]+side*.071, center[1]+.005, center[2]+.095])
        for ring in range(3):
            for forward, up, fraction, edge in OUTLINE:
                f = fraction if ring == 0 else .94 if ring == 1 else 1
                half = .054 + .009 * max(0, forward/.21) if ring == 0 else edge+.010 if ring == 1 else edge
                # A restrained lean of the upper lobe gives a real profile contour.
                midx = center[0] + .025*up + .014*forward
                vertices.append([midx+side*half,center[1]+f*up,center[2]+f*forward])
    stride=1+3*n
    def add(face,region): faces.append(list(face));regions.append(region)
    for side in range(2):
        offset=side*stride
        def face(ids,region): add(tuple(reversed(ids)) if side else ids,region)
        for k in range(n):
            j=(k+1)%n
            core='upper' if k in (1,2,3,4) else 'deep' if k in (8,9,10,11) else 'teal'
            face((offset,offset+1+k,offset+1+j),core)
            for ring in range(2):
                a=offset+1+ring*n+k;b=offset+1+ring*n+j;c=offset+1+(ring+1)*n+k;d=offset+1+(ring+1)*n+j
                # No complete colored ring around the anatomical attachment.
                region=core if k in (0,14,15) else ('ochre' if ring==0 else 'gold')
                if ring==1 and k in (2,3,6,8,10,11):region='cream'
                face((a,c,d),region);face((a,d,b),region)
    for k in range(n):
        j=(k+1)%n;a=1+2*n+k;b=1+2*n+j
        add((b,a,b+stride),'cream' if k in (2,3,6,8,10,11) else 'gold' if k not in (0,14,15) else 'teal')
        add((b+stride,a,a+stride),regions[-1])
    # Orient the closed shell consistently outward by signed volume.
    def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
    volume=sum(sum(a*b for a,b in zip(vertices[f[0]],cross(vertices[f[1]],vertices[f[2]]))) for f in faces)/6
    if volume<0:faces=[f[::-1] for f in faces]
    mesh={'schema':'wildshard.editable-tail.v1','status':'unaccepted independent study',
          'coordinates':base['coordinates'],'baseSha256':hashlib.sha256(BASE.read_bytes()).hexdigest(),
          'pivot':next(b for b in base['bones'] if b['name']=='tail'),'integrationTransform':'identity in V71 native coordinates',
          'vertices':vertices,'triangles':faces,'faceRegions':regions,'paletteLinear':COLORS,
          'rootPolicy':'First 44 V71 Tail root triangles preserved byte-for-value; broad fan overlaps distal root. Two closed components, not welded.',
          'outlineParameters':[list(p) for p in OUTLINE]}
    for face,region in zip(faces,regions):
        for index in face:
            root['positions'].extend(vertices[index]);root['colorsLinear'].extend(COLORS[region]);root['skinIndices'].extend([2,0,0,0]);root['skinWeights'].extend([1.,0.,0.,0.]);root['furLen'].append(0.)
    native={'schema':base['schema'],'status':'unaccepted tail-only replacement study; not a complete creature','coordinates':base['coordinates'],'bones':base['bones'],'parts':[root]}
    return mesh,native

if __name__=='__main__':
    mesh,native=build()
    (HERE/'tail-fan-indexed.json').write_text(json.dumps(mesh,indent=2)+'\n')
    (HERE/'tail-native-study.json').write_text(json.dumps(native,separators=(',',':'))+'\n')
    print('Wrote independent indexed mesh and tail-only native study')
