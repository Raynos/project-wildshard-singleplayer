"""Mandatory closed oriented triangle-surface gate before winding queries."""
import math


def validate_closed_surface(vertices, triangles):
    # Native triangle soup duplicates shared vertices. Weld exact positions only;
    # no tolerance may hide a geometric gap or silently change the surface.
    canonical = {}
    vertex_ids = []
    for point in vertices:
        key = tuple(float(v) for v in point)
        if len(key) != 3 or not all(math.isfinite(v) for v in key):
            raise ValueError('Nonfinite surface vertex')
        if key not in canonical:
            canonical[key] = len(canonical)
        vertex_ids.append(canonical[key])
    edges = {}
    seen = set()
    minimum_area = math.inf
    for face in triangles:
        if len(face) != 3 or any(i < 0 or i >= len(vertices) for i in face):
            raise ValueError('Invalid triangle indices')
        ids = tuple(vertex_ids[i] for i in face)
        key = tuple(sorted(ids))
        if len(set(ids)) != 3 or key in seen:
            raise ValueError('Degenerate or duplicate surface triangle')
        seen.add(key)
        a,b,c = [vertices[i] for i in face]
        u,v = [tuple(p[k]-a[k] for k in range(3)) for p in (b,c)]
        cross = (u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
        area = math.sqrt(sum(x*x for x in cross))/2
        if area <= 1e-12:
            raise ValueError('Zero-area surface triangle')
        minimum_area = min(minimum_area,area)
        for first,second in zip(ids,ids[1:]+ids[:1]):
            edges.setdefault(tuple(sorted((first,second))),[]).append((first,second))
    if not seen:
        raise ValueError('Empty surface')
    for uses in edges.values():
        if len(uses) != 2 or uses[0] != tuple(reversed(uses[1])):
            raise ValueError('Surface is not closed consistently oriented two-manifold')
    return {'triangles':len(seen),'edges':len(edges),
            'minimumTriangleArea':minimum_area,'boundaryEdges':0,
            'nonmanifoldEdges':0,'inconsistentOrientationEdges':0,
            'positionWeld':'exact coordinates only'}
