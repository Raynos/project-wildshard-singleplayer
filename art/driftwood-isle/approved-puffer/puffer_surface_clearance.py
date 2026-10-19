"""Closed-surface containment and signed Euclidean clearance, independent of BVH normals."""
import math

BOUNDARY_TOLERANCE = 1e-6
WINDING_TOLERANCE = 1e-4


def classify_surface_point(point, vertices, triangles, nearest_distance):
    """Return a measured winding classification; reject ambiguous/open surfaces.

    BVH supplies only Euclidean nearest distance. Inside/outside comes from the
    complete oriented triangle surface, so a tie between adjacent nearest faces
    cannot change clearance. Absolute winding supports either global orientation.
    """
    if not math.isfinite(nearest_distance) or nearest_distance < 0:
        raise ValueError('Invalid nearest-surface distance')
    if nearest_distance <= BOUNDARY_TOLERANCE:
        return {'classification': 'boundary', 'winding': None,
                'signedEuclideanDistance': 0.0,
                'boundaryTolerance': BOUNDARY_TOLERANCE}
    total = 0.0
    for face in triangles:
        a, b, c = [tuple(vertices[i][k]-point[k] for k in range(3)) for i in face]
        lengths = [math.sqrt(sum(v*v for v in vector)) for vector in (a,b,c)]
        if min(lengths) <= BOUNDARY_TOLERANCE:
            raise ValueError('Nearest-distance query inconsistent with a surface vertex')
        det = (a[0]*(b[1]*c[2]-b[2]*c[1])
               - a[1]*(b[0]*c[2]-b[2]*c[0])
               + a[2]*(b[0]*c[1]-b[1]*c[0]))
        ab = sum(x*y for x,y in zip(a,b))
        bc = sum(x*y for x,y in zip(b,c))
        ca = sum(x*y for x,y in zip(c,a))
        denominator = lengths[0]*lengths[1]*lengths[2] + ab*lengths[2] + bc*lengths[0] + ca*lengths[1]
        total += 2*math.atan2(det, denominator)
    winding = total/(4*math.pi)
    if abs(abs(winding)-1) <= WINDING_TOLERANCE:
        kind, signed = 'inside', -nearest_distance
    elif abs(winding) <= WINDING_TOLERANCE:
        kind, signed = 'outside', nearest_distance
    else:
        raise ValueError(f'Ambiguous/nonclosed surface winding: {winding}')
    return {'classification': kind, 'winding': winding,
            'signedEuclideanDistance': signed,
            'boundaryTolerance': BOUNDARY_TOLERANCE}
