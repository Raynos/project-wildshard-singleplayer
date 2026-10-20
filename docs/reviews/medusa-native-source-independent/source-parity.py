"""Independent, read-only editable-to-packed geometry comparison; no artifact rewrites."""
import hashlib
import json
from pathlib import Path
import struct
import zlib

source = Path('art/driftwood-isle/approved-pearlglass-medusa/complete-character-next')
editable = json.loads((source / 'native-source.json').read_text())
metadata = json.loads((source / 'metadata.json').read_text())
payload = zlib.decompress((source / 'payload.bin').read_bytes())
assert len(payload) == metadata['bytes']
body = metadata['bodies'][0]
assert body['bones'] == editable['bones']
assert len(body['hard']) == len(editable['parts']) == 10
names = {'position': 'positions', 'color': 'colorsLinear', 'skinIndex': 'skinIndices',
         'skinWeight': 'skinWeights', 'furLen': 'furLen', 'normal': 'normals'}
values = 0
for packed, original in zip(body['hard'], editable['parts'], strict=True):
    for offset, (name, dtype, width, normalized) in zip(packed['offsets'], packed['row']['attrs'], strict=True):
        assert not normalized
        expected = original[names[name]]
        assert len(expected) == packed['row']['count'] * width
        code = {'f32': 'f', 'u16': 'H'}[dtype]
        binary = struct.pack('<' + code * len(expected), *expected)
        assert payload[offset:offset + len(binary)] == binary, (original['name'], name)
        values += len(expected)
print(json.dumps({'allPackedAttributeValuesExactAfterDeclaredStorageConversion': values,
                  'bonesExact': len(body['bones']), 'partsExact': len(body['hard']),
                  'inflatedBytes': len(payload), 'packedSHA256': hashlib.sha256((source / 'payload.bin').read_bytes()).hexdigest()}, indent=2))
