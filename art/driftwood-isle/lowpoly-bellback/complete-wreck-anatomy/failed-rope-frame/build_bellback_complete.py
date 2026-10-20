"""Bellback complete-wreck-anatomy: projecting wreck-guardian wedge anatomy. Blender 4.3+, no external assets.
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
 vs=[];previous_u=None
 for j,(xyz,w,h) in enumerate(rows):
  c=Vector(xyz);t=(Vector(rows[min(len(rows)-1,j+1)][0])-Vector(rows[max(0,j-1)][0])).normalized();u=t.cross(Vector((0,1,0)))
  if u.length<.01:u=t.cross(Vector((0,0,1)))
  u.normalize()
  if previous_u is not None and u.dot(previous_u)<0:u=-u
  previous_u=u.copy();v=t.cross(u).normalized()
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
def cord(name,points,r=.065):
 closed=(Vector(points[0])-Vector(points[-1])).length<1e-6
 raw=[Vector(p) for p in (points[:-1] if closed else points)]
 # Subdivide long runs so a coarse twisted section reads across each run.
 centers=[]
 for j in range(len(raw) if closed else len(raw)-1):
  a=raw[j];b=raw[(j+1)%len(raw)];steps=max(1,math.ceil((b-a).length/.17))
  centers.extend(a.lerp(b,k/steps) for k in range(steps))
 if not closed:centers.append(raw[-1])
 N=len(centers);n=6;vs=[]
 if name=='Crown tie':r=.052
 for j,c in enumerate(centers):
  tangent=(centers[(j+1)%N if closed else min(N-1,j+1)]-centers[(j-1)%N if closed else max(0,j-1)]).normalized()
  up=Vector((0,0,1))
  if abs(tangent.dot(up))>.9:up=Vector((0,1,0))
  u=tangent.cross(up).normalized();v=tangent.cross(u).normalized()
  phase=.20*math.sin(j*1.3);rad=r*(1+.07*math.sin(j*1.7))
  vs.extend(tuple(c+rad*(u*math.cos(math.tau*i/n+phase)+v*math.sin(math.tau*i/n+phase))) for i in range(n))
 fs=[];ids=[]
 for j in range(N if closed else N-1):
  for i in range(n):
   fs.append((j*n+i,j*n+(i+1)%n,((j+1)%N)*n+(i+1)%n,((j+1)%N)*n+i));ids.append(1 if (i+j//2)%6==4 else 0)
 if not closed:fs.extend([tuple(reversed(range(n))),tuple((N-1)*n+i for i in range(n))]);ids.extend([0,0])
 return mesh(name,vs,fs,[rope,ropeshade],ids)
# Structural carcass: continuous ribbed hull beneath the bell, not stacked spheres.
loft('Barrel timber hull',[((0,-.88,1.36),.58,.30),((0,-.38,1.40),.82,.44),((0,.32,1.46),.73,.42),((0,.91,1.40),.59,.33),((0,1.25,1.30),.30,.22)],[wood,shade,cut],7)
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
# Complete cranium and descending jaw are rebuilt as interlocking volumes.
# The eye ridge terminates in a narrow muzzle; no long flat face shield.
loft('Solid timber cranium',[((0,-.56,1.41),.53,.27),((0,-.96,1.35),.60,.29),((0,-1.37,1.10),.40,.23),((0,-1.79,.80),.18,.13)],[wood,cut,shade],7)
loft('Pointed central face keel',[((0,-.80,1.62),.18,.11),((0,-1.20,1.39),.23,.10),((0,-1.60,1.02),.16,.12),((0,-1.91,.79),.09,.055)],[cut,wood,shade],5)
for side in [-1,1]:
 loft('Shaped orbital brow timber '+str(side),[((side*.55,-.75,1.53),.23,.13),((side*.58,-1.10,1.38),.20,.12),((side*.40,-1.51,1.04),.16,.085),((side*.19,-1.83,.77),.065,.045)],[wood,cut,shade],5)
 loft('Lower cheek timber '+str(side),[((side*.55,-.73,1.21),.20,.17),((side*.52,-1.12,.97),.18,.12),((side*.28,-1.60,.69),.12,.085)],[wood,shade,cut],5)
 loft('Swept cheek horn '+str(side),[((side*.75,-.69,1.20),.23,.21),((side*1.05,-.78,1.51),.21,.17),((side*1.24,-.88,1.93),.14,.12),((side*1.20,-.99,2.30),.045,.035)],[wood,cut,shade],6)
 def eye_prism(name,front,depth,mat):
  vv=[(side*x,y,z) for x,y,z in front]+[(side*(x-depth*.6),y+depth,z) for x,y,z in front]
  ff=[(0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(2,5,3,0)]
  if side<0:ff=[tuple(reversed(q)) for q in ff]
  return mesh(name+str(side),vv,ff,[mat])
 eye_prism('Recessed eye shadow',[(.29,-1.75,.78),(.56,-1.33,1.115),(.52,-1.44,.86)],.065,dark)
 eye_prism('Inset amber eye',[(.335,-1.70,.835),(.535,-1.365,1.06),(.485,-1.465,.895)],.025,eye)
 loft('Crown wood splinter '+str(side),[((side*.22,-1.03,1.53),.07,.055),((side*.25,-1.01,1.73+side*.025),.012,.015)],[cut,wood],4)
 loft(('Left fore' if side<0 else 'Right fore')+' neck gusset',[((side*.66,-.56,1.54),.25,.20),((side*.85,-.78,1.46),.25,.22),((side*.69,-1.05,1.14),.16,.12)],[wood,cut,shade],5)
# A recessed dark cheek-and-jaw cavity supports separate small tooth solids.
loft('Mouth dark pocket',[((0,-1.12,.91),.39,.16),((0,-1.56,.68),.28,.13),((0,-1.85,.60),.15,.10)],[dark],6)
loft('Lower timber jaw',[((0,-.97,.88),.34,.13),((0,-1.40,.59),.27,.105),((0,-1.75,.50),.18,.075),((0,-1.88,.59),.09,.055)],[wood,shade,cut],5)
for side in [-1,1]:
 for j,(x,y,z) in enumerate([(.245,-1.63,.74),(.145,-1.80,.69)]):
  loft('Ivory upper fang '+str(side)+' '+str(j),[((side*x,y,z),.055,.045),((side*(x-.015),y-.025,z-.11),.042,.035),((side*(x-.02),y-.045,z-.18),.008,.008)],[ivory],4)
 # The central ivory bite remains directional, with a small uneven pair.
 for j,(x,y,z) in enumerate([(.09,-1.82,.50),(.19,-1.69,.55)]):
  loft('Ivory lower jaw '+str(side)+' '+str(j),[((side*x,y,z),.055,.045),((side*(x+.015),y-.035,z+.10),.045,.030),((side*(x+.025),y-.05,z+.17+(side*.012)),.008,.008)],[ivory],4)
head_mass=('Solid timber cranium','Pointed central face keel','Shaped orbital brow timber','Lower cheek timber','Recessed eye shadow','Inset amber eye','Crown wood splinter','Mouth dark pocket','Lower timber jaw','Ivory upper fang','Ivory lower jaw')
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
# Integrated load-bearing proportions: compact body, splayed crouch, purposeful wreck carrier.
# All transforms affect genuine geometry, before outward orientation and export.
carrier_prefixes=('Broken ship rib','Rooted lower hull rib','Sweeping upper wreck rib','Haunch overlapping strake','Lower broken side strake','Middle broken side strake','Stern diagonal wreck plank','Tall stern plank','Frame rope knot','Diagonal binding')
for obj in objects:
 if obj.name.startswith(carrier_prefixes) or obj.name=='Barrel timber hull':
  for v in obj.data.vertices:
   v.co.y=-.35+(v.co.y+.35)*.79
 if obj.name.startswith(('Left hind','Right hind')):
  for v in obj.data.vertices:
   v.co.y-=.23
   v.co.x*=1.08
 if obj.name.startswith(('Left fore','Right fore')):
  side=-1 if obj.name.startswith('Left') else 1
  for v in obj.data.vertices:
   h=max(0,min(1,(v.co.z-.30)/1.3))
   v.co.x+=side*(.10+.06*h)
   v.co.z*=.94
 if obj.name=='Barrel timber hull':
  for v in obj.data.vertices:
   v.co.x*=1.08
   v.co.z=1.13+(v.co.z-1.2)*.92
 if obj.name.startswith('Middle broken side strake'):
  for v in obj.data.vertices:
   v.co.z+=.20*(v.co.y+.40)
 if obj.name.startswith('Lower broken side strake'):
  for v in obj.data.vertices:
   v.co.z-=.12*(v.co.y+.40)
 if obj.name.startswith(('Tall stern plank','Stern diagonal wreck plank')):
  for v in obj.data.vertices:
   v.co.z=1.5+(v.co.z-1.5)*.81
   v.co.x+=.15*(v.co.z-1.5)
# Broad connected chest wedges bridge head roots to the weight-bearing shoulder plates.
for side in [-1,1]:
 loft(('Left fore' if side<0 else 'Right fore')+' connected chest strake',[
  ((side*.47,-.65,1.48),.25,.20),((side*.88,-.78,1.40),.38,.24),
  ((side*1.16,-.95,.92),.27,.17)],[wood,cut,shade],5)
 # Rear fan overlaps the hull end with two unequal broad ship fragments.
 beam('Stern fan broad plank '+str(side),(side*.15,.70,1.05),(side*.62,1.08,2.14+side*.10),.25,.13)
# Clearance repair: retain fixed crown attachment, shorten stem and lift weight.
# The old clapper intersected both hull and cranium. These edits change actual geometry.
for obj in objects:
 if obj.name=='Clapper weight':
  for v in obj.data.vertices:v.co.z+=.20
 if obj.name=='Clapper stem':
  anchor=bp((0,0,1.19))[2]
  for v in obj.data.vertices:v.co.z=anchor+(v.co.z-anchor)*.84
# Complete-character correction: a descending head, irregular wreck lashings,
# broad articulated haunches and a connected stern rather than a shelf and box.
for obj in objects:
 if obj.name.startswith(('Left hind','Right hind')):
  side=-1 if obj.name.startswith('Left') else 1
  for v in obj.data.vertices:
   h=max(0,min(1,v.co.z/1.2))
   v.co.x+=side*.05*math.sin(math.pi*h)
   v.co.y+=.16*math.sin(math.pi*h)
 if obj.name.startswith('Barrel timber hull'):
  for v in obj.data.vertices:
   if v.co.y>.45:v.co.z-=.13*(v.co.y-.45)
 if obj.name.startswith(('Arch left','Arch right')):
  for v in obj.data.vertices:
   v.co.z-=.13*max(0,1-abs(v.co.x))
 if obj.name=='Crown tie':
  for v in obj.data.vertices:v.co.z-=.13
 # Large side rails become short broken wooden strakes under the ropes.
 if obj.name.startswith(('Middle broken side strake','Sweeping upper wreck rib')):
  for v in obj.data.vertices:
   v.co.y=.32+(v.co.y-.32)*.86
# Thick continuous lashings, with angular bent runs and uneven paired wraps.
# Each run is a closed solid tube; no painted-on rope or floating image detail.
for side in [-1,1]:
 for level in [0,1]:
  z=1.72+level*.75
  # Capsule ends have radius greater than the tube, preventing inner folds.
  pts=[]
  for center,angles in [(.70,[math.pi*i/12 for i in range(13)]),
                         (-.12,[math.pi+math.pi*i/12 for i in range(13)])]:
   for angle in angles:
    yy=center+.19*math.sin(angle)
    pts.append((side*(.94+.19*math.cos(angle)),yy,z+.18*(yy+.4)))
  pts.append(pts[0])
  cord('Heavy salvage side lashing '+str(side)+' '+str(level),pts,.105)
  # Loose end stays rooted in the wrap and descends toward the shoulder.
  if level==0:
   cord('Hanging shoulder rope '+str(side),[(side*.98,-.39,1.83),
    (side*.94,-.59,1.55),(side*.89,-.55,1.22),(side*.80,-.42,1.15)],.082)
 # Rear has an overlapping hull fan, rather than a naked octagonal end cap.
 loft('Stern overlapping plate '+str(side),[((side*.11,.88,1.34),.24,.20),
  ((side*.39,1.13,1.04),.30,.19),((side*.29,1.12,.69),.12,.12)],[wood,shade,cut],5)
 loft(('Left hind' if side<0 else 'Right hind')+' broad haunch shield',[
  ((side*.85,.65,1.50),.28,.25),((side*1.23,.91,.99),.30,.26),
  ((side*1.29,1.04,.46),.16,.12)],[wood,cut,shade],5)
# Wreck lashings cross behind the bell, referencing the approved inferred rear.
cord('Rear crossed rope left',[(-.84,.94,2.52),(-.52,1.18,2.22),(.18,1.32,1.95),(.72,1.03,1.73)],.095)
cord('Rear crossed rope right',[(.85,.97,2.46),(.45,1.22,2.16),(-.22,1.33,1.96),(-.75,1.03,1.73)],.095)
# Integrated abdomen-to-haunch transition, with visible overlapping broad ribs.
for side in [-1,1]:
 for j in range(3):
  yy=-.30+j*.38
  loft('Angled abdominal rib '+str(side)+' '+str(j),[
   ((side*.68,yy,1.46),.18,.15),((side*.78,yy+.06,1.17),.19,.12),
   ((side*.47,yy+.16,.96+j*.035),.13,.09)],[wood,shade,cut],5)
 # A hanging knotted end joins the lower frame and front shoulder.
 cord('Shoulder knot tail '+str(side),[(side*.98,-.18,1.71),
  (side*1.03,-.35,1.58),(side*.96,-.51,1.34),(side*.91,-.46,1.10)],.085)
for obj in objects:
 if obj.name.startswith(('Left fore','Right fore','Left hind','Right hind')):
  for v in obj.data.vertices:
   # Knees retain breadth; wrists taper into narrower stone contact masses.
   if 'stone foot' in obj.name or ' toe ' in obj.name:
    side=-1 if obj.name.startswith('Left') else 1
    center=side*(1.38 if 'hind' in obj.name else 1.26)
    v.co.x=center+(v.co.x-center)*.89
   elif 'timber leg' in obj.name or 'shoulder cap' in obj.name:
    t=max(0,min(1,(.8-v.co.z)/.65))
    side=-1 if obj.name.startswith('Left') else 1
    v.co.x=side*1.25+(v.co.x-side*1.25)*(1-.15*t)
 # Bell keeps its aperture and attached clapper; broad body color fields only.
 if obj.name=='Hollow cast bell':
  for poly in obj.data.polygons:
   if poly.material_index in (0,1,2) and poly.index%7==0:poly.material_index=0
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
bpy.ops.export_scene.gltf(filepath=str(out/'bellback-complete-wreck-anatomy.glb'),export_format='GLB',use_selection=True,export_materials='EXPORT',export_yup=True)
tri=sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in mesh_objects)
(out/'metrics.json').write_text(json.dumps({'model':'Bellback integrated wreck anatomy','mesh_objects':len(mesh_objects),'rigid_pivots':len(pivots),'triangles':tri,'glb_bytes':(out/'bellback-complete-wreck-anatomy.glb').stat().st_size,'palette':'sRGB swatches explicitly decoded to linear Blender Base Color','hollow_bell':True,'rigged':False,'runtime_integrated':False,'accepted':False},indent=2)+'\n')

(out/'native-geometry.json').write_text(json.dumps([dict(name=o.name,vertices=[list(v.co) for v in o.data.vertices],faces=[list(f.vertices) for f in o.data.polygons],material_indices=[f.material_index for f in o.data.polygons],materials=[m.name for m in o.data.materials],matrix_world=[list(row) for row in o.matrix_world],parent=o.parent.name if o.parent else None) for o in mesh_objects],separators=(',',':'))+'\n')
