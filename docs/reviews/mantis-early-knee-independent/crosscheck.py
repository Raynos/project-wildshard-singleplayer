"""Independent scalar formula and NumPy mesh-world reconstruction, no runtime claim."""
import copy
import hashlib
import json
import math
from pathlib import Path
import numpy as np

OUT = Path(__file__).parent
ROOT = Path('art/driftwood-isle/lowpoly-mantis/runtime-admission')
native_path = ROOT / 'v7-rigid1/mantis-v7-native.json'
native = json.loads(native_path.read_text())
binds = {b['name']: b for b in native['bones']}

def smooth(t):
    t = max(0, min(1, t))
    return t*t*(3-2*t)

def knee(row, name, multiplier):
    side = -1 if name.startswith('leg-1') else 1
    index = int(name.split('_')[1])
    offset = (index if side == -1 else 1-index)*math.pi
    live = 1-smooth(row['deathT'])
    moving = max(0, min(1, row['speed']))*(0 if row['stage'] in [1,3] else 1)
    k = smooth(multiplier*row['deathT'])
    return side*(live*.09*moving*max(0,math.sin(row['gait']*2*math.pi+offset)) + .38*k + 2*k*(1-k))

def matrix(v):
    x,y,z,w = v[3:]
    m = np.eye(4)
    m[:3,:3] = [[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
                  [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
                  [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
    m[:3,3] = v[:3]
    return m

def measure(row, bones):
    posed = {}
    world = np.array(row['world']).reshape(4,4).T
    for b in native['bones']:
        local = matrix(bones[b['name']])
        posed[b['name']] = posed[b['parent']]@local if b['parent'] else local
    parts = []
    for p in native['parts']:
        vertices = np.array(p['positions']).reshape(-1,3)-binds[p['name']]['pos']
        vertices = np.column_stack((vertices,np.ones(len(vertices))))
        # Candidate4 omitted the floor field; this isolated practice floor is 900.
        ys = (world@posed[p['name']]@vertices.T)[1]-row.get('floor',900)
        parts.append({'name':p['name'],'minimum':float(ys.min()),'below':int((ys<0).sum())})
    return sorted(parts,key=lambda p:p['minimum'])

report = {'method':'Independent closed-form knee evaluation and NumPy complete rigid mesh skinning; recorded full local skeleton and meshWorld held fixed, not full runtime replay.', 'acceptance':False,'traces':[]}
for number in [4,5]:
    path = ROOT / f'arena-candidate{number}/evidence/observer-render-trace.json'
    rows = json.loads(path.read_text())
    results = []
    for i,row in enumerate(rows):
        bones = copy.deepcopy(row['bones'])
        parity = 0
        for name,v in bones.items():
            if not (name.startswith('leg') and name.endswith('_knee')): continue
            old = knee(row,name,1)
            parity = max(parity,max(abs(a-b) for a,b in zip(v[3:],[0,0,math.sin(old/2),math.cos(old/2)])))
            new = knee(row,name,2.5)
            v[3:] = [0,0,math.sin(new/2),math.cos(new/2)]
        before,after = measure(row,row['bones']),measure(row,bones)
        results.append({'index':i,'frame':row['frame'],'deathT':row['deathT'],'kneeParityError':parity,'baseline':before[0],'candidate':after[0], 'candidateBelowVertices':sum(p['below'] for p in after), **({'candidateParts':after,'baselineParts':before} if 0<=row['deathT']<1 else {})})
    summary = {'candidate':number,'rows':len(rows),'traceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'maxKneeParityError':max(r['kneeParityError'] for r in results),'minimum':min(r['candidate']['minimum'] for r in results),'deathMinimum':min(r['candidate']['minimum'] for r in results if r['deathT']>=0),'negativeFrames':[r['frame'] for r in results if r['candidateBelowVertices']],'frames':results}
    assert summary['maxKneeParityError'] < 1e-12
    assert not summary['negativeFrames']
    report['traces'].append(summary)
    print({k:v for k,v in summary.items() if k!='frames'})
report['nativeSha256'] = hashlib.sha256(native_path.read_bytes()).hexdigest()
(OUT/'world-crosscheck.json').write_text(json.dumps(report,indent=2)+'\n')
