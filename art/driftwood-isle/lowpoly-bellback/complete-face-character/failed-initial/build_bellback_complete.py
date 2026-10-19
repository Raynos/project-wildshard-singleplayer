"""Bellback complete-face-character: projecting wreck-guardian wedge anatomy. Blender 4.3+, no external assets.
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
wood=material('Timber honey sRGB','A86636');cut=material('Timber sunward sRGB','CE9051');shade=material('Timber broad shade sRGB','754A30');rope=material('Coarse rope flat sRGB','D7B775');ropeshade=material('Rope shade sRGB','A88B55');teal=material('Patinated bell sRGB','548A79');teallight=material('Patina light sRGB','6C9783');tealdark=material('Patina shade sRGB','497B6B');bronze=material('Bell bronze rims sRGB','C3A465');inside=material('Bell dark cavity sRGB','293D32');stone=material('Stone foot sRGB','656B6C');stonelight=material('Stone plane sRGB','92948B');ivory=material('Fangs ivory sRGB','EBDEB5');dark=material('Mouth and eye recess sRGB','332A20');eye=material('Amber eye sRGB','FF8B0C')
eye_shader=eye.node_tree.nodes.get('Principled BSDF');eye_shader.inputs['Emission Color'].default_value=(1,.19,.005,1);eye_shader.inputs['Emission Strength'].default_value=.35
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
  y=.94 if rear else -.66;label=('Right' if side>0 else 'Left')+(' hind' if rear else ' fore')
  foot_y=y+(.25 if rear else -.46);foot_x=side*(1.36 if rear else 1.12)
  # Humerus, broad elbow and tapered wrist form an articulated animal stance.
  loft(label+' timber leg',[((side*.60,y,1.46),.35,.32),((side*.92,y+(.10 if rear else -.08),1.25),.45,.36),((side*1.14,y+(.20 if rear else -.22),.70),.38,.31),((foot_x,foot_y,.25),.25,.26)],[wood,cut,shade],7)
  loft(label+' shoulder cap',[((side*.60,y,1.54),.36,.26),((side*.94,y-.14,1.28),.49,.34),((side*1.12,y-.31,.62),.30,.20)],[wood,cut,shade],5)
  loft(label+' stone foot',[((foot_x,foot_y,.04),.36,.39),((foot_x,foot_y,.28),.34,.34),((foot_x-side*.03,foot_y+.025,.60),.19,.22)],[stone,stonelight],7)
  for dx in [-.23,.23]:
   loft(label+' toe '+str(dx),[((foot_x+dx,foot_y-.26,.035),.14,.19),((foot_x+dx,foot_y-.21,.23),.13,.14),((foot_x+dx,foot_y-.03,.40),.055,.07)],[stone,stonelight],5)
  for offset in [-.07,.07]:
   cord(label+' shoulder lashing',[(side*.70+.33*math.cos(math.tau*i/10),y+.29*math.sin(math.tau*i/10),1.50+offset) for i in range(11)],.075)
 # Two ribs per side with unequal cant, width and tip heights. No regular fence.
 for j,y in enumerate([-.18,.48,1.13]):
  top=(side*[.91,.72,.48][j],y+[.11,.23,.19][j],[2.94,3.42,3.18][j]+side*.10)
  loft('Broken ship rib '+str(side)+' '+str(j),[((side*.79,y,.93),.21,.18),((side*.90,y+.09,2.22),.20,.17),(top,.14,.12),((top[0]+side*.06,top[1]-.015,top[2]+.17),.09,.11)],[wood,cut,shade],5)
 loft('Rooted lower hull rib '+str(side),[((side*.87,-.75,1.38),.20,.18),((side*1.02,.13,1.56),.19,.16),((side*.83,1.19,1.71),.14,.13)],[wood,cut,shade],5)
 loft('Sweeping upper wreck rib '+str(side),[((side*.95,-.15,2.44),.16,.14),((side*1.03,.42,2.69),.16,.13),((side*.67,1.24,2.82),.11,.12)],[wood,cut,shade],5)
 loft('Haunch overlapping strake '+str(side),[((side*.62,.18,1.46),.27,.18),((side*.89,.75,1.29),.33,.20),((side*.66,1.40,1.02),.18,.12)],[wood,shade,cut],5)
 for y,z,x in [(-.04,2.38,side*.86),(.98,1.62,side*.82)]:
  for offset in [-.065,.065]:
   cord('Frame rope knot',[(x+.23*math.cos(math.tau*i/10),y+.22*math.sin(math.tau*i/10),z+offset+.02*math.sin(math.tau*i/10)) for i in range(11)],.073)
 cord('Diagonal binding '+str(side),[(side*.91,-.16,2.38),(side*.98,.24,2.11),(side*.90,.90,1.66)],.075)
# Broad overlapping wreck strakes have rooted ends and unequal broken tips.
# They fill the carrier's side mass without obscuring the retained bell mouth.
for side in [-1,1]:
 loft('Lower broken side strake '+str(side),[((side*.99,-.64,1.48),.15,.20),((side*1.13,.32,1.68),.16,.21),((side*.82,1.36,1.95),.13,.16)],[wood,cut,shade],5)
 loft('Middle broken side strake '+str(side),[((side*1.0,-.41,2.08),.12,.17),((side*1.10,.49,2.31),.14,.20),((side*.76,1.36,2.51),.11,.15)],[wood,shade,cut],5)
 beam('Stern diagonal wreck plank '+str(side),(side*.78,.87,1.39),(side*.39,1.56,3.37+side*.16),.19,.13)
 # Shoulder armor overlaps the humerus in one large tapered facet mass.
 loft(('Right fore' if side>0 else 'Left fore')+' outer timber shield',[((side*.79,-.71,1.61),.29,.22),((side*1.16,-.99,1.10),.36,.26),((side*1.30,-1.22,.39),.15,.10)],[wood,cut,shade],5)
# A central split stern plank replaces the rear pair's repeating pickets.
beam('Tall stern plank',(-.18,1.14,1.56),(-.30,1.47,3.46),.18,.13)
# Bell support arch, shaped as a timber roof.
loft('Arch left',[((-.99,.18,2.56),.20,.18),((-.65,.30,3.04),.20,.18),((0,.40,3.44),.17,.18)],[wood,cut,shade],5)
loft('Arch right',[((0,.40,3.44),.17,.18),((.65,.30,3.04),.20,.18),((.99,.18,2.56),.20,.18)],[wood,cut,shade],5)
cord('Crown tie',[(-.16,.24,3.40),(0,.22,3.53),(.17,.24,3.40),(.15,.53,3.36),(-.17,.53,3.40),(-.16,.24,3.40)],.075)
# Bell is a continuous thick shell. Opening stays genuinely empty, with inner wall and crown.
# Local Z is the bell axis, tilted back 15 degrees to show cavity from low front views.
origin=Vector((0,-.22,1.86));rot=Matrix.Rotation(math.radians(-20),4,'X')
def bp(v):return tuple(origin+rot.to_3x3()@Vector(v))
profile=[(.99,0),(.97,.07),(.85,.24),(.82,.36),(.81,.42),(.76,.61),(.67,.86),(.65,.92),(.63,.99),(.54,1.25),(.49,1.33),(.0,1.35),(.0,1.20),(.42,1.19),(.47,1.12),(.56,.96),(.67,.55),(.76,.21),(.87,.08),(.88,0)]
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
# A long descending wedge is the skull, not a compact feline mask.
# Cross sections widen at the temples and converge into a blunt splintered nose.
loft('Solid timber cranium',[((0,-.61,1.35),.73,.34),((0,-1.14,1.38),.72,.32),((0,-1.72,1.13),.49,.24),((0,-2.08,.95),.25,.17)],[wood,cut,shade],7)
v=[(-.27,-.86,1.64),(.28,-.86,1.65),(-.31,-1.52,1.47),(.33,-1.52,1.47),(-.18,-2.13,.94),(.18,-2.13,.94),(0,-2.26,1.03),(0,-1.58,1.65),(0,-.94,1.77),(-.24,-1.42,1.05),(.24,-1.42,1.05),(0,-2.10,.81)]
f=[(0,2,7,8),(1,8,7,3),(2,4,6,7),(3,7,6,5),(4,11,5,6),(0,9,4,2),(1,3,5,10),(9,10,11,4),(9,0,8,1,10),(10,5,11)]
mesh('Pointed central face keel',v,f,[wood,cut,shade],[0,1,1,0,1,2,2,2,2,2])
# Integrated orbital wedges are thick cheek/temple masses, not long flat blades.
# The skull retains the descending silhouette; shorter overhang reveals eye depth.
for side in [-1,1]:
 brow_front=[(.80,-.77,1.63),(.70,-1.28,1.53),(.43,-1.83,1.13),(.46,-1.81,1.01),(.71,-1.39,1.25),(.85,-.94,1.36)]
 bv=[(side*x,y,z) for x,y,z in brow_front]+[(side*(x-.20),y+.07,z+.10) for x,y,z in brow_front]
 bf=[(0,1,4,5),(1,2,3,4),tuple(range(11,5,-1))]+[(i,i+6,(i+1)%6+6,(i+1)%6) for i in range(6)]
 if side<0:bf=[tuple(reversed(q)) for q in bf]
 mesh('Shaped orbital brow timber',bv,bf,[wood,cut,shade],[0,1,2,0,1,0,2,0,0])
 loft('Lower cheek timber',[((side*.72,-.85,1.15),.25,.20),((side*.67,-1.34,.99),.21,.17),((side*.40,-1.82,.82),.13,.10)],[wood,shade,cut],5)
 loft('Swept cheek horn',[((side*.75,-.69,1.20),.23,.21),((side*1.05,-.78,1.51),.21,.17),((side*1.24,-.88,1.93),.14,.12),((side*1.20,-.99,2.30),.045,.035)],[wood,cut,shade],6)
 def eye_prism(name,front,depth,mat):
  vv=[(side*x,y,z) for x,y,z in front]+[(side*(x-depth*.6),y+depth,z) for x,y,z in front]
  ff=[(0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(2,5,3,0)]
  if side<0:ff=[tuple(reversed(q)) for q in ff]
  return mesh(name,vv,ff,[mat])
 # Tall outer corner and low nose corner form the predatory triangular eye.
 eye_prism('Recessed eye shadow',[(.41,-1.97,.94),(.76,-1.45,1.25),(.69,-1.68,.89)],.09,dark)
 eye_prism('Inset amber eye',[(.46,-1.937,.978),(.718,-1.527,1.194),(.665,-1.711,.943)],.03,eye)
 # Small split wood facets replace the conspicuous ivory forehead pair.
 loft('Crown wood splinter '+str(side),[((side*.27,-1.17,1.57),.075,.055),((side*.30,-1.14,1.72+side*.025),.018,.014)],[cut,wood],4)
 # Overlapping neck gussets bind the shoulders into the head silhouette.
 loft(('Left fore' if side<0 else 'Right fore')+' neck gusset',[((side*.73,-.56,1.61),.20,.18),((side*.94,-.82,1.53),.25,.21),((side*.82,-1.10,1.25),.17,.11)],[wood,cut,shade],5)
loft('Mouth dark pocket',[((0,-1.54,.86),.39,.13),((0,-2.03,.73),.27,.14)],[dark],6)
loft('Lower timber jaw',[((0,-1.21,.68),.36,.15),((0,-1.73,.58),.29,.12),((0,-2.04,.65),.18,.075)],[wood,shade,cut],5)
# Sparse nonuniform opposing fangs, with dark negative space between them.
# Four real closed teeth replace the eight-tooth frontal fan.
for side in [-1,1]:
 x=.28; y=-1.98; z=.86
 loft('Ivory upper fang '+str(side),[((side*x,y,z),.065,.055),((side*(x-.005),y-.03,z-.12),.052,.045),((side*(x-.025),y-.045,z-.23),.008,.01)],[ivory],4)
 x=.115; y=-2.055; z=.62
 loft('Ivory lower tooth '+str(side),[((side*x,y,z),.064,.052),((side*(x+.018),y-.025,z+.10),.045,.035),((side*(x+.035),y-.035,z+.19+side*.015),.008,.009)],[ivory],4)
# Blunt wedge muzzle transitions into the recessed cheek instead of an arrow tip.
for obj in objects:
 if obj.name in ('Solid timber cranium','Pointed central face keel'):
  for v in obj.data.vertices:
   if v.co.y < -1.5:
    v.co.y=-1.5+(v.co.y+1.5)*.84
    v.co.x*=1.07
# Anatomical asymmetry and broad frontal load-bearing legs, without moving the sole plane.
for obj in objects:
 if obj.name.startswith(('Left fore','Right fore')):
  side=-1 if obj.name.startswith('Left') else 1
  for v in obj.data.vertices:
   v.co.x=side*.72+(v.co.x-side*.72)*1.10
 if obj.name.startswith(('Left hind','Right hind')):
  for v in obj.data.vertices:
   v.co.z*=.90
 if obj.name=='Barrel timber hull':
  for v in obj.data.vertices:
   v.co.z=1.2+(v.co.z-1.2)*1.12
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
bpy.ops.export_scene.gltf(filepath=str(out/'bellback-complete-face-character.glb'),export_format='GLB',use_selection=True,export_materials='EXPORT',export_yup=True)
tri=sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in mesh_objects)
(out/'metrics.json').write_text(json.dumps({'model':'Bellback complete face character','mesh_objects':len(mesh_objects),'rigid_pivots':len(pivots),'triangles':tri,'glb_bytes':(out/'bellback-complete-face-character.glb').stat().st_size,'palette':'sRGB swatches explicitly decoded to linear Blender Base Color','hollow_bell':True,'rigged':False,'runtime_integrated':False,'accepted':False},indent=2)+'\n')
