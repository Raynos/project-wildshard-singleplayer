"""Mapped-subset convex pouch study; preserves the frozen equal-count helper.

Builder supplies full reference samples, retained OLD IDs, and explicit candidate
positions in that same retained-ID order. All silhouette and volume comparisons
use the FULL reference. Standalone pouch only, before union/mouth cutting. This
module performs no Blender operations, color/weight assignment or visual scoring.
"""
import math

from convex_puffer_pouch import (checked_points, convex_hull, dot, length,
                                signed_volume, sub, unit, validate_convex_surface)


def retopologize_pouch_subset(reference_points, retained_old_ids, candidate_points,
                             protected_old_ids, directions, *, max_displacement,
                             silhouette_tolerance, max_volume_fraction=.02,
                             max_dihedral_degrees=80):
    """Return compact points/faces, bidirectional identity maps and a receipt.

    Protected IDs cannot be removed, moved or discarded by the hull. Other
    retained samples can become interior; oldToNew records None for every absent
    output sample. Vertex IDs always refer to the full original reference.
    """
    reference = checked_points(reference_points)
    candidate = checked_points(candidate_points)
    retained = list(retained_old_ids)
    protected = set(protected_old_ids)
    if len(retained) != len(candidate):
        raise ValueError('One retained old ID per candidate point required')
    if any(type(i) is not int or not 0 <= i < len(reference) for i in retained):
        raise ValueError('Invalid retained old ID')
    if len(set(retained)) != len(retained):
        raise ValueError('Duplicate retained old IDs')
    if any(type(i) is not int or not 0 <= i < len(reference) for i in protected):
        raise ValueError('Invalid protected old ID')
    if not protected.issubset(retained):
        raise ValueError('Protected anchor removed from retained set')
    if any(not math.isfinite(x) or x < 0 for x in (max_displacement, silhouette_tolerance, max_volume_fraction)):
        raise ValueError('Finite nonnegative tolerances required')
    distances = [length(sub(point, reference[old])) for old, point in zip(retained, candidate)]
    if max(distances) > max_displacement+1e-12:
        raise ValueError('Retained sample displacement bound exceeded')
    for old, point in zip(retained, candidate):
        if old in protected and point != reference[old]:
            raise ValueError('Protected anchor position changed')
    faces = convex_hull(candidate)
    used = sorted({i for face in faces for i in face})
    output_old_ids = [retained[i] for i in used]
    if not protected.issubset(output_old_ids):
        raise ValueError('Protected anchor discarded by convex hull')
    receipt = validate_convex_surface(candidate, faces, max_dihedral_degrees=max_dihedral_degrees)
    directions = [unit(d) for d in directions]
    if not directions:
        raise ValueError('Explicit silhouette support directions required')
    # Never replace reference with reference[retained]: that hides deletion loss.
    drifts = [abs(max(dot(p, d) for p in candidate)-max(dot(p, d) for p in reference)) for d in directions]
    maximum_drift = max(drifts)
    if maximum_drift > silhouette_tolerance+1e-12:
        raise ValueError('Full-reference sampled silhouette tolerance exceeded')
    reference_volume = signed_volume(reference, convex_hull(reference))
    volume_fraction = abs(receipt['signedVolume']/reference_volume-1)
    if volume_fraction > max_volume_fraction+1e-12:
        raise ValueError('Full-reference convex volume drift exceeded')
    remap = {old: new for new, old in enumerate(used)}
    old_to_new = [None]*len(reference)
    for new, old in enumerate(output_old_ids):
        old_to_new[old] = new
    receipt.update(status='mapped-subset structural study; visual acceptance pending',
                   referenceSampleCount=len(reference), retainedSampleCount=len(retained),
                   outputSampleCount=len(used), protectedAnchorCount=len(protected),
                   explicitlyRemovedOldIds=sorted(set(range(len(reference)))-set(retained)),
                   hullDiscardedOldIds=[retained[i] for i in range(len(candidate)) if i not in remap],
                   maximumRetainedSampleDisplacement=max(distances),
                   maximumSampledSilhouetteDrift=maximum_drift,
                   silhouetteDirectionCount=len(directions), referenceConvexVolume=reference_volume,
                   volumeFractionChange=volume_fraction,
                   comparisonBasis='Full original reference, including all explicitly removed samples',
                   limits={'maxDisplacement': max_displacement, 'silhouetteTolerance': silhouette_tolerance,
                           'maxVolumeFraction': max_volume_fraction, 'maxDihedralDegrees': max_dihedral_degrees},
                   caveat='Sampled convex envelope only; actual raster silhouette, post-union topology, colors and skinning remain unverified')
    return {'points': [candidate[i] for i in used],
            'faces': [tuple(remap[i] for i in face) for face in faces],
            'newToOld': output_old_ids, 'oldToNew': old_to_new, 'receipt': receipt}
