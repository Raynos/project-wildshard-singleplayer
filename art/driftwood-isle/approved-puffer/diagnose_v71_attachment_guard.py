"""Read-only exception receipt for the exact frozen V71 builder.

Run with the same builder arguments. This never suppresses its failing guard or
continues to export/render; it records the failing nearest-hull query then
raises the original exception. Geometry and builder source remain unchanged.
"""
import hashlib
import json
from pathlib import Path

source = Path('art/driftwood-isle/approved-puffer/build_puffer_lowpoly_v71_from_v9.py')
if hashlib.sha256(source.read_bytes()).hexdigest() != '653f2be77e3cd2302f7cbd4735e6d957ec97a722edfdf155b2dc659ffc0927ec':
    raise RuntimeError('Diagnostic requires exact frozen V71 source')
namespace = {'__file__': str(source.resolve()), '__name__': '__main__'}
try:
    exec(compile(source.read_text(), str(source), 'exec'), namespace)
except Exception as error:
    def hit(value):
        if value is None:
            return None
        return {'location': list(value[0]) if value[0] is not None else None,
                'normal': list(value[1]) if value[1] is not None else None,
                'face': value[2], 'distance': value[3]}
    all_attachments = []
    if 'base_bvh' in namespace and 'current_bvh' in namespace:
        for ob, joint in namespace.get('parts', []):
            count = 12 if ob.name.startswith('Volumetric connected ') else 4 if ob.name.startswith('Cream crown spine ') else 0
            if not count:
                continue
            samples = []
            for vertex in list(ob.data.vertices)[:count]:
                query = ob.matrix_world @ vertex.co
                before = namespace['base_bvh'].find_nearest(query)
                after = namespace['current_bvh'].find_nearest(query)
                samples.append({'vertex': vertex.index, 'query': list(query),
                                'before': hit(before), 'after': hit(after),
                                'signedBefore': (query-before[0]).dot(before[1]),
                                'signedAfter': (query-after[0]).dot(after[1])})
            all_attachments.append({'object': ob.name, 'joint': joint, 'samples': samples,
                                    'minimumBurialBefore': -max(row['signedBefore'] for row in samples),
                                    'minimumBurialAfter': -max(row['signedAfter'] for row in samples)})
    receipt = {
        'status': 'original structural guard failed; no continuation',
        'error': str(error),
        'object': getattr(namespace.get('ob'), 'name', None),
        'vertex': getattr(namespace.get('vertex'), 'index', None),
        'query': list(namespace['query']) if 'query' in namespace else None,
        'signedBefore': namespace.get('signed_before'),
        'signedAfter': namespace.get('signed_after'),
        'hitBefore': hit(namespace.get('before')),
        'hitAfter': hit(namespace.get('after')),
        'allAttachmentsReadOnly': all_attachments,
        'completedAttachments': namespace.get('attachment_receipts', []),
    }
    output = namespace.get('out', Path('tmp/approved-puffer'))
    (output / 'attachment-failure-diagnostic.json').write_text(json.dumps(receipt, indent=2) + '\n')
    raise
