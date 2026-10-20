"""Keep exact native22 rig and source ownership; explicitly map ten new shells."""
from pathlib import Path
import json,hashlib
H=Path(__file__).resolve().parent;R=H.parents[3];B=H.parent/'complete-integrated-next'
source=json.loads((H/'mantis-mesh-complete-sculpted-anatomy.json').read_text())
old=json.loads((B/'authored-mapping.json').read_text())
metrics=json.loads((H/'metrics-complete-sculpted-anatomy.json').read_text())
assert metrics['pivots']==json.loads((B/'metrics-complete-integrated-next.json').read_text())['pivots']
old['schema']='wildshard.mantis.complete-sculpted-anatomy.mapping.v1'
old['notes']=['Exact retained native22 bones, pivots, hierarchy and existing ownership preserved.', 'Four sternal plates follow neck; two inset orbits follow head; two lower leaves and petioles follow existing lower wing joints. No new bone or runtime contract.']
parts={p['name']:p for p in old['parts']}
for p in source['parts']:
 if p['name'] in parts:continue
 joint='neck' if p['name'].startswith('Layered sternal bark') else p['joint']
 parts[p['name']]=dict(name=p['name'],staticLabel=p['joint'],nativeJoint=joint,newlyMapped=True)
assert set(parts)=={p['name'] for p in source['parts']}
old['parts']=[parts[p['name']] for p in source['parts']]
(H/'authored-mapping.json').write_text(json.dumps(old,indent=2)+'\n')
pins=json.loads((B/'input-pins.json').read_text())
paths=[p for p in B.iterdir() if p.is_file() and p.suffix in ['.py','.json','.glb','.ts']]
paths += [H/n for n in ['build_mantis_complete.py','prepare_source.py','mantis-mesh-complete-sculpted-anatomy.json','mantis-study-complete-sculpted-anatomy.glb','metrics-complete-sculpted-anatomy.json','authored-mapping.json']]
paths += [R/'art/driftwood-isle/concepts/approved-nine-2026-10-19'/n for n in ['mantisExplorerGen.png','mantisWorldGen.png','corrections/mantisWorldCorrectedGen-v2.png']]
paths += [R/p for p in ['src/game/plugin/geometry.ts','src/game/plugin/packedCreatureBody.ts'] if (R/p).exists()]
paths += [R/p for p in ['art/driftwood-isle/lowpoly-mantis/runtime-admission/export_native.py','art/driftwood-isle/approved-puffer/native_export.py','art/driftwood-isle/lowpoly-mantis/cervical-frame-repair/check_geometry.py','docs/reviews/mantis-curved-normal-diagnosis/diagnose.py']]
for p in paths:pins[str(p.relative_to(R))]=hashlib.sha256(p.read_bytes()).hexdigest()
(H/'input-pins.json').write_text(json.dumps(pins,indent=2)+'\n')
print(len(parts),'source parts;',len(old['bones']),'identical bones;',len(pins),'pins')
