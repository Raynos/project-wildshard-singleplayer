"""Execute actual builder loft AST, without building scene, including zero tangent crossing."""
import ast
import math
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).resolve().parent
source=ast.parse((HERE/'build_mantis_complete.py').read_text())
loft=next(n for n in source.body if isinstance(n,ast.FunctionDef) and n.name=='loft')
namespace=dict(Vector=Vector,math=math,mesh=lambda name,vs,fs,mats,mi,joint:vs)
exec(compile(ast.Module(body=[loft],type_ignores=[]),'candidate-loft','exec'),namespace)
for dz in [.02,.000001,0,-.000001,-.02]:
 profile=[((0,0,0),.125,.105),((0,-1,.1),.125,.105),((0,-2,.1+dz),.125,.105)]
 points=namespace['loft']('Regression cervical',profile,[0],n=7,continuous_frame=True)
 us=[(Vector(points[j*7])-Vector(p)).normalized() for j,(p,w,d) in enumerate(profile)]
 assert all(a.dot(b)>.999 for a,b in zip(us,us[1:])),(dz,us)
 for j,(p,w,d) in enumerate(profile):
  tangent=(Vector(profile[min(j+1,2)][0])-Vector(profile[max(j-1,0)][0])).normalized()
  assert abs(us[j].dot(tangent))<1e-6
print('PASS: actual loft continuity and orthogonality through +/zero/- vertical tangent, five cases')
