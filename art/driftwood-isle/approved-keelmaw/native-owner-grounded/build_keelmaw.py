"""Keelmaw complete editable source, right-handed native +Y up/+Z front.
Blender maps (x,y,z) to (x,-z,y). Closed faceted components, actual skin,
no runtime writes. Run under heavy lane: blender -b -t 2 -P this -- --out DIR --render.
"""
import argparse,sys,math,json,hashlib,importlib.util
from pathlib import Path
import bpy
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--render',action='store_true');p.add_argument('--view');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
spec=importlib.util.spec_from_file_location('codec',ROOT/'art/driftwood-isle/approved-puffer/native_export.py');codec=importlib.util.module_from_spec(spec);spec.loader.exec_module(codec)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
hexes={'green':'405B51','light':'53695A','dark':'283C38','moss':'727B38','mossLight':'ACAC4B','gold':'BA8C42','goldLight':'D9AF65','goldDark':'9E7135','ivory':'ECD6A1','ivoryShade':'BEA775','mouth':'48241F','tongue':'8C4439','black':'151C19','eye':'F4AE24','rope':'AC813F'}
colors={k:[round(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4,7) for v in [int(h[i:i+2],16)/255 for i in (0,2,4)]] for k,h in hexes.items()};materials={}
for k,c in colors.items():
 m=bpy.data.materials.new(k);m.diffuse_color=(*c,1);m.use_backface_culling=True;m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*c,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.88;materials[k]=m
bones=[{'name':'body','parent':None,'pos':[0,1,0]},{'name':'neck1','parent':'body','pos':[0,1.03,.86]},{'name':'head','parent':'neck1','pos':[0,1.05,1.48]},{'name':'jaw','parent':'head','pos':[0,.84,1.28]}]
for name,par,pos in [('tail1','body',[0,.92,-1]),('tail2','tail1',[-.42,.80,-2.0]),('tail3','tail2',[-1.35,1.00,-2.60])]:bones.append({'name':name,'parent':par,'pos':pos})
legs=[]
for prefix,side,z in [('FL',-1,.72),('FR',1,.72),('BL',-1,-.85),('BR',1,-.85)]:
 names=[prefix+s for s in (['_shoulder','_carpus','_fetlock'] if prefix[0]=='F' else ['_hip','_stifle','_hock'])];pts=[(side*.78,.92,z),(side*1.35,.48,z+.02),(side*1.56,.18,z+.45)]
 for i in range(3):bones.append({'name':names[i],'parent':'body' if i==0 else names[i-1],'pos':list(pts[i])})
 legs.append((prefix,side,z,names,pts))
parts={b['name']:{'name':b['name'],**{k:[] for _,_,_,k in codec.ATTRS}} for b in bones};objects=[];components=[]
def bp(v):return (v[0],-v[2],v[1])
def mesh(name,verts,faces,palette,joint='body'):
 # Shorten the complete muzzle together, retaining original rig pivot contract.
 if joint in ('head','jaw'):
  verts=[(x, y, 1.2+(z-1.2)*.83) for x,y,z in verts]
 tris=[]
 for f in faces:
  for i in range(1,len(f)-1):tris.append((f[0],f[i],f[i+1]))
 volume=sum(Vector(verts[x]).dot(Vector(verts[y]).cross(Vector(verts[z]))) for x,y,z in tris)/6
 if volume<0:tris=[(x,z,y) for x,y,z in tris];volume=-volume
 assert volume>1e-10,name
 data=bpy.data.meshes.new(name);data.from_pydata([bp(v) for v in verts],[],tris);data.update();o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o)
 for k in palette:data.materials.append(materials[k])
 part=parts[joint];bi=[b['name'] for b in bones].index(joint)
 for i,tri in enumerate(tris):
  mi=(i//4+i//13)%len(palette);data.polygons[i].material_index=mi
  for vi in tri:
   part['positions'].extend(round(float(x),6) for x in verts[vi]);part['colorsLinear'].extend(colors[palette[mi]]);part['skinIndices'].extend([bi,0,0,0]);part['skinWeights'].extend([1,0,0,0]);part['furLen'].append(0)
 # Round Blender positions to identical native source precision.
 for i,v in enumerate(verts):data.vertices[i].co=bp([round(float(x),6) for x in v])
 o['nativeJoint']=joint;objects.append(o);components.append({'name':name,'joint':joint,'triangles':len(tris),'startVertex':len(part['positions'])//3-len(tris)*3,'signedVolume':volume});return o
skin=['green','light','green','green','dark'];gold=['gold','goldLight','goldDark'];ivory=['ivory','ivory','ivoryShade']
def loft(name,rows,palette,joint='body',n=10):
 # rows are x,y,z,width,height cross sections along longitudinal Z.
 vs=[]
 for x,y,z,rx,ry in rows:
  vs.extend((x+rx*math.cos(math.tau*i/n),y+ry*math.sin(math.tau*i/n),z) for i in range(n))
 fs=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(rows)-1) for i in range(n)]
 fs.extend([tuple(reversed(range(n))),tuple((len(rows)-1)*n+i for i in range(n))]);return mesh(name,vs,fs,palette,joint)
def tube(name,rows,palette,joint='body',n=6):
 vs=[];previous=None
 for j,(c,r) in enumerate(rows):
  t=(Vector(rows[min(j+1,len(rows)-1)][0])-Vector(rows[max(0,j-1)][0])).normalized();u=Vector((1,0,0)) if previous is None else previous;u=u-t*u.dot(t)
  if u.length<.01:u=Vector((0,0,1))-t*t.z
  u.normalize();v=t.cross(u);previous=u;vs.extend(tuple(Vector(c)+r*(math.cos(math.tau*i/n)*u+math.sin(math.tau*i/n)*v)) for i in range(n))
 fs=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(rows)-1) for i in range(n)];fs.extend([tuple(reversed(range(n))),tuple((len(rows)-1)*n+i for i in range(n))]);return mesh(name,vs,fs,palette,joint)
def ell(name,c,r,palette,joint='body',n=10):
 x,y,z=c;rx,ry,rz=r;return loft(name,[(x,y,z-rz,.03*rx,.03*ry),(x,y,z-rz*.7,rx*.7,ry*.7),(x,y,z,rx,ry),(x,y,z+rz*.7,rx*.7,ry*.7),(x,y,z+rz,.03*rx,.03*ry)],palette,joint,n)
def spike(name,base,tip,w,d,joint='body',palette=gold):
 x,y,z=base;mesh(name,[(x-w,y,z-d),(x+w,y,z-d),(x+w,y,z+d),(x-w,y,z+d),tip],[(0,3,2,1),(0,1,4),(1,2,4),(2,3,4),(3,0,4)],palette,joint)
def plate(name,x,y,z,w,d,joint='body'):
 # raised dorsal scute, closed inset bevel, no painted planar scale.
 vs=[(x-w,y-.035,z-d),(x+w,y-.035,z-d),(x+w,y-.035,z+d),(x-w,y-.035,z+d),(x-w*.8,y+.045,z-d*.8),(x+w*.8,y+.045,z-d*.8),(x+w*.8,y+.045,z+d*.8),(x-w*.8,y+.045,z+d*.8),(x,y+.08,z)]
 fs=[(0,3,2,1)]+[(i,(i+1)%4,(i+1)%4+4,i+4) for i in range(4)]+[(4+i,4+(i+1)%4,8) for i in range(4)];mesh(name,vs,fs,skin,joint)
# Complete low, shoulder-dominant animal; broad angular lofts carry the silhouette.
loft('Broad shoulder armored torso',[(0,.87,-1.23,.35,.32),(0,.94,-.88,.68,.43),(0,1.10,-.3,.94,.64),(0,1.20,.38,1.14,.78),(0,1.12,.88,1.02,.63)],skin,n=12)
loft('Deep warm belly',[(0,.64,-1.12,.30,.20),(0,.64,-.6,.75,.27),(0,.65,.28,.94,.30),(0,.68,.94,.72,.29)],ivory,n=10)
loft('Thick shoulder neck',[(0,1.15,.60,.96,.60),(0,1.13,1.10,.89,.52),(0,1.06,1.52,.73,.39)],skin,'neck1',10)
# Broad muzzle with blunt squared nose and a deep coherent ivory cheek/jaw wedge.
loft('Broad sculpted muzzle',[(0,1.12,1.15,.76,.43),(0,1.26,1.52,.79,.34),(0,1.17,2.10,.67,.23),(0,1.11,2.62,.59,.20),(0,1.10,2.78,.56,.19)],skin,'head',8)
loft('Upper dark palate',[(0,1.01,1.3,.60,.05),(0,.99,1.9,.59,.05),(0,.96,2.72,.51,.045)],['mouth'],'head',8)
loft('Massive lower jaw wedge',[(0,.80,1.19,.69,.35),(0,.65,1.61,.72,.31),(0,.43,2.15,.61,.24),(0,.31,2.72,.54,.20),(0,.34,2.82,.48,.17)],ivory,'jaw',8)
loft('Recessed lower mouth',[(0,.91,1.32,.49,.08),(0,.81,1.69,.55,.06),(0,.59,2.19,.49,.045),(0,.45,2.70,.44,.035)],['mouth','tongue'],'jaw',8)
ell('Dark throat',(0,.96,1.41),(.52,.30,.24),['mouth'],'head',8)
for side in [-1,1]:
 loft('Heavy ivory cheek '+str(side),[(side*.57,.85,1.12,.24,.40),(side*.63,.80,1.42,.29,.39),(side*.63,.68,1.76,.23,.32),(side*.56,.49,2.07,.12,.18)],ivory,'head',8)
 # Closed annular socket: an actual aperture, not a solid globe hiding the iris.
 socket=[];n=8
 for x,ry,rz in [(.77,.13,.19),(.89,.13,.19),(.89,.092,.135),(.78,.092,.135)]:
  socket.extend((side*x,1.285+ry*math.cos(math.tau*q/n),1.74+rz*math.sin(math.tau*q/n)) for q in range(n))
 faces=[(j*n+q,j*n+(q+1)%n,((j+1)%4)*n+(q+1)%n,((j+1)%4)*n+q) for j in range(4) for q in range(n)]
 mesh('Recessed open eye socket '+str(side),socket,faces,['dark'],'head')
 ell('Amber eye '+str(side),(side*.858,1.285,1.74),(.027,.074,.115),['eye'],'head',8)
 ell('Vertical pupil '+str(side),(side*.884,1.285,1.76),(.007,.053,.024),['black'],'head',6)
 ell('Eye glint '+str(side),(side*.889,1.315,1.78),(.005,.012,.011),['ivory'],'head',6)
 # Slanted angular brow closes over eye, not a round tube.
 mesh('Overhanging angry brow '+str(side),[(side*.46,1.57,1.35),(side*.81,1.51,1.43),(side*.88,1.39,1.82),(side*.53,1.45,1.99),(side*.49,1.38,1.39),(side*.77,1.37,1.53),(side*.85,1.32,1.83),(side*.54,1.36,1.94)],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],skin,'head')
 ell('Nostril '+str(side),(side*.43,1.23,2.69),(.10,.055,.09),['black'],'head',6)
 for i in range(8):
  z=1.57+i*.16;w=.66-(z-1.57)*.10;y=1.005-(z-1.57)*.035;length=[.20,.27,.19,.30,.23,.29,.21,.25][i]
  tube('Upper varied tooth %s %s'%(side,i),[((side*w,y,z),.082),((side*(w-.025),y-length,z+.03),.007)],ivory,'head',5)
  yl=.83-(z-1.57)*.34;tube('Lower varied tooth %s %s'%(side,i),[((side*(w-.025),yl,z+.055),.073),((side*(w-.04),yl+length*.9,z+.075),.007)],ivory,'jaw',5)
# Thick sculpted keel follows the upper nose; dark cavity remains open to either side.
mesh('Golden sculpted snout keel',[(-.12,1.30,2.75),(.12,1.30,2.75),(.13,1.08,2.87),(-.13,1.08,2.87),(-.095,.42,2.81),(.095,.42,2.81),(-.075,.42,2.70),(.075,.42,2.70)],[(0,1,2,3),(3,2,5,4),(4,5,7,6),(0,6,7,1),(0,3,4,6),(1,7,5,2)],gold,'head')
# Preserve upper forearm bulk, but taper the distal front ring to the planted palm.
# Original .62*r radius crossed the floor at the unchanged .18m bind endpoint.
# This is a real local anatomical silhouette change, not root lift or vertex clipping.
for prefix,side,z,names,pts in legs:
 front=prefix[0]=='F';r=.52 if front else .32
 tube(prefix+' shoulder muscle',[(pts[0],r),((side*1.02,.80 if front else .65,z+.04),r),(pts[1],r*.76)],skin,names[0],8)
 tube(prefix+' angular forearm',[(pts[1],r*.77),((side*1.48,.34,z+.23),r*.76),(pts[2],r*(.36 if front else .62))],skin,names[1],8)
 ell(prefix+' broad planted palm',(side*1.55,.145,z+.57),(.43 if front else .34,.14,.40 if front else .32),['dark','green','light'],names[2],8)
 for i in range(4):
  x=side*(1.24+i*.21);tz=z+.81+(.07 if i in [1,2] else 0)
  tube(prefix+' chunky toe '+str(i),[((x,.16,z+.49),.115),((x,.115,tz),.09)],['dark','green'],names[2],5)
  tube(prefix+' ivory gold claw '+str(i),[((x,.12,tz-.02),.09),((x,.045,tz+.20),.006)],gold,names[2],5)
# Thick lifted C tail, narrowing gradually through an actual continuous curl.
tail=[((0,.93,-1.03),.51),((-.13,.93,-1.49),.47),((-.40,1.01,-1.93),.43),((-.79,1.18,-2.28),.38),((-1.26,1.40,-2.49),.33),((-1.74,1.61,-2.47),.28),((-2.13,1.74,-2.22),.235),((-2.38,1.78,-1.82),.19),((-2.40,1.77,-1.40),.145),((-2.23,1.74,-1.04),.098),((-1.96,1.70,-.80),.025)]
for j,(start,end) in enumerate([(0,3),(2,5),(4,11)]):
 tube('Continuous thick tail '+str(j),tail[start:end],skin,'tail'+str(j+1),10)
 # Continuous pale belly strip on the lower arc, built in the same local sweep frame.
 rows=[((c[0],c[1]-r*.60,c[2]),r*.65) for c,r in tail[start:end]]
 tube('Tail pale underside '+str(j),rows,ivory,'tail'+str(j+1),8)
# Irregular shield-shaped armor, swept backward, rather than rectangular tile deck.
def shield(name,x,y,z,w,d,joint='body',palette=skin):
 vs=[(x-w,y-.03,z+d*.65),(x+w,y-.03,z+d*.65),(x+w*.86,y-.03,z-d*.55),(x,y-.03,z-d),(x-w*.86,y-.03,z-d*.55),(x,y+.09,z+.02)]
 mesh(name,vs,[(0,4,3,2,1),(0,1,5),(1,2,5),(2,3,5),(3,4,5),(4,0,5)],palette,joint)
# Overlapping limb scutes break up large smooth forearm bands.
for prefix,side,z,names,pts in legs:
 for k in range(3):
  x=side*(1.02+.20*k);y=.98-.23*k;zz=z+.02+.20*k
  shield(prefix+' forelimb shield '+str(k),x,y,zz,.25-.025*k,.21,names[0] if k==0 else names[1],['green','moss','light'])
# Broad armor patches lie against the changing barrel, with a discontinuous crest hierarchy.
for zi,(z,rx,cy,ry) in enumerate([(-.89,.67,.95,.43),(-.48,.85,1.05,.56),(-.04,1.04,1.16,.70),(.40,1.12,1.20,.77),(.80,.99,1.14,.61)]):
 for xi,angle in enumerate([-1.04,-.54,0,.54,1.04]):
  ang=angle+(.065 if zi%2 else -.04);zz=z+(.07 if xi%2 else -.035)
  c=Vector((rx*math.sin(ang),cy+ry*math.cos(ang),zz));u=Vector((math.cos(ang),-math.sin(ang),0));v=Vector((0,0,1));normal=u.cross(v)*-1
  w=.26 if xi in (0,4) else .29;d=.27
  verts=[tuple(c+u*x+v*y+normal*h) for x,y,h in [(-w,d*.7,-.025),(w,d*.7,-.025),(w*.85,-d*.55,-.025),(0,-d,-.025),(-w*.85,-d*.55,-.025),(0,.035,.065)]]
  mesh('Body following armor %s %s'%(zi,xi),verts,[(0,4,3,2,1),(0,1,5),(1,2,5),(2,3,5),(3,4,5),(4,0,5)],['green','light','green','moss'] if (zi+xi)%3==0 else skin)
  # Central crest is taller at shoulders; flank accents alternate instead of three rails.
  if xi==2 or (xi in (0,4) and (zi+xi//4)%2==0):
   h=[.20,.25,.35,.40,.25][zi] if xi==2 else .18
   base=tuple(c+normal*.045);tip=tuple(c+normal*h+Vector((0,0,-.16)))
   spike('Anatomical crest %s %s'%(zi,xi),base,tip,.105 if xi==2 else .075,.13)
# Armor sweeps with the tail tangent, never axis-aligned gold crossbars.
for i,(c,r) in enumerate(tail[:-1]):
 joint='tail1' if i<2 else 'tail2' if i<4 else 'tail3';c=Vector(c)
 tangent=(Vector(tail[min(i+1,len(tail)-1)][0])-Vector(tail[max(0,i-1)][0])).normalized()
 up=Vector((0,1,0));up=(up-tangent*up.dot(tangent)).normalized();side=tangent.cross(up).normalized()
 for k,ang in enumerate([-.92,0,.92]):
  normal=up*math.cos(ang)+side*math.sin(ang);u=side*math.cos(ang)-up*math.sin(ang);center=c+normal*r*.95
  w=r*.48;d=.24 if i<5 else .18
  vs=[tuple(center+u*x+tangent*z+normal*h) for x,z,h in [(-w,-d*.7,-.02),(w,-d*.7,-.02),(w*.8,d*.55,-.02),(0,d,-.02),(-w*.8,d*.55,-.02),(0,0,.045)]]
  mesh('Swept tail armor %s %s'%(i,k),vs,[(0,4,3,2,1),(0,1,5),(1,2,5),(2,3,5),(3,4,5),(4,0,5)],skin if (i+k)%3 else ['green','moss','light'],joint)
  if k==1 or (k==0 and i%2==0):
   # Full closed wedge in local tangent frame.
   w=r*.23;d=r*.34;h=r*.65
   vs=[tuple(center+u*x+tangent*z) for x,z in [(-w,-d),(w,-d),(w,d),(-w,d)]]+[tuple(center+normal*h+tangent*.15)]
   mesh('Tail integrated crest %s %s'%(i,k),vs,[(0,3,2,1),(0,1,4),(1,2,4),(2,3,4),(3,0,4)],gold,joint)
for i,z in enumerate([1.37,1.72,2.08,2.42]):
 for side in [-1,1]:
  shield('Interlocking snout plate %s %s'%(side,i),side*(.30 if i<2 else .25),1.55-(z-1.37)*.23,z,.29,.23,'head')
  if i<3:spike('Head side crest %s %s'%(side,i),(side*.58,1.43-(z-1.37)*.17,z),(side*.70,1.65-(z-1.37)*.20,z-.14),.10,.14,'head')
# Chunky braided rope with two truly helical strands following anatomy.
for band,z in enumerate([-.70,.64,1.30]):
 rx,ry,cy=((.76,.50,1.00) if band==0 else (1.09,.70,1.18)) if band<2 else (.86,.49,1.10);joint='body' if band<2 else 'neck1'
 for strand in [-1,1]:
  rows=[]
  for i in range(33):
   t=math.tau*i/32;tw=t*12+strand*math.pi/2;rows.append(((rx+.035*math.cos(tw))*math.cos(t),cy+(ry+.035*math.cos(tw))*math.sin(t),z+.043*math.sin(tw)))
  tube('Braided nautical rope %s %s'%(band,strand),[(c,.055) for c in rows],['rope','goldLight','goldDark'],joint,4)
 for side in [-1,1]:
  for k in range(4 if side<0 else 3):
   x=side*(rx*.86+(k%2)*.075);y=cy+.24+(k//2)*.15;zz=z+[-.10,.10,-.05,.17][k];r=[.15,.105,.125,.085][k];n=6
   vs=[]
   for rr,dx in [(r,0),(r*.83,.14),(r*.43,.145),(r*.38,.025)]:
    vs.extend((x+side*dx,y+rr*math.cos(math.tau*q/n),zz+rr*math.sin(math.tau*q/n)) for q in range(n))
   fs=[(j*n+q,j*n+(q+1)%n,((j+1)%4)*n+(q+1)%n,((j+1)%4)*n+q) for j in range(4) for q in range(n)]
   mesh('Uneven hollow barnacle %s %s %s'%(band,side,k),vs,fs,ivory,joint)
# Explicit source and native packed body. Dimensions describe core only; coverage audit is separate.
data={'schema':codec.SCHEMA,'candidate':'keelmaw-native-owner-grounded','status':'source-only; not runtime-admitted','coordinates':'+Y up +Z front; Blender x,-z,y','bones':bones,'parts':list(parts.values())};report=codec.validate_native(data)
raw=json.dumps(data,separators=(',',':'),allow_nan=False).encode();assert len(raw)<=5000000;(out/'native-source.json').write_bytes(raw)
dims={'bodyY':1,'bodyHalfLen':1.05,'bodyRadius':.88,'headRadius':.76,'legLen':.82,'feet':[[s*1.36,z+.42] for _,s,z,_,_ in legs],'halfWidth':.91,'capsuleAxis':'z'}
metadata,packed=codec.pack_native_puffer(data,dims,'/assets/driftwood-isle/keelmaw-native');metadata['bodies'][0].update(kind='keelmaw',variant='keelmaw');(out/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n');(out/'payload.bin').write_bytes(packed)
arm=bpy.data.armatures.new('Keelmaw anatomy');rig=bpy.data.objects.new('Keelmaw rig',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for b in bones:
 eb=arm.edit_bones.new(b['name']);eb.head=bp(b['pos']);eb.tail=Vector(eb.head)+Vector((0,0,.15))
 if b['parent']:eb.parent=arm.edit_bones[b['parent']]
bpy.ops.object.mode_set(mode='OBJECT')
for o in objects:
 vg=o.vertex_groups.new(name=o['nativeJoint']);vg.add(list(range(len(o.data.vertices))),1,'REPLACE');mod=o.modifiers.new('Native articulated skin','ARMATURE');mod.object=rig;o.parent=rig
# Merge only export objects per native bone to avoid redundant glTF accessors.
# Component names and exact vertex ranges remain in construction.json; producer is editable source.
merged=[]
groups={b['name']:[o for o in objects if o['nativeJoint']==b['name']] for b in bones}
for bone in bones:
 selected=groups[bone['name']]
 bpy.ops.object.select_all(action='DESELECT')
 for o in selected:o.select_set(True)
 bpy.context.view_layer.objects.active=selected[0];bpy.ops.object.join();joined=bpy.context.object;joined.name=bone['name']+' geometry';merged.append(joined)
objects=merged
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'keelmaw-v1.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
report.update({'components':components,'nativeBytes':len(raw),'packedBytes':len(packed),'glbBytes':(out/'keelmaw-v1.glb').stat().st_size,'visualAcceptance':False,'runtimeAcceptance':False,'colliderAcceptance':False,'sourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()});(out/'construction.json').write_text(json.dumps(report,indent=2)+'\n')
assert report['glbBytes']<=1000000,report['glbBytes']
if a.render:
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False;scene.render.resolution_x=600;scene.render.resolution_y=720;scene.render.resolution_percentage=100;scene.world.color=(.25,.25,.25);scene.view_settings.view_transform='Standard'
 ground=bpy.data.materials.new('Review ground');ground.diffuse_color=(.16,.22,.28,1);bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(ground)
 for name,pos,power,size in [('Key',(-4,-5,8),1100,5),('Fill',(5,-2,5),750,5),('Rim',(0,4,7),1000,4)]:
  bpy.ops.object.light_add(type='AREA',location=pos);bpy.context.object.name=name;bpy.context.object.data.energy=power;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=size
 bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=8.3;target=Vector((-.35,0,.95))
 views=[('hero',-48,18),('front',0,7),('left',90,7),('right',-90,7),('back',180,7),('top',0,89.9),('elevated-front',0,39),('elevated-left',55,30),('elevated-right',-55,30),('elevated-back',180,39)];cameras=[]
 for name,az,el in views:
  if a.view and name!=a.view:continue
  ar=math.radians(az);er=math.radians(el);camera.location=target+Vector((10*math.sin(ar)*math.cos(er),-10*math.cos(ar)*math.cos(er),10*math.sin(er)));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();
  if name=='top':camera.rotation_euler.rotate_axis('Z',math.pi/2)
  from bpy_extras.object_utils import world_to_camera_view
  bpy.context.view_layer.update()
  projected=[world_to_camera_view(scene,camera,o.matrix_world @ v.co) for o in objects for v in o.data.vertices]
  framing={'minX':min(v.x for v in projected),'maxX':max(v.x for v in projected),'minY':min(v.y for v in projected),'maxY':max(v.y for v in projected)}
  assert framing['minX']>0 and framing['maxX']<1 and framing['minY']>0 and framing['maxY']<1, (name,framing)
  scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True);cameras.append({'name':name,'azimuthDegrees':az,'elevationDegrees':el,'orthoScale':8.3,'cameraRollDegrees':90 if name=='top' else 0,'actualRender':True,'framingNDC':framing,'targetBlender':list(target),'cameraBlender':list(camera.location),'resolution':[600,720],'samples':32})
 (out/'cameras.json').write_text(json.dumps(cameras,indent=2)+'\n')
print('KEELMAW_SOURCE_COMPLETE',json.dumps({k:v for k,v in report.items() if k!='components'}))
