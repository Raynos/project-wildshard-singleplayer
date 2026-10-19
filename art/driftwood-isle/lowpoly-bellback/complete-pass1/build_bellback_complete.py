"""Bellback editable full-3D complete pass 1, projecting face and interlocked wreck carrier. Blender 4.3+, no external assets.
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
wood=material('Timber honey sRGB','AF6F40');cut=material('Timber sunward sRGB','D4985C');shade=material('Timber broad shade sRGB','7E5036');rope=material('Coarse rope flat sRGB','D7B775');ropeshade=material('Rope shade sRGB','A88B55');teal=material('Patinated bell sRGB','548A79');teallight=material('Patina light sRGB','6C9783');tealdark=material('Patina shade sRGB','497B6B');bronze=material('Bell bronze rims sRGB','C3A465');inside=material('Bell dark cavity sRGB','293D32');stone=material('Stone foot sRGB','656B6C');stonelight=material('Stone plane sRGB','92948B');ivory=material('Fangs ivory sRGB','EBDEB5');dark=material('Mouth and eye recess sRGB','332A20');eye=material('Amber eye sRGB','FFB324')
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
loft('Barrel timber hull',[((0,-.86,1.27),.77,.43),((0,.0,1.34),.94,.59),((0,.92,1.23),.80,.49),((0,1.32,1.15),.46,.31)],[wood,cut,shade],8)
for side in [-1,1]:
 for rear in [False,True]:
  y=.86 if rear else -.57;label=('Right' if side>0 else 'Left')+(' hind' if rear else ' fore')
  foot_y=y+(.35 if rear else -.43);foot_x=side*(1.31 if rear else 1.04)
  # Humerus, broad elbow and tapered wrist form an articulated animal stance.
  loft(label+' timber leg',[((side*.60,y,1.46),.35,.32),((side*.92,y+(.10 if rear else -.08),1.25),.45,.36),((side*1.14,y+(.20 if rear else -.22),.70),.38,.31),((foot_x,foot_y,.25),.25,.26)],[wood,cut,shade],7)
  loft(label+' shoulder cap',[((side*.60,y,1.54),.36,.26),((side*.96,y-.17,1.22),.46,.32),((side*1.10,y-.29,.64),.23,.18)],[wood,cut,shade],5)
  loft(label+' stone foot',[((foot_x,foot_y,.04),.36,.39),((foot_x,foot_y,.28),.34,.34),((foot_x-side*.03,foot_y+.025,.60),.19,.22)],[stone,stonelight],7)
  for dx in [-.23,.23]:
   loft(label+' toe '+str(dx),[((foot_x+dx,foot_y-.26,.035),.14,.19),((foot_x+dx,foot_y-.21,.23),.13,.14),((foot_x+dx,foot_y-.03,.40),.055,.07)],[stone,stonelight],5)
  for offset in [-.07,.07]:
   cord(label+' shoulder lashing',[(side*.70+.33*math.cos(math.tau*i/10),y+.29*math.sin(math.tau*i/10),1.50+offset) for i in range(11)],.075)
 # Two ribs per side with unequal cant, width and tip heights. No regular fence.
 for j,y in enumerate([-.04,.98]):
  top=(side*(.72 if j==0 else .52),y+.30,2.96+(0.20 if j else -.22)+(side*.08))
  loft('Broken ship rib '+str(side)+' '+str(j),[((side*.79,y,.93),.17,.16),((side*.90,y+.09,2.22),.18,.15),(top,.14,.12),((top[0]+side*.06,top[1]-.015,top[2]+.17),.09,.11)],[wood,cut,shade],5)
 loft('Lower fractured wale '+str(side),[((side*.98,-.75,1.49),.14,.15),((side*1.02,.16,1.65),.16,.14),((side*.85,1.30,1.89),.12,.13)],[wood,cut,shade],5)
 loft('Upper curved wreck wale '+str(side),[((side*.91,-.32,2.36),.14,.12),((side*1.03,.42,2.54),.13,.14),((side*.69,1.28,2.70),.10,.10)],[wood,cut,shade],5)
 beam('Diagonal buried ship brace '+str(side),(side*.84,1.28,1.22),(side*1.02,.22,2.29),.17,.12)
 loft('Overlapping broken hull strake '+str(side),[((side*.71,-.45,1.10),.20,.12),((side*.98,.34,1.38),.22,.13),((side*.73,1.30,1.26),.15,.10)],[wood,shade,cut],5)
 for y,z,x in [(-.04,2.38,side*.86),(.98,1.62,side*.82)]:
  for offset in [-.065,.065]:
   cord('Frame rope knot',[(x+.23*math.cos(math.tau*i/10),y+.22*math.sin(math.tau*i/10),z+offset+.02*math.sin(math.tau*i/10)) for i in range(11)],.073)
 cord('Diagonal binding '+str(side),[(side*.91,-.16,2.38),(side*.98,.24,2.11),(side*.90,.90,1.66)],.075)
# A central split stern plank replaces the rear pair's repeating pickets.
beam('Canted stern spine',(-.18,1.14,1.48),(-.46,1.40,3.46),.20,.13)
beam('Split stern companion',(.21,1.19,1.65),(.37,1.38,3.18),.14,.105)
beam('Crossed stern wreck timber',(-.67,1.18,1.47),(.55,1.33,2.23),.16,.12)
# Bell support arch, shaped as a timber roof.
beam('Arch left',(-.88,-.03,2.52),(0,.05,3.24),.16,.17);beam('Arch right',(0,.05,3.24),(.88,-.03,2.52),.16,.17)
cord('Crown tie',[(-.17,-.11,3.18),(.0,-.17,3.30),(.18,-.11,3.19),(.15,.20,3.15),(-.17,.20,3.18),(-.17,-.11,3.18)],.075)
# Bell is a continuous thick shell. Opening stays genuinely empty, with inner wall and crown.
# Local Z is the bell axis, tilted back 15 degrees to show cavity from low front views.
origin=Vector((0,-.20,1.88));rot=Matrix.Rotation(math.radians(-22),4,'X')
def bp(v):return tuple(origin+rot.to_3x3()@Vector(v))
profile=[(.99,0),(.97,.07),(.85,.24),(.82,.36),(.81,.42),(.76,.61),(.67,.86),(.65,.92),(.63,.99),(.55,1.25),(.51,1.33),(.0,1.35),(.0,1.20),(.44,1.19),(.48,1.12),(.56,.96),(.67,.55),(.76,.21),(.87,.08),(.88,0)]
n=16;vs=[bp((r*math.cos(math.tau*i/n),r*math.sin(math.tau*i/n),z)) for r,z in profile for i in range(n)];fs=[];mi=[]
for j in range(len(profile)):
 for i in range(n):
  k=(i+1)%n;nj=(j+1)%len(profile);fs.append((j*n+i,j*n+k,nj*n+k,nj*n+i));mi.append(4 if j>=11 and j<19 else (3 if j in [0,3,7,19] else [0,0,1,0,2,0,1,0][i%8]))
# Teal fields have staggered large triangular facets between the cast bands.
new_faces=[]; new_mi=[]
for f,idx in zip(fs,mi):
 j=f[0]//n; i=f[0]%n
 if j in [1,4,5,8,9]:
  new_faces.extend([(f[0],f[1],f[2]),(f[0],f[2],f[3])])
  palette=[0,0,1,0,2,0,0,1]
  new_mi.extend([palette[(i//2+j//4)%8],palette[(i//2+j//4+(1 if i%4==0 else 0))%8]])
 else:new_faces.append(f);new_mi.append(idx)
bell=mesh('Hollow cast bell',vs,new_faces,[teal,teallight,tealdark,bronze,inside],new_mi)
# Collapse coincident polar vertices; genuine closed shell, no degenerate crown faces.
import bmesh
bm=bmesh.new();bm.from_mesh(bell.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bmesh.ops.delete(bm,geom=[e for e in bm.edges if not e.link_faces],context='EDGES');bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(bell.data);bm.free()
# Independent clapper is real volume inside mouth; can swing about its crown attachment later.
loft('Clapper stem',[(bp((0,0,1.19)),.08,.08),(bp((0,-.27,-.16)),.09,.09)],[bronze],6)
loft('Clapper weight',[(bp((0,-.27,-.36)),.12,.12),(bp((0,-.27,-.26)),.23,.23),(bp((0,-.27,-.05)),.24,.24),(bp((0,-.27,.06)),.13,.13)],[bronze,ropeshade],8)
# Broad coherent skull has a closed forehead, sharply tapering snout and two
# side-mounted amber eye cavities; eye geometry is inset behind the brow edge.
loft('Solid timber cranium',[((0,-.62,1.32),.70,.36),((0,-1.10,1.28),.65,.33),((0,-1.58,1.06),.35,.22),((0,-1.83,.99),.12,.13)],[wood,cut,shade],8)
v=[(-.25,-.96,1.51),(.25,-.96,1.51),(-.24,-1.52,1.23),(.24,-1.52,1.23),(-.13,-1.86,.94),(.13,-1.86,.94),(0,-1.96,1.07),(0,-1.47,1.56),(0,-.98,1.62),(-.21,-1.31,.96),(.21,-1.31,.96),(0,-1.76,.86)]
f=[(0,2,7,8),(1,8,7,3),(2,4,6,7),(3,7,6,5),(4,11,5,6),(0,9,4,2),(1,3,5,10),(9,10,11,4),(9,0,8,1,10),(10,5,11)]
mesh('Pointed central face keel',v,f,[wood,cut,shade],[0,1,1,0,1,2,2,2,2,2])
for side in [-1,1]:
 loft('Layered face plank '+str(side),[((side*.23,-.88,1.55),.15,.065),((side*.25,-1.30,1.46),.16,.08),((side*.13,-1.76,1.17),.085,.05)],[cut,wood,shade],5)
 # Long cheekbone follows the skull. The eye is on its outward-front plane.
 # Closed shaped brow: an explicit cut underside clears the orbital plane.
 # V5's swept pentagonal brow buried 3/4 eye-ray samples in all face views.
 brow_front=[(.77,-.78,1.65),(.60,-1.30,1.48),(.25,-1.83,1.12),(.30,-1.80,1.04),(.58,-1.42,1.28),(.73,-.89,1.40)]
 bv=[(side*x,y,z) for x,y,z in brow_front]+[(side*(x-.12),y+.11,z+.025) for x,y,z in brow_front]
 bf=[tuple(range(6)),tuple(range(11,5,-1))]+[(i,i+6,(i+1)%6+6,(i+1)%6) for i in range(6)]
 if side<0:bf=[tuple(reversed(f)) for f in bf]
 mesh('Shaped orbital brow timber',bv,bf,[wood,cut,shade],[1,2,0,1,0,2,0,0])
 loft('Lower cheek timber',[((side*.68,-.82,1.13),.23,.18),((side*.51,-1.40,.95),.18,.14),((side*.25,-1.71,.88),.11,.08)],[wood,shade,cut],5)
 loft('Swept cheek horn',[((side*.72,-.69,1.19),.22,.20),((side*1.02,-.73,1.49),.21,.18),((side*1.20,-.80,1.90),.14,.13),((side*1.16,-.88,2.24),.045,.04)],[wood,cut,shade],6)
 # Triangular inset eye socket and amber triangular lens. Separate real solids.
 # Mirrored vertices use reflected winding, never a rotated copy.
 def eye_prism(name,front,depth,mat):
  vv=[(side*x,y,z) for x,y,z in front]+[(side*(x-depth*.6),y+depth,z) for x,y,z in front]
  ff=[(0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(2,5,3,0)]
  if side<0:ff=[tuple(reversed(q)) for q in ff]
  return mesh(name,vv,ff,[mat])
 eye_prism('Recessed eye shadow',[(.31,-1.78,1.06),(.63,-1.39,1.29),(.56,-1.50,1.04)],.065,dark)
 eye_prism('Inset amber eye',[(.35,-1.752,1.085),(.59,-1.425,1.245),(.535,-1.526,1.085)],.025,eye)
 # Unequal broken wooden splints lie along the brow, rather than paired ivory horns.
 loft('Brow split timber '+str(side),[((side*.31,-1.02,1.54),.095,.055),((side*.35,-1.33,1.60),.065,.045),((side*.33,-1.50,1.47),.012,.012)],[cut,wood],4)
loft('Mouth dark pocket',[((0,-1.44,.87),.34,.15),((0,-1.81,.81),.25,.12)],[dark],6)
loft('Lower timber jaw',[((0,-1.14,.68),.30,.14),((0,-1.63,.61),.26,.12),((0,-1.84,.75),.13,.075)],[wood,cut],5)
# Individual uneven teeth are seated in the timber jaw: no continuous cream frame.
for i,(x,z,length) in enumerate([(-.28,.98,.19),(-.14,.94,.12),(.015,.92,.10),(.18,.96,.15),(.28,.99,.22)]):
 loft('Upper tooth '+str(i),[((x,-1.77,z),.065,.065),((x*.91,-1.88,z-length),.008,.010)],[ivory],4)
for i,(x,z,tip) in enumerate([(-.25,.69,.87),(-.12,.64,.79),(.015,.65,.83),(.15,.67,.82),(.255,.72,.93)]):
 loft('Lower jaw tooth '+str(i),[((x,-1.77,z),.075,.065),((x*.93,-1.90,tip),.012,.012)],[ivory],4)
# Project the complete layered head in depth from its neck; preserve eye registration.
# All brow, eye, horn, dental and skull geometry shares this anatomical change.
head_names=('skull','cranium','face','brow','cheek','eye','amber','mouth','jaw','fang','tooth','splinter')
for obj in objects:
 if any(word in obj.name.lower() for word in head_names):
  for v in obj.data.vertices:v.co.y=-.65+(v.co.y+.65)*1.10
  for v in obj.data.vertices:v.co.x*=.93
# Every closed component uses outward normals, including reflected eye prisms.
# Stone sole vertices are flattened at the model's origin ground plane.
for obj in objects:
 if 'stone foot' in obj.name or ' toe ' in obj.name:
  for v in obj.data.vertices:
   if v.co.z<.05:v.co.z=0.0
 bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
# Semantic rigid hierarchy: each appendage can be articulated independently.
# All actual model objects remain selected for export, including pivot empties.
mesh_objects=list(objects)
root_pivot=bpy.data.objects.new('Bellback_ROOT',None);bpy.context.collection.objects.link(root_pivot)
root_pivot['front']='-Y';root_pivot['up']='Z';root_pivot['animation_status']='rigid pivots only; clips untested'
pivots={}
for name,location in [('Body',(0,0,1.2)),('Head',(0,-.65,1.20)),('Bell',(0,.475,3.05)),('Left fore',(-.60,-.57,1.46)),('Right fore',(.60,-.57,1.46)),('Left hind',(-.60,.86,1.46)),('Right hind',(.60,.86,1.46))]:
 pivot=bpy.data.objects.new(name+'_PIVOT',None);bpy.context.collection.objects.link(pivot);pivot.location=location;pivot.parent=root_pivot;pivots[name]=pivot
head_words=('skull','cranium','face','brow','cheek','eye','amber','Mouth','jaw','fang','tooth','splinter')
for obj in mesh_objects:
 group=next((key for key in pivots if obj.name.startswith(key)),None)
 if group is None:group='Head' if any(word.lower() in obj.name.lower() for word in head_words) else ('Bell' if obj.name.startswith(('Hollow','Clapper')) else 'Body')
 obj.parent=pivots[group];obj.matrix_parent_inverse=pivots[group].matrix_world.inverted()
# Parent inverse requires evaluated transforms before export.
bpy.context.view_layer.update()
for obj in mesh_objects:
 obj.matrix_parent_inverse=obj.parent.matrix_world.inverted()
objects=mesh_objects+[root_pivot]+list(pivots.values())
# Export creature only, before adding review environment.
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=str(out/'bellback-complete-pass1.glb'),export_format='GLB',use_selection=True,export_materials='EXPORT',export_yup=True)
tri=sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in mesh_objects)
(out/'metrics.json').write_text(json.dumps({'model':'Bellback complete pass 1','mesh_objects':len(mesh_objects),'rigid_pivots':len(pivots),'triangles':tri,'glb_bytes':(out/'bellback-complete-pass1.glb').stat().st_size,'palette':'sRGB swatches explicitly decoded to linear Blender Base Color','hollow_bell':True,'rigged':False,'runtime_integrated':False,'accepted':False},indent=2)+'\n')
if a.render:
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False
 scene.render.resolution_x=768;scene.render.resolution_y=960;scene.render.resolution_percentage=100
 scene.world.color=(.25,.25,.25);scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=-.20;scene.view_settings.gamma=1
 ground=material('Review ground sRGB','293D4B');bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));bpy.context.object.data.materials.append(ground)
 for name,loc,power,size in [('Key',(-4,-5,7),450,5),('Fill',(0,-5,3),260,4),('Rim',(0,4,6),600,3)]:
  d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1.5))-o.location).to_track_quat('-Z','Y').to_euler()
 d=bpy.data.cameras.new('Review camera');o=bpy.data.objects.new('Review camera',d);bpy.context.collection.objects.link(o);o.location={'front':(-4.4,-8,2.65),'side':(8,0,3.4),'rear':(-5,7,3.8),'low':(3,-7,2.1)}[a.view];o.rotation_euler=(Vector((0,-.05,1.65))-o.location).to_track_quat('-Z','Y').to_euler();d.type='ORTHO';d.ortho_scale=5.65;scene.camera=o
 from bpy_extras.object_utils import world_to_camera_view
 landmarks={'bell_crown':bp((0,0,1.35)),'mouth_left':bp((-.99,0,0)),'mouth_right':bp((.99,0,0)),'clapper':bp((0,-.27,-.18)),'nose':(0,-1.87,1.09),'fore_left':(-1.04,-1.0,.03),'fore_right':(1.04,-1.0,.03),'stern_tip':(-.30,1.47,3.46)}
 bpy.context.view_layer.update()
 projected={name:[round(v,5) for v in world_to_camera_view(scene,o,Vector(pt))[:2]] for name,pt in landmarks.items()}
 (out/('landmarks-v6-'+a.view+'.json')).write_text(json.dumps({'camera':list(o.location),'look_at':[0,-.05,1.65],'orthographic_scale':5.65,'normalized_xy_origin':'bottom-left','projected':projected},indent=2)+'\n')
 scene.render.image_settings.file_format='PNG';scene.render.filepath=str(out/('bellback-v6-'+a.view+'.png'));bpy.ops.render.render(write_still=True)
