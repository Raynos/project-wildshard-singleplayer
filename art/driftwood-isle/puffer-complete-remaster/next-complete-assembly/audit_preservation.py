"""Independent exact preservation, region envelopes and carrier orientation."""
import json,hashlib,sys
from pathlib import Path
import numpy as np
from geometry_tools import *
H=Path(__file__).resolve().parent;A=H.parents[1];source=json.loads((A/'puffer-remaster-guided/seated-mouth-diagnostic-native.json').read_text());n=json.loads((H/'candidate-native.json').read_text());pre=json.loads((H/'prepaint-native.json').read_text());controls=json.loads((H/'carrier-controls.json').read_text());ownership=json.loads((H/'surface-ownership.json').read_text())['carrierFaces'];st=np.array(source['parts'][0]['positions']).reshape(-1,3,3);nt=np.array(n['parts'][0]['positions']).reshape(-1,3,3);ov,of=ordered_indexed(st);indexed=json.loads((H/'edited-carrier-indexed.json').read_text());cv=np.array(indexed['vertices']);rows=json.loads((H/'shoulder-controls.json').read_text());allowed={tuple(p)for row in rows for key in ['rootBefore','tipBefore'] if key in row for p in ([row[key]]if key=='tipBefore'else row[key])};violations=[]
for i,row in enumerate(ownership):
 if row['patch'] is not None:continue
 old=st[row['sourceFace']]
 for a,b in zip(old,nt[i]):
  if not np.array_equal(a,b)and tuple(a)not in allowed:violations.append({'sourceFace':row['sourceFace'],'from':a.tolist(),'to':b.tolist()})
checks={'outsideNamedCarrierAndSpikeEnvelopesExact':not violations,'bonesAndPivotsExact':n['bones']==source['bones'],'headExposedPositionsExact':n['parts'][1]['positions'][:len(source['parts'][1]['positions'])]==source['parts'][1]['positions'],'eyePalateTongueNostrilColorsExact':n['parts'][1]['colorsLinear'][:1005*9]==source['parts'][1]['colorsLinear'][:1005*9],'tailFullPayloadExact':n['parts'][2]==json.loads((A/'puffer-tail-study/tail-native-study.json').read_text())['parts'][0],'paintChangesNoPositions':all(p['positions']==q['positions']for p,q in zip(n['parts'],pre['parts']))}
regions=[]
for p in controls['patches']:
 axes=p['projectionAxes'];boundary=p['boundaryVertexIds'];uv=cv[:,axes];sgn=np.sign(sum(cross2(uv[a],uv[b])for a,b in zip(boundary,boundary[1:]+boundary[:1])));fs=np.array(p['replacementFaces']);areas=[sgn*cross2(uv[b]-uv[a],uv[c]-uv[a])/2 for a,b,c in fs];deltas=[];dropped=next(i for i in range(3)if i not in axes)
 for point in p['authoredControlPositions']:
  candidates=[];q=np.array(point)
  for tr in st[p['sourceFaces']]:
   mat=np.vstack([tr[:,axes].T,np.ones(3)])
   if abs(np.linalg.det(mat))<1e-14:continue
   w=np.linalg.solve(mat,np.r_[q[axes],1])
   if min(w)>=-1e-8:candidates.append(float(q[dropped]-w@tr[:,dropped]))
  deltas.append({'control':point,'signedAxisDistancesToSourceSheet':candidates})
 regions.append({'name':p['name'],'oldFaces':len(p['sourceFaces']),'newFaces':len(fs),'minimumBoundaryOrientedProjectedTriangleArea':min(areas),'allReplacementFacesAgreeWithCarrierProjection':min(areas)>0,'boundaryExact':all(np.array_equal(cv[j],ov[j])for j in boundary),'newControlDepthComparisons':deltas,'sourceBounds':[st[p['sourceFaces']].min((0,1)).tolist(),st[p['sourceFaces']].max((0,1)).tolist()],'replacementBounds':[cv[fs].min((0,1)).tolist(),cv[fs].max((0,1)).tolist()]})
checks['allPatchBoundariesExact']=all(r['boundaryExact']for r in regions);checks['allReplacementFacesCarrierOriented']=all(r['allReplacementFacesAgreeWithCarrierProjection']for r in regions)
oldcore=st[component_ids(of)[0]];nv,nf=ordered_indexed(nt);newcore=nt[component_ids(nf)[0]];volume=lambda t:float(np.einsum('ij,ij->i',t[:,0],np.cross(t[:,1],t[:,2])).sum()/6)
deps=[A/'puffer-remaster-guided/paint_semantic_face_diagonal_robust.py',A/'puffer-spike-study/build_spikes.py',H.parent/'local-surface-repair/validate.py',H.parent/'local-surface-repair/intersections.py',H.parent/'closed-anatomy-study/save_preview.py',A/'puffer-fin-study/terminal-fin-fans-indexed.json']
r={'checks':checks,'violations':violations,'regions':regions,'hullVolumeBefore':volume(oldcore),'hullVolumeAfter':volume(newcore),'hullVolumeRelativeChange':volume(newcore)/volume(oldcore)-1,'dependencyPins':[{'path':str(p.relative_to(H.parents[3])),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in deps],'allChecksPass':all(checks.values()),'runtimeAdmitted':False};(H/'preservation-audit.json').write_text(json.dumps(r,indent=2,default=lambda x:x.item())+'\n');print(checks);assert all(checks.values())
