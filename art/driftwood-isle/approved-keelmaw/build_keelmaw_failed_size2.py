"""Keelmaw complete editable source, right-handed native +Y up/+Z front.
Blender maps (x,y,z) to (x,-z,y). Closed faceted components, actual skin,
no runtime writes. Run under heavy lane: blender -b -t 2 -P this -- --out DIR --render.
"""
import argparse,sys,math,json,hashlib,importlib.util
from pathlib import Path
import bpy
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--render',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
spec=importlib.util.spec_from_file_location('codec',ROOT/'art/driftwood-isle/approved-puffer/native_export.py');codec=importlib.util.module_from_spec(spec);spec.loader.exec_module(codec)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
hexes={'green':'405B51','light':'647668','dark':'283C38','moss':'8B923A','mossLight':'ACAC4B','gold':'D8A54F','goldLight':'F0C779','goldDark':'9E7135','ivory':'ECD6A1','ivoryShade':'BEA775','mouth':'48241F','tongue':'8C4439','black':'151C19','eye':'F4AE24','rope':'AC813F'}
colors={k:[round(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4,7) for v in [int(h[i:i+2],16)/255 for i in (0,2,4)]] for k,h in hexes.items()};materials={}
for k,c in colors.items():
 m=bpy.data.materials.new(k);m.diffuse_color=(*c,1);m.use_backface_culling=True;m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*c,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.88;materials[k]=m
bones=[{'name':'body','parent':None,'pos':[0,1,0]},{'name':'neck1','parent':'body','pos':[0,1.03,.86]},{'name':'head','parent':'neck1','pos':[0,1.05,1.48]},{'name':'jaw','parent':'head','pos':[0,.84,1.28]}]
for name,par,pos in [('tail1','body',[0,.92,-1]),('tail2','tail1',[-.42,.80,-2.0]),('tail3','tail2',[-1.35,1.00,-2.60])]:bones.append({'name':name,'parent':par,'pos':pos})
legs=[]
for prefix,side,z in [('FL',-1,.72),('FR',1,.72),('BL',-1,-.85),('BR',1,-.85)]:
 names=[prefix+s for s in (['_shoulder','_carpus','_fetlock'] if prefix[0]=='F' else ['_hip','_stifle','_hock'])];pts=[(side*.66,.92,z),(side*1.15,.52,z-.08),(side*1.36,.18,z+.29)]
 for i in range(3):bones.append({'name':names[i],'parent':'body' if i==0 else names[i-1],'pos':list(pts[i])})
 legs.append((prefix,side,z,names,pts))
parts={b['name']:{'name':b['name'],**{k:[] for _,_,_,k in codec.ATTRS}} for b in bones};objects=[];components=[]
def bp(v):return (v[0],-v[2],v[1])
def mesh(name,verts,faces,palette,joint='body'):
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
  mi=(i//2*7+i//7)%len(palette);data.polygons[i].material_index=mi
  for vi in tri:
   part['positions'].extend(round(float(x),6) for x in verts[vi]);part['colorsLinear'].extend(colors[palette[mi]]);part['skinIndices'].extend([bi,0,0,0]);part['skinWeights'].extend([1,0,0,0]);part['furLen'].append(0)
 # Round Blender positions to identical native source precision.
 for i,v in enumerate(verts):data.vertices[i].co=bp([round(float(x),6) for x in v])
 o['nativeJoint']=joint;objects.append(o);components.append({'name':name,'joint':joint,'triangles':len(tris),'startVertex':len(part['positions'])//3-len(tris)*3,'signedVolume':volume});return o
skin=['green','light','green','moss','green','dark'];gold=['gold','goldLight','goldDark'];ivory=['ivory','ivory','ivoryShade']
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
# Broad continuous trunk and real pale underbelly.
loft('Continuous armored torso',[(0,.92,-1.18,.30,.32),(0,.98,-.85,.73,.50),(0,1,-.2,.91,.59),(0,1,.50,.88,.58),(0,1,.98,.59,.39)],skin,n=12)
loft('Faceted warm belly',[(0,.66,-1.05,.25,.19),(0,.66,-.7,.65,.24),(0,.66,.1,.78,.30),(0,.70,.82,.53,.25)],ivory,n=10)
loft('Muscular neck',[(0,1.02,.73,.58,.37),(0,1.03,1.15,.62,.40),(0,1.03,1.52,.53,.31)],skin,'neck1')
# Head composed of a closed upper snout, cheek volumes, a deep actual jaw gap.
loft('Long flattened armored snout',[(0,1.15,1.16,.57,.34),(0,1.23,1.52,.58,.28),(0,1.18,2.1,.46,.19),(0,1.12,2.72,.41,.17)],skin,'head',n=8)
loft('Upper dark palate',[(0,1.03,1.3,.45,.035),(0,1.02,1.8,.46,.04),(0,.99,2.68,.34,.035)],['mouth'],'head',n=8)
# Lower jaw is open in the bind silhouette; numeric jaw closure raises its tip.
loft('Heavy hinged ivory lower jaw',[(0,.80,1.21,.48,.20),(0,.62,1.70,.50,.14),(0,.36,2.25,.43,.13),(0,.26,2.72,.36,.13)],ivory,'jaw',n=8)
loft('Recessed red lower mouth',[(0,.84,1.32,.38,.05),(0,.70,1.72,.40,.045),(0,.44,2.28,.35,.04),(0,.36,2.60,.25,.035)],['mouth','tongue'],'jaw',n=8)
ell('Throat cavity',(0,.94,1.40),(.36,.26,.16),['mouth'],'head',8)
for side in [-1,1]:
 ell('Ivory cheek '+str(side),(side*.45,.87,1.45),(.18,.29,.40),ivory,'head',8)
 ell('Dark eye socket '+str(side),(side*.53,1.36,1.64),(.10,.14,.17),['dark'],'head',10)
 ell('Amber eye '+str(side),(side*.602,1.38,1.67),(.055,.091,.09),['eye'],'head',10)
 ell('Slit pupil '+str(side),(side*.650,1.385,1.68),(.012,.070,.024),['black'],'head',8)
 ell('Eye glint '+str(side),(side*.66,1.422,1.70),(.008,.016,.014),['ivory'],'head',6)
 tube('Predatory brow '+str(side),[((side*.34,1.53,1.39),.10),((side*.56,1.52,1.64),.105),((side*.51,1.44,1.89),.06)],skin,'head',6)
 ell('Nostril '+str(side),(side*.29,1.22,2.65),(.10,.045,.09),['black'],'head',6)
 for i in range(9):
  z=1.50+i*.139;w=.48-(z-1.5)*.10;y=1.02-(z-1.5)*.035
  tube('Upper tooth %s %s'%(side,i),[((side*w,y,z),.069),((side*w*.97,y-.23-(i%3)*.035,z+.022),.006)],ivory,'head',5)
  yl=.76-(z-1.5)*.34;tube('Lower tooth %s %s'%(side,i),[((side*(w-.03),yl,z+.06),.061),((side*(w-.045),yl+.20+(i%2)*.035,z+.06),.006)],ivory,'jaw',5)
# Distinctive golden keel on blunt nose, geometrically thick.
mesh('Golden vertical snout keel',[(-.065,1.30,2.69),(.065,1.30,2.69),(.08,.98,2.76),(-.08,.98,2.76),(-.055,.34,2.79),(.055,.34,2.79),(-.055,.34,2.68),(.055,.34,2.68)],[(0,1,2,3),(3,2,5,4),(4,5,7,6),(0,6,7,1),(0,3,4,6),(1,7,5,2)],gold,'head')
# Four bent limbs, wrists and broad four-clawed planted feet.
for prefix,side,z,names,pts in legs:
 tube(prefix+' muscular upper leg',[(pts[0],.32),((side*.94,.72,z-.08),.36),(pts[1],.27)],skin,names[0],8)
 tube(prefix+' scaled forearm',[(pts[1],.26),((side*1.29,.34,z+.07),.24),(pts[2],.22)],skin,names[1],8)
 ell(prefix+' broad planted foot',(side*1.37,.135,z+.42),(.32,.115,.33),['dark','green','light'],names[2],8)
 for i in range(4):
  x=side*(1.12+i*.17);toeZ=z+.63+(.07 if i in [1,2] else 0)
  tube(prefix+' toe '+str(i),[((x,.14,z+.36),.095),((x,.11,toeZ),.073)],['dark','green'],names[2],5)
  tube(prefix+' ivory claw '+str(i),[((x,.12,toeZ-.03),.071),((x,.055,toeZ+.17),.006)],gold,names[2],5)
# Long muscular C-curved tail: overlapping articulated segments, no detached ornaments.
tail=[((0,.92,-.95),.42),((-.12,.85,-1.45),.41),((-.38,.82,-1.97),.35),((-.80,.88,-2.39),.29),((-1.31,1,-2.60),.25),((-1.73,1.12,-2.45),.20),((-1.98,1.24,-2.10),.15),((-2.02,1.34,-1.64),.10),((-1.87,1.41,-1.30),.015)]
for j,(start,end) in enumerate([(0,3),(2,5),(4,9)]):tube('Continuous tail segment '+str(j),tail[start:end],skin,'tail'+str(j+1),10)
for i,(c,r) in enumerate(tail[:-1]):
 joint='tail1' if i<2 else 'tail2' if i<4 else 'tail3';x,y,z=c
 for side in [-1,1]:spike('Tail crest %s %s'%(i,side),(x+side*r*.57,y+r*.62,z),(x+side*r*.68,y+r+.30*(1-i*.07),z-.16),r*.32,r*.44,joint)
# Raised armor tiles and three parallel ridges.
for zi,z in enumerate([-.86,-.49,-.12,.25,.62,.91]):
 for xi,x in enumerate([-.57,-.29,0,.29,.57]):
  y=1+math.sqrt(max(0,1-(x/.95)**2))*.56-(abs(z)*.08);plate('Dorsal tile %s %s'%(zi,xi),x,y,z,.14,.17)
  if xi in [0,2,4]:spike('Dorsal keel %s %s'%(zi,xi),(x,y+.06,z),(x,y+.34+(.10 if xi==2 else 0),z-.15),.12,.14)
for i,z in enumerate([1.42,1.73,2.04,2.35]):
 for side in [-1,1]:plate('Snout scute %s %s'%(side,i),side*.19,1.48-(z-1.42)*.22,z,.17,.14,'head')
# Twin-strand old nautical rope wraps; each continuous around upper trunk, pale barnacles.
for band,z in enumerate([-.62,.68,1.30]):
 rx,ry,cy=(.91,.60,1) if band<2 else (.61,.43,1.04);joint='body' if band<2 else 'neck1'
 for strand in [-1,1]:
  rows=[]
  for i in range(33):
   t=math.tau*i/32;tw=t*9+strand*math.pi/2;rows.append(((math.cos(t)*(rx+.024*math.cos(tw)),cy+math.sin(t)*(ry+.024*math.cos(tw)),z+.027*math.sin(tw)),.043))
  tube('Twisted rope %s %s'%(band,strand),rows,['rope','goldLight','goldDark'],joint,5)
 for side in [-1,1]:
  for k in range(5):
   x=side*(rx*.84+((k%2)*.08));y=cy+.27+(k//2)*.11;zz=z+(k%2)*.13-.08;r=.085+(k%2)*.022;n=7
   # radial shell aligned outward in x, inner aperture visibly recessed.
   vs=[]
   for rr,dx in [(r,0),(r*.82,.10),(r*.40,.11),(r*.36,.025)]:
    vs.extend((x+side*dx,y+rr*math.cos(math.tau*q/n),zz+rr*math.sin(math.tau*q/n)) for q in range(n))
   fs=[(j*n+q,j*n+(q+1)%n,((j+1)%4)*n+(q+1)%n,((j+1)%4)*n+q) for j in range(4) for q in range(n)]
   mesh('Hollow barnacle %s %s %s'%(band,side,k),vs,fs,ivory,joint)
# Explicit source and native packed body. Dimensions describe core only; coverage audit is separate.
data={'schema':codec.SCHEMA,'candidate':'keelmaw-v1','status':'source-only; not runtime-admitted','coordinates':'+Y up +Z front; Blender x,-z,y','bones':bones,'parts':list(parts.values())};report=codec.validate_native(data)
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
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=False;scene.render.resolution_x=600;scene.render.resolution_y=720;scene.render.resolution_percentage=100;scene.world.color=(.25,.25,.25);scene.view_settings.view_transform='Standard'
 ground=bpy.data.materials.new('Review ground');ground.diffuse_color=(.16,.22,.28,1);bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(ground)
 for name,pos,power,size in [('Key',(-4,-5,8),1100,5),('Fill',(5,-2,5),750,5),('Rim',(0,4,7),1000,4)]:
  bpy.ops.object.light_add(type='AREA',location=pos);bpy.context.object.name=name;bpy.context.object.data.energy=power;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=size
 bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=7.1;target=Vector((-.18,0,.90))
 views=[('hero',38,23),('front',0,7),('left',-90,7),('right',90,7),('back',180,7),('top',0,89.9),('elevated-front',0,39),('elevated-left',-90,39),('elevated-right',90,39),('elevated-back',180,39)];cameras=[]
 for name,az,el in views:
  ar=math.radians(az);er=math.radians(el);camera.location=target+Vector((10*math.sin(ar)*math.cos(er),-10*math.cos(ar)*math.cos(er),10*math.sin(er)));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True);cameras.append({'name':name,'azimuthDegrees':az,'elevationDegrees':el,'orthoScale':7.1,'actualRender':True})
 (out/'cameras.json').write_text(json.dumps(cameras,indent=2)+'\n')
print('KEELMAW_SOURCE_COMPLETE',json.dumps({k:v for k,v in report.items() if k!='components'}))
