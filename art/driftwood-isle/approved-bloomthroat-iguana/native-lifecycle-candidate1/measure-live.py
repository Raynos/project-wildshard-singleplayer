"""Read-only source diagnosis. No collider or model is changed."""
import json
import math
from pathlib import Path

folder = Path('art/driftwood-isle/approved-bloomthroat-iguana')
source = json.loads((folder / 'complete-character-next/native-source.json').read_text())
construction = json.loads((folder / 'complete-character-next/construction.json').read_text())
offsets = {}
rows = []
for component in construction['components']:
    part = next(p for p in source['parts'] if p['name'] == component['part'])
    start = offsets.get(component['part'], 0)
    end = start + component['triangles'] * 9
    points = [part['positions'][i:i + 3] for i in range(start, end, 3)]
    offsets[component['part']] = end
    if component['part'] != 'body':
        continue
    distances = [(math.sqrt(x*x + (y-.78)**2 + max(0, abs(z+.2)-.64)**2),
                  math.sqrt(x*x + (y-1.51)**2 + (z-1.04)**2)) for x,y,z in points]
    outside_head = [body for body, head in distances if head > .574 + 1e-6]
    rows.append({'component': component['name'], 'corners': len(points),
                 'outsideBodyCapsule': sum(body > .623 + 1e-6 for body, head in distances),
                 'outsideBodyHeadUnion': sum(body > .623 + 1e-6 and head > .574 + 1e-6 for body, head in distances),
                 'maximumBodyExcess': max(body-.623 for body, head in distances),
                 'restOnlyComplementaryBodyRadius': max(outside_head, default=0)})
report = {'method': 'Native rest mesh, component triangle order, exact bone-centred Z capsule plus head sphere. Duplicate face corners counted. Rest only, not a fit or runtime gate.',
          'bodyAtRest': rows,
          'sourceBounds': {p['name']: [[min(p['positions'][a::3]), max(p['positions'][a::3])] for a in range(3)] for p in source['parts']},
          'defaultCorpseBox': {'halfExtents': [.55, .39, .64], 'localCenter': [0, .468, 0]},
          'rootLift': 0, 'colliderPadding': 0, 'geometryChanged': False, 'accepted': False}
(folder / 'native-lifecycle-candidate1/live-coverage.json').write_text(json.dumps(report, indent=2)+'\n')
