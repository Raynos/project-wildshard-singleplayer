import json,math,hashlib,itertools,numpy as np
from pathlib import Path
p=json.load(open('tmp/puffer-lowpoly-v57-from-v9/puffer-native-v57.json'));bones={b['name']:np.array(b['pos']) for b in p['bones']};names=[b['name'] for b in p['bones']];parts={}
for q in p['parts']:
 ids=np.array(q['skinIndices']).reshape(-1,4);parts[names[ids[0,0]]]=np.unique(np.array(q['positions']).reshape(-1,3),axis=0)
def rot(x=0,y=0,z=0):
 cx,sx=math.cos(x),math.sin(x);cy,sy=math.cos(y),math.sin(y);cz,sz=math.cos(z),math.sin(z)
 return np.array([[1,0,0],[0,cx,-sx],[0,sx,cx]])@np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]])@np.array([[cz,-sz,0],[sz,cz,0],[0,0,1]])
def pose(idle=0,walk=0,tell=0,burst=0,flinch=0,dead=0,swelling=1,version=3):
 live=1-dead;B=bones['body'];R=rot(x=live*(-.08*flinch+(-.035*tell+.08*burst if version==3 else 0)),z=.35*dead);delta=live*(.015*(1+idle)+.10*flinch+(.03*tell+.06*burst if version==3 else 0))+.09*dead;out={};roots={}
 for name,v in parts.items():
  if name in ('belly','head'):w=(v-bones['belly'])*swelling+bones['belly']
  else:
   if name=='tail':C=rot(x=-.18*burst*live if version==3 else 0,y=live*(.22*idle+.24*walk))
   else:
    sign={'finL':1,'finR':-1,'rearL':-1,'rearR':1}[name];C=rot(x=-.18*max(0,sign*walk)*live*(1-tell if version==3 else 1),y=live*(1 if name.endswith('L') else -1)*(.03*idle+.07*tell-.08*burst))
   w=(v-bones[name])@C.T+bones[name]
   if name!='tail':
    rv=v[v[:,1]>(.475 if name.startswith('fin') else .487)];roots[name]=float(np.linalg.norm((rv-bones[name])@C.T+bones[name]-rv,axis=1).max())
  w=((w-B)*[1,1-.4*dead,1])@R.T+B+[0,delta,0];out[name]=float(w[:,1].min())
 return {'minimumY':min(out.values()),'parts':out,'maximumFinRootMotion':max(roots.values())}

source=Path('src/shards/driftwood-isle/generators/pufferNativeClips.ts')
source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
assert source_hash=='27d26c7b9a65500e55b3cbb287c3812a85a150e5d06af2c19160fb55babf5e01'
def ramp(clock,lo,hi):return max(0,min(1,(clock-lo)/(hi-lo)))
results={}
# Real clock ties tell, burst and swell together; independent idle/walk/hit/death
# extrema conservatively include combinations beyond ordinary AI locomotion.
clocks=sorted(set(np.linspace(0,2.1,43).tolist()+[.819,.82,.9,1.,1.12,1.42,2.1*.39,2.1*.43,2.1*.61]))
for version in (2,3):
 worst={'minimumY':1e9};tail_min=1e9;root_max=0.;count=0;living_min=1e9
 for clock,dead,idle,walk,flinch in itertools.product(clocks,np.linspace(0,1,11),(-1,1),(-1,0,1),(0,1)):
  tell=ramp(clock,0,.82)*(1-ramp(clock,.9,1.12));burst=ramp(clock,.9,1)*(1-ramp(clock,1,1.42));swell=1+.1*ramp(clock/2.1,0,.39)*(1-ramp(clock/2.1,.43,.61))
  kw=dict(idle=idle,walk=walk,tell=tell,burst=burst,flinch=flinch,dead=float(dead),swelling=swell,version=version);r=pose(**kw);count+=1
  if r['minimumY']<worst['minimumY']:worst={**r,'clock':clock,'parameters':kw}
  tail_min=min(tail_min,r['parts']['tail']);root_max=max(root_max,r['maximumFinRootMotion'])
  if dead==0:living_min=min(living_min,r['minimumY'])
 results[str(version)]={'samples':count,'worst':worst,'minimumTailY':tail_min,'minimumLivingY':living_min,'maximumFinRootMotion':root_max}
receipt={'status':'sampled rigid V57 envelope only; no video or world-ragdoll contact acceptance','sourceSha256':source_hash,'nativeSha256':hashlib.sha256(Path('tmp/puffer-lowpoly-v57-from-v9/puffer-native-v57.json').read_bytes()).hexdigest(),'method':'Actual vertex buffers, Three.js XYZ Euler; real linked attack clock, conservative idle/walk/flinch/death combinations; unchanged rigid per-part weights; positive body scaleY>=.6 excludes linear transform collapse','comparison':results}
Path('tmp/puffer-v57-motion3-grounding.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
