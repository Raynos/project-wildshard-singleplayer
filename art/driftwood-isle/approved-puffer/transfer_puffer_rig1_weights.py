"""Deterministic, build-only rig1 weights for an explicitly pinned native mesh.

The source's geometry, paint, topology and bones remain unchanged. Only the four
named fin root/transition regions receive the preserved rig1 weights. Matching
uses exact semantic coordinates and oriented triangle neighborhoods, never a
vertex index or nearest-neighbor guess. This does not admit a runtime candidate.
"""
import argparse
from collections import Counter
import copy
import hashlib
import json
from pathlib import Path
import re

from native_export import validate_native


ROOT = Path(__file__).resolve().parent
BASELINE_NAME = 'unaccepted-native-v57.json'
BASELINE_SHA256 = 'c3dc5595bce7180ed39b0c8156833afcdc6b4ac1000eab08078037cb5bb16187'
RIG1_NAME = 'unaccepted-v57-motion-rig1-native.json'
RIG1_SHA256 = '7d27737df2bd9b1c7b81fd8eff97fbf5fc4fa02f9eba85faeeacd646cc481dcb'
FIN_NAMES = ('finL', 'finR', 'rearL', 'rearR')


def encode(data):
    """Use the unchanged native export serialization, including field order."""
    return json.dumps(data, separators=(',', ':'), allow_nan=False).encode()


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def _pinned(raw, expected, label):
    if not isinstance(expected, str) or re.fullmatch(r'[a-f0-9]{64}', expected) is None or sha256(raw) != expected:
        raise ValueError(label + ' SHA-256 mismatch')
    data = json.loads(raw)
    validate_native(data)
    return data


def _points(part):
    return [tuple(part['positions'][i:i + 3])
            for i in range(0, len(part['positions']), 3)]


def _weights(part, index):
    start = index * 4
    return (tuple(part['skinIndices'][start:start + 4]),
            tuple(part['skinWeights'][start:start + 4]))


def _parts_by_name(data):
    parts = {part['name']: part for part in data['parts']}
    if len(parts) != len(data['parts']):
        raise ValueError('Duplicate semantic part name')
    return parts


def _rest_payload(data):
    """Everything except the two weight attributes must remain exact."""
    result = copy.deepcopy(data)
    for part in result['parts']:
        del part['skinIndices']
        del part['skinWeights']
    return result


def _oriented_triangle(points):
    # Permit cyclic vertex order and triangle reordering, but never a reversal.
    return min(tuple(points[i:] + points[:i]) for i in range(3))


def _protected_triangles(points, protected):
    return Counter(_oriented_triangle(points[i:i + 3])
                   for i in range(0, len(points), 3)
                   if any(point in protected for point in points[i:i + 3]))


def transfer_native_bytes(source_bytes, expected_source_sha256, candidate,
                          baseline_bytes=None, rig1_bytes=None):
    """Return new native bytes and a receipt; never modify input or files.

    Optional reference bytes are still checked against the immutable V57 pins.
    Caller-supplied source pins establish provenance, not selection/acceptance.
    """
    if not isinstance(candidate, str) or re.fullmatch(r'V[0-9]+', candidate) is None:
        raise ValueError('Explicit candidate identity must be V followed by digits')
    source = _pinned(source_bytes, expected_source_sha256, 'Candidate source')
    baseline = _pinned((ROOT / BASELINE_NAME).read_bytes()
                       if baseline_bytes is None else baseline_bytes,
                       BASELINE_SHA256, 'V57 baseline')
    rig1 = _pinned((ROOT / RIG1_NAME).read_bytes()
                   if rig1_bytes is None else rig1_bytes, RIG1_SHA256, 'V57 rig1')
    if source['bones'] != baseline['bones'] or rig1['bones'] != baseline['bones']:
        raise ValueError('Candidate bone hierarchy/order/absolute bind pivots changed')
    if _rest_payload(baseline) != _rest_payload(rig1):
        raise ValueError('Pinned rig1 reference changed its rest payload')
    baseline_parts = _parts_by_name(baseline)
    rig1_parts = _parts_by_name(rig1)
    source_parts = _parts_by_name(source)
    result = copy.deepcopy(source)
    result_parts = _parts_by_name(result)
    records = []
    for name in FIN_NAMES:
        label = 'Volumetric connected ' + name
        if label not in source_parts:
            raise ValueError('Missing semantic fin part: ' + label)
        prior, weighted = baseline_parts[label], rig1_parts[label]
        original, output = source_parts[label], result_parts[label]
        indices = {bone['name']: index for index, bone in enumerate(source['bones'])}
        pure_fin = ((indices[name], 0, 0, 0), (1., 0., 0., 0.))
        points = _points(original)
        if any(_weights(original, i) != pure_fin for i in range(len(points))):
            raise ValueError('Candidate fin must retain original pure-fin weights: ' + name)
        protected, expected_counts = {}, Counter()
        prior_points = _points(prior)
        for i, point in enumerate(prior_points):
            weights = _weights(weighted, i)
            if _weights(prior, i) == weights:
                continue
            if point in protected and protected[point] != weights:
                raise ValueError('Ambiguous reference coordinate weights: ' + name)
            protected[point] = weights
            expected_counts[point] += 1
        if len(protected) != 24 or sum(expected_counts.values()) != 138:
            raise ValueError('Unexpected pinned root/transition contract: ' + name)
        minimum_protected_y = min(point[1] for point in protected)
        if any(point[1] >= minimum_protected_y and point not in protected for point in points):
            raise ValueError('Unrecognized protected root/transition coordinate: ' + name)
        counts = Counter(point for point in points if point in protected)
        if counts != expected_counts:
            raise ValueError('Protected coordinate multiplicity mismatch: ' + name)
        if _protected_triangles(points, protected) != _protected_triangles(prior_points, protected):
            raise ValueError('Protected oriented triangle neighborhood mismatch: ' + name)
        changed = 0
        for i, point in enumerate(points):
            if point not in protected:
                continue
            ids, values = protected[point]
            output['skinIndices'][4 * i:4 * i + 4] = ids
            output['skinWeights'][4 * i:4 * i + 4] = values
            changed += 1
        records.append({'bone': name, 'part': label,
                        'protectedUniqueCoordinates': len(protected),
                        'changedTriangleVertices': changed,
                        'unchangedDistalTriangleVertices': len(points) - changed,
                        'protectedMinimumY': minimum_protected_y,
                        'protectedOrientedTriangles': sum(_protected_triangles(points, protected).values())})
    validate_native(result)
    source_rest = _rest_payload(source)
    if source_rest != _rest_payload(result):
        raise ValueError('Weight transfer changed the candidate rest payload')
    encoded = encode(result)
    if len(encoded) > 5_000_000:
        raise ValueError('Native JSON exceeds storage budget')
    receipt = {
        'schema': 'wildshard.puffer.rig1-transfer.v1', 'candidate': candidate,
        'sourceSha256': expected_source_sha256, 'nativeSha256': sha256(encoded),
        'referenceSourceSha256': BASELINE_SHA256, 'referenceRig1Sha256': RIG1_SHA256,
        'method': 'Exact named-fin root/transition coordinate weights; oriented triangle neighborhoods and multiplicities must match',
        'restPayloadSha256': sha256(encode(source_rest)),
        'restPayloadUnchanged': True, 'bonesExact': True,
        'normalizedWeights': True, 'fins': records,
        'colliderAcceptance': False, 'visualAcceptance': False, 'gaitAcceptance': False,
        'limitations': ['No runtime admission or candidate selection',
                       'No Blender reevaluation, posed deformation, grounding, rendering or gameplay proof',
                       'Changed distal geometry requires fresh weighted-envelope and actual motion review'],
    }
    return encoded, receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--candidate', required=True)
    parser.add_argument('--output', type=Path, required=True,
                        help='New directory only; existing outputs are never overwritten')
    args = parser.parse_args()
    native, receipt = transfer_native_bytes(args.source.read_bytes(), args.sha256, args.candidate)
    receipt['transferScriptSha256'] = sha256(Path(__file__).read_bytes())
    # Validate fully before creating anything. A partial write remains available
    # for diagnosis; reruns must choose a new directory rather than replace it.
    args.output.mkdir(parents=True, exist_ok=False)
    for filename, raw in [('native.json', native),
                          ('equivalence.json', (json.dumps(receipt, indent=2) + '\n').encode())]:
        with (args.output / filename).open('xb') as handle:
            handle.write(raw)
    print(json.dumps({'candidate': args.candidate, 'sourceSha256': args.sha256,
                      'nativeSha256': receipt['nativeSha256'],
                      'restPayloadUnchanged': True, 'visualAcceptance': False}))


if __name__ == '__main__':
    main()
