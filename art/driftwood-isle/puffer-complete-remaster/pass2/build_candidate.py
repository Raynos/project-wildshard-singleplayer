"""Reference-grounded complete second static pass. No runtime assets are changed.
Native +Y is up, +Z is forward. Reproduce with Python + numpy only.
"""
import copy,hashlib,json,math,sys
from pathlib import Path
import numpy as np
HERE=Path(__file__).resolve().parent; ROOT=HERE.parents[3]; ART=HERE.parents[1]
sys.path.insert(0,str(ART/'puffer-remaster-guided'))
from paint_semantic_face_diagonal_robust import triangles,components,topology,COLORS
sys.path.insert(0,str(ART/'puffer-spike-study'))
from build_spikes import clearance
sys.path.insert(0,str(ART/'approved-puffer'))
from native_export import validate_native
BASE=ART/'approved-puffer/unaccepted-native-v71.json';TAIL=HERE.parent/'complete-native.json'
def pin(p): return {'path':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
def smooth(a,b,x):
 t=max(0.,min(1.,(x-a)/(b-a)));return t*t*(3-2*t)
def reshape(p):
 x,h,z=p
 # Inflate crown behind eye line; steepen the crown-to-face descent.
 crown=smooth(.92,1.17,h)
 arch=.105*math.exp(-((z+.06)/.34)**2)-.085*math.exp(-((z-.52)/.23)**2)
 # Broader upper-mid flanks, taper toward the fixed orbital/muzzle assembly.
 flank=math.exp(-((h-.88)/.37)**2)*math.exp(-((z+.02)/.43)**2)
 xx=x*(1+.11*flank)
 hh=h+crown*arch
 # The pouch is an inflated lower-front mass, not a flat projecting bib.
 pouch=(1-smooth(.62,.77,h))*smooth(.03,.38,z)
 xx*=1+.13*pouch
 zz=z+.105*pouch*math.exp(-((h-.43)/.27)**2)
 hh-=.032*pouch*math.exp(-((h-.30)/.20)**2)
 return [xx,hh,zz]
def build():
 b=json.loads(BASE.read_text());n=copy.deepcopy(b);part=n['parts'][0]
 old=np.array(part['positions']).reshape(-1,3);new=old.copy()
 for i,p in enumerate(old[:1022*3]):new[i]=reshape(p)
 part['positions']=new.reshape(-1).tolist()
 # Preserve full distinct angular brow geometry and head. Only reduce inherited
 # oversized rear orange cheek patches, using shared triangle-centroid fields.
 recolor=0
 for fi in range(1022):
  pts=new[fi*3:fi*3+3];x,h,z=pts.mean(0);rgb=part['colorsLinear'][fi*9:fi*9+3]
  orange=rgb[0]>rgb[1]*2.2 and rgb[0]>rgb[2]*4
  if orange and z<.30+.38*abs(x) and h>.47:
   part['colorsLinear'][fi*9:fi*9+9]=list(COLORS['teal'])*3;recolor+=1
 # Broad coherent teal facets rather than color-threshold horizontal bands.
 # Face-by-face hues do not change geometry and add no random noise.
 for fi in range(1022):
  rgb=part['colorsLinear'][fi*9:fi*9+3]
  if rgb[1]>rgb[0]*1.7 and rgb[2]>rgb[0]*1.7:
   part['colorsLinear'][fi*9:fi*9+9]=list(COLORS['teal'])*3
 hull=new[:1022*3].reshape(-1,3,3)
 spikes=[]
 for index in range(8):
  start=(1426+index*6)*3;original=old[start:start+18];verts=[];faces=[]
  for tri in original.reshape(-1,3,3):
   face=[]
   for point in tri:
    q=point.tolist()
    if q not in verts:verts.append(q)
    face.append(verts.index(q))
   faces.append(face)
  v=np.array(verts);tip=int(np.argmax(v[:,1]));roots=[i for i in range(5)if i!=tip];center=v[roots].mean(0)
  delta=np.array(reshape(center))-center;v+=delta;center+=delta
  # Existing spike locations/hierarchy, bold shoulder and flank silhouettes.
  width={0:1.15,1:1.0,2:1.10,3:1.38,4:1.38,5:1.50,6:1.50,7:1.12}[index]
  length={0:1.12,1:1.0,2:1.08,3:1.33,4:1.33,5:1.50,6:1.50,7:1.10}[index]
  v[roots]=center+(v[roots]-center)*width;v[tip]=center+(v[tip]-center)*length
  direction=np.array([0.,.72,center[2]])-center;direction/=np.linalg.norm(direction);burial=0.
  def samples():
   r=v[roots];return np.concatenate([r,(r[:,None,:]+r[None,:,:]).reshape(-1,3)/2,r.mean(0)[None,:]])
  while max(clearance(samples(),hull))>-.004:
   v[roots]+=direction*.002;burial+=.002
   if burial>.24:raise ValueError('Root needs excessive burial')
  new[start:start+18]=v[np.array(faces)].reshape(-1,3)
  spikes.append({'index':index,'vertices':v.tolist(),'faces':faces,'rootIndices':roots,'tipIndex':tip,'widthMultiplier':width,'lengthMultiplier':length,'inwardRootTranslation':burial,'rootSampleClearance':clearance(samples(),hull)})
 part['positions']=new.reshape(-1).tolist()
 n['parts'][2]=copy.deepcopy(json.loads(TAIL.read_text())['parts'][2])
 # Complete-study root retained, with its actual burial measured against new hull.
 tail=np.array(n['parts'][2]['positions'][:132*3]).reshape(-1,3);cap=np.unique(tail[np.isclose(tail[:,2],tail[:,2].max(),atol=1e-8,rtol=0)],axis=0)
 tailclear=clearance(np.concatenate([cap,(cap[:,None,:]+cap[None,:,:]).reshape(-1,3)/2,cap.mean(0)[None,:]]),hull)
 if max(tailclear)>=-1e-6:raise ValueError('Tail root not buried')
 n['status']='Unaccepted complete pass2: inflated crown and pouch, seated spike hierarchy, retained V71 angular brows and broad wedge forefins; no runtime admission'
 oldtris=triangles(b['parts'][0]);newtris=triangles(part)
 before=topology(oldtris[:1022]);after=topology(newtris[:1022])
 assert n['bones']==b['bones'] and n['parts'][1]==b['parts'][1] and n['parts'][3:]==b['parts'][3:]
 assert part['positions'][1022*9:1426*9]==b['parts'][0]['positions'][1022*9:1426*9]
 stats=validate_native(n)
 metrics={'sourcePins':[pin(BASE),pin(TAIL)],'schema':stats,'bodyVolumeBefore':before,'bodyVolumeAfter':after,'volumeChangeFraction':after/before-1,'maximumHullVertexDisplacement':float(np.linalg.norm(new[:3066]-old[:3066],axis=1).max()),'recoloredRearCheekTriangles':recolor,'bonesExact':True,'headExact':True,'browAndBeakComponentsExact':True,'allFourFinPartsExact':True,'tailRootMaximumSampledDistance':max(tailclear),'spikes':spikes,'runtimeAdmitted':False,'qualityScore':None,'limitations':['Finite sampled root burial is not continuous attachment or animation proof.','Inherited single-sided palate, tongue and nostril inlays remain unchanged; exact-edge full-model topology still fails.','Broad original body connectivity retained; volume changed substantially, longitudinal topology rails not independently remeshed.','No runtime culling, physics, combat, animation or physical-device acceptance.']}
 dest=HERE/'pass2-native.json';dest.write_text(json.dumps(n,separators=(',',':'),allow_nan=False)+'\n');metrics['candidatePin']=pin(dest)
 (HERE/'construction-receipt.json').write_text(json.dumps(metrics,indent=2)+'\n')
 print(json.dumps({k:v for k,v in metrics.items()if k!='spikes'},indent=2))
if __name__=='__main__':build()
