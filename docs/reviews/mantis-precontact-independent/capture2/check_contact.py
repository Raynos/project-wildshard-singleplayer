"""Independent actual-capture contact reconstruction; do not substitute any pose."""
import hashlib
import json
import math
from pathlib import Path
import sys
import numpy as np

out = Path(__file__).parent
native_path = Path('art/driftwood-isle/lowpoly-mantis/runtime-admission/v7-rigid1/mantis-v7-native.json')
native = json.loads(native_path.read_text())
binds = {b['name']:b for b in native['bones']}
trace_path = Path(sys.argv[1])
trace = json.loads(trace_path.read_text())

def matrix(v):
    x,y,z,w = v[3:]
    m = np.eye(4)
    m[:3,:3] = [[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
                  [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
                  [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
    m[:3,3] = v[:3]
    return m

rows = []
death = 0
previous = None
for i,r in enumerate(trace):
    if not r['alive'] and (previous is None or previous['alive']): death += 1
    posed = {}
    world = np.array(r['world']).reshape(4,4).T
    for b in native['bones']:
        local = matrix(r['bones'][b['name']])
        posed[b['name']] = posed[b['parent']]@local if b['parent'] else local
    values = []
    for part in native['parts']:
        name = part['name']
        vertices = np.array(part['positions']).reshape(-1,3)
        indices = np.array(part['skinIndices']).reshape(-1,4)
        weights = np.array(part['skinWeights']).reshape(-1,4)
        assert np.max(np.abs(weights.sum(axis=1)-1)) < 1e-7
        deformed = np.zeros((len(vertices),3))
        for joint_index in np.unique(indices):
            bind = native['bones'][int(joint_index)]
            homogeneous = np.column_stack((vertices-np.array(bind['pos']),np.ones(len(vertices))))
            influence = (weights*(indices==joint_index)).sum(axis=1)
            deformed += ((world@posed[bind['name']]@homogeneous.T).T[:,:3])*influence[:,None]
        ys = deformed[:,1]-r['floor']
        values.append({'name':name,'minimum':float(ys.min()),'below':int((ys<0).sum()),'below5mm':int((ys<-.005).sum())})
    values.sort(key=lambda v:v['minimum'])
    jumps = []
    if previous is not None and previous['frame']<r['frame']:
        for name,v in r['bones'].items():
            if name.startswith('leg') and name.endswith('_knee'):
                dot = abs(float(np.dot(v[3:],previous['bones'][name][3:])))
                jumps.append(2*math.acos(min(1,dot)))
    rows.append({'index':i,'frame':r['frame'],'phase':r.get('phase'),'deathNumber':death if not r['alive'] else None,
        'alive':r['alive'],'stage':r['stage'],'deathT':r['deathT'],'boutTime':r.get('boutTime'),'gameTime':r['gameTime'],
        'minimum':values[0]['minimum'],'lowestPart':values[0]['name'],'belowVertices':sum(v['below'] for v in values),
        'below5mmVertices':sum(v['below5mm'] for v in values),'maximumAdjacentKneeJump':max(jumps,default=0),
        **({'parts':values} if not r['alive'] and r['deathT']<1 or values[0]['minimum']<0 else {})})
    previous = r
deaths = []
for number in range(1,death+1):
    samples = [r for r in rows if r['deathNumber']==number]
    deaths.append({'deathNumber':number,'samples':len(samples),'minimum':min(r['minimum'] for r in samples),
        'negativeFrames':[r['frame'] for r in samples if r['minimum']<0],
        'earlySamples':[r for r in samples if r['deathT']<1],
        'maxEarlyKneeJump':max((r['maximumAdjacentKneeJump'] for r in samples if r['deathT']<1),default=0)})
summary = {'frames':len(rows),'minimum':min(r['minimum'] for r in rows),'livingMinimum':min((r['minimum'] for r in rows if r['alive']),default=None),
    'deadMinimum':min((r['minimum'] for r in rows if not r['alive']),default=None),'framesBelowFloor':sum(r['minimum']<0 for r in rows),
    'framesBelow5mm':sum(r['minimum']<-.005 for r in rows),'deaths':deaths}
report = {'method':'Independent NumPy native actual skinIndices/skinWeights vertices; complete captured local xyz/xyzw parent hierarchy, absolute bind subtraction, full column-major meshWorld and recorded floor. No pose substitutions or physics inference.',
    'nativeSha256':hashlib.sha256(native_path.read_bytes()).hexdigest(),'traceSha256':hashlib.sha256(trace_path.read_bytes()).hexdigest(),
    'acceptance':False,'summary':summary,'failures':[r for r in rows if r['minimum']<0],'frames':rows}
(out/'world-contact-independent.json').write_text(json.dumps(report,indent=2)+'\n')
print({k:v for k,v in summary.items() if k!='deaths'})
print([{k:v for k,v in d.items() if k!='earlySamples'} for d in deaths])
