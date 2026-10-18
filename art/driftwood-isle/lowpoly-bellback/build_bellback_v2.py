"""Bellback editable full-3D study. Blender 4.3+, no external assets.
blender -b -t 2 -P art/driftwood-isle/lowpoly-bellback/build_bellback.py -- --out tmp/lowpoly-bellback --render
All declared palette values are sRGB, decoded to linear Base Color. -Y is front.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector, Matrix
p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--render',action='store_true');p.add_argument('--view',choices=['front','rear','side','low'],default='front');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
objects=[]
def material(name,hexcode):
 c=[int(hexcode[i:i+2],16)/255 for i in (0,2,4)];linear=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
 m=bpy.data.materials.new(name);m.diffuse_color=(*linear,1);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*linear,1);b.inputs['Roughness'].default_value=.85;return m
wood=material('Timber honey sRGB','A86636');cut=material('Timber sunward sRGB','CE9051');shade=material('Timber broad shade sRGB','754A30');rope=material('Coarse rope flat sRGB','D7B775');ropeshade=material('Rope shade sRGB','A88B55');teal=material('Patinated bell sRGB','548A79');teallight=material('Patina light sRGB','75A18B');tealdark=material('Patina shade sRGB','447365');bronze=material('Bell bronze rims sRGB','C3A465');inside=material('Bell dark cavity sRGB','293D32');stone=material('Stone foot sRGB','656B6C');stonelight=material('Stone plane sRGB','92948B');ivory=material('Fangs ivory sRGB','EBDEB5');dark=material('Mouth and eye recess sRGB','332A20');eye=material('Amber eye sRGB','FFB324')
def mesh(name,v,f,mats,indices=None):
 d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o)
 for m in mats:d.materials.append(m)
 for poly,i in zip(d.polygons,indices or [0]*len(f)):poly.material_index=i;poly.use_smooth=False
 objects.append(o);return o

def loft(name,rows,mats,n=6):
 vs=[]
 for j,(xyz,w,h) in enumerate(rows):
  c=Vector(xyz);t=(Vector(rows[min(len(rows)-1,j+1)][0])-Vector(rows[max(0,j-1)][0])).normalized();u=t.cross(Vector((0,1,0)))
  if u.length<.01:u=t.cross(Vector((0,0,1)))
  u.normalize();v=t.cross(u).normalized()
  vs.extend(tuple(c+u*w*math.cos(math.tau*i/n)+v*h*math.sin(math.tau*i/n)) for i in range(n))
 fs=[];ids=[]
 for j in range(len(rows)-1):
  for i in range(n):fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i));ids.append(i%len(mats))
 fs.extend([tuple(reversed(range(n))),tuple((len(rows)-1)*n+i for i in range(n))]);ids.extend([0,min(1,len(mats)-1)])
 return mesh(name,vs,fs,mats,ids)

def beam(name,start,end,width,depth):
 # Chamfered timber section, not a square prism; tips taper slightly off axis.
 start=Vector(start);end=Vector(end);t=(end-start).normalized();u=t.cross(Vector((0,1,0)))
 if u.length<.01:u=t.cross(Vector((0,0,1)))
 u.normalize();v=t.cross(u).normalized();section=[(-.65,-1),(.65,-1),(1,-.65),(1,.65),(.65,1),(-.65,1),(-1,.65),(-1,-.65)];vs=[]
 for c,scale in [(start,1),(start.lerp(end,.82),.93),(end,.75)]:vs.extend(tuple(c+u*x*width*scale+v*y*depth*scale) for x,y in section)
 fs=[tuple(reversed(range(8))),tuple(16+i for i in range(8))];ids=[2,1]
 for j in range(2):
  for i in range(8):fs.append((j*8+i,j*8+(i+1)%8,(j+1)*8+(i+1)%8,(j+1)*8+i));ids.append([0,1,1,0,0,2,2,0][i])
 return mesh(name,vs,fs,[wood,cut,shade],ids)
def cord(name,points,r=.065):return loft(name,[(v,r,r) for v in points],[rope,ropeshade],6)
# Structural carcass: continuous ribbed hull beneath the bell, not stacked spheres.
loft('Barrel timber hull',[((0,-.72,1.25),.61,.39),((0,.0,1.35),.88,.53),((0,.92,1.23),.74,.47),((0,1.32,1.15),.40,.28)],[wood,cut,shade],8)
for side in [-1,1]:
 for rear in [False,True]:
  y=.9 if rear else -.66;label=('Right' if side>0 else 'Left')+(' hind' if rear else ' fore')
  # Outward shoulder and inboard ankle create weight-bearing quadruped anatomy.
  loft(label+' timber leg',[((side*.62,y,1.43),.31,.32),((side*1.04,y-.12,1.03),.36,.29),((side*1.12,y-.27,.40),.27,.25),((side*1.13,y-.35,.17),.25,.22)],[wood,cut,shade],6)
  loft(label+' stone foot',[((side*1.14,y-.37,.04),.37,.37),((side*1.14,y-.37,.24),.34,.33),((side*1.10,y-.30,.53),.20,.22)],[stone,stonelight],7)
  for dx in [-.22,.2]:
   loft(label+' toe '+str(dx),[((side*1.14+dx,y-.65,.03),.13,.16),((side*1.14+dx,y-.59,.22),.11,.12),((side*1.14+dx,y-.47,.32),.04,.05)],[stone,stonelight],5)
 # Timber back uprights and two broad rails. Unequal tips read as broken ship ribs.
 for j,y in enumerate([-.12,.63,1.17]):
  beam('Upright '+str(side)+' '+str(j),(side*.82,y,.92),(side*(.90 if j==0 else .77),y+.12,3.18+(j%2)*.30),.14,.14)
 beam('Lower rail '+str(side),(side*.96,-.77,1.48),(side*.96,1.38,1.50),.115,.14)
 beam('Upper rail '+str(side),(side*.94,-.38,2.32),(side*.94,1.39,2.35),.11,.12)
 # Two rope turns around each principal frame junction: intentionally no strand texture.
 for y,z in [(-.12,2.34),(.63,1.52)]:
  for offset in [-.055,.065]:
   x=side*.9
   cord('Frame binding',[(x-.19,y-.17,z+offset),(x+.18,y-.17,z+offset),(x+.20,y+.18,z+offset),(x-.18,y+.19,z+offset),(x-.19,y-.17,z+offset)])
 cord('Diagonal lashing '+str(side),[(side*1.0,-.2,2.35),(side*1.05,.25,2.02),(side*1.05,.75,1.58)])
# Bell support arch, shaped as a timber roof.
beam('Arch left',(-.88,-.03,2.52),(0,.05,3.24),.16,.17);beam('Arch right',(0,.05,3.24),(.88,-.03,2.52),.16,.17)
cord('Crown tie',[(-.17,-.11,3.18),(.0,-.17,3.30),(.18,-.11,3.19),(.15,.20,3.15),(-.17,.20,3.18),(-.17,-.11,3.18)],.075)
# Bell is a continuous thick shell. Opening stays genuinely empty, with inner wall and crown.
# Local Z is the bell axis, tilted back 15 degrees to show cavity from low front views.
origin=Vector((0,-.06,1.75));rot=Matrix.Rotation(math.radians(-17),4,'X')
def bp(v):return tuple(origin+rot.to_3x3()@Vector(v))
profile=[(.99,0),(.97,.07),(.85,.24),(.82,.36),(.81,.42),(.76,.61),(.65,1.03),(.62,1.09),(.60,1.14),(.52,1.25),(.38,1.33),(.0,1.35),(.0,1.20),(.32,1.19),(.45,1.12),(.56,.96),(.67,.55),(.76,.21),(.87,.08),(.88,0)]
n=16;vs=[bp((r*math.cos(math.tau*i/n),r*math.sin(math.tau*i/n),z)) for r,z in profile for i in range(n)];fs=[];mi=[]
for j in range(len(profile)):
 for i in range(n):
  k=(i+1)%n;nj=(j+1)%len(profile);fs.append((j*n+i,j*n+k,nj*n+k,nj*n+i));mi.append(4 if j>=11 and j<19 else (3 if j in [0,3,7,19] else [0,0,1,0,2,0,1,0][i%8]))
mesh('Hollow cast bell',vs,fs,[teal,teallight,tealdark,bronze,inside],mi)
# Independent clapper is real volume inside mouth; can swing about its crown attachment later.
loft('Clapper stem',[(bp((0,0,1.19)),.08,.08),(bp((0,-.13,-.10)),.09,.09)],[bronze],6)
loft('Clapper weight',[(bp((0,-.13,-.36)),.12,.12),(bp((0,-.13,-.26)),.23,.23),(bp((0,-.13,-.05)),.24,.24),(bp((0,-.13,.06)),.13,.13)],[bronze,ropeshade],8)
# Broad predatory timber face: one connected wedge with purposefully arranged planes.
v=[(-.70,-.75,1.37),(.70,-.75,1.37),(-.58,-1.36,1.20),(.58,-1.36,1.20),(-.22,-1.72,.89),(.22,-1.72,.89),(0,-1.86,1.08),(0,-1.49,1.53),(0,-.74,1.68),(-.49,-1.13,.90),(.49,-1.13,.90),(0,-1.62,.77)]
f=[(0,2,7,8),(1,8,7,3),(2,4,6,7),(3,7,6,5),(4,11,5,6),(0,9,4,2),(1,3,5,10),(9,10,11,4),(9,0,8,1,10),(10,5,11)]
mesh('Pointed timber head',v,f,[wood,cut,shade],[0,1,1,0,1,2,2,2,2,2])
# Side cheek horns rise around rather than obscure face.
for s in [-1,1]:
 loft('Swept timber horn', [((s*.53,-1.12,1.21),.19,.17),((s*.91,-1.05,1.44),.17,.16),((s*1.10,-.99,1.91),.12,.12),((s*1.09,-1.00,2.22),.015,.018)],[wood,cut,shade],5)
 # Slanted thick eye inset on cheek; not a billboard: wedge with rear thickness.
 ev=[(s*.29,-1.64,1.13),(s*.61,-1.34,1.27),(s*.56,-1.48,1.08),(s*.40,-1.48,1.18)]
 mesh('Amber inset eye',ev,[(0,1,2),(0,3,1),(0,2,3),(1,3,2)],[eye])
# Deep mouth pocket and six tapered ivory teeth.
loft('Mouth dark volume',[((0,-1.46,.89),.39,.18),((0,-1.72,.85),.28,.11)],[dark],6)
for x in [-.31,-.12,.12,.31]:
 loft('Upper fang '+str(x),[((x,-1.60,.98),.105,.09),((x*.90,-1.72,.71 if abs(x)>.2 else .76),.012,.018)],[ivory],4)
loft('Lower jaw keel',[((0,-1.12,.72),.28,.12),((0,-1.57,.64),.25,.09),((0,-1.70,.76),.10,.06)],[wood,cut],5)
# Export creature only, before adding review environment.
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=str(out/'bellback-study-v2.glb'),export_format='GLB',use_selection=True,export_materials='EXPORT',export_yup=True)
tri=sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in objects)
(out/'metrics-v2.json').write_text(json.dumps({'model':'Bellback low-poly study v2','mesh_objects':len(objects),'triangles':tri,'glb_bytes':(out/'bellback-study-v2.glb').stat().st_size,'palette':'sRGB swatches explicitly decoded to linear Blender Base Color','hollow_bell':True,'rigged':False,'runtime_integrated':False,'accepted':False},indent=2)+'\n')
if a.render:
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False
 scene.render.resolution_x=768;scene.render.resolution_y=960;scene.render.resolution_percentage=100
 scene.world.color=(.25,.25,.25);scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=-.35;scene.view_settings.gamma=1
 ground=material('Review ground sRGB','293D4B');bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));bpy.context.object.data.materials.append(ground)
 for name,loc,power,size in [('Key',(-4,-5,7),450,5),('Fill',(4,-2,4),180,4),('Rim',(0,4,6),600,3)]:
  d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1.5))-o.location).to_track_quat('-Z','Y').to_euler()
 d=bpy.data.cameras.new('Review camera');o=bpy.data.objects.new('Review camera',d);bpy.context.collection.objects.link(o);o.location={'front':(4.2,-8,3.6),'side':(8,0,3.4),'rear':(-5,7,3.8),'low':(3,-7,2.1)}[a.view];o.rotation_euler=(Vector((0,-.05,1.65))-o.location).to_track_quat('-Z','Y').to_euler();d.type='ORTHO';d.ortho_scale=4.7;scene.camera=o;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(out/('bellback-v2-'+a.view+'.png'));bpy.ops.render.render(write_still=True)
