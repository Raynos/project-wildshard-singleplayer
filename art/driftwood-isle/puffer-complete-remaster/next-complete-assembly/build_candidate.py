"""Single complete guided-carrier assembly, explicit bounded arrangements first.
Never edits predecessors or runtime. Semantic paint is applied only after shape.
"""
import copy,hashlib,json,math,sys
from pathlib import Path
from collections import Counter
import numpy as np
from geometry_tools import *
H=Path(__file__).resolve().parent;A=H.parents[1];ROOT=H.parents[3]
PINS={'puffer-remaster-guided/seated-mouth-diagnostic-native.json':'030dbb8c40bf2507429b6017ad4c8d36a15eb5f5ca839c630e14189c51c8424b','puffer-remaster-guided/semantic-face-diagonal-native.json':'483b47367ddbad0e4872f357f786fc0cca778380a07bd536428923aadd3046cb','puffer-tail-study/tail-native-study.json':'c8f2ef68d0860539b93d3a343a54a05369b3278d239d5e871715a6f3abb17d35','puffer-fin-study/terminal-fin-native-study.json':'755d8e2d7605cfe9331ae064fe6f301602709ed542e8ee73f3d56f6687f0159e','puffer-spike-study/spike-native-study.json':'f49fb808735792d5945d8ac2991e89c5e8f013b4e4e8dcfe6ee51cfc189e90dd','puffer-complete-remaster/closed-anatomy-study/closed-anatomy-native.json':'98c4855852fc77ef385b0998e98dc5bdbabf40bb32b815f598c9a922525e5006'}
def dump(name,obj):
 (H/name).write_text(json.dumps(obj,separators=(',',':'),allow_nan=False)+'\n')
def build():
 for path,sha in PINS.items():assert hashlib.sha256((A/path).read_bytes()).hexdigest()==sha,path
 source=json.loads((A/'puffer-remaster-guided/seated-mouth-diagnostic-native.json').read_text());n=copy.deepcopy(source);body=n['parts'][0]
 v,f=ordered_indexed(np.array(body['positions']).reshape(-1,3,3));oldv=v.copy();core=set(component_ids(f)[0]);removed=set();replacement=[];ownership=[];patches=[]
 def replace(name,ids,axes,points=[]):
  nonlocal v
  ids=set(ids);assert not ids&removed,name+' overlapping edits'
  loops=patch_boundary(f,ids);assert len(loops)==1
  v,fs,added=triangulate_with_controls(v,loops[0],axes,points)
  # Every replacement keeps source boundary directed identically. The new
  # topology has geometric rather than old-face-index normal correspondence.
  assert patch_boundary(np.array(fs),range(len(fs)))[0]==loops[0] or set(tuple(x) for x in zip(loops[0],loops[0][1:]+loops[0][:1]))==set(tuple(x) for l in patch_boundary(np.array(fs),range(len(fs))) for x in zip(l,l[1:]+l[:1]))
  patches.append({'name':name,'sourceFaces':sorted(ids),'boundaryVertexIds':loops[0],'boundaryPositionsExact':oldv[loops[0]].tolist(),'projectionAxes':axes,'authoredControlVertexIds':added,'authoredControlPositions':points,'replacementFaces':fs})
  removed.update(ids);replacement.extend(fs);ownership.extend([{'patch':name,'sourceFace':min(ids)} for _ in fs])
 # Repair crossed arrangement, not a harmonic displacement of the fold.
 seeds={301,573,616,623};vs=set(f[list(seeds)].flat);ids={i for i in core if vs&set(f[i])}
 replace('lower-left-fold-connected-sheet',ids,[1,2])
 for side in [-1,1]:
  ids={i for i in core if all(abs(v[j,2]-.675000011920929)<1e-9 and side*v[j,0]>0 for j in f[i])}
  replace('orbital-back-wall-'+str(side),ids,[0,1])
 def selected(pred):
  ids=sorted(i for i in core-removed if all(pred(v[j])for j in f[i]));cs=component_ids(f[ids]);return [ids[i] for i in cs[0]]
 # Crown apex/hood boundaries remain anchored. Offset interior roof controls
 # break the inherited horizontal course and descend toward the sheltered face.
 ids=selected(lambda p:p[1]>.90 and p[2]<.48)
 points=[[-.025,1.265,-.08],[.255,1.174,-.025],[-.265,1.195,.075],[.02,1.198,.115],[-.26,1.14,.22],[.26,1.12,.22],[.025,1.13,-.26]]
 replace('descending-interlocked-crown',ids,[0,2],points)
 # Side patches have staggered broad carrier vertices rather than moving
 # coplanar paint subdivisions. All perimeter coordinates remain exact.
 for side in [-1,1]:
  ids=selected(lambda p:side*p[0]>.39 and .48<p[1]<.90 and p[2]<.35)
  points=[[side*.593,.64,.025],[side*.601,.79,.14],[side*.554,.755,-.13]]
  replace('broad-flank-'+str(side),ids,[2,1],points)
 # Modest central front patch: preserve full underside, side joins and mouth.
 ids=selected(lambda p:.24<p[1]<.66 and p[2]>.60)
 points=[[-.16,.39,.924],[.10,.405,.945],[.018,.525,.930],[.30,.465,.862],[-.30,.485,.867]]
 replace('forward-hanging-pouch-center',ids,[0,1],points)
 keep=[i for i in range(len(f))if i not in removed];nf=np.array([f[i]for i in keep]+replacement);own=[{'sourceFace':i,'patch':None}for i in keep]+ownership
 out={k:[]for k in ('positions','colorsLinear','skinIndices','skinWeights','furLen')};out['name']=body['name']
 for face,o in zip(nf,own):
  src=o['sourceFace'];color=body['colorsLinear'][src*9:src*9+3]
  for j in face:
   out['positions'].extend(v[j].tolist());out['colorsLinear'].extend(color);out['skinIndices'].extend(body['skinIndices'][src*12:src*12+4]);out['skinWeights'].extend(body['skinWeights'][src*12:src*12+4]);out['furLen'].append(0)
 n['parts'][0]=out
 dump('carrier-controls.json',{'sourceSha256':PINS['puffer-remaster-guided/seated-mouth-diagnostic-native.json'],'coordinateSystem':source['coordinates'],'patches':patches,'unchangedSourceFaces':keep,'unaffectedCoordinatesExact':all(np.array_equal(v[j],oldv[j])for i in keep for j in f[i]),'allOriginalVerticesUnmoved':np.array_equal(v[:len(oldv)],oldv)})
 dump('surface-ownership.json',{'carrierFaces':own,'originalCoreFaceIds':sorted(core),'sourceTriangleCount':len(f),'carrierTriangleCount':len(nf)})
 dump('edited-carrier-indexed.json',{'vertices':v.tolist(),'faces':nf.tolist(),'partName':out['name'],'faceOwnership':own,'coordinates':source['coordinates']})
 # Retained tail exact. Forefins start from compact indexed web, but their
 # shoulders and entire fan surface are authored together, not just tips.
 tail=json.loads((A/'puffer-tail-study/tail-native-study.json').read_text());n['parts'][2]=copy.deepcopy(tail['parts'][0])
 fin=json.loads((A/'puffer-fin-study/terminal-fin-fans-indexed.json').read_text());finrecords=[]
 for pi,mesh in enumerate(fin['meshes'],3):
  mesh=copy.deepcopy(mesh);vv=np.array(mesh['vertices']);before=vv.copy();count=len(mesh['rootVertexIndices']);side=1 if mesh['bone']=='finL'else -1
  for k in range(count,4*count):
   ring=k//count;x,y,z=vv[k];dx=side*x-.57;dz=z-.435
   # Broad shoulders at the center of the same compact footprint.
   if ring==1:vv[k]=[side*(.565+1.13*dx),y+.065,.425+1.04*dz]
   elif ring==2:vv[k]=[x,y+.038,z]
   elif ring==3:vv[k]=[x,y+.014*(1-min(1,abs(dx)/.30)),z]
  mesh['vertices']=vv.tolist();part=copy.deepcopy(json.loads((A/'puffer-fin-study/terminal-fin-native-study.json').read_text())['parts'][pi-3]);part['positions']=vv[np.array(mesh['triangles'])].reshape(-1).tolist();n['parts'][pi]=part
  finrecords.append({'part':part['name'],'rootExact':bool(np.array_equal(vv[:count],before[:count])),'soleExact':bool(np.array_equal(vv[4*count:5*count],before[4*count:5*count])),'maximumDisplacement':float(np.linalg.norm(vv-before,axis=1).max()),'indexedMesh':mesh})
 # Rear lower webs broaden toward sole but retain actual root ring and pivots.
 for pi in [5,6]:
  p=n['parts'][pi];vv,ff=ordered_indexed(np.array(p['positions']).reshape(-1,3,3));before=vv.copy();top=vv[:,1].max();side=1 if pi==5 else -1
  for k,(x,y,z)in enumerate(vv):
   w=max(0,min(1,(top-y)/top));xx=side*x;vv[k,0]=side*(.47+(xx-.47)*(1+.25*w));vv[k,2]=-.36+(z+.36)*(1+.14*w)
  p['positions']=vv[ff].reshape(-1).tolist();finrecords.append({'part':p['name'],'rootExact':bool(np.array_equal(vv[before[:,1]==top],before[before[:,1]==top])),'maximumDisplacement':float(np.linalg.norm(vv-before,axis=1).max()),'vertices':vv.tolist(),'faces':ff.tolist()})
 dump('whole-fin-controls.json',finrecords)
 # Broaden shoulder wedges against final carrier. All root corners stay in the
 # existing envelope initially; tip changes deliberately alter silhouette.
 sys.path.insert(0,str(A/'puffer-spike-study'))
 from build_spikes import clearance
 bv,bf=ordered_indexed(np.array(n['parts'][0]['positions']).reshape(-1,3,3));comps=component_ids(bf);spikes=[]
 for component in comps[1:]:
  ids=np.unique(bf[component]);ps=bv[ids]
  if len(component)!=6 or len(ids)!=5:continue
  tip=ids[np.argmax(ps[:,1])];root=[j for j in ids if j!=tip];center=bv[root].mean(0)
  originalRoots=bv[root].copy();direction=np.array([0.,.69,.10])-center;direction/=np.linalg.norm(direction);burial=0.
  while max(clearance(bv[root],bv[bf[comps[0]]]))>-.006:
   bv[root]+=direction*.003;burial+=.003
   if burial>.20:raise ValueError('Spike root exceeds bounded seating envelope')
  spikes.append({'rootBefore':originalRoots.tolist(),'rootAfter':bv[root].tolist(),'inwardTranslation':burial,'tipExactBeforeShoulderAuthorship':True})
  if abs(center[0])>.45 and center[2]>.02:
   oldtip=bv[tip].copy();bv[tip]+=np.array([math.copysign(.035,center[0]),.035,.012]);spikes.append({'tipBefore':oldtip.tolist(),'tipAfter':bv[tip].tolist(),'rootVertices':bv[root].tolist(),'rootExact':False})
 n['parts'][0]['positions']=bv[bf].reshape(-1).tolist();dump('shoulder-controls.json',spikes)
 # Close inherited exposed inlays without moving their front coordinates.
 head=n['parts'][1];original=copy.deepcopy(head);ts=np.array(head['positions']).reshape(-1,3,3);hv,hf=ordered_indexed(ts);closures=[]
 for component in component_ids(hf):
  if topology(ts[component])['edgeManifoldOriented']:continue
  loops=patch_boundary(hf,component);normals=np.cross(ts[component,1]-ts[component,0],ts[component,2]-ts[component,0]);direction=normals.sum(0);direction/=np.linalg.norm(direction);depth=.009 if len(component)==2 and min(component)>8 else .022;offset=-depth*direction
  additions=[[t[0]+offset,t[2]+offset,t[1]+offset]for t in ts[component]]
  for loop in loops:
   for a,b in zip(loop,loop[1:]+loop[:1]):
    x,y=hv[a],hv[b];additions.extend([[y,x,x+offset],[y,x+offset,y+offset]])
  start=len(head['positions'])//9;src=component[0]
  for t in additions:
   for p in t:
    head['positions'].extend(p.tolist());head['colorsLinear'].extend(original['colorsLinear'][src*9:src*9+3]);head['skinIndices'].extend(original['skinIndices'][src*12:src*12+4]);head['skinWeights'].extend(original['skinWeights'][src*12:src*12+4]);head['furLen'].append(0)
  closures.append({'sourceFaces':component,'addedRange':[start,len(head['positions'])//9],'offset':offset.tolist(),'exposedFacesExact':True})
 n['status']='UNACCEPTED complete pre-paint carrier assembly; geometry gates pending'
 dump('prepaint-native.json',n)
 dump('construction-receipt.json',{'sourcePins':PINS,'protectedBonesExact':n['bones']==source['bones'],'protectedTailExact':n['parts'][2]==tail['parts'][0],'protectedHeadExposedArraysExact':all(head[k][:len(original[k])]==original[k]for k in original if k!='name'),'patchCount':len(patches),'closures':closures,'runtimeAdmitted':False,'artScore':None,'status':'prepaint candidate constructed; semantic paint and gates pending'})
 print('built',[(p['name'],len(p['positions'])//9)for p in n['parts']],flush=True)
if __name__=='__main__':build()
