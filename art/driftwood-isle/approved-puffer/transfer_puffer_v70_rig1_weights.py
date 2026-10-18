"""V70-only transformed-reference rig1 transfer; no runtime admission.

The immutable source pin admits precisely the reviewed V70 geometry. The V57
transfer remains unchanged. Explicit Float32 cap mapping and the single tail
pivot change form a new reference, against which semantic matching stays exact.
"""
import argparse
from collections import Counter
import copy
import json
import math
from pathlib import Path
import struct

from native_export import validate_native
from measure_native_preview import measure
from transfer_puffer_rig1_weights import (
    BASELINE_NAME, BASELINE_SHA256, RIG1_NAME, RIG1_SHA256, FIN_NAMES,
    _parts_by_name, _pinned, _points, _protected_triangles, _rest_payload,
    _weights, encode, sha256,
)


ROOT = Path(__file__).resolve().parent
SOURCE_SHA256 = '3d0606971754f7788e899fe31214748fd38f43b38b363f2d2b291be588de48dc'
BUILDER_SHA256 = '5a0be4072b3d0346229b09e964727944c2e4168f4a1634bd02220461f086c731'
COMPRESSION_RECEIPT_SHA256 = 'bfb97872a8fea75863056db29a05a2c45dd53f4a1a118279043d5f83b96166e0'
PHASE_LEG_LEN = .24 / (2 * math.sin(.36))


def _f32(value):
    return struct.unpack('<f', struct.pack('<f', value))[0]


def _transformed_reference(data):
    reference = copy.deepcopy(data)
    next(bone for bone in reference['bones'] if bone['name'] == 'tail')['pos'][2] = _f32(-.70 + .1825)
    records = []
    for name in FIN_NAMES:
        part = _parts_by_name(reference)['Volumetric connected ' + name]
        points = _points(part)
        root_y = max(point[1] for point in points)
        changes = {}
        for i, (x, y, z) in enumerate(points):
            if y != root_y:
                continue
            mapped_z = _f32(.10 + .75 * (z - .10)) if z < .10 else z
            part['positions'][3 * i + 2] = mapped_z
            changes[(x, y, z)] = (x, y, mapped_z)
        if len(changes) != 12:
            raise ValueError('V70 expected twelve semantic root-cap coordinates')
        records.append({'bone': name, 'rootCoordinates': 12,
                        'changedCoordinates': sum(before != after for before, after in changes.items()),
                        'mapping': [{'from': before, 'to': after} for before, after in sorted(changes.items())]})
    return reference, records


def transfer_v70_native_bytes(source_bytes):
    source = _pinned(source_bytes, SOURCE_SHA256, 'V70 source')
    baseline = _pinned((ROOT / BASELINE_NAME).read_bytes(), BASELINE_SHA256, 'V57 baseline')
    rig1 = _pinned((ROOT / RIG1_NAME).read_bytes(), RIG1_SHA256, 'V57 rig1')
    expected, cap_map = _transformed_reference(baseline)
    weighted, second_map = _transformed_reference(rig1)
    if cap_map != second_map or _rest_payload(expected) != _rest_payload(weighted):
        raise ValueError('Transformed reference rest equivalence mismatch')
    if source['bones'] != expected['bones']:
        raise ValueError('V70 exact expected bone hierarchy/order/pivots mismatch')
    result = copy.deepcopy(source)
    outputs = _parts_by_name(result)
    sources = _parts_by_name(source)
    references = _parts_by_name(expected)
    weight_references = _parts_by_name(weighted)
    indices = {bone['name']: i for i, bone in enumerate(source['bones'])}
    records = []
    for name in FIN_NAMES:
        label = 'Volumetric connected ' + name
        original, output = sources[label], outputs[label]
        prior, reference = references[label], weight_references[label]
        points, prior_points = _points(original), _points(prior)
        pure_fin = ((indices[name], 0, 0, 0), (1., 0., 0., 0.))
        if any(_weights(original, i) != pure_fin for i in range(len(points))):
            raise ValueError('V70 source must have original pure-fin weights')
        protected, counts = {}, Counter()
        for i, point in enumerate(prior_points):
            if _weights(prior, i) == _weights(reference, i):
                continue
            value = _weights(reference, i)
            if point in protected and protected[point] != value:
                raise ValueError('Ambiguous transformed-reference weight')
            protected[point] = value
            counts[point] += 1
        if len(protected) != 24 or sum(counts.values()) != 138:
            raise ValueError('V70 transformed-reference contract changed')
        minimum_y = min(point[1] for point in protected)
        if any(point[1] >= minimum_y and point not in protected for point in points):
            raise ValueError('V70 protected coordinate mismatch')
        if Counter(point for point in points if point in protected) != counts:
            raise ValueError('V70 protected coordinate multiplicity mismatch')
        if _protected_triangles(points, protected) != _protected_triangles(prior_points, protected):
            raise ValueError('V70 protected oriented triangle neighborhood mismatch')
        for i, point in enumerate(points):
            if point in protected:
                ids, values = protected[point]
                output['skinIndices'][4 * i:4 * i + 4] = ids
                output['skinWeights'][4 * i:4 * i + 4] = values
        records.append({'bone': name, 'protectedCoordinates': len(protected),
                        'changedTriangleVertices': sum(counts.values()),
                        'distalTriangleVerticesPreserved': len(points) - sum(counts.values())})
    validate_native(result)
    if _rest_payload(result) != _rest_payload(source):
        raise ValueError('V70 geometry, paint, topology, metadata or bones changed')
    native = encode(result)
    if len(native) > 5_000_000:
        raise ValueError('V70 native exceeds source JSON budget')
    receipt = {'schema': 'wildshard.puffer.rig1-transfer.v1', 'candidate': 'V70',
               'sourceSha256': SOURCE_SHA256, 'nativeSha256': sha256(native),
               'builderSha256': BUILDER_SHA256, 'compressionReceiptSha256': COMPRESSION_RECEIPT_SHA256,
               'referenceSourceSha256': BASELINE_SHA256, 'referenceRig1Sha256': RIG1_SHA256,
               'referenceTransform': 'Root-cap game Z below .10 maps to Float32(.10 + .75 * (Z - .10)); all lower stations exact',
               'tailBindGameZ': _f32(-.70 + .1825), 'allOtherBindValuesExact': True,
               'capCoordinateMap': cap_map, 'fins': records,
               'restPayloadSha256': sha256(encode(_rest_payload(source))),
               'restPayloadUnchanged': True, 'normalizedWeights': True,
               'colliderAcceptance': False, 'visualAcceptance': False, 'gaitAcceptance': False,
               'limitations': ['V70-only exact-source profile; no generic transformed-rig permission',
                              'No posed-envelope, actual renderer, terrain or gameplay proof']}
    return native, receipt


def preview_measurements(native):
    measured_dims, measured = measure(json.loads(native), weighted=True)
    measured['candidate'] = 'V70 rig1 UNACCEPTED WIP'
    measured['sourceSha256'] = sha256(native)
    raw_measured_dims = (json.dumps(measured_dims, indent=2) + '\n').encode()
    measured['dimensionsSha256'] = sha256(raw_measured_dims)
    calibrated_dims = {**measured_dims, 'legLen': PHASE_LEG_LEN}
    calibrated = copy.deepcopy(measured)
    calibrated['candidate'] = 'V70 rig1 gait5 UNACCEPTED WIP'
    calibrated['dimensions'] = calibrated_dims
    calibrated['measuredDimensions'] = measured_dims
    calibrated['gaitCalibration'] = {'measuredLegLen': measured_dims['legLen'], 'phaseLegLen': PHASE_LEG_LEN,
        'method': 'Existing walk-phase calibration: .24m stroke / (2*sin(.36)); all other freshly measured dimensions preserved',
        'stance': .62, 'stroke': .24, 'isolatedTrial': True}
    calibrated['method']['legLen'] = 'Explicit gait phase calibration; original geometric value retained in measuredDimensions'
    raw_calibrated_dims = (json.dumps(calibrated_dims, indent=2) + '\n').encode()
    calibrated['dimensionsSha256'] = sha256(raw_calibrated_dims)
    return {'measured-dimensions.json': raw_measured_dims,
            'measured-receipt.json': (json.dumps(measured, indent=2) + '\n').encode(),
            'gait5-dimensions.json': raw_calibrated_dims,
            'gait5-measurements.json': (json.dumps(calibrated, indent=2) + '\n').encode()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    native, receipt = transfer_v70_native_bytes(args.source.read_bytes())
    receipt['transferScriptSha256'] = sha256(Path(__file__).read_bytes())
    receipt['semanticHelperSha256'] = sha256((ROOT / 'transfer_puffer_rig1_weights.py').read_bytes())
    receipt['measurementScriptSha256'] = sha256((ROOT / 'measure_native_preview.py').read_bytes())
    files = {'native.json': native, 'equivalence.json': (json.dumps(receipt, indent=2) + '\n').encode(),
             **preview_measurements(native)}
    args.output.mkdir(parents=True, exist_ok=False)
    for name, raw in files.items():
        with (args.output / name).open('xb') as handle:
            handle.write(raw)
    print(json.dumps({name: sha256(raw) for name, raw in files.items()}))


if __name__ == '__main__':
    main()
