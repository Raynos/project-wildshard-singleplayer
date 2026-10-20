"""Independent GLB/native triangle, color, joint and bind parity audit."""
import json,struct,math,sys,hashlib,zlib
from pathlib import Path
from collections import Counter
import numpy as np
p=Path(sys.argv[1]);native=json.loads((p/'native-source.json').read_text());raw=(p/'keelmaw-v1.glb').read_bytes();length=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+length]);binary=raw[28+length:]
def acc(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];size={'SCALAR':1,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];fmt='<'+{5121:'B',5123:'H',5125:'I',5126:'f'}[a['componentType']]*size;stride=v.get('byteStride',struct.calcsize(fmt));start=v.get('byteOffset',0)+a.get('byteOffset',0);return [struct.unpack_from(fmt,binary,start+k*stride) for k in range(a['count'])]
def key(pos,col,joint):return tuple(struct.unpack('<f',struct.pack('<f',x))[0] for x in (*pos,*col))+(joint,)
expected=Counter();minimumArea=1e9;zero=0
for part in native['parts']:
 for i in range(0,len(part['positions']),3):
  vi=i//3;indices=part['skinIndices'][vi*4:vi*4+4];weights=part['skinWeights'][vi*4:vi*4+4];assert weights==[1,0,0,0];assert indices[0]==[b['name'] for b in native['bones']].index(part['name']);expected[key(part['positions'][i:i+3],part['colorsLinear'][i:i+3],part['name'])]+=1
 for i in range(0,len(part['positions']),9):
  a,b,c=np.array(part['positions'][i:i+9]).reshape((3,3));area=float(np.linalg.norm(np.cross(b-a,c-a))/2);minimumArea=min(area,minimumArea);zero+=area<1e-10
actual=Counter();skin=g['skins'][0];names=[g['nodes'][i]['name'] for i in skin['joints']]
for node in g['nodes']:
 if 'mesh' not in node:continue
 assert not any(k in node for k in ['translation','rotation','scale','matrix']),node
 for prim in g['meshes'][node['mesh']]['primitives']:
  attrs=prim['attributes'];positions=acc(attrs['POSITION']);joints=acc(attrs['JOINTS_0']);weights=acc(attrs['WEIGHTS_0']);color=g['materials'][prim['material']]['pbrMetallicRoughness']['baseColorFactor'][:3]
  for (i,) in acc(prim['indices']):
   assert abs(weights[i][0]-1)<1e-6 and sum(weights[i][1:])<1e-6;actual[key(positions[i],color,names[joints[i][0]])]+=1
# Validate exported normal directions against each actual oriented triangle.
minimumNormalDot=1.;maximumNormalLengthError=0.;normalCorners=0
for node in g['nodes']:
 if 'mesh' not in node:continue
 for prim in g['meshes'][node['mesh']]['primitives']:
  attrs=prim['attributes'];positions=np.array(acc(attrs['POSITION']));normals=np.array(acc(attrs['NORMAL']));ids=[r[0] for r in acc(prim['indices'])]
  assert np.isfinite(normals).all()
  for offset in range(0,len(ids),3):
   indices=ids[offset:offset+3];a,b,c=positions[indices];n=np.cross(b-a,c-a);n/=np.linalg.norm(n)
   for i in indices:
    minimumNormalDot=min(minimumNormalDot,float(np.dot(n,normals[i])));maximumNormalLengthError=max(maximumNormalLengthError,abs(float(np.linalg.norm(normals[i]))-1));normalCorners+=1
assert minimumNormalDot>.999 and maximumNormalLengthError<1e-5,(minimumNormalDot,maximumNormalLengthError)
# Both exporters use float32 vertex/material channels. Exact counters compare all repeated corners.
assert actual==expected,f'Triangle/color/skin parity mismatch: {sum((actual-expected).values())}'
# Oriented triangle parity, invariant only to cyclic starting corner, not winding reversal.
def oriented(rows):
 return min(tuple(rows[i:]+rows[:i]) for i in range(3))
expectedTriangles=Counter();actualTriangles=Counter();rimChecks=0
for part in native['parts']:
 for offset in range(0,len(part['positions']),9):
  rows=[key(part['positions'][offset+i:offset+i+3],part['colorsLinear'][offset+i:offset+i+3],part['name']) for i in [0,3,6]];expectedTriangles[oriented(rows)]+=1
for node in g['nodes']:
 if 'mesh' not in node:continue
 for prim in g['meshes'][node['mesh']]['primitives']:
  attrs=prim['attributes'];positions=acc(attrs['POSITION']);joints=acc(attrs['JOINTS_0']);color=g['materials'][prim['material']]['pbrMetallicRoughness']['baseColorFactor'][:3];indices=[r[0] for r in acc(prim['indices'])]
  for offset in range(0,len(indices),3):
   ids=indices[offset:offset+3];actualTriangles[oriented([key(positions[k],color,names[joints[k][0]]) for k in ids])]+=1
   if node['name'].endswith('sculpted ivory rim'):
    name=node['name'].split(' ')[0];x,y,z,scale={'head':(0,2.05,0,1.06),'leftHead':(-1.28,1.60,.02,.78),'rightHead':(1.30,1.48,.05,.73)}[name]
    points=np.array([positions[k] for k in ids]);center=points.mean(axis=0);theta=math.atan2((center[2]-z-.10*scale)/.85,center[0]-x);ring=np.array([x+.565*scale*math.cos(theta),y+scale*(1.245+.08*math.sin(theta)),z+scale*(.565*.85*math.sin(theta)+.10)]);normal=np.cross(points[1]-points[0],points[2]-points[0]);assert normal.dot(center-ring)>0,'Inward ivory rim winding';rimChecks+=1
assert actualTriangles==expectedTriangles,'Oriented triangle parity mismatch'
# Nine explicit orthographic culling projections compare native and GLB visible triangle sets.
visibility={}
for name,az,el in [('front',0,0),('left',-90,0),('right',90,0),('back',180,0),('top',0,90),('elevated-front',0,39),('elevated-left',-90,39),('elevated-right',90,39),('elevated-back',180,39)]:
 az=math.radians(az);el=math.radians(el);eye=np.array([math.sin(az)*math.cos(el),math.sin(el),math.cos(az)*math.cos(el)])
 def visible(counter):
  result=Counter()
  for tri,count in counter.items():
   x,y,z=[np.array(row[:3]) for row in tri]
   if np.dot(np.cross(y-x,z-x),eye)>1e-10:result[tri]=count
  return result
 n=visible(expectedTriangles);gvis=visible(actualTriangles);assert n==gvis,'Single-sided projection parity mismatch: '+name
 visibility[name]=sum(n.values())
# Every authored component is a closed outward manifold. Export joining does not hide seams.
closed=[];opened=[];vesselVolumes={}
construction=json.loads((p/'construction.json').read_text())
for component in construction['components']:
 part=next(x for x in native['parts'] if x['name']==component['joint']);start=component['startVertex']*3;end=start+component['triangles']*9
 points=np.array(part['positions'][start:end]).reshape((-1,3,3));edges=Counter();directed=Counter();volume=0
 for tri in points:
  tri=[tuple(v) for v in tri]
  for i in range(3):edges[tuple(sorted([tri[i],tri[(i+1)%3]]))]+=1;directed[(tri[i],tri[(i+1)%3])]+=1
  x,y,z=np.array(tri);volume+=float(np.dot(x,np.cross(y,z)))/6
 assert all(n==2 for n in edges.values()),'Nonmanifold '+component['name']
 assert all(n==directed[(b,a)] for (a,b),n in directed.items()),'Inconsistent winding '+component['name']
 assert volume>0,'Inward '+component['name']
 closed.append({'name':component['name'],'volume':volume})
for material in g['materials']:assert material.get('doubleSided',False) is False
# Compute actual GLB hierarchy world transforms and verify bind inverse closure.
world={}
def visit(i,parent):
 n=g['nodes'][i];m=np.eye(4)
 if 'rotation' in n:
  x,y,z,w=n['rotation'];m[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
 m[:3,3]=n.get('translation',[0,0,0]);m[:3,:3]=m[:3,:3]@np.diag(n.get('scale',[1,1,1]));world[i]=parent@m
 for child in n.get('children',[]):visit(child,world[i])
for i in g['scenes'][g['scene']]['nodes']:visit(i,np.eye(4))
binds=acc(skin['inverseBindMatrices']);bindError=0
for i,joint in enumerate(skin['joints']):
 inverse=np.array(binds[i]).reshape((4,4)).T;bindError=max(bindError,float(np.max(abs(world[joint]@inverse-np.eye(4)))));b=next(b for b in native['bones'] if b['name']==g['nodes'][joint]['name']);assert np.max(abs(world[joint][:3,3]-b['pos']))<1e-5
assert bindError<1e-5 and zero==0
assert len(raw)<1000000 and (p/'native-source.json').stat().st_size<5000000
allpoints=np.array([v for part in native['parts'] for v in part['positions']]).reshape((-1,3));bounds=[allpoints.min(axis=0).tolist(),allpoints.max(axis=0).tolist()]
report={'schema':'wildshard.keelmaw.source-audit.v1','vertices':sum(expected.values()),'triangles':sum(expected.values())//3,'joints':names,'glbNativePositionColorSkinParity':True,'orientedTriangleParity':True,'exportedNormals':{'corners':normalCorners,'minimumGeometricNormalDot':minimumNormalDot,'maximumUnitLengthError':maximumNormalLengthError},'outwardRimTriangles':rimChecks,'singleSidedGlbMaterials':True,'numericalSingleSidedVisibilityParity':visibility,'positiveClosedComponents':closed,'watertightVesselVolumes':vesselVolumes,'intentionalOpenComponents':opened,'maximumBindClosureError':bindError,'zeroAreaTriangles':zero,'minimumTriangleArea':minimumArea,'bounds':bounds,'coordinateConvention':'+Y-up +Z-forward right-handed; Blender x,-z,y','visualAcceptance':False,'colliderAcceptance':False,'runtimeAcceptance':False,'files':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in p.iterdir() if f.name in ['native-source.json','keelmaw-v1.glb','metadata.json','payload.bin','construction.json']}}
(p/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
