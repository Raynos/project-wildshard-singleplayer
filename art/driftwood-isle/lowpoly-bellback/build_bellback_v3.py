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
  y=.86 if rear else -.57;label=('Right' if side>0 else 'Left')+(' hind' if rear else ' fore')
  foot_y=y+(.35 if rear else -.43);foot_x=side*(1.31 if rear else 1.04)
  # Humerus, broad elbow and tapered wrist form an articulated animal stance.
  loft(label+' timber leg',[((side*.60,y,1.40),.26,.27),((side*1.00,y+(.10 if rear else -.10),1.08),.32,.27),((side*1.19,y+(.20 if rear else -.23),.72),.27,.23),((foot_x,foot_y,.24),.21,.21)],[wood,cut,shade],7)
  loft(label+' shoulder cap',[((side*.64,y,1.48),.29,.19),((side*.92,y-.10,1.23),.33,.22),((side*1.08,y-.16,.92),.22,.17)],[wood,cut,shade],5)
  loft(label+' stone foot',[((foot_x,foot_y,.03),.30,.30),((foot_x,foot_y,.23),.27,.27),((foot_x-side*.05,foot_y+.06,.48),.14,.17)],[stone,stonelight],7)
  for dx in [-.18,.18]:
   loft(label+' toe '+str(dx),[((foot_x+dx,foot_y-.23,.03),.11,.13),((foot_x+dx,foot_y-.18,.19),.09,.10),((foot_x+dx,foot_y-.05,.29),.035,.045)],[stone,stonelight],5)
 # Two ribs per side with unequal cant, width and tip heights. No regular fence.
 for j,y in enumerate([-.04,.98]):
  top=(side*(.72 if j==0 else .52),y+.30,3.13+(0.37 if j else -.16)+(side*.08))
  loft('Broken ship rib '+str(side)+' '+str(j),[((side*.79,y,.93),.17,.16),((side*.90,y+.09,2.22),.18,.15),(top,.14,.12),((top[0]+side*.06,top[1]-.015,top[2]+.17),.09,.11)],[wood,cut,shade],5)
 beam('Lower angled rail '+str(side),(side*.94,-.67,1.45),(side*.87,1.24,1.66),.11,.13)
 beam('Upper angled rail '+str(side),(side*.89,-.23,2.39),(side*.74,1.22,2.63),.10,.12)
 for y,z,x in [(-.04,2.38,side*.86),(.98,1.62,side*.82)]:
  for offset in [-.065,.065]:
   cord('Frame rope knot',[(x-.20,y-.17,z+offset),(x+.19,y-.17,z+offset+.02),(x+.20,y+.18,z+offset),(x-.18,y+.19,z+offset-.02),(x-.20,y-.17,z+offset)])
 cord('Diagonal binding '+str(side),[(side*.91,-.16,2.38),(side*.98,.24,2.11),(side*.90,.90,1.66)],.075)
# A central split stern plank replaces the rear pair's repeating pickets.
beam('Tall stern plank',(-.18,1.14,1.56),(-.30,1.47,3.72),.18,.13)
# Bell support arch, shaped as a timber roof.
beam('Arch left',(-.88,-.03,2.52),(0,.05,3.24),.16,.17);beam('Arch right',(0,.05,3.24),(.88,-.03,2.52),.16,.17)
cord('Crown tie',[(-.17,-.11,3.18),(.0,-.17,3.30),(.18,-.11,3.19),(.15,.20,3.15),(-.17,.20,3.18),(-.17,-.11,3.18)],.075)
# Bell is a continuous thick shell. Opening stays genuinely empty, with inner wall and crown.
# Local Z is the bell axis, tilted back 15 degrees to show cavity from low front views.
origin=Vector((0,-.20,1.88));rot=Matrix.Rotation(math.radians(-30),4,'X')
def bp(v):return tuple(origin+rot.to_3x3()@Vector(v))
profile=[(.99,0),(.97,.07),(.85,.24),(.82,.36),(.81,.42),(.76,.61),(.65,1.03),(.62,1.09),(.60,1.14),(.52,1.25),(.38,1.33),(.0,1.35),(.0,1.20),(.32,1.19),(.45,1.12),(.56,.96),(.67,.55),(.76,.21),(.87,.08),(.88,0)]
n=16;vs=[bp((r*math.cos(math.tau*i/n),r*math.sin(math.tau*i/n),z)) for r,z in profile for i in range(n)];fs=[];mi=[]
for j in range(len(profile)):
 for i in range(n):
  k=(i+1)%n;nj=(j+1)%len(profile);fs.append((j*n+i,j*n+k,nj*n+k,nj*n+i));mi.append(4 if j>=11 and j<19 else (3 if j in [0,3,7,19] else [0,0,1,0,2,0,1,0][i%8]))
mesh('Hollow cast bell',vs,fs,[teal,teallight,tealdark,bronze,inside],mi)
# Independent clapper is real volume inside mouth; can swing about its crown attachment later.
loft('Clapper stem',[(bp((0,0,1.19)),.08,.08),(bp((0,-.27,-.16)),.09,.09)],[bronze],6)
loft('Clapper weight',[(bp((0,-.27,-.36)),.12,.12),(bp((0,-.27,-.26)),.23,.23),(bp((0,-.27,-.05)),.24,.24),(bp((0,-.27,.06)),.13,.13)],[bronze,ropeshade],8)
# Narrow central keel and broad layered cheek timbers instead of one horned mask.
v=[(-.31,-.93,1.32),(.31,-.93,1.32),(-.27,-1.48,1.13),(.27,-1.48,1.13),(-.14,-1.79,.94),(.14,-1.79,.94),(0,-1.87,1.09),(0,-1.53,1.48),(0,-.99,1.49),(-.25,-1.29,.91),(.25,-1.29,.91),(0,-1.69,.80)]
f=[(0,2,7,8),(1,8,7,3),(2,4,6,7),(3,7,6,5),(4,11,5,6),(0,9,4,2),(1,3,5,10),(9,10,11,4),(9,0,8,1,10),(10,5,11)]
mesh('Pointed central face keel',v,f,[wood,cut,shade],[0,1,1,0,1,2,2,2,2,2])
for side in [-1,1]:
 # Broad wood zygomatic ridge runs from skull toward nose, leaving the eye inset below.
 loft('Layered brow timber', [((side*.76,-.70,1.51),.20,.18),((side*.57,-1.16,1.36),.23,.14),((side*.23,-1.70,1.06),.075,.07)],[wood,cut,shade],5)
 loft('Lower cheek timber',[((side*.62,-.85,1.17),.18,.13),((side*.49,-1.35,.97),.16,.11),((side*.21,-1.62,.87),.08,.065)],[wood,shade,cut],5)
 loft('Swept cheek horn',[((side*.65,-.77,1.17),.18,.16),((side*.99,-.82,1.43),.18,.15),((side*1.14,-.88,1.86),.12,.11),((side*1.10,-.96,2.22),.025,.03)],[wood,cut,shade],6)
 ev=[(side*.30,-1.63,1.06),(side*.49,-1.39,1.18),(side*.48,-1.49,1.02),(side*.40,-1.43,1.09)]
 ef=[(0,1,2),(0,3,1),(0,2,3),(1,3,2)]
 if side<0:ef=[tuple(reversed(face)) for face in ef]
 mesh('Recessed amber eye',ev,ef,[eye])
loft('Mouth dark pocket',[((0,-1.42,.88),.32,.13),((0,-1.72,.85),.25,.10)],[dark],6)
for x in [-.27,-.10,.10,.27]:
 loft('Ivory upper fang '+str(x),[((x,-1.65,.95),.085,.07),((x*.90,-1.74,.71 if abs(x)>.2 else .78),.01,.015)],[ivory],4)
# Raised jaw prongs produce the characteristic pale serrated grin.
loft('Lower timber jaw',[((0,-1.12,.72),.27,.12),((0,-1.59,.65),.25,.10),((0,-1.77,.77),.09,.055)],[wood,cut],5)
for x in [-.20,0,.20]:
 loft('Ivory lower tooth '+str(x),[((x,-1.68,.68),.075,.065),((x*.85,-1.78,.88),.01,.015)],[ivory],4)
# Export creature only, before adding review environment.
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=str(out/'bellback-study-v3.glb'),export_format='GLB',use_selection=True,export_materials='EXPORT',export_yup=True)
tri=sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in objects)
(out/'metrics-v3.json').write_text(json.dumps({'model':'Bellback low-poly study v3','mesh_objects':len(objects),'triangles':tri,'glb_bytes':(out/'bellback-study-v3.glb').stat().st_size,'palette':'sRGB swatches explicitly decoded to linear Blender Base Color','hollow_bell':True,'rigged':False,'runtime_integrated':False,'accepted':False},indent=2)+'\n')
if a.render:
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False
 scene.render.resolution_x=768;scene.render.resolution_y=960;scene.render.resolution_percentage=100
 scene.world.color=(.25,.25,.25);scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=-.20;scene.view_settings.gamma=1
 ground=material('Review ground sRGB','293D4B');bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));bpy.context.object.data.materials.append(ground)
 for name,loc,power,size in [('Key',(-4,-5,7),450,5),('Fill',(0,-5,3),260,4),('Rim',(0,4,6),600,3)]:
  d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1.5))-o.location).to_track_quat('-Z','Y').to_euler()
 d=bpy.data.cameras.new('Review camera');o=bpy.data.objects.new('Review camera',d);bpy.context.collection.objects.link(o);o.location={'front':(-4.4,-8,2.65),'side':(8,0,3.4),'rear':(-5,7,3.8),'low':(3,-7,2.1)}[a.view];o.rotation_euler=(Vector((0,-.05,1.65))-o.location).to_track_quat('-Z','Y').to_euler();d.type='ORTHO';d.ortho_scale=4.65;scene.camera=o
 from bpy_extras.object_utils import world_to_camera_view
 landmarks={'bell_crown':bp((0,0,1.35)),'mouth_left':bp((-.99,0,0)),'mouth_right':bp((.99,0,0)),'clapper':bp((0,-.27,-.18)),'nose':(0,-1.87,1.09),'fore_left':(-1.04,-1.0,.03),'fore_right':(1.04,-1.0,.03),'stern_tip':(-.30,1.47,3.72)}
 bpy.context.view_layer.update()
 projected={name:[round(v,5) for v in world_to_camera_view(scene,o,Vector(pt))[:2]] for name,pt in landmarks.items()}
 (out/('landmarks-v3-'+a.view+'.json')).write_text(json.dumps({'camera':list(o.location),'look_at':[0,-.05,1.65],'orthographic_scale':4.65,'normalized_xy_origin':'bottom-left','projected':projected},indent=2)+'\n')
 scene.render.image_settings.file_format='PNG';scene.render.filepath=str(out/('bellback-v3-'+a.view+'.png'));bpy.ops.render.render(write_still=True)
