"""Derive explicit rest map; write only this candidate's mapping."""
from pathlib import Path
import json
H=Path(__file__).resolve().parent
old=json.loads((H.parent/'complete-pass2-native/authored-mapping.json').read_text())
metrics=json.loads((H/'metrics-complete-integrated-next.json').read_text())
source=json.loads((H/'mantis-mesh-complete-integrated-next.json').read_text())
old['schema']='wildshard.mantis.complete-integrated-next.mapping.v1'
old['notes']=['Complete candidate-specific rigid rest map; no animation or contact acceptance.', '22 bones: 20 freshly generated static pivots plus authored neck and abdomen attachment centers.', 'Existing explicit part ownership retained for shared anatomical names; additional fourth tergite explicitly assigned to abdomen.']
for b in old['bones']:
 if b['staticLabel'] is not None:b['blenderPivot']=metrics['pivots'][b['staticLabel']]
 b['pos']=[b['blenderPivot'][0],b['blenderPivot'][2],-b['blenderPivot'][1]]
parts={p['name']:p for p in old['parts']}
parts['Abdominal tergite 3']=dict(name='Abdominal tergite 3',staticLabel='body',nativeJoint='abdomen',newlyMapped=True)
assert set(parts)=={p['name'] for p in source['parts']}
old['parts']=[parts[p['name']] for p in source['parts']]
(H/'authored-mapping.json').write_text(json.dumps(old,indent=2)+'\n')
