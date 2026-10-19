"""Pass3: replace the mantle/pouch outside the retained orbital inset with an
explicit irregular diagonal triangulation. No old latitude courses retained.
All native coordinates +Y up, +Z forward. Requires numpy and triangle.
"""
import copy,hashlib,json,math,sys
from pathlib import Path
from collections import Counter
import numpy as np
H=Path(__file__).resolve().parent;ROOT=H.parents[3];A=H.parents[1]
sys.path.insert(0,str(ROOT/'tmp/puffer-complete-pass3/deps'))
import triangle
sys.path.insert(0,str(A/'puffer-remaster-guided'))
from paint_semantic_face_diagonal_robust import COLORS,triangles,topology
sys.path.insert(0,str(A/'puffer-spike-study'))
from build_spikes import clearance
sys.path.insert(0,str(A/'approved-puffer'))
from native_export import validate_native
BASE=H.parent/'pass2/pass2-native.json'
def pin(p):return {'path':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
def build():
 b=json.loads(BASE.read_text());n=copy.deepcopy(b);p=b['parts'][0];ts=np.array(p['positions'][:1022*9]).reshape(-1,3,3)
 keep=np.array([any(v[2]>.49 and .64<v[1]<1.08 and abs(v[0])<.54 for v in t) for t in ts])
 edges=Counter(tuple(sorted((tuple(a),tuple(b))))for t in ts[keep]for a,b in zip(t,np.roll(t,-1,axis=0)))
 boundary=[e for e,c in edges.items()if c==1];bv=sorted({v for e in boundary for v in e});center=np.array([0.,.74,.12])
 def uv(v):
  d=np.array(v)-center;d/=np.linalg.norm(d);return d[:2]/(1-d[2])
 verts=list(bv);pts=[uv(v) for v in bv];segments=[(bv.index(a),bv.index(b))for a,b in boundary]
 # Unequal angular stations, alternating offsets and varying ring populations.
 # The ring heights are only an authoring scaffold; no edges follow a latitude.
 for polar,count,phase in [(42,13,9),(65,15,21),(89,16,3),(113,14,17),(138,11,0),(161,7,23),(180,1,0)]:
  for j in range(count):
   az=math.radians(360*j/count+phase);theta=math.radians(polar+(0 if count==1 else [0,5,-4,3,-3][j%5]))
   d=np.array([math.sin(theta)*math.cos(az),math.sin(theta)*math.sin(az),math.cos(theta)])
   v=center+d/np.linalg.norm(d/np.array([.675,.65,.73]))
   # Hanging bowl: preserve full mid-pouch, pull its low corners inward.
   if v[1]<.55 and v[2]>.15:
    q=max(0.,(.55-v[1])/.5);v[0]*=1-.12*q;v[2]-=.045*q
   u=uv(v)
   # Interior of stereographic boundary polygon via ray parity.
   inside=False
   for aa,bb in segments:
    a,c=pts[aa],pts[bb]
    if (a[1]>u[1])!=(c[1]>u[1]) and u[0]<(c[0]-a[0])*(u[1]-a[1])/(c[1]-a[1])+a[0]:inside=not inside
   if inside:verts.append(tuple(v));pts.append(u)
 r=triangle.triangulate({'vertices':np.array(pts),'segments':np.array(segments)},'pQ')
 if len(r['vertices'])!=len(verts):raise RuntimeError('Unexpected inserted vertices')
 out={k:[] for k in ['positions','colorsLinear','skinIndices','skinWeights','furLen']};out['name']='Rebuilt diagonal mantle cheek and hanging pouch'
 def exact(fi):
  for k,w in [('positions',9),('colorsLinear',9),('skinIndices',12),('skinWeights',12),('furLen',3)]:out[k].extend(p[k][fi*w:(fi+1)*w])
 for fi,k in enumerate(keep):
  if k:exact(fi)
 for ids in r['triangles']:
  t=np.array([verts[i] for i in ids]);c=t.mean(0)
  if np.dot(np.cross(t[1]-t[0],t[2]-t[0]),c-center)<0:t=t[[0,2,1]]
  x,h,z=c
  key='ivory'if z>.12 and h<.77-.32*abs(x)+.16*z else 'teal'
  for v in t:
   out['positions'].extend(v.tolist());out['colorsLinear'].extend(COLORS[key]);out['skinIndices'].extend([1,0,0,0]);out['skinWeights'].extend([1,0,0,0]);out['furLen'].append(0)
 hull_count=len(out['positions'])//9;hull=np.array(out['positions']).reshape(-1,3,3)
 # Retain brows/beak exactly, preserve pass2 spike widths and tip hierarchy.
 for fi in range(1022,1426):exact(fi)
 spike_receipts=[]
 for i in range(8):
  ss=ts # unused: spike sources below are outside original core.
  raw=np.array(p['positions'][(1426+i*6)*9:(1432+i*6)*9]).reshape(-1,3)
  unique=np.unique(raw,axis=0);tip=np.argmax(unique[:,1]);roots=np.delete(unique,tip,axis=0);c=roots.mean(0)
  shift=np.zeros(3);direction=center-c;direction/=np.linalg.norm(direction)
  def samples(v):return np.concatenate([v,(v[:,None]+v[None,:]).reshape(-1,3)/2,v.mean(0)[None]])
  while max(clearance(samples(roots+shift),hull))>-.004:
   shift+=direction*.003
   if np.linalg.norm(shift)>.35:raise RuntimeError('Spike burial excessive')
  for fi in range(1426+i*6,1432+i*6):
   before=len(out['positions']);exact(fi)
   vv=np.array(out['positions'][before:]).reshape(-1,3)
   for j,v in enumerate(vv):
    if not np.array_equal(v,unique[tip]):vv[j]+=shift
   out['positions'][before:]=vv.reshape(-1).tolist()
  spike_receipts.append({'index':i,'rootTranslation':shift.tolist(),'maximumSampledDistance':max(clearance(samples(roots+shift),hull))})
 n['parts'][0]=out;n['status']='Unaccepted pass3 reconstructed diagonal mantle and bowl; preserved orbital assembly and fins; static study only'
 vol=topology(triangles(out)[:hull_count]);stats=validate_native(n)
 dest=H/'pass3-native.json';dest.write_text(json.dumps(n,separators=(',',':'),allow_nan=False)+'\n')
 receipt={'sourcePins':[pin(BASE)],'candidatePin':pin(dest),'schema':stats,'oldHullTriangles':1022,'retainedOrbitalHullTriangles':int(sum(keep)),'newPatchTriangles':len(r['triangles']),'hullTriangles':hull_count,'boundaryVertices':len(bv),'authoredPatchVertices':len(verts)-len(bv),'hullSignedVolume':vol,'bonesExact':n['bones']==b['bones'],'headExact':n['parts'][1]==b['parts'][1],'tailExact':n['parts'][2]==b['parts'][2],'finsExact':n['parts'][3:]==b['parts'][3:],'spikes':spike_receipts,'qualityScore':None,'runtimeAdmitted':False,'limitations':['Retained four open head inlays require individual diagnosis; no topology waiver.','Finite root sampling is not animation or continuous attachment proof.','Static mesh requires independent original-target review.']}
 (H/'construction-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
if __name__=='__main__':build()
