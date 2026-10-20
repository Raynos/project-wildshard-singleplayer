"""Editable diagnostic motion declaration. Frozen candidate geometry is input only.
No gameplay/visual/recovery admission is claimed by these conservative declared bounds.
"""
import hashlib
import json
from pathlib import Path
HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / 'articulated-source-candidate1'
contract = json.loads((SOURCE / 'contract.json').read_text())
hulls = json.loads((SOURCE / 'recipe.json').read_text())
feet = []
for side, sole in zip(('Left', 'Right'), contract['feet']):
    chain = contract['chains'][side]
    hip, knee, ankle = chain['hip'], chain['knee'], chain['ankle']
    # Knee-pole is an authored root-frame vector derived from the actual bind bend.
    axis = [a-h for a,h in zip(ankle, hip)]
    thigh = [k-h for k,h in zip(knee, hip)]
    d2 = sum(x*x for x in axis)
    along = sum(a*b for a,b in zip(axis,thigh))/d2
    pole = [t-along*a for t,a in zip(thigh,axis)]
    feet.append({'joints': [f'leg{side}', f'leg{side}Knee', f'leg{side}Ankle'],
      'pole':pole, 'nominal': ankle,
      'sole': [[p[i]-ankle[i] for i in range(3)] for p in sole['supportPolygon']],
      'lengths':[chain['thighLength'],chain['shinLength']],
      'limits':[[[-1.2,-1.2,-1.2],[1.2,1.2,1.2]], [[-1.6,-1.6,-1.6],[1.6,1.6,1.6]], [[-1.6,-1.6,-1.6],[1.6,1.6,1.6]]]})
contact = {'version':1, 'source':hashlib.sha256((SOURCE/'payload.bin').read_bytes()).hexdigest(),
 'ancestors':['body'], 'feet':feet, 'swingTicks':12, 'lift':0.08,
 'releaseDistance':0.075, 'releaseYaw':0.12, 'maxRootStep':0.08, 'maxRootTurn':0.08,
 'minScale':0.8,'maxScale':1.3, 'geometry':[{'joint':p['bone'],'points':p['points']} for p in hulls['parts']]}
programs=[]
for foot in feet:
 for joint in foot['joints']:
  for axis in 'xyz':
   read=f'solved.{joint}.rotation.{axis}'
   programs.append({'id':f'conch.contact1.{joint}.{axis}', 'reads':[read], 'nodes':[{'op':'read','index':0}],
    'channels':[{'property':axis,'value':0}], 'numeric':{'group':'creature.pose',
    'inputs':[{'input':read,'owner':f'solved.{joint}','path':['rotation',axis]}],
    'outputs':[{'property':axis,'target':f'joint.{joint}','path':['rotation',axis]}], 'restoreOnly':[]}})
model=json.loads((SOURCE/'model.json').read_text())
output={'group':'creature.pose','practiceTransition':{'owner':'isolated-practice','joints':[b['name'] for b in model['bones']]},
 'footContact':contact,'programs':programs}
(HERE/'motion.json').write_text(json.dumps(output,indent=2)+'\n')

# The committed build mirror deliberately omits art/. Keep complete, byte-identical
# source inputs in the normal test tree rather than weaken mirror/type admission.
PROOF = HERE.parents[3] / 'test' / 'proof' / 'conch-grounded-source'
PROOF.mkdir(parents=True, exist_ok=True)
inputs = {'model.json': SOURCE/'model.json', 'recipe.json': SOURCE/'recipe.json',
          'freeze.json': SOURCE/'freeze.json', 'motion.json': HERE/'motion.json'}
receipt = {}
for name, origin in inputs.items():
    data = origin.read_bytes()
    (PROOF/name).write_bytes(data)
    receipt[name] = {'origin': str(origin.relative_to(HERE.parents[3])),
                     'bytes':len(data), 'sha256':hashlib.sha256(data).hexdigest()}
(PROOF/'inputs.json').write_text(json.dumps({'completeByteCopies':True,'files':receipt},indent=2)+'\n')
