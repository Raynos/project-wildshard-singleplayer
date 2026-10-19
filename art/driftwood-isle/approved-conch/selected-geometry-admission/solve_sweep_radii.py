"""Bounded section-radius search; fixed centerlines, counts and material indices."""
import json,math,sys
from pathlib import Path
from mathutils import Vector
p=Path(__file__).resolve().parent;sys.path.insert(0,str(p))
from geometry_checks import inspect
s=json.loads((p/'baseline-source-sweep.json').read_text())['meshes']
def evaluate(name,profile,scales):
 n=7;rows=[];prev=None;u=None
 for j,(pos,w,d) in enumerate(profile):
  pos=Vector(pos);t=(Vector(profile[min(j+1,len(profile)-1)][0])-Vector(profile[max(j-1,0)][0])).normalized()
  if prev is None:u=t.cross(Vector((0,1,0))).normalized()
  else:u=prev.rotation_difference(t) @ u;u=(u-t*u.dot(t)).normalized()
  v=t.cross(u).normalized();prev=t
  rows.append([tuple(pos+u*w*scales[j]*math.cos(a)*(1+.06*math.cos(3*a))+v*d*scales[j]*math.sin(a)) for a in [math.tau*i/n for i in range(n)]])
 return inspect(name,profile,rows)
def passes(r):return r['minimumOutwardRadialCosine']>.02 and not r['opposedStripTrianglePairs']
result={}
for m in s:
 name=m['mesh']
 if not name.startswith(('Raised breast carapace','Swept shoulder armor')):continue
 profile=m['profile'];scales=[1.]*len(profile)
 for step in range(100,9,-1):
  scales=[step/100]*len(profile)
  if passes(evaluate(name,profile,scales)):break
 assert passes(evaluate(name,profile,scales))
 # Restore each section's size as far as the source-domain proof permits.
 for _ in range(3):
  for i in range(len(scales)):
   for step in range(round(scales[i]*100)+1,101):
    trial=scales.copy();trial[i]=step/100
    if passes(evaluate(name,profile,trial)):scales=trial
    else:break
 result[name]={'radiusScales':scales,'sourceAudit':evaluate(name,profile,scales)}
 print(name,scales,result[name]['sourceAudit']['minimumOutwardRadialCosine'])
(p/'radius-solution.json').write_text(json.dumps(result,indent=2))
