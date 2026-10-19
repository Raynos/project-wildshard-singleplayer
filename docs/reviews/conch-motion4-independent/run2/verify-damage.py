"""Independent callback and following-render weighted rapier-tip reconstruction."""
import runpy,json,numpy as np
from pathlib import Path
v=runpy.run_path('docs/reviews/conch-motion4-independent/run2/verify.py');D=v['D'];t=v['t'];g=v['g'];mat=v['mat'];inv=v['inv'];ids=v['ids'];w=v['w'];bound=v['bound']; tip=5761

def world(r):
 m=r['meshes'][0];p=np.array([mat(x) for x in m['boneWorld']])@inv
 a=sum((p[ids[tip,k]]@bound[tip])*w[tip,k] for k in range(4));a[3]=1
 return ((mat(m['world'])@mat(m['bindInverse']))@a)[:3]
def lane(p,s):
 d=np.array([s['x1']-s['x0'],s['z1']-s['z0']]);d/=np.linalg.norm(d);q=p[[0,2]]-[s['x0'],s['z0']]
 return {'along':float(q@d),'perpendicular':float(q@np.array([d[1],-d[0]]))}
e=json.loads((D/'events.json').read_text());out=[]
for r in e:
 if r['kind']!='hurt-request-before':continue
 n=next(x for x in t if x['sampleIndex']>r['sampleIndex'] and x['bout']==r['bout']);p=world(r);np_=world(n)
 out.append({'eventSample':r['sampleIndex'],'frame':r['frame'],'callbackLane':lane(p,r['strike']),'followingRenderFrame':n['frame'],'followingRenderLaneAgainstDamageLane':lane(np_,r['strike']),'playerHpBefore':r['playerHp'],'playerHpFollowing':n['playerHp'],'callbackPose':r['poseInput']['poseIndex'],'followingPose':n['poseInput']['poseIndex']})
phases=[{k:r[k] for k in ['kind','frame','phase','stage','clock','guard','hp','strike']} for r in e if r['kind']=='enemy-damage-before-presentation']
Path('docs/reviews/conch-motion4-independent/run2/damage-verification.json').write_text(json.dumps({'tipVertex':tip,'events':out,'actualEnemyHitPhases':phases},indent=2)+'\n')
print('DAMAGE',len(out),max(abs(x['followingRenderLaneAgainstDamageLane']['perpendicular']) for x in out))
