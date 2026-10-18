"""Independent geometry/skin report for the generated native payload; no Blender needed."""
import json, math, sys
from pathlib import Path
root=Path(sys.argv[1]); data=json.loads((root/'brine-puffer.mesh.json').read_text())
joints={b['name'] for b in data['bones']}; errors=[]; count=0; minimum=[math.inf]*3; maximum=[-math.inf]*3
for bone in data['bones']:
    if bone['parent'] is not None and bone['parent'] not in joints:errors.append('Unknown bone parent')
for part in data['parts']:
    if part['joint'] not in joints:errors.append('Unknown skin joint: '+part['name'])
    points=part['positions'];colors=part['colorsLinear'];count+=len(points)//9
    if len(points)%9 or len(colors)!=len(points):errors.append('Attribute length: '+part['name'])
    for i,value in enumerate(points):
        if not math.isfinite(value):errors.append('Non-finite position')
        minimum[i%3]=min(minimum[i%3],value);maximum[i%3]=max(maximum[i%3],value)
    if any(not math.isfinite(v) or v<0 or v>1 for v in colors):errors.append('Invalid paint')
report={'triangles':count,'unindexedVertices':count*3,'joints':len(joints),'parts':len(data['parts']),'materials':1,'boundsMin':minimum,'boundsMax':maximum,'rawGlbBytes':(root/'brine-puffer-study.glb').stat().st_size,'nativeJsonBytes':(root/'brine-puffer.mesh.json').stat().st_size,'errors':errors}
compressed=root/'brine-puffer-study.meshopt.glb'
if compressed.exists():report['meshoptGlbBytes']=compressed.stat().st_size
(root/'validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
if errors:sys.exit(1)
