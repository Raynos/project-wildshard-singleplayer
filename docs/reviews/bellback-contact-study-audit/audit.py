import json,hashlib,pathlib,math
import numpy as np
base=pathlib.Path('art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate4/solver-study1')
manifest=json.loads((base/'manifest.json').read_text()); pins=[]
for row in manifest['sourceAndInputFiles']+manifest['evidenceFiles']:
 b=pathlib.Path(row['path']).read_bytes();assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'],row['path'];pins.append(row['path'])
def v(d):return np.array([d[k] for k in 'xyz'])
def rot(q,p):
 u=v(q);return p+2*np.cross(u,np.cross(u,p)+q['w']*p)
def transform(s,p):return v(s['position'])+rot(s['rotation'],p)
result={'pinsVerified':len(pins),'manifestSha256':hashlib.sha256((base/'manifest.json').read_bytes()).hexdigest(),'baselines':[],'velocities':[]}
for case in range(2):
 cap=json.loads((base/f'replay-case-{case}.json').read_text());replay=json.loads((base/f'case{case}-iterations0.json').read_text())
 delta={k:max(abs(s['after'][k][a]-r[k][a]) for s,r in zip(cap['steps'],replay['rows']) for a in ('xyzw' if k=='rotation' else 'xyz')) for k in ['position','rotation','linvel','angvel']}
 result['baselines'].append({'case':case,'steps':len(cap['steps']),'maxDelta':delta})
 i=[32,28][case];s=cap['steps'][i];prior=cap['steps'][i-1]
 for contact in s['contacts']:
  if contact['bone'] not in (['leg2'] if case==0 else ['leg0','leg2']):continue
  p=min(contact['points'],key=lambda p:p['distance']);local=v(p['local2'] if contact['flipped'] else p['local1'])
  a=next(x for x in prior['localShapes'] if x['bone']==contact['bone']);b=next(x for x in s['localShapes'] if x['bone']==contact['bone']);body=s['before']
  art=rot(body['rotation'],(transform(b,local)-transform(a,local))/s['dt'])
  lever=rot(body['rotation'],transform(b,local)-v(body['localCom']))
  rigid=v(body['linvel'])+np.cross(v(body['angvel']),lever)
  result['velocities'].append({'case':case,'step':i,'bone':contact['bone'],'deathT':s['context']['deathT'],'distance':p['distance'],'impulse':p['impulse'],'articulated':art.tolist(),'rigid':rigid.tolist(),'combined':(art+rigid).tolist(),'bodyLocalYDelta':s['bones']['body'][1]-prior['bones']['body'][1]})
print(json.dumps(result,indent=2));pathlib.Path('docs/reviews/bellback-contact-study-audit/verification.json').write_text(json.dumps(result,indent=2)+'\n')
