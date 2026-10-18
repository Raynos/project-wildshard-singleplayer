"""Measure conservative V23 preview inputs, never approved gameplay tuning.

No Blender, public assets, runtime catalogue or other enemy is touched. Writes
only the two explicitly named, previously absent output files beside this script.
"""
import hashlib
import json
import math
from pathlib import Path
from native_export import validate_native

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'unaccepted-native-v23.json'
EXPECTED = '18e8847e87e9e6d9546000572e1775cced8b20b78c0317e2a0599b5fb3a4fd68'


def points(parts):
    return [tuple(part['positions'][i:i+3]) for part in parts
            for i in range(0, len(part['positions']), 3)]


def bounds(vertices):
    return {'min': [min(p[i] for p in vertices) for i in range(3)],
            'max': [max(p[i] for p in vertices) for i in range(3)]}


def measure(data):
    validate_native(data)
    bones = {row['name']: row for row in data['bones']}
    body, head = bones['body']['pos'], bones['head']['pos']
    hull_parts = [part for part in data['parts'] if part['name'] == 'Closed pear hull with continuous cheek and pouch']
    if len(hull_parts) != 1:
        raise ValueError('Expected the preserved V23 closed hull')
    hull = points(hull_parts)
    eyes = points([part for part in data['parts'] if part['name'].startswith(('Recessed amber eye ', 'Recessed black pupil ', 'Eye highlight '))])
    if not eyes:
        raise ValueError('Missing V23 eye geometry')
    limbs = {name: points([part for part in data['parts'] if part['name'] == 'Broad connected ' + name
                          or part['name'].startswith(name + ' cream toe ')])
             for name in ('finL', 'finR', 'rearL', 'rearR')}
    if any(not vertices for vertices in limbs.values()):
        raise ValueError('Missing V23 fin/toe geometry')
    # A symmetric Z capsule about the exported body pivot. Half the measured
    # maximum longitudinal reach chooses the segment; the radius is then the
    # exact maximum vertex distance to that segment, plus one millimetre.
    # This encloses all rest-hull triangles because a capsule is convex.
    half_len = max(abs(p[2] - body[2]) for p in hull) / 2
    distance = lambda p: math.sqrt((p[0] - body[0])**2 + (p[1] - body[1])**2
                                  + max(0, abs(p[2] - body[2]) - half_len)**2)
    radius = max(map(distance, hull)) + .001
    limb_bounds = {name: bounds(vertices) for name, vertices in limbs.items()}
    all_bounds = bounds(points(data['parts']))
    dims = {'bodyY': body[1], 'bodyHalfLen': half_len, 'bodyRadius': radius,
            'headRadius': max(math.dist(p, head) for p in eyes) + .001,
            'legLen': body[1] - min(p[1] for vertices in limbs.values() for p in vertices),
            'feet': [[(b['min'][axis] + b['max'][axis])/2 for axis in (0, 2)] for b in limb_bounds.values()],
            'halfWidth': max(abs(all_bounds['min'][0]), abs(all_bounds['max'][0]))}
    receipt = {'schema': 'wildshard.puffer.preview-dimensions.v1', 'candidate': 'V23 UNACCEPTED WIP',
               'sourceSha256': EXPECTED, 'colliderAcceptance': False, 'visualAcceptance': False,
               'scope': 'Conservative rest-geometry inputs for local actual-engine diagnostics only',
               'method': {'bodyY': 'Actual body absolute bind Y',
                          'bodyHalfLen': 'Half of maximum absolute hull Z offset from body pivot',
                          'bodyRadius': 'Maximum actual hull-vertex distance to symmetric body Z segment plus 0.001 m',
                          'headRadius': 'Maximum actual eye/pupil/highlight vertex distance from head pivot plus 0.001 m; not an anatomical head fit',
                          'legLen': 'Body pivot Y minus lowest fin/toe vertex Y',
                          'feet': 'Fin/toe AABB X/Z centres, ordered finL, finR, rearL, rearR; not terrain-tested contact points',
                          'halfWidth': 'Maximum absolute X of all actual parts'},
               'bounds': {'hull': bounds(hull), 'eyes': bounds(eyes), 'limbs': limb_bounds, 'all': all_bounds},
               'restHullOutsideCapsule': sum(distance(p) > radius for p in hull),
               'limitations': ['Rest only; 1.05/1.10 inflation containment and collider response untested',
                              'Conservative capsule includes empty space and may feel oversized',
                              'Eye sphere is not a full head hit-volume design',
                              'No visual, fight, terrain, balance or phone acceptance'], 'dimensions': dims}
    return dims, receipt


if __name__ == '__main__':
    raw = SOURCE.read_bytes()
    if hashlib.sha256(raw).hexdigest() != EXPECTED:
        raise ValueError('Preserved V23 source hash changed')
    dims, receipt = measure(json.loads(raw))
    outputs = {'unaccepted-native-v23-preview-dimensions.json': dims,
               'native-v23-preview-measurements.json': receipt}
    if any((ROOT / name).exists() for name in outputs):
        raise FileExistsError('Refuse to overwrite existing measurement outputs')
    for name, value in outputs.items():
        with (ROOT / name).open('x') as handle:
            handle.write(json.dumps(value, indent=2) + '\n')
    print(json.dumps({'dimensions': dims, 'colliderAcceptance': False}))
