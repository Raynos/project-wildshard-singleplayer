"""Audit the preserved expanded native NORMAL stream without repairing it."""
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent

def audit():
    data = json.loads((HERE/'native/conch-character-pass-native.json').read_bytes())
    mapping = json.loads((HERE/'native/mesh-map.json').read_bytes())
    parts = {p['name']:p for p in data['parts']}
    deviations, opposed = [], []
    minimum, triangles, degenerate = 1.0, 0, 0
    for mesh in mapping:
        part = parts[mesh['joint']]
        for primitive in mesh['primitives']:
            start = primitive['vertexStart']
            for first in range(start, start+primitive['vertexCount'], 3):
                points = [part['positions'][v*3:v*3+3] for v in range(first,first+3)]
                normals = [part['normals'][v*3:v*3+3] for v in range(first,first+3)]
                a,b,c = points
                u,v = [[y-x for x,y in zip(a,p)] for p in (b,c)]
                cross = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
                length = math.sqrt(sum(x*x for x in cross))
                triangles += 1
                if length < 1e-10:
                    degenerate += 1
                    continue
                dots = [sum(x*y for x,y in zip(cross,n))/length for n in normals]
                minimum = min(minimum,*dots)
                row = dict(node=mesh['node'],name=mesh['name'],primitive=primitive['primitive'],triangle=(first-start)//3,normalCosines=dots)
                if min(dots) < .999: deviations.append(row)
                if min(dots) < -1e-7: opposed.append(row)
    assert triangles == 2190 and degenerate == 0 and len(deviations) == 21 and not opposed
    return dict(triangleCount=triangles,degenerateTriangles=degenerate,minimumNormalCosine=minimum,
                facetNormalDeviations=deviations,opposedTriangles=opposed,
                normalPolicy='Exact selected source GLB NORMAL preserved, not triangulated/facet recomputed',
                allClosedUnitFacetDiagnostic=False,visualAcceptance=False,runtimeAcceptance=False)

if __name__ == '__main__': print(json.dumps(audit(),indent=2))
