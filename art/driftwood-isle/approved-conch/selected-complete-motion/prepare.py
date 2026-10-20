"""Deterministic selected-only numeric motion and source-extreme recipe authoring.
No geometry edits, weight reassignment, physics, root lifts, or build publication.
"""
import hashlib,json
from pathlib import Path
import numpy as np
from scipy.spatial import ConvexHull
HERE=Path(__file__).resolve().parent
BASE=HERE.parent
SOURCE=BASE/'selected-native-normals/native/conch-character-pass-native.json'
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()=='3dddaf6a2845ffea0c372fe46d8d422baaa2864bfaf5cc5f4c4cd98a9faa0929'
s=json.loads(SOURCE.read_bytes()); bones=s['bones']; parts={p['name']:p for p in s['parts']}
groups={'body':['body','shell'],'head':['head','eyestalkLeft','eyestalkRight'],'shieldArm':['shieldArm'],'shieldForearm':['shieldForearm'],'rapierArm':['rapierArm'],'rapierForearm':['rapierForearm'],'legLeft':['legLeft','legLeftKnee','legLeftAnkle'],'legRight':['legRight','legRightKnee','legRightAnkle']}
pivots={b['name']:np.array(b['pos']) for b in bones}
recipe={'parts':[]}; ownership=[]
for owner,names in groups.items():
    points=np.unique(np.concatenate([np.array(parts[name]['positions']).reshape(-1,3) for name in names]),axis=0)
    hull=ConvexHull(points)
    recipe['parts'].append({'bone':owner,'points':(points[hull.vertices]-pivots[owner]).tolist()})
    ownership.append({'owner':owner,'parts':names,'extremePoints':len(hull.vertices),'maxPlaneResidual':float(np.max(points@hull.equations[:,:3].T+hull.equations[:,3]))})
assert sum(len(p['points']) for p in recipe['parts'])==361
# Each tuple is ready, tell, active, recovery brace, hit recoil, final death.
# Authored against selected -Z source. No old canonical motion imported.
POSE={
 'head.x':(0,-.10,.04,-.025,-.16,.30),
 'head.y':(0,.08,-.06,.03,.08,.12),
 'shieldArm.x':(.10,.20,.28,.20,-.12,.40),
 'shieldArm.z':(0,-.08,-.10,-.04,.08,-.22),
 'shieldForearm.y':(0,.12,.16,.08,-.06,.32),
 'rapierArm.x':(.08,-.14,.32,.10,-.20,.44),
 'rapierArm.y':(0,.12,-.30,-.08,-.10,-.28),
 'rapierArm.z':(0,.12,-.08,.04,.10,.25),
 'rapierForearm.y':(0,.20,-.35,-.12,-.12,-.35),
 'legLeft.x':(0,0,0,0,0,-.30), 'legRight.x':(0,0,0,0,0,-.30),
 'legLeft.z':(0,0,0,0,0,-.22), 'legRight.z':(0,0,0,0,0,.22),
}
class DAG:
 def __init__(self):self.nodes=[];self.reads=[];self.inputs=[]
 def node(self,op,**kw):self.nodes.append({'op':op,**kw});return len(self.nodes)-1
 def n(self,x):return self.node('constant',value=x)
 def read(self,owner,path):
  key='.'.join([owner,*path])
  if key not in self.reads:self.reads.append(key);self.inputs.append({'input':key,'owner':owner,'path':path})
  return self.node('read',index=self.reads.index(key))
 def op(self,op,a,b):return self.node(op,a=a,b=b)
 def add(self,a,b):return self.op('add',a,b)
 def mul(self,a,b):return self.op('mul',a,b)
 def sub(self,a,b):return self.op('sub',a,b)
 def select(self,c,a,b):return self.node('select',test=c,yes=a,no=b)
 def eq(self,v,x):return self.mul(self.op('gt',v,self.n(x-.5)),self.op('gt',self.n(x+.5),v))
 def sample(self,v,keys):return self.node('sample',a=v,keys=keys,interpolation='smoothstep')
 def mix(self,a,b,t):return self.add(a,self.mul(self.sub(b,a),t))
 def motion(self,name,axis):
  key=name+'.'+axis
  if key not in POSE:return self.n(0)
  ready,tell,active,recover,hit,dead=POSE[key]
  phase=self.read('strike',['phase']); elapsed=self.read('strike',['elapsed']); index=self.read('strike',['index'])
  wind=self.select(self.eq(index,2),self.n(.45),self.n(.6))
  normalized=self.op('div',elapsed,wind)
  attack=self.select(self.eq(phase,1),self.sample(normalized,[[0,0],[.45,tell],[.65,tell],[1,active]]),self.select(self.eq(phase,2),self.n(active),self.select(self.eq(phase,3),self.sample(elapsed,[[0,active],[.45,recover],[.9,0]]),self.n(0))))
  live=self.add(self.n(ready),attack)
  if name=='head' and axis=='x':live=self.add(live,self.mul(self.n(.012),self.node('sin',a=self.mul(self.read('frame',['t']),self.n(1.7)))))
  if name in ['legLeft','legRight'] and axis=='x':
   gait=self.node('sin',a=self.mul(self.read('motion',['total']),self.n(2*np.pi/.65)))
   live=self.add(live,self.mul(self.n(.085 if name=='legLeft' else -.085),gait))
  kind=self.read('transition',['kind']); clock=self.read('transition',['elapsed']); entry=self.read('entry.'+name,['rotation',axis])
  hitPose=self.add(self.mix(entry,live,self.sample(clock,[[0,0],[.08,0],[.32,1]])),self.mul(self.n(hit),self.sample(clock,[[0,0],[.08,1],[.32,0]])))
  deadPose=self.mix(entry,self.n(dead),self.sample(self.read('frame',['deathT']),[[0,0],[1,1]]))
  return self.select(self.eq(kind,2),deadPose,self.select(self.eq(kind,1),hitPose,live))
programs=[]
for bone in bones:
 name=bone['name']; parent=pivots.get(bone['parent'],np.zeros(3)); local=pivots[name]-parent
 for prop in ['position','rotation','scale']:
  for i,axis in enumerate('xyz'):
   d=DAG(); value=d.motion(name,axis) if prop=='rotation' else d.n(float(local[i]) if prop=='position' else 1)
   assert len(d.nodes)<=128,(name,axis,len(d.nodes))
   programs.append({'id':f'conch-selected.complete1.{name}.{prop}.{axis}','numeric':{'group':'creature.pose','outputs':[{'property':'x','target':'joint.'+name,'path':[prop,axis]}],'inputs':d.inputs,'restoreOnly':[]},'reads':d.reads,'nodes':d.nodes,'channels':[{'property':'x','value':value}]})
poses={'group':'creature.pose','states':['stalk','attack','alert','idle'],'scalars':[],'practiceTransition':{'owner':'isolated-practice','joints':[b['name'] for b in bones]},'strikeIds':['strike.conch-duelist.thrust','strike.conch-duelist.counter'],'programs':programs}
for name,data in [('recipe.json',recipe),('poses.json',poses),('ownership.json',ownership)]: (HERE/name).write_text(json.dumps(data,separators=(',',':'))+'\n')
pins={str(p.relative_to(BASE)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [SOURCE,BASE/'selected-native-color/metadata.json',BASE/'selected-native-color/payload.bin',BASE/'selected-native-view/poses.json']}
(HERE/'source-pins.json').write_text(json.dumps(pins,indent=2)+'\n')
print(json.dumps({'programs':len(programs),'maxNodes':max(len(p['nodes']) for p in programs),'parts':len(recipe['parts']),'points':361}))
