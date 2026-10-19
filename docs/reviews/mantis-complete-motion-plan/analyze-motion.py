"""Read-only interpretation of saved native source poses; never fits or edits a curve."""
import json, math
from pathlib import Path
p = Path(__file__).parent
r = json.loads((p/'motion-results.json').read_text())
rows = r.get('gait', [])
frequency = max(.6, 1.15*.62/(2*1.399999976158142*math.sin(.36)))
metrics = {}
for name in ['leg-1_0_knee','leg-1_1_knee','leg1_0_knee','leg1_1_knee']:
    side = -1 if name.startswith('leg-') else 1
    index = 0 if '_0_' in name else 1
    offset = (index if side == -1 else 1-index)*.5
    travel = root_travel = 0
    speeds = []
    for a,b in zip(rows,rows[1:]):
        pa=(2*a['phase']+offset)%1; pb=(2*b['phase']+offset)%1
        if not (.05<=pa<pb<=.57): continue
        dt=(b['phase']-a['phase'])/frequency
        av=a['feet'][name];bv=b['feet'][name]
        distance=math.hypot(bv[0]-av[0],bv[2]-av[2]+1.15*dt)
        travel+=distance;root_travel+=1.15*dt;speeds.append(distance/dt)
    speeds.sort()
    metrics[name]={'intervals':len(speeds),'footRootRatio':travel/root_travel if root_travel else None,
                   'medianFootSpeed':speeds[len(speeds)//2] if speeds else None}
result={'scope':'Coherent straight source fixture at1.15m/s; NOT actual game contact/turn/stop validation',
        'phaseHz':frequency,'perFoot':metrics,
        'gate':all(m['footRootRatio'] is not None and m['footRootRatio']<=.20 and m['medianFootSpeed']<=.20 for m in metrics.values())}
(p/'stance-results.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
