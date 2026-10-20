"""Read selected editable source; preserve exact influence groups, not invented collision hulls."""
from pathlib import Path
import hashlib
import json

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / 'complete-character-next'
source = json.loads((SOURCE / 'native-source.json').read_text())
parts = []
for part in source['parts']:
    influences = set()
    blended = 0
    vertices = len(part['positions']) // 3
    for vertex in range(vertices):
        active = [int(part['skinIndices'][vertex * 4 + slot]) for slot in range(4)
                  if part['skinWeights'][vertex * 4 + slot] > 0]
        influences.update(active)
        blended += len(active) > 1
    parts.append({'part': part['name'], 'vertices': vertices, 'blendedVertices': blended,
                  'influences': [source['bones'][index]['name'] for index in sorted(influences)]})
names = ['native-source.json', 'metadata.json', 'payload.bin', 'pearlglass-medusa-complete-character-next.glb']
report = {'source': 'complete-character-next', 'runtimeAdmission': False,
          'scope': 'Exact selected source references and influences; no generated collider or copied binary',
          'sourcePins': {name: {'bytes': (SOURCE / name).stat().st_size,
                               'sha256': hashlib.sha256((SOURCE / name).read_bytes()).hexdigest()} for name in names},
          'bones': len(source['bones']), 'parts': parts,
          'constraint': 'Ten mesh parts and multi-joint weighted ribbons cannot be equated to ten or eight faithful rigid hulls. This is not proof that every bounded redesign is impossible. The exact weighted oracle is supplied for testing a concrete future design.',
          'preservedStaticReview': {'preferred': 3.2925, 'retainedV2Fresh': 3.015, 'target': 4}}
(HERE / 'source-audit.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'bones': report['bones'], 'parts': len(parts), 'vertices': sum(p['vertices'] for p in parts),
                  'blendedVertices': sum(p['blendedVertices'] for p in parts), 'runtimeAdmission': False}))
