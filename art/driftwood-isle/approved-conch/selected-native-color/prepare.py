#!/usr/bin/env python3
"""Append authored paint without rewriting any admitted source channel."""
import copy
import hashlib
import json
from pathlib import Path
import zlib

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
BASE = HERE.parent / 'selected-native-normals'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def encode(data):
    return (json.dumps(data, indent=2, sort_keys=True) + '\n').encode()

def prepare():
    pins = json.loads((HERE / 'input-pins.json').read_bytes())
    for name, digest in pins.items():
        if sha((ROOT / name).read_bytes()) != digest:
            raise ValueError('Pinned input changed: ' + name)
    metadata = json.loads((BASE / 'native/metadata.json').read_bytes())
    original = zlib.decompress((BASE / 'native/payload.bin').read_bytes())
    if len(original) != metadata['bytes']:
        raise ValueError('Original payload size mismatch')
    binary = bytearray(original)
    candidate = copy.deepcopy(metadata)
    for body in candidate['bodies']:
        for part in body['hard']:
            attrs = part['row']['attrs']
            color = next(i for i, attr in enumerate(attrs) if attr[0] == 'color')
            if attrs[color] != ['color', 'f32', 3, False]:
                raise ValueError('Unexpected color encoding')
            start = part['offsets'][color]
            size = part['row']['count'] * 12
            part['offsets'].append(len(binary))
            attrs.append(['aAuthoredColour', 'f32', 3, False])
            binary.extend(original[start:start + size])
    if len(binary) - len(original) != 78840:
        raise ValueError('Unexpected authored channel size')
    payload = zlib.compress(binary, 9)
    candidate['bytes'] = len(binary)
    candidate['file'] = '/assets/driftwood-isle/conch-selected-color-' + sha(payload) + '.bin'
    graph = json.loads((ROOT / 'src/shards/driftwood-isle/data/lookGraphs.json').read_bytes())['looks']['driftwood-creature']
    graph['nodes']['paint'] = {'op': 'attribute', 'name': 'aAuthoredColour', 'type': 'vec3'}
    return {'metadata.json': encode(candidate), 'payload.bin': payload, 'graph.json': encode(graph)}

if __name__ == '__main__':
    files = prepare()
    for name in files:
        if (HERE / name).exists():
            raise ValueError('Preserve existing candidate: ' + name)
    for name, data in files.items():
        (HERE / name).write_bytes(data)
    receipt = {'schema': 'wildshard.conch.authored-color.v1', 'extraUncompressedBytes': 78840,
               'files': {name: {'sha256': sha(data), 'bytes': len(data)} for name, data in files.items()},
               'visualAcceptance': False, 'runtimeAcceptance': False, 'animationAcceptance': False,
               'note': 'One paint channel only. Native tint, toon, faceting and all old channels retained.'}
    (HERE / 'closure.json').write_bytes(encode(receipt))
    print(json.dumps(receipt, indent=2))
