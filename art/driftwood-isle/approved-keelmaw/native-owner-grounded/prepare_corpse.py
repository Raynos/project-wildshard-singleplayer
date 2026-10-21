"""Derive unchanged-budget support hulls from this variant's exact rendered source.
Static limb descendants remain body-owned. Every animated bone owns its exact hull.
No padding, root translation, solver changes, or runtime admission.
"""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from scipy.spatial import ConvexHull

parser = argparse.ArgumentParser()
parser.add_argument('--model', required=True)
args = parser.parse_args()
folder = Path(args.model)
source_bytes = (folder / 'native-source.json').read_bytes()
source = json.loads(source_bytes)
metadata = json.loads((folder / 'metadata.json').read_text())
parts, audits = [], []
for name in ['body', 'neck1', 'head', 'jaw', 'tail1', 'tail2', 'tail3']:
    selected = [part for part in source['parts'] if part['name'] == name or
                name == 'body' and part['name'].startswith(('FL_', 'FR_', 'BL_', 'BR_'))]
    points = np.unique(np.array([value for part in selected for value in part['positions']]).reshape((-1, 3)), axis=0)
    hull = ConvexHull(points)
    support = points[hull.vertices]
    bind = np.array(next(bone['pos'] for bone in source['bones'] if bone['name'] == name))
    local = support - bind
    assert len(local) <= 128, (name, len(local))
    outside = float(np.max(points @ hull.equations[:, :3].T + hull.equations[:, 3]))
    assert outside < 1e-10, (name, outside)
    parts.append({'bone': name, 'points': local.tolist()})
    audits.append({'bone': name, 'hullPoints': len(local), 'sourceParts': [part['name'] for part in selected], 'maximumOutsideDistance': outside})
assert sum(len(part['points']) for part in parts) <= 512
metadata['bodies'][0]['dims']['rigidCorpse'] = {'parts': parts}
(folder / 'metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
(folder / 'corpse-hull-audit.json').write_text(json.dumps({
    'method': 'Exact mesh convex support. Seven animated/static ownership groups, no padding. Shape containment is not physical contact acceptance.',
    'nativeSourceSha256': hashlib.sha256(source_bytes).hexdigest(),
    'parts': audits, 'runtimeAcceptance': False, 'contactAcceptance': False,
}, indent=2) + '\n')
print(json.dumps(audits))
