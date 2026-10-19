"""Light source-only feasibility probe; does not generate or export a model."""
import contextlib
import io
import itertools
import json
import math
from pathlib import Path
import runpy

with contextlib.redirect_stdout(io.StringIO()):
    state = runpy.run_path('art/driftwood-isle/approved-puffer/audit_v71_longitudinal_rails.py')
ns = state['ns']
points, faces = ns['mantle_candidate'], ns['mantle_faces']
edge_uses = state['edge_uses']
deficits = state['deficits']
hinge = state['maximum_concave_hinge']
ids = [r*14+s for r in range(4,8) for s in range(5)]
lookup = {old:new for new,old in enumerate(ids)}
before = [points[i] for i in ids]
old_faces = [tuple(lookup[i] for i in f) for f in faces if all(i in lookup for i in f)]
base_deficit = deficits(before,old_faces)
base_hinge = hinge(before,old_faces)
rails = [tuple(sorted((lookup[70+s],lookup[84+s]))) for s in (1,2,3)]
movable = [lookup[r*14+s] for r in (5,6) for s in (1,2,3)]

def flip(ps,fs,e):
    uses=edge_uses(fs).get(e,[])
    if len(uses)!=2:return None
    a,b=e
    c=next(i for i in fs[uses[0]] if i not in e)
    d=next(i for i in fs[uses[1]] if i not in e)
    if tuple(sorted((c,d))) in edge_uses(fs):return None
    def area(f):
        p=[]
        for i in f:
            x,y,z=ps[i]
            w,cz,h=ns['section'](y)
            p.append((math.atan2(x/w,(z-cz)/h),y))
        return (p[1][0]-p[0][0])*(p[2][1]-p[0][1])-(p[1][1]-p[0][1])*(p[2][0]-p[0][0])
    new=[]
    for f in ((c,d,a),(d,c,b)):
        if area(f)*area(fs[uses[0]])<0:f=tuple(reversed(f))
        if abs(area(f))<1e-8:return None
        new.append(f)
    if abs(sum(abs(area(f)) for f in new)-sum(abs(area(fs[i])) for i in uses))>1e-8:return None
    return [f for i,f in enumerate(fs) if i not in uses]+new

attempts=0
layout_trials=0
first_edge_failures={str(tuple(ids[i] for i in e)):0 for e in rails}
best=None
passing=[]
for amplitude in (0,.01,.02,.03):
    for signs in ([(0,)*6] if amplitude==0 else itertools.product((-1,1),repeat=6)):
        candidate=list(before)
        for index,sign in zip(movable,signs):
            x,y,z=before[index]
            w,cz,h=ns['section'](y)
            theta=math.atan2(x/w,(z-cz)/h)
            radius=math.hypot(x/w,(z-cz)/h)
            candidate[index]=(w*radius*math.sin(theta+sign*amplitude),y,cz+h*radius*math.cos(theta+sign*amplitude))
        displacement=max(math.dist(a,b) for a,b in zip(before,candidate))
        if displacement>.02:continue
        for order in itertools.permutations(rails):
            layout_trials+=1
            fs=old_faces
            for edge in order:
                fs=flip(candidate,fs,edge)
                if fs is None:
                    first_edge_failures[str(tuple(ids[i] for i in edge))]+=1
                    break
            if fs is None:continue
            attempts+=1
            delta=max(a-b for a,b in zip(deficits(candidate,fs),base_deficit))
            hinge_delta=hinge(candidate,fs)-base_hinge
            entry=dict(amplitudeRadians=amplitude,signs=signs,maximumDisplacement=displacement,
                       supportDeficitIncrease=delta,concaveHingeIncrease=hinge_delta,
                       removedCentralRails=sum(e not in edge_uses(fs) for e in rails))
            if best is None or max(delta,hinge_delta)<max(best['supportDeficitIncrease'],best['concaveHingeIncrease']):best=entry
            if delta<=.001 and hinge_delta<=.001:passing.append(entry)
result=dict(status='source-only feasibility; no geometry/export/render changed',
            scope='same V71 patch/perimeter; six angularly staggered interior samples, three central longitudinal edge flips',
            completeLayouts=attempts,layoutTrials=layout_trials,firstRejectedEdgeCounts=first_edge_failures,
            passingLocalCandidates=len(passing),best=best,
            limits='Local deficit and hinge screening only. Full mirrored topology, final union/paint, signed cap clearance and visual validation remain required for any candidate.')
print(json.dumps(result,indent=2))
