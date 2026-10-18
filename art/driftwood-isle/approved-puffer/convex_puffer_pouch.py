"""Pure convex-pouch topology preparation; no Blender or runtime dependencies.

Use only on the standalone convex pouch BEFORE union and mouth cutting. A hull
of the whole creature would erase intentional concavities. Retopology accepts
explicit proposed interior positions, pins designated anchors, constructs an
outward hull, and measures sampled silhouette support against the reference.
No call here edits a scene, assigns colors/weights, or establishes visual quality.
"""
import math


def sub(a, b):
    return tuple(x-y for x, y in zip(a, b))


def dot(a, b):
    return sum(x*y for x, y in zip(a, b))


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def length(a):
    return math.sqrt(dot(a, a))


def unit(a):
    size = length(a)
    if size <= 1e-14:
        raise ValueError('Zero direction or degenerate plane')
    return tuple(x/size for x in a)


def checked_points(points):
    result = [tuple(map(float, p)) for p in points]
    if len(result) < 4 or any(len(p) != 3 or not all(math.isfinite(x) for x in p) for p in result):
        raise ValueError('At least four finite XYZ points required')
    return result


def normal(points, face):
    a, b, c = (points[i] for i in face)
    return unit(cross(sub(b, a), sub(c, a)))


def signed_volume(points, faces):
    return sum(dot(points[a], cross(points[b], points[c]))/6 for a, b, c in faces)


def convex_hull(points, epsilon=1e-8):
    """Deterministic incremental 3D hull, returning original point indices.

    Coplanar/interior samples may disappear. Required anchor vertices are checked
    separately. Intended for tens/hundreds of pouch samples, not large meshes.
    """
    points = checked_points(points)
    if not math.isfinite(epsilon) or epsilon <= 0:
        raise ValueError('Positive finite epsilon required')
    a = min(range(len(points)), key=lambda i: points[i])
    b = max(range(len(points)), key=lambda i: length(sub(points[i], points[a])))
    axis = sub(points[b], points[a])
    c = max(range(len(points)), key=lambda i: length(cross(axis, sub(points[i], points[a]))))
    n = normal(points, (a, b, c))
    d = max(range(len(points)), key=lambda i: abs(dot(n, sub(points[i], points[a]))))
    if abs(dot(n, sub(points[d], points[a]))) <= epsilon:
        raise ValueError('Pouch samples are coplanar')
    seed = {a, b, c, d}
    inside = tuple(sum(points[i][j] for i in seed)/4 for j in range(3))

    def outward(face):
        if dot(normal(points, face), sub(inside, points[face[0]])) > 0:
            return (face[0], face[2], face[1])
        return face

    faces = [outward(f) for f in ((a, b, c), (a, d, b), (a, c, d), (b, d, c))]
    for index, point in enumerate(points):
        if index in seed:
            continue
        visible = [f for f in faces if dot(normal(points, f), sub(point, points[f[0]])) > epsilon]
        if not visible:
            continue
        edges = {}
        for face in visible:
            for x, y in zip(face, face[1:]+face[:1]):
                key = tuple(sorted((x, y)))
                edges.setdefault(key, []).append((x, y))
        horizon = [uses[0] for uses in edges.values() if len(uses) == 1]
        faces = [f for f in faces if f not in visible]
        faces.extend(outward((x, y, index)) for x, y in horizon)
    validate_convex_surface(points, faces, epsilon=epsilon*4, max_dihedral_degrees=180)
    return faces


def validate_convex_surface(points, faces, epsilon=1e-7, max_dihedral_degrees=90):
    """Reject inward planes, concave hinges, winding errors and open meshes.

    Dihedral is the angle between outward face normals (flat=0). The caller
    chooses its engineering bound; a passing number is not a visual score.
    """
    points = checked_points(points)
    if not 0 < max_dihedral_degrees <= 180 or not math.isfinite(epsilon) or epsilon <= 0:
        raise ValueError('Invalid validation thresholds')
    edges, normals = {}, []
    for index, face in enumerate(faces):
        if len(face) != 3 or len(set(face)) != 3 or any(not isinstance(i, int) or not 0 <= i < len(points) for i in face):
            raise ValueError('Invalid triangle')
        n = normal(points, face)
        normals.append(n)
        if max(dot(n, sub(p, points[face[0]])) for p in points) > epsilon:
            raise ValueError('Outward support-plane violation: concave or inward surface')
        for x, y in zip(face, face[1:]+face[:1]):
            edges.setdefault(tuple(sorted((x, y))), []).append((index, x, y))
    maximum = 0.0
    for uses in edges.values():
        if len(uses) != 2 or uses[0][1:] != tuple(reversed(uses[1][1:])):
            raise ValueError('Mesh is not an oriented closed two-manifold')
        angle = math.degrees(math.acos(max(-1, min(1, dot(normals[uses[0][0]], normals[uses[1][0]])))))
        maximum = max(maximum, angle)
    volume = signed_volume(points, faces)
    if volume <= epsilon**3:
        raise ValueError('Nonpositive or degenerate volume')
    if maximum > max_dihedral_degrees+1e-8:
        raise ValueError('Dihedral bound exceeded')
    return {'signedVolume': volume, 'maximumDihedralDegrees': maximum,
            'triangles': len(faces), 'verticesUsed': len({i for f in faces for i in f}),
            'supportPlaneTolerance': epsilon}


def pouch_point(latitude, angle):
    """Original analytic pre-stance pouch envelope, in Blender XYZ."""
    radius = math.cos(latitude)
    z = .56+.48*math.sin(latitude)
    if z < .34:
        z = .17+(z-.08)*.66
    return (.58*radius*(1+.025*math.sin(latitude))*math.sin(angle),
            .44+.49*radius*math.cos(angle), z)


def controlled_samples(parameters, latitude_offsets, angle_offsets, protected_indices,
                       max_latitude_offset=.08, max_angle_offset=.05):
    """Explicit authored offsets, never random displacement or automatic smoothing.

    Input parameters are (latitude, angle). Preserve extremal/face anchors by
    index; geometric envelope/anchor checks still run in retopologize_pouch.
    """
    count = len(parameters)
    if len(latitude_offsets) != count or len(angle_offsets) != count:
        raise ValueError('Offset counts differ')
    protected = set(protected_indices)
    if any(not isinstance(i, int) or not 0 <= i < count for i in protected):
        raise ValueError('Invalid protected index')
    result = []
    for i, ((lat, angle), dl, da) in enumerate(zip(parameters, latitude_offsets, angle_offsets)):
        if not all(math.isfinite(x) for x in (lat, angle, dl, da)):
            raise ValueError('Nonfinite sampling parameter')
        if abs(dl) > max_latitude_offset or abs(da) > max_angle_offset:
            raise ValueError('Authored sample offset exceeds bound')
        if i in protected and (dl != 0 or da != 0):
            raise ValueError('Protected anchor parameter changed')
        if not -math.pi/2 < lat+dl < math.pi/2:
            raise ValueError('Latitude outside pouch envelope')
        result.append(pouch_point(lat+dl, angle+da))
    return result


def silhouette_directions(camera_directions, samples_per_view=72):
    """Sample support directions around each orthographic image plane.

    This bounds sampled convex silhouettes, not exact raster masks. Use the same
    fixed cameras for reference/candidate, and inspect actual renders afterward.
    """
    if samples_per_view < 8:
        raise ValueError('At least eight directions per view required')
    result = []
    for direction in camera_directions:
        facing = unit(direction)
        axis = (0, 0, 1) if abs(facing[2]) < .99 else (0, 1, 0)
        right = unit(cross(facing, axis))
        up = unit(cross(right, facing))
        for k in range(samples_per_view):
            angle = k*2*math.pi/samples_per_view
            result.append(tuple(math.cos(angle)*x+math.sin(angle)*y for x, y in zip(right, up)))
    return result


def retopologize_pouch(reference_points, candidate_points, protected_indices, directions,
                      *, max_displacement, silhouette_tolerance, max_volume_fraction=.02,
                      max_dihedral_degrees=80):
    """Return new point/triangle arrays and measured structural receipt, or fail.

    Reference volume is its convex envelope, not the post-Boolean creature.
    Anchor vertices must survive the hull; an internal/concave anchor causes a
    refusal rather than silent omission. Colors and skin weights are deliberately
    excluded: the builder must assign final linear colors and belly weights.
    """
    reference = checked_points(reference_points)
    candidate = checked_points(candidate_points)
    if len(reference) != len(candidate):
        raise ValueError('Reference/candidate point identities must correspond')
    if any(not math.isfinite(x) or x < 0 for x in (max_displacement, silhouette_tolerance, max_volume_fraction)):
        raise ValueError('Finite nonnegative tolerances required')
    protected = set(protected_indices)
    if any(not isinstance(i, int) or not 0 <= i < len(reference) for i in protected):
        raise ValueError('Invalid protected index')
    distances = [length(sub(a, b)) for a, b in zip(reference, candidate)]
    if max(distances) > max_displacement+1e-12:
        raise ValueError('Interior displacement bound exceeded')
    if any(candidate[i] != reference[i] for i in protected):
        raise ValueError('Protected anchor position changed')
    faces = convex_hull(candidate)
    used = {i for f in faces for i in f}
    if not protected.issubset(used):
        raise ValueError('Protected anchor removed from convex surface')
    receipt = validate_convex_surface(candidate, faces, max_dihedral_degrees=max_dihedral_degrees)
    directions = [unit(d) for d in directions]
    if not directions:
        raise ValueError('Explicit silhouette support directions required')
    drift = [abs(max(dot(p, d) for p in candidate)-max(dot(p, d) for p in reference)) for d in directions]
    if max(drift) > silhouette_tolerance+1e-12:
        raise ValueError('Sampled silhouette tolerance exceeded')
    reference_faces = convex_hull(reference)
    reference_volume = signed_volume(reference, reference_faces)
    volume_fraction = abs(receipt['signedVolume']/reference_volume-1)
    if volume_fraction > max_volume_fraction+1e-12:
        raise ValueError('Convex envelope volume drift exceeded')
    receipt.update(status='structural preparation only; visual acceptance pending',
                   maximumSampleDisplacement=max(distances), maximumSampledSilhouetteDrift=max(drift),
                   silhouetteDirectionCount=len(directions), protectedAnchorCount=len(protected),
                   referenceConvexVolume=reference_volume, volumeFractionChange=volume_fraction,
                   caveat='Sampled convex support bounds do not certify exact raster silhouette or post-union topology')
    source_indices = sorted(used)
    remap = {old: new for new, old in enumerate(source_indices)}
    return {'points': [candidate[i] for i in source_indices],
            'faces': [tuple(remap[i] for i in face) for face in faces],
            'sourceIndices': source_indices, 'receipt': receipt}
