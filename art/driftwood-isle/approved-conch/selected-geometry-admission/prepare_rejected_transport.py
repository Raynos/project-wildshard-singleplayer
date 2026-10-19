"""Reproduce rejected transport-only experiment from immutable pass2 source."""
from pathlib import Path
p=Path(__file__).resolve().parent
s=(p.parent/'complete-pass2/build_conch_complete_pass2.py').read_text()
s=s.replace('TAU=math.tau;objects=[]','TAU=math.tau;objects=[];sweeps=[]\nfrom geometry_checks import inspect')
s=s.replace('rows=[]\n for j,(p,w,d) in enumerate(profile):','rows=[];previous_t=None;previous_u=None\n corrected=name.startswith((\'Raised breast carapace\',\'Swept shoulder armor\'))\n for j,(p,w,d) in enumerate(profile):',1)
s=s.replace('t.normalize();u=t.cross(Vector((0,1,0))).normalized();v=t.cross(u).normalized()', '''t.normalize();u=t.cross(Vector((0,1,0))).normalized()
  if corrected and previous_t is not None:
   u=previous_t.rotation_difference(t) @ previous_u
   u=(u-t*u.dot(t)).normalized()
  v=t.cross(u).normalized();previous_t=t;previous_u=u''',1)
s=s.replace('return loft(name,rows,mats,indices=lambda','sweeps.append(inspect(name,profile,rows))\n return loft(name,rows,mats,indices=lambda',1)
s=s.replace("bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'conch-source.blend'))", "(OUT/'source-sweep-check.json').write_text(json.dumps({'stage':'Before mirroring or recalculation','meshes':sweeps},indent=2))")
s=s.replace("ob['source']='approved-conch/complete-pass2/build_conch_complete_pass2.py'", "ob['source']='approved-conch/selected-geometry-admission/build_selected_conch.py'")
s=s.replace('import bpy','import bpy\nsys.path.insert(0,str(Path(__file__).resolve().parent))',1)
(p/'rejected-transport-only-source.py').write_text(s)
a=(p/'audit_source.py').read_text();a=a[a.index('def inspect'):a.index('source=BASE')];a=a.replace("sweeps.append({'mesh':name", "return {'mesh':name").replace("'profile':profile})", "'profile':profile}")
(p/'geometry_checks.py').write_text('from mathutils import Vector\n'+a)
