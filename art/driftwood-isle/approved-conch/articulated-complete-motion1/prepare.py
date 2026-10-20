"""Editable shoulder choreography on frozen eight-owner source; no selection changes.
All six leg joints remain exclusive contact copies. Body/head/shield and elbow
remain fixed. Death delegates world-root dynamics to the native corpse owner.
"""
import hashlib
import json
import math
from pathlib import Path
from scipy.spatial.transform import Rotation
import numpy as np
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
BASE = HERE.parent
SOURCE = BASE / 'articulated-source-candidate1'
PROOF = ROOT / 'test/proof/conch-articulated-complete-motion'
model = json.loads((SOURCE / 'model.json').read_text())
contact = json.loads((BASE / 'articulated-contact-motion1/motion.json').read_text())
contract = json.loads((SOURCE / 'contract.json').read_text())
shoulder = np.array(next(b['pos'] for b in model['bones'] if b['name'] == 'rapierArm'))
weapon = next(p for p in model['parts'] if p['name'] == 'rapierArm')
points = np.array(weapon['positions']).reshape(-1, 3)
tip = points[np.argmax(points[:, 2])]
vector = tip - shoulder
length = np.linalg.norm(vector)
# Actual actor +Z points, not old -Z Euler labels. Shortest-arc shoulder mapping
# leaves the elbow locked. XYZ intrinsic Euler is THREE's documented convention.
def aim(x, y):
    desired = np.array([x - shoulder[0], y - shoulder[1], 0.])
    desired[2] = math.sqrt(length * length - desired[0] ** 2 - desired[1] ** 2)
    a, b = vector / length, desired / length
    cross = np.cross(a, b)
    q = np.r_[cross, 1 + np.dot(a, b)]
    q /= np.linalg.norm(q)
    return Rotation.from_quat(q).as_euler('XYZ').tolist()
# One intentional complete shoulder pass. No endpoint search against a gate.
poses = {'ready': aim(.65, 1.12), 'tell': aim(1.12, 1.49),
         'active': aim(0., 1.36), 'brace': aim(.28, 1.18),
         'dead': aim(1.15, .58)}
class DAG:
    def __init__(self): self.nodes=[]; self.reads=[]; self.inputs=[]
    def node(self, op, **kw):
        self.nodes.append({'op':op, **kw}); return len(self.nodes)-1
    def n(self, value): return self.node('constant', value=value)
    def read(self, owner, field):
        path=field if isinstance(field,list) else [field]; key='.'.join([owner,*path])
        if key not in self.reads:
            self.reads.append(key); self.inputs.append({'input':key,'owner':owner,'path':path})
        return self.node('read',index=self.reads.index(key))
    def op(self, op, a, b): return self.node(op,a=a,b=b)
    def mix(self,a,b,t): return self.op('add',a,self.op('mul',self.op('sub',b,a),t))
    def select(self,t,a,b): return self.node('select',test=t,yes=a,no=b)
    def eq(self,v,x): return self.op('mul',self.op('gt',v,self.n(x-.5)),self.op('gt',self.n(x+.5),v))
    def sample(self,v,keys): return self.node('sample',a=v,keys=keys,interpolation='smoothstep')
programs=list(contact['programs'])
for i,axis in enumerate('xyz'):
    d=DAG(); phase=d.read('strike','phase'); elapsed=d.read('strike','elapsed')
    index=d.read('strike','index'); wind=d.select(d.eq(index,2),d.n(.45),d.n(.6))
    ready,tell,active,brace,dead=[poses[k][i] for k in ['ready','tell','active','brace','dead']]
    # Quiet ready signal uses real owner time. It is tapered out at windup start
    # and back in at recovery end to make all exact phase boundaries meet.
    breath=d.op('mul',d.n([.012,0.,.008][i]),d.node('sin',a=d.op('mul',d.read('frame','t'),d.n(1.7))))
    normalized=d.op('div',elapsed,wind)
    attack=d.select(d.eq(phase,1),d.sample(normalized,[[0,ready],[.45,tell],[.67,tell],[1,active]]),
        d.select(d.eq(phase,2),d.n(active),d.select(d.eq(phase,3),d.sample(elapsed,[[0,active],[.35,brace],[.9,ready]]),d.n(ready))))
    quiet=d.select(d.eq(phase,1),d.sample(normalized,[[0,1],[.25,0],[1,0]]),
        d.select(d.eq(phase,2),d.n(0),d.select(d.eq(phase,3),d.sample(elapsed,[[0,0],[.6,0],[.9,1]]),d.n(1))))
    live=d.op('add',attack,d.op('mul',breath,quiet))
    clock=d.read('transition','elapsed'); entry=d.read('entry.rapierArm',['rotation',axis]); kind=d.read('transition','kind')
    hit=d.op('add',d.mix(entry,live,d.sample(clock,[[0,0],[.075,0],[.3,1]])),
        d.op('mul',d.n([-.10,.08,.06][i]),d.sample(clock,[[0,0],[.075,1],[.3,0]])))
    death=d.mix(entry,d.n(dead),d.sample(d.read('frame','deathT'),[[0,0],[.35,.20],[.8,1],[1,1]]))
    value=d.select(d.eq(kind,2),death,d.select(d.eq(kind,1),hit,live))
    assert len(d.nodes)<=128
    programs.append({'id':f'conch.articulated.complete1.rapierArm.{axis}','reads':d.reads,'nodes':d.nodes,
        'channels':[{'property':axis,'value':value}], 'numeric':{'group':'creature.pose','inputs':d.inputs,
        'outputs':[{'property':axis,'target':'joint.rapierArm','path':['rotation',axis]}],'restoreOnly':[]}})
out={**contact,'states':['stalk','attack','alert','idle'],'strikeIds':['strike.conch-duelist.thrust','strike.conch-duelist.counter'],'programs':programs}
(HERE/'motion.json').write_text(json.dumps(out,indent=2)+'\n')
(HERE/'shoulder-authoring.json').write_text(json.dumps({'basis':contract['basis'],'rotationOrder':'XYZ','method':'Shortest-arc quaternion from actual shoulder-to-tip bind vector, then intrinsic XYZ Euler; no label remapping','shoulder':shoulder.tolist(),'tip':tip.tolist(),'poses':poses,'tradeoff':contract['upperBodyTradeoff']},indent=2)+'\n')
(PROOF).mkdir(parents=True,exist_ok=True)
files={'motion.json':HERE/'motion.json','shoulder-authoring.json':HERE/'shoulder-authoring.json','contract.json':SOURCE/'contract.json'}
receipt={}
for name,path in files.items():
    data=path.read_bytes();(PROOF/name).write_bytes(data)
    receipt[name]={'origin':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)}
for name in ['model.json','metadata.json','payload.bin','recipe.json','contract.json']:
    path=SOURCE/name; data=path.read_bytes()
    receipt['source/'+name]={'origin':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)}
(PROOF/'inputs.json').write_text(json.dumps({'completeByteCopies':True,'sharedSourceFixture':'test/proof/conch-grounded-source','files':receipt},indent=2)+'\n')
print(json.dumps({'programs':len(programs),'maximumNodes':max(len(p['nodes']) for p in programs),'poses':poses}))
