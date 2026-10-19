"""Verify exact protected anatomy and disclose triangulation changes."""
from pathlib import Path
import importlib.util,json,hashlib
H=Path(__file__).resolve().parent;B=H.parent/'complete-proportion-study'
s=importlib.util.spec_from_file_location('x',H.parent/'cervical-frame-repair/check_geometry.py');x=importlib.util.module_from_spec(s);s.loader.exec_module(x)
a={p['name']:p for p in json.loads((B/'mantis-mesh-complete-proportion-study.json').read_text())['parts']};b={p['name']:p for p in json.loads((H/'mantis-mesh-complete-character-pass.json').read_text())['parts']}
assert a.keys()==b.keys()
changed=[];unchanged=[]
for name in a:
 assert a[name]['joint']==b[name]['joint'] and a[name]['colors']==b[name]['colors']
 assert len(a[name]['vertices'])==len(b[name]['vertices'])
 (changed if a[name]['vertices']!=b[name]['vertices'] else unchanged).append(name)
protected=[n for n in a if a[n]['joint'].startswith(('wing','leg','raptor')) or n.startswith(('Abdomen','Abdominal','Coxal','Lateral tail','Femur leaf'))]
assert all(n in unchanged for n in protected)
at=x.triangles(B/'mantis-study-complete-proportion-study.glb',a);bt=x.triangles(H/'mantis-study-complete-character-pass.glb',b)
def canon(t):return tuple(sorted(t['ids']))
tessellation=[]
for name in unchanged:
 old={canon(t) for t in at if t['name']==name};new={canon(t) for t in bt if t['name']==name}
 if old!=new:tessellation.append(dict(part=name,removed=len(old-new),added=len(new-old)))
assert not tessellation,tessellation
assert all(len(f)==3 for p in b.values() for f in p['faces'])
result=dict(status='PASS_PROTECTED_VERTEX_POSITIONS_MATERIALS_JOINTS',changedVertexParts=changed,unchangedVertexParts=unchanged,protectedAnatomyParts=protected,explicitSourceTriangles=3052,unchangedPartTessellationChanges=tessellation,limitations='Explicit original loop-triangle tessellation preserves every protected exported triangle. Stored normals change from polygon shading to actual geometric facets. Not native rig or collision acceptance.')
(H/'scope-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
