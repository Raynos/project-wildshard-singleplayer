"""All-stage complete geometry/contact audit, using documented finite predicates.
No adjacency blanket exemptions; shared-vertex crossings are included.
Separate closed components are classified, never called a welded solid.
"""
import hashlib,json,sys,struct
from pathlib import Path
import numpy as np
from geometry_tools import *
H=Path(__file__).resolve().parent;A=H.parents[1];sys.path.insert(0,str(A/'puffer-spike-study'));from build_spikes import clearance
native=json.loads((H/'candidate-native.json').read_text());pre=json.loads((H/'prepaint-native.json').read_text());source=json.loads((A/'puffer-remaster-guided/seated-mouth-diagnostic-native.json').read_text())
raw=(H/'candidate.glb').read_bytes();jl=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+jl]);blob=raw[28+jl:]
def glb_positions(mesh):
 ai=mesh['primitives'][0]['attributes']['POSITION'];a=g['accessors'][ai];view=g['bufferViews'][a['bufferView']];return np.frombuffer(blob,dtype='<f4',count=a['count']*3,offset=view.get('byteOffset',0)+a.get('byteOffset',0)).astype(float).reshape(-1,3,3)
formats={'prepaint':[np.array(p['positions']).reshape(-1,3,3)for p in pre['parts']],'postpaint':[np.array(p['positions']).reshape(-1,3,3)for p in native['parts']],'exportedFloat32':[glb_positions(m)for m in g['meshes']]}
checks={'finiteAttributes':all(np.isfinite(p[k]).all()for p in native['parts']for k in ['positions','colorsLinear','skinWeights','skinIndices','furLen']),'sevenPartsEightBones':len(native['parts'])==7 and len(native['bones'])==8,'bindsExact':native['bones']==source['bones'],'paintPositionsExact':all(np.array_equal(a,b)for a,b in zip(formats['prepaint'],formats['postpaint']))}
report={'checks':checks,'tolerances':{'planeDistance':1e-10,'properCrossingSegmentLength':1e-9,'contactDistance':1e-9,'coplanarProjectedArea':1e-12},'limitations':['Predicates use fixed finite tolerances; this is not exact-arithmetic certification.','Intentional intersecting closed appendage components are classified separately from within-component defects.','Whole-facet diagonal paint has no geometric cuts; visual boundary quantization requires actual review.'],'formats':{},'runtimeAdmitted':False}
for fmt,parts in formats.items():
 if fmt=='postpaint' and checks['paintPositionsExact']:
  report['formats'][fmt]={'geometryExactlyEquals':'prepaint','evidence':'Every position array checked with numpy.array_equal; all geometric predicates and attachment results therefore identical.'};continue
 all_t=np.concatenate(parts);labels=[];tops=[];offset=0
 for pi,t in enumerate(parts):
  vv,ff=ordered_indexed(t);groups=component_ids(ff);component=np.zeros(len(t),dtype=int)
  for ci,ids in enumerate(groups):component[ids]=ci
  labels.extend([[pi,int(ci)]for ci in component]);top=topology(t);tops.append({'part':native['parts'][pi]['name'],**top});offset+=len(t)
 crossings=audit(all_t);self_cross=[];inter=[]
 for row in crossings:
  a,b=row['faces'];row['components']=[labels[a],labels[b]]
  (self_cross if labels[a]==labels[b]else inter).append(row)
 cs=contacts(all_t);self_cs={};inter_cs={};uv,ff=indexed(all_t);vertex_components=defaultdict(set)
 for i,face in enumerate(ff):
  for vi in face:vertex_components[int(vi)].add(tuple(labels[i]))
 for kind,rows in cs.items():
  own=[];other=[]
  for row in rows:
   if kind=='coplanarAreaOverlap':a,b=row['faces'];same=labels[a]==labels[b]
   elif kind=='nonincidentVertexFace':same=tuple(labels[row['face']])in vertex_components[row['vertex']]
   else:
    a,b=row['edges'];same=bool((vertex_components[a[0]]&vertex_components[a[1]])&(vertex_components[b[0]]&vertex_components[b[1]]))
   (own if same else other).append(row)
  self_cs[kind]=own;inter_cs[kind]=other
 checks[fmt+'OrientedClosedPositive']=all(x['edgeManifoldOriented']and x['vertexManifold']and x['minimumArea']>1e-12 and all(c['volume']>1e-12 for c in x['components'])for x in tops)
 checks[fmt+'ZeroWithinComponentCrossings']=not self_cross;checks[fmt+'ZeroWithinComponentContacts']=not any(self_cs.values())
 report['formats'][fmt]={'topology':tops,'withinComponentCrossings':self_cross,'withinComponentContacts':self_cs,'separateComponentCrossings':inter,'separateComponentContacts':inter_cs,'separateComponentPolicy':'Closed spikes, shell/bill, tail-root/fan and layered face solids intentionally intersect. Contacts listed explicitly; no union-manifold assertion.'}
 print(fmt,'self crossing',len(self_cross),'self contacts',{k:len(v)for k,v in self_cs.items()},'inter',len(inter),flush=True)
 # Continuous cap containment: all cap vertices interior plus no proper cap/
 # hull crossing or coplanar/point contacts, over the complete cap triangles.
 global_uv=uv.copy();global_ff=ff.copy()
 body=parts[0];vv,ff=ordered_indexed(body);groups=component_ids(ff);hull=body[groups[0]];root_rows=[]
 for ci,ids in enumerate(groups[1:],1):
  vertices=np.unique(ff[ids]);
  if len(ids)!=6 or len(vertices)!=5:continue
  tip=vertices[np.argmax(vv[vertices,1])];root=[j for j in vertices if j!=tip];caps=[i for i in ids if tip not in ff[i]];captri=body[caps];samples=np.concatenate([vv[root],vv[root].mean(0)[None,:],(vv[root][:,None,:]+vv[root][None,:,:]).reshape(-1,3)/2]);dist=clearance(samples,hull)
  capset=set(caps);hullset=set(groups[0]);rootcoords=set(map(tuple,vv[root]));hullcoords=set(map(tuple,hull.reshape(-1,3)));capedges={tuple(sorted((tuple(a),tuple(b))))for tr in captri for a,b in zip(tr,np.roll(tr,-1,axis=0))};hulledges={tuple(sorted((tuple(a),tuple(b))))for tr in hull for a,b in zip(tr,np.roll(tr,-1,axis=0))}
  hits=[x for x in crossings if (x['faces'][0]in hullset and x['faces'][1]in capset)or(x['faces'][1]in hullset and x['faces'][0]in capset)]
  capcontacts=[]
  for row in cs['nonincidentVertexFace']:
   coord=tuple(global_uv[row['vertex']]);face=row['face']
   if (coord in rootcoords and face in hullset)or(coord in hullcoords and face in capset):capcontacts.append(row)
  for row in cs['coplanarAreaOverlap']:
   a,b=row['faces']
   if (a in hullset and b in capset)or(b in hullset and a in capset):capcontacts.append(row)
  for row in cs['nonincidentEdgeEdge']:
   a,b=[tuple(sorted(map(tuple,global_uv[e])))for e in row['edges']]
   if (a in capedges and b in hulledges)or(a in hulledges and b in capedges):capcontacts.append(row)
  root_rows.append({'component':ci,'capTriangleCount':len(caps),'finiteSampleCount':len(samples),'maximumSignedDistance':max(dist),'capHullProperCrossings':len(hits),'capHullContacts':len(capcontacts),'continuousContainmentUnderFinitePredicates':max(dist)<0 and not hits and not capcontacts,'allFiniteSamplesInside':max(dist)<0})
 checks[fmt+'AllSpikeRootSamplesInside']=all(r['allFiniteSamplesInside']for r in root_rows)
 checks[fmt+'AllSpikeCapsContained']=all(r['continuousContainmentUnderFinitePredicates']for r in root_rows)
 report['formats'][fmt]['attachmentCaps']=root_rows
 (H/'geometry-audit.json').write_text(json.dumps(report,separators=(',',':'),allow_nan=False)+'\n')
old=np.concatenate([np.array(p['positions']).reshape(-1,3)for p in source['parts']]);new=np.concatenate([p.reshape(-1,3)for p in formats['postpaint']]);i=np.arange(4096);y=1-2*(i+.5)/4096;r=np.sqrt(1-y*y);ang=i*np.pi*(3-np.sqrt(5));directions=np.concatenate([np.stack([r*np.cos(ang),y,r*np.sin(ang)],1),np.eye(3),-np.eye(3)]);delta=(new@directions.T).max(0)-(old@directions.T).max(0)
report['shape']={'sourceBounds':[old.min(0).tolist(),old.max(0).tolist()],'candidateBounds':[new.min(0).tolist(),new.max(0).tolist()],'directionCount':len(directions),'supportDeltaRange':[float(delta.min()),float(delta.max())],'maximumAbsoluteSupportDelta':float(abs(delta).max()),'patchEnvelopeManifest':'carrier-controls.json','appendageEnvelopeManifest':'whole-fin-controls.json','spikeEnvelopeManifest':'shoulder-controls.json'}
report['allImplementedChecksPass']=all(checks.values());report['continuousAttachmentCertification']=False;report['sourcePins']={p:hashlib.sha256((H/p).read_bytes()).hexdigest()for p in ['candidate-native.json','prepaint-native.json','candidate.glb','build_candidate.py','paint_candidate.py','geometry_tools.py']}
(H/'geometry-audit.json').write_text(json.dumps(report,separators=(',',':'),allow_nan=False)+'\n');print(checks,flush=True)
