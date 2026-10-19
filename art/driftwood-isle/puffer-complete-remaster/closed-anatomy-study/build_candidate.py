"""Integrated closed anatomical study from retained pass2, never pass3.
Editable native source. +Y up, +Z face. No runtime files or saved blend.
"""
import copy,hashlib,json,math,sys
from collections import Counter
from pathlib import Path
import numpy as np
H=Path(__file__).resolve().parent;ROOT=H.parents[3];ART=H.parents[1]
sys.path.insert(0,str(ART/'puffer-remaster-guided'))
from paint_semantic_face_diagonal_robust import triangles,components,topology,COLORS
sys.path.insert(0,str(ART/'approved-puffer'))
from native_export import validate_native
BASE=H.parent/'pass2/pass2-native.json'
def pin(p):return {'path':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
def smooth(a,b,x):
 t=min(1,max(0,(x-a)/(b-a)));return t*t*(3-2*t)
def shape(p):
 x,y,z=p
 # Keep orbital seam, crown tips and rear root envelope. Round the inherited
 # closed bowl by tapering its lower corners and retreating its wide cheeks,
 # while preserving the forward central volume that pass3 lost.
 w=smooth(.18,.48,z)*(1-smooth(.54,.66,y))
 lower=1-smooth(.25,.57,y)
 xx=x*(1-.16*w*lower)
 zz=z-.115*w*(abs(x)/.665)**2
 yy=y-.045*w*math.exp(-((y-.38)/.22)**2)*math.exp(-(x/.39)**2)
 # Sweep side courses diagonally over the shoulders, leaving face and apex.
 side=smooth(.26,.50,abs(x))*(1-smooth(.32,.58,z))*smooth(.48,.72,y)*(1-smooth(1.10,1.29,y))
 yy+=.065*side*math.sin(4.0*(z+.24))
 return [xx,yy,zz]
def build():
 b=json.loads(BASE.read_text());n=copy.deepcopy(b);body=n['parts'][0]
 old=np.array(body['positions']).reshape(-1,3);v=old.copy()
 target=np.array([shape(p) for p in old[:3066]])
 # Preserve the orientation of narrow inherited semantic-cut triangles.
 # Shared exact vertices use one local deformation factor; no edge cracks.
 factors={tuple(p):1.0 for p in old[:3066]}
 before=old[:3066].reshape(-1,3,3);bn=np.cross(before[:,1]-before[:,0],before[:,2]-before[:,0])
 for iteration in range(200):
  v[:3066]=old[:3066]+np.array([factors[tuple(p)] for p in old[:3066]])[:,None]*(target-old[:3066])
  after=v[:3066].reshape(-1,3,3);an=np.cross(after[:,1]-after[:,0],after[:,2]-after[:,0])
  dots=(an*bn).sum(1)/(np.linalg.norm(an,axis=1)*np.linalg.norm(bn,axis=1))
  bad=np.where(dots<.20)[0]
  if not len(bad):break
  for key in {tuple(p) for i in bad for p in before[i]}:factors[key]*=.8
 else:raise RuntimeError('Cannot preserve inherited facet orientation')
 limiter={'limitedSharedVertices':sum(f<1 for f in factors.values()),'minimumScale':min(factors.values()),'iterations':iteration,'minimumNormalDot':float(dots.min())}
 body['positions']=v.reshape(-1).tolist()
 # Closed shell construction adds true thickness behind each original exposed
 # front surface; never enables double-sided rendering or a topology waiver.
 head=n['parts'][1];orig=copy.deepcopy(head);closures=[]
 for label,ids,depth in [('palate',list(range(7)),.022),('tongue',[7,8],.024),('left nostril',[49,50],.009),('right nostril',[51,52],.009)]:
  ts=np.array(orig['positions']).reshape(-1,3,3)[ids];edges=Counter();oriented={}
  for t in ts:
   for a,c in zip(t,np.roll(t,-1,axis=0)):
    a,c=tuple(a),tuple(c);key=tuple(sorted((a,c)));edges[key]+=1;oriented[key]=(a,c)
  boundary=[oriented[e] for e,count in edges.items() if count==1]
  normals=np.cross(ts[:,1]-ts[:,0],ts[:,2]-ts[:,0]);direction=normals.sum(0);direction/=np.linalg.norm(direction)
  offset=-depth*direction
  color=orig['colorsLinear'][ids[0]*9:ids[0]*9+3]
  joint=orig['skinIndices'][ids[0]*12:ids[0]*12+4];weight=orig['skinWeights'][ids[0]*12:ids[0]*12+4]
  added=[]
  for t in ts:added.append([t[0]+offset,t[2]+offset,t[1]+offset])
  for a,c in boundary:
   a,c=np.array(a),np.array(c);added.extend([[c,a,a+offset],[c,a+offset,c+offset]])
  start=len(head['positions'])//9
  for t in added:
   for p in t:
    head['positions'].extend(p.tolist());head['colorsLinear'].extend(color);head['skinIndices'].extend(joint);head['skinWeights'].extend(weight);head['furLen'].append(0)
  closures.append({'anatomy':label,'originalTriangles':ids,'addedTriangleRange':[start,len(head['positions'])//9],'depth':depth,'extrusionVector':offset.tolist(),'boundaryEdges':len(boundary),'originalFrontSurfaceExact':True})
 n['status']='Unaccepted closed-anatomy complete study: pass2 closed bowl reshaped, four anatomical inserts closed, no score or runtime admission'
 stats=validate_native(n)
 dest=H/'closed-anatomy-native.json';dest.write_text(json.dumps(n,separators=(',',':'),allow_nan=False)+'\n')
 report={'sourcePins':[pin(BASE),pin(ART/'concepts/lowpoly-revision-2026-10-18/brine-puffer-lowpoly.webp')],'candidatePin':pin(dest),'schema':stats,'closures':closures,'orientationSafetyLimiter':limiter,'bodyHullTriangles':1022,'maximumHullDisplacement':float(np.linalg.norm(v[:3066]-old[:3066],axis=1).max()),'bodyVolumeBefore':topology(triangles(b['parts'][0])[:1022]),'bodyVolumeAfter':topology(triangles(body)[:1022]),'bonesExact':n['bones']==b['bones'],'spikesBrowsBeakExact':body['positions'][9198:]==b['parts'][0]['positions'][9198:],'tailFourFinsExact':n['parts'][2:]==b['parts'][2:],'originalHeadFrontArraysExact':all(head[k][:len(orig[k])]==orig[k] for k in ['positions','colorsLinear','skinIndices','skinWeights','furLen']),'runtimeAdmitted':False,'score':None,'limitations':['Closed component tests do not establish no inter-component intersection or animation attachment.','Existing body connectivity is retained; shoulder course warp is not retopology.','No runtime, motion, physics, likeness or acceptance claim.']}
 (H/'construction-receipt.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':build()
