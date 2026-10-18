"""Bounded V71 flank study, preserving inherited boundary concavity.

Explicit constrained layout, not a convex-hull claim. The authored alternating
axial offsets were fitted numerically to a 0.8 mm support-deficit allowance.
No optimization or third-party numerical dependency runs in Blender.
"""
import math
from convex_puffer_pouch import dot, sub, normal, signed_volume, silhouette_directions

# Rows 5/6, positive sectors 1/2/3; mirror exactly for the opposite flank.
AXIAL = (.0099244987079, -.0100466684185, .0084345527520,
         -.0044427535071, .0099999726419, -.0024105935926)
RADIAL = (.0026926472879, .0003206990384, -.0001373949897,
          .0027737022979, -.0000001391364, .0003297101453)
# Local IDs enumerate rows4..7, sectors0..4. All perimeter edges retained.
FACES = [(1,2,7),(1,7,6),(2,3,7),(3,8,7),(3,4,9),(3,9,8),
         (5,11,10),(6,7,11),(7,12,11),(7,8,13),(7,13,12),
         (8,9,13),(9,14,13),(10,11,15),(11,16,15),(11,12,17),
         (11,17,16),(12,13,17),(13,18,17),(13,14,19),(13,19,18),
         (1,6,0),(5,0,11),(6,11,0)]


def edge_uses(faces):
    result = {}
    for index, face in enumerate(faces):
        for a, b in zip(face, face[1:] + face[:1]):
            result.setdefault(tuple(sorted((a, b))), []).append(index)
    return result


def deficits(points, faces):
    return [max(dot(normal(points, face), sub(point, points[face[0]]))
                for face in faces) for point in points]


def maximum_concave_hinge(points, faces):
    result = 0.0
    for edge, uses in edge_uses(faces).items():
        if len(uses) != 2:
            continue
        for first, second in (uses, uses[::-1]):
            face, other = faces[first], faces[second]
            opposite = next(i for i in other if i not in edge)
            result = max(result, dot(normal(points, face),
                                    sub(points[opposite], points[face[0]])))
    return result


def remesh_flanks(points, faces, sections, section):
    reference = list(points)
    result = list(points)
    output = list(faces)
    receipts = []
    changed = set()
    for sign in (1, -1):
        ids = [row * 14 + (sign * sector) % 14
               for row in range(4, 8) for sector in range(5)]
        lookup = {old: new for new, old in enumerate(ids)}
        old_global = [face for face in faces if all(i in lookup for i in face)]
        old_local = [tuple(lookup[i] for i in face) for face in old_global]
        before = [reference[i] for i in ids]
        for k, (row, sector) in enumerate((r, s) for r in (5, 6) for s in (1, 2, 3)):
            y = sections[row][0] + AXIAL[k]
            w, z, h = section(y)
            theta = 2 * math.pi * sector / 14 + .035 * math.sin(4 * math.pi * sector / 14) * (1 if row % 2 else -1)
            ridge = .020 * max(0, math.cos(theta)) ** 2
            index = row * 14 + (sign * sector) % 14
            result[index] = (sign * (w + ridge * .35 + RADIAL[k]) * math.sin(theta),
                             y, z + (h + ridge + RADIAL[k]) * math.cos(theta))
            changed.add(index)
        after = [result[i] for i in ids]
        new_local = [face if sign > 0 else tuple(reversed(face)) for face in FACES]
        old_edges, new_edges = edge_uses(old_local), edge_uses(new_local)
        old_boundary = {edge for edge, uses in old_edges.items() if len(uses) == 1}
        new_boundary = {edge for edge, uses in new_edges.items() if len(uses) == 1}
        if old_boundary != new_boundary:
            raise ValueError('Constrained flank boundary changed')
        perimeter = {i for edge in old_boundary for i in edge}
        if any(before[i] != after[i] for i in perimeter):
            raise ValueError('Constrained flank perimeter position changed')
        if {i for face in new_local for i in face} != set(range(len(ids))):
            raise ValueError('Constrained flank discarded a sample')
        old_deficits, new_deficits = deficits(before, old_local), deficits(after, new_local)
        increase = max(a-b for a, b in zip(new_deficits, old_deficits))
        old_hinge = maximum_concave_hinge(before, old_local)
        new_hinge = maximum_concave_hinge(after, new_local)
        if increase > .001 or new_hinge > old_hinge + .001:
            raise ValueError('Flank introduces excess support deficit/concave hinge')
        # Parameterized triangles must cover the same simple rectangular domain.
        def area(face, coordinates):
            p = [(ids[i] % 14 if sign > 0 else (-ids[i]) % 14, coordinates[i][1]) for i in face]
            return ((p[1][0]-p[0][0])*(p[2][1]-p[0][1]) - (p[1][1]-p[0][1])*(p[2][0]-p[0][0])) / 2
        old_area = sum(abs(area(face, before)) for face in old_local)
        new_area = sum(abs(area(face, after)) for face in new_local)
        if abs(new_area-old_area) > 1e-9:
            raise ValueError('Flank parameter domain has overlap or missing area')
        expected_sign = math.copysign(1, area(old_local[0], before))
        if any(area(face, after)*expected_sign <= 1e-10 for face in new_local):
            raise ValueError('Flank parameter triangle inverted/degenerate')
        for face in new_local:
            normal(after, face)
        old_rails = {e for e, uses in old_edges.items() if len(uses) == 2 and abs(before[e[0]][1]-before[e[1]][1]) < 1e-9}
        new_rails = {e for e, uses in new_edges.items() if len(uses) == 2 and abs(after[e[0]][1]-after[e[1]][1]) < 1e-9}
        if new_rails:
            raise ValueError('Continuous equal-Y interior rail survives')
        old_set = set(old_global)
        output = [face for face in output if face not in old_set]
        output.extend(tuple(ids[i] for i in face) for face in new_local)
        receipts.append({'side': sign, 'indices': ids,
                         'before': before, 'after': after,
                         'boundaryEdgesExact': True, 'parameterArea': new_area,
                         'oldEqualYInteriorEdges': len(old_rails),
                         'newEqualYInteriorEdges': len(new_rails),
                         'removedOldConnectivityEdges': len(old_rails-set(new_edges)),
                         'maximumSupportDeficitIncrease': increase,
                         'oldMaximumConcaveHinge': old_hinge,
                         'newMaximumConcaveHinge': new_hinge})
    if any(result[i] != reference[i] for i in range(len(points)) if i not in changed):
        raise ValueError('Outside-patch position changed')
    old_volume, new_volume = signed_volume(reference, faces), signed_volume(result, output)
    if min(old_volume, new_volume) <= 0 or abs(new_volume/old_volume-1) > .01:
        raise ValueError('Flank volume change exceeds one percent')
    directions = silhouette_directions([(0,1,0),(1,0,0),(0,0,1),(3,4.63,1.41),(0,1,.82),(1,0,.82)],180)
    drift = max(abs(max(dot(p,d) for p in result)-max(dot(p,d) for p in reference)) for d in directions)
    extent = min(max(p[a] for p in reference)-min(p[a] for p in reference) for a in range(3))
    displacement = max(math.dist(a,b) for a,b in zip(result,reference))
    if displacement > .02 or drift > extent*.01:
        raise ValueError('Flank displacement/projected support exceeded scope')
    if any(len(uses) != 2 for uses in edge_uses(output).values()):
        raise ValueError('Flank replacement broke closed manifold')
    return result, output, {'status':'unaccepted boundary-constrained study; inherited concavity preserved, not globally convex',
                            'changedIndices':sorted(changed), 'patches':receipts,
                            'axialOffsets':AXIAL, 'radialOffsets':RADIAL,
                            'maximumSampleDisplacement':displacement,
                            'maximumSampledProjectedSupportDrift':drift,
                            'referenceMinimumCoreExtent':extent,
                            'oldSignedVolume':old_volume, 'newSignedVolume':new_volume,
                            'outsidePatchPositionsExact':True,
                            'featureGeometryChanged':False}
