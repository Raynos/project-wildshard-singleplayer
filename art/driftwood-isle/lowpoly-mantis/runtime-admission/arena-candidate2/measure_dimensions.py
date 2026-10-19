"""Candidate-only hit/motor volumes from declared central anatomy. Never edits V7 geometry."""
import hashlib
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
PREP = HERE.parent / 'v7-rigid1'
PINS = {'mantis-v7-native.json': '6c47dd59acdc01993b84f70adf39a1c3f050088e6bbd781409514f85fda75bb0',
        'mesh-map.json': '9cba218d94a24a2a5025e50236057b568ac78ce062410f3ea44d1e1aada75985',
        'metadata.json': 'f6354fa3ca75a30fdddd428fd81152884e96a27a246107e98ffcc5801281a73a'}

def measured():
    inputs = {}
    for name, expected in PINS.items():
        data = (PREP / name).read_bytes()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError('Changed native input: ' + name)
        inputs[name] = json.loads(data)
    native, mapping, metadata = (inputs[name] for name in PINS)
    parts = {part['name']: part for part in native['parts']}
    bones = {bone['name']: bone['pos'] for bone in native['bones']}
    central = [row for row in mapping if row['name'] == 'Abdomen core' or row['name'].startswith('Abdominal tergite ')]
    face = [row for row in mapping if row['name'] == 'Volumetric pointed insect skull' or row['name'].startswith(
        ('Inset green compound eye ', 'Angled socket brow ', 'Tapered cheek splinter ', 'Compact mandible '))]
    if len(central) != 4 or len(face) != 9:
        raise ValueError('Unexpected selected anatomy')
    def vertices(rows):
        for row in rows:
            data = parts[row['joint']]['positions']
            for i in range(row['vertexStart'], row['vertexStart'] + row['vertexCount']):
                yield data[i * 3:i * 3 + 3]
    torso = [[p[i] - bones['body'][i] for i in range(3)] for p in vertices(central)]
    head = [[p[i] - bones['head'][i] for i in range(3)] for p in vertices(face)]
    raw = {'bodyRadius': max(math.hypot(p[0], p[1]) for p in torso),
           'bodyHalfLen': max(abs(p[2]) for p in torso), 'headRadius': max(math.sqrt(sum(x*x for x in p)) for p in head)}
    dims = metadata['bodies'][0]['dims']
    dims.update({name: math.ceil(value * 100) / 100 for name, value in raw.items()})
    dims['feet'] = [dims['feet'][i] for i in [0, 2, 1, 3]]
    receipt = {'schema': 'wildshard.mantis.central-anatomy-dimensions.v1', 'inputs': PINS,
        'bodyNodes': [row['name'] for row in central], 'headNodes': [row['name'] for row in face],
        'rawBounds': raw, 'rounding': 'ceil to 0.01 world unit, no rescale', 'dimensions': dims,
        'excludedFromHitVolumes': ['coxal bark shields', 'lateral tail splinters', 'crown splinters', 'antennae', 'leaf wings', 'walking and raptorial limbs'],
        'limitations': ['central torso and face approximation, not a full rendered hull', 'long rising neck is not independently hit-tested',
            'generic motor radius is min(bodyRadius, bodyHalfLen) clamped to [0.12,0.9]', 'animated hit envelope and wall/contact playtests remain unaccepted'],
        'colliderAcceptance': False, 'visualAcceptance': False}
    return metadata, dims, receipt

if __name__ == '__main__':
    import sys
    outputs = dict(zip(['metadata.json', 'dimensions.json', 'dimension-measurement.json'], measured()))
    for name, data in outputs.items():
        encoded = json.dumps(data, separators=(',', ':')) + '\n'
        if '--check' in sys.argv:
            if (HERE / name).read_text() != encoded:
                raise ValueError('Stale measured output: ' + name)
        else:
            with (HERE / name).open('x') as stream:
                stream.write(encoded)
