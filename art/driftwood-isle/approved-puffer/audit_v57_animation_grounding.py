import json,math,hashlib,itertools,numpy as np
from pathlib import Path
p=json.load(open('tmp/puffer-lowpoly-v57-from-v9/puffer-native-v57.json'));bones={b['name']:np.array(b['pos']) for b in p['bones']};names=[b['name'] for b in p['bones']];parts={}
for q in p['parts']:
 ids=np.array(q['skinIndices']).reshape(-1,4);parts[names[ids[0,0]]]=np.unique(np.array(q['positions']).reshape(-1,3),axis=0)
def rot(x=0,y=0,z=0):
 cx,sx=math.cos(x),math.sin(x);cy,sy=math.cos(y),math.sin(y);cz,sz=math.cos(z),math.sin(z)
 return np.array([[1,0,0],[0,cx,-sx],[0,sx,cx]])@np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]])@np.array([[cz,-sz,0],[sz,cz,0],[0,0,1]])
def pose(idle=0,walk=0,tell=0,burst=0,flinch=0,dead=0,swelling=1):
 live=1-dead;B=bones['body'];R=rot(x=-.08*flinch*live,z=.35*dead);delta=live*(.015*(1+idle)+.10*flinch)+.09*dead;out={};roots={}
 for name,v in parts.items():
  if name in ('belly','head'):w=(v-bones['belly'])*swelling+bones['belly']
  else:
   if name=='tail':C=rot(y=live*(.22*idle+.24*walk))
   else:
    sign={'finL':1,'finR':-1,'rearL':-1,'rearR':1}[name];C=rot(x=-.18*max(0,sign*walk)*live,y=live*(1 if name.endswith('L') else -1)*(.03*idle+.07*tell-.08*burst))
   w=(v-bones[name])@C.T+bones[name]
   if name!='tail':
    rv=v[v[:,1]>(.475 if name.startswith('fin') else .487)];roots[name]=float(np.linalg.norm((rv-bones[name])@C.T+bones[name]-rv,axis=1).max())
  w=((w-B)*[1,1-.4*dead,1])@R.T+B+[0,delta,0];out[name]=float(w[:,1].min())
 return {'minimumY':min(out.values()),'parts':out,'maximumFinRootMotion':max(roots.values())}
worst={'minimumY':1e9};rootmax=0;count=0
# Conservative independent envelopes, including impossible tell/burst overlap.
for idle,walk,tell,burst,flinch,swelling in itertools.product(np.linspace(-1,1,9),np.linspace(-1,1,9),(0,1),(0,1),(0,.5,1),(1,1.1)):
 kw=dict(idle=float(idle),walk=float(walk),tell=tell,burst=burst,flinch=flinch,swelling=swelling);r=pose(**kw);count+=1;rootmax=max(rootmax,r['maximumFinRootMotion'])
 if r['minimumY']<worst['minimumY']:worst={**r,'parameters':kw}
death=[]
for dead in np.linspace(0,1,1001):
 r=pose(idle=-1,dead=float(dead));death.append((r['minimumY'],float(dead)))
source=Path('src/shards/driftwood-isle/generators/pufferNativeClips.ts')
receipt={'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'method':'Actual rigid-weight V57 vertices; Three.js XYZ Euler; independent living parameter envelope plus 1001 death samples. Numerical samples, not continuous proof or visual acceptance.','livingSamples':count,'worstLiving':worst,'maximumFinRootMotion':rootmax,'worstDeath':min(death),'deathEnd':pose(idle=-1,dead=1),'nativeSha256':hashlib.sha256(Path('tmp/puffer-lowpoly-v57-from-v9/puffer-native-v57.json').read_bytes()).hexdigest()}
Path('tmp/puffer-v57-final-animation-grounding.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
worst_transition={'minimumY':1e9};transition_count=0
for dead,idle,walk,tell,burst,flinch,swelling in itertools.product(np.linspace(0,1,21),(-1,0,1),(-1,0,1),(0,1),(0,1),(0,1),(1,1.1)):
 kw=dict(dead=float(dead),idle=idle,walk=walk,tell=tell,burst=burst,flinch=flinch,swelling=swelling);r=pose(**kw);transition_count+=1
 if r['minimumY']<worst_transition['minimumY']:worst_transition={**r,'parameters':kw}
receipt['transitionSamples']=transition_count;receipt['worstTransition']=worst_transition
Path('tmp/puffer-v57-final-animation-grounding.json').write_text(json.dumps(receipt,indent=2)+'\n');print('TRANSITION',json.dumps(worst_transition))
