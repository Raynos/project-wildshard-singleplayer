"""Conch complete likeness pass 2, rebuilding asymmetric sloped whorls and coordinated face/shield from approved low-poly concept; no fresh human approval claimed. No runtime registration.
Blender -b -t 2 --python-exit-code 1 -P this.py -- --out tmp/approved-conch --render --clay
Coordinate frame: X lateral, +Y face, +Z up. All anatomy authored as surfaces.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy
sys.path.insert(0,str(Path(__file__).resolve().parent))
from mathutils import Vector
P=argparse.ArgumentParser();P.add_argument('--out',required=True);P.add_argument('--render',action='store_true');P.add_argument('--clay',action='store_true');P.add_argument('--view',default='front',choices=['front','side','rear'])
A=P.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []);OUT=Path(A.out).resolve();OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
TAU=math.tau;objects=[];sweeps=[]
from geometry_checks import inspect
def mat(name,c):
 c=tuple(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in c);m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*c,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.76;return m
cream=mat('Warm chalk shell',(.96,.70,.43));ivory=mat('Exposed pale shell ridges',(.99,.86,.62));orange=mat('Coral shell growth bands',(.98,.40,.20));pink=mat('Salmon aperture',(.88,.30,.15));dark=mat('Deep coral throat',(.57,.16,.075));red=mat('Burgundy carapace',(.46,.15,.20));edge=mat('Wine red plate edge',(.58,.21,.28));joint=mat('Dark flexible joints',(.065,.025,.033));amber=mat('Amber eye',(.98,.58,.008));black=mat('Slit pupil',(.008,.006,.008));clay=mat('Neutral clay',(.45,.47,.46))
def mesh(name,vs,fs,mats,indices=None):
 d=bpy.data.meshes.new(name);d.from_pydata(vs,[],fs);d.update();ob=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(ob)
 for m in mats:d.materials.append(clay if A.clay else m)
 if indices:
  for f,i in zip(d.polygons,indices):f.material_index=i
 objects.append(ob);return ob

def loft(name,rows,mats,cap=True,indices=None):
 n=len(rows[0]);v=[p for r in rows for p in r];f=[];mi=[]
 for j in range(len(rows)-1):
  for i in range(n):
   q=j*n+i;r=j*n+(i+1)%n;s=(j+1)*n+(i+1)%n;t=(j+1)*n+i
   f.extend([(q,r,s),(q,s,t)]);idx=indices(j,i) if indices else 0;mi.extend([idx,idx])
 if cap:f.extend([tuple(reversed(range(n))),tuple((len(rows)-1)*n+i for i in range(n))]);mi.extend([0,0])
 return mesh(name,v,f,mats,mi)

RADIUS_SCALES={'Raised breast carapace -1': [1.0, 0.6, 0.6, 1.0], 'Raised breast carapace 1': [1.0, 0.69, 0.69, 1.0], 'Swept shoulder armor -1': [1.0, 1.0, 0.97, 0.98], 'Swept shoulder armor 1': [1.0, 1.0, 0.98, 0.97]}

def limb(name,profile,mats,facets=12,flute=.06):
 # Swept elliptical sections oriented across the anatomical centerline.
 rows=[];previous_t=None;previous_u=None
 corrected=name.startswith(('Raised breast carapace','Swept shoulder armor'))
 for j,(p,w,d) in enumerate(profile):
  radius_scale=RADIUS_SCALES.get(name,[1.]*len(profile))[j];w*=radius_scale;d*=radius_scale
  p=Vector(p);t=Vector(profile[min(j+1,len(profile)-1)][0])-Vector(profile[max(0,j-1)][0]);t.normalize();u=t.cross(Vector((0,1,0))).normalized()
  if corrected and previous_t is not None:
   u=previous_t.rotation_difference(t) @ previous_u
   u=(u-t*u.dot(t)).normalized()
  v=t.cross(u).normalized();previous_t=t;previous_u=u
  rows.append([tuple(p+u*(w*math.cos(a)*(1+flute*math.cos(3*a)))+v*(d*math.sin(a))) for a in [TAU*i/facets for i in range(facets)]])
 sweeps.append(inspect(name,profile,rows))
 return loft(name,rows,mats,indices=lambda j,i:1 if len(mats)>1 and (i+j)%5==0 else 0)

# V10 repair: authored tilted polygonal whorl cages, not a phase-modulated cone.
# The broad shoulder planes carry the spiral silhouette. A single cut patch in
# this cage is continued into the flared outer lip and then back down a blind
# throat. Every part of the shell shares vertices; no separate aperture plate,
# Boolean excavation, collar trim, inner ribbon, or solidify modifier is used.
# Rows: axis x/y, central z, lateral/depth radius, oblique shoulder rise.
CAGES=[
 (-.38,-.34,1.35,.34,.35,.12),
 (-.43,-.37,1.55,.63,.53,.36),
 (-.54,-.40,1.87,.85,.64,.55),
 (-.64,-.43,2.16,.88,.66,.61),
 (-.73,-.42,2.49,.45,.38,.35),
 (-.85,-.43,2.60,.59,.43,.39),
 (-.94,-.44,2.82,.57,.43,.43),
 (-1.08,-.44,3.10,.25,.22,.21),
 (-1.15,-.43,3.22,.31,.24,.23),
 (-1.26,-.43,3.43,.14,.14,.11),
 (-1.36,-.42,3.65,.015,.018,.00),
]
N=12
vs=[];fs=[];colors=[]
for row,(cx,cy,z,rx,ry,tilt) in enumerate(CAGES):
 for i in range(N):
  angle=TAU*i/N
  # A deliberate irregular hexagonal shoulder rhythm. The low-frequency
  # asymmetry shapes the volumes rather than adding surface noise.
  radial=1 + .075*math.sin(3*angle+.40*row)
  # Offset shoulder planes avoid a circular crown or planar shelf.
  shoulder_warp=.055*math.sin(2*angle+.65*row) if row not in (0,10) else 0
  vs.append((cx+rx*math.cos(angle)*radial,
             cy+ry*math.sin(angle)*radial,
             z+tilt*math.cos(angle)+.24*ry*math.sin(angle)+shoulder_warp))
for row in range(len(CAGES)-1):
 for i in range(N):
  # Removed patch is exactly the aperture's shared boundary, not a Boolean.
  if 1<=row<5 and 0<=i<4:continue
  q=row*N+i;r=row*N+(i+1)%N;u=(row+1)*N+(i+1)%N;v=(row+1)*N+i
  tris=[(q,r,v),(r,u,v)] if (row+i)%2 else [(q,r,u),(q,u,v)]
  fs.extend(tris)
  # Broad chalk shoulders and irregular coral triangular faces, no painted
  # regular ring stripe. Each shoulder is a full sloping geometric plane.
  # Warm coral whorl flanks, narrow sloping cream growth shoulders.
  # Local facets track the physical whorl instead of pale horizontal disks.
  if row in (3,6,8):m=[0,1 if i%3==0 else 0]
  elif row in (0,4,7):m=[2,4 if i%3==1 else 2]
  else:m=[4 if i%3==0 else 2,0 if (row+i)%5==0 else 2]
  colors.extend(m)
# Close the small terminal tip and low shell seat.
fs.extend([tuple(reversed(range(N))),tuple((len(CAGES)-1)*N+i for i in range(N))]);colors.extend([3,0])
# Clockwise in front projection: lower right -> lower left -> upper left ->
# upper right. This is the boundary of the omitted cage patch, used directly.
boundary=[N+i for i in range(5)]+[row*N+4 for row in range(2,6)]+[5*N+i for i in range(3,-1,-1)]+[row*N for row in range(4,1,-1)]
assert len(boundary)==16
outline=[(.50,1.64),(.25,1.63),(-.05,1.57),(-.29,1.60),(-.47,1.65),
         (-.50,1.94),(-.43,2.24),(-.20,2.56),(.10,2.78),
         (.40,2.82),(.72,2.90),(.98,3.03),(1.00,2.70),
         (.78,2.45),(.95,2.27),(.70,1.98)]
# Thick lip has a variable-depth oblique profile, then opens onto an actual
# orange cavity. The deepest closed throat stays behind the brow and shell.
outer=[(x,.25+.10*(x+.50),z) for x,z in outline]
base=[Vector(vs[k]) for k in boundary]
rows=[boundary]
for blend in (.55,1.0):
 ids=[]
 for p,q in zip(base,outer):
  ids.append(len(vs));vs.append(tuple(p.lerp(Vector(q),blend)))
 rows.append(ids)
center=Vector((.15,-.10,2.20))
for scale,depth,shift in [(.88,.34,0),(.66,.16,-.12),(.40,-.02,-.24),(.15,-.25,-.34),(.025,-.32,-.38)]:
 ids=[]
 for x,y,z in outer:
  ids.append(len(vs));vs.append((center.x+shift+(x-center.x)*scale,depth+.07*(x+.5),center.z+(z-center.z)*scale))
 rows.append(ids)
for j in range(len(rows)-1):
 for i in range(16):
  q=rows[j][i];r=rows[j][(i+1)%16];u=rows[j+1][(i+1)%16];v=rows[j+1][i]
  fs.extend([(q,r,u),(q,u,v)])
  color=0 if j==0 else 1 if j in (1,2) else 4 if j==3 else 5 if j==4 else 3
  colors.extend([color,color if i%3 else (2 if j==4 else color)])
fs.append(tuple(reversed(rows[-1])));colors.append(3)
shell=mesh('Unified angular whorls lip and recessed throat',vs,fs,[cream,ivory,orange,dark,pink,mat('Warm cavity planes',(.75,.20,.075))],colors)
# A compact armored thorax and interlocking belly, not a long hanging pod.
breast=mat('Chest carmine light planes',(.54,.18,.24))
belly=mat('Dark burgundy abdomen',(.27,.075,.10))
belly_edge=mat('Abdomen warm facets',(.37,.12,.13))
limb('Compact thorax core',[((0,-.04,.82),.19,.18),((0,-.05,1.04),.29,.22),((0,-.02,1.29),.37,.25),((0,.00,1.47),.29,.20)],[red,breast],10)
# Chest armor wraps from sternum around both sides with raised value planes.
for side in [-1,1]:
 limb('Raised breast carapace '+str(side),[((side*.05,.13,1.38),.14,.16),((side*.21,.16,1.30),.23,.18),((side*.27,.13,1.17),.20,.15),((side*.16,.12,1.09),.11,.10)],[red,breast,edge],7)
# One continuous tapered abdominal volume replaces three mechanical belts
# and the skirt-like tassets. Separate thorax/limb objects remain rig inputs.
limb('Continuous tucked abdomen',[((0,-.03,1.10),.265,.20),((0,.02,.94),.245,.19),((0,.04,.78),.19,.16),((0,.05,.64),.10,.10)],[belly,belly_edge],9,.025)
# Coral head: cheek width, raised frontal keel, hooked descending beak.
# Every cross section is volumetric; the tip curls back after the forward keel.
face_rows=[]
for z,w,cy,d in [(1.64,.15,.365,.10),(1.56,.175,.405,.135),(1.46,.12,.455,.18),(1.36,.05,.50,.16),(1.28,.006,.575,.010)]:
 face_rows.append([(-w,cy,z),(-w*.60,cy+d*.72,z+.025),(0,cy+d,z+.035),(w*.60,cy+d*.72,z+.025),(w,cy,z),(w*.70,cy-.10,z), (0,cy-.13,z),(-w*.70,cy-.10,z)])
loft('Hooked coral cranium and keel',face_rows,[orange,pink,cream],indices=lambda j,i:2 if j==0 and i in [1,2] else 1 if i in [4,5,6,7] or (j==2 and i==0) else 0)
for side in [-1,1]:
 # Cheek wings emerge from the cranium, with a sharp downward facial sweep.
 limb('Sculpted cheek '+str(side),[((side*.19,.39,1.56),.105,.11),((side*.21,.455,1.46),.085,.11),((side*.125,.53,1.43),.04,.05),((side*.075,.55,1.32),.006,.008)],[orange,pink],5)
 limb('Angular brow root '+str(side),[((side*.075,.41,1.57),.07,.065),((side*.18,.43,1.60),.105,.085),((side*.28,.39,1.55),.035,.04)],[orange,cream],5)
 # Small dark nostrils on separate sloped cheek planes rather than stickers.
 mesh('Inset nostril '+str(side),[(side*.105,.659,1.49),(side*.157,.619,1.47),(side*.133,.646,1.425)],[(0,1,2)],[joint])
# Pointed dimensional eye sockets with sloping brows and recessed convex lenses.
# The signed local x axis tilts the two eye leaves away from the centerline.
for side in [-1,1]:
 c=Vector((side*.42,.465,2.04+(0.11 if side<0 else -.08)))
 limb('Eyestalk '+str(side),[((side*.16,.33,1.51),.073,.066),((side*.25,.38,1.70),.061,.053),((side*.35,.415,1.88),.052,.047),(tuple(c),.065,.06)],[red,edge],7)
 shape=[(.125,.20),(.11,.035),(.045,-.072),(-.095,-.12),(-.095,.012),(-.050,.105)]
 rows=[]
 # Slanted eye surface and peaked socket crown give depth from all angles.
 for scale,dy in [(.53,-.070),(.90,-.035),(1.0,.015),(.88,.064),(.78,.052)]:
  rows.append([(c.x+side*x*scale,c.y+dy-.20*x,c.z+(z+.24*x)*scale) for x,z in shape])
 eye=loft('Pointed sculpted eye socket '+str(side),rows,[red,edge,belly],cap=False,indices=lambda j,i:1 if j==2 and i in [0,4,5] else 2 if j==3 else 0)
 mesh('Closed socket back '+str(side),rows[0],[tuple(range(6))],[red])
 # Six peripheral vertices sink behind the brow; raised center lens is amber.
 rim=rows[-1];lens=[(c.x,c.y+.074,c.z+.015)]+rim
 mesh('Convex inset amber lens '+str(side),lens,[(0,i+1,(i+1)%6+1) for i in range(6)],[amber])
 # Pupil follows the convex lens ridge, and is pointed rather than rectangular.
 mesh('Black pointed slit '+str(side),[(c.x-.016,c.y+.078,c.z+.008),(c.x-.002,c.y+.073,c.z+.112),(c.x+.017,c.y+.077,c.z+.014),(c.x+.006,c.y+.071,c.z-.078)],[(0,1,2),(0,2,3)],[black])
 mesh('Eye glint '+str(side),[(c.x-.038,c.y+.087,c.z+.072),(c.x-.017,c.y+.090,c.z+.051),(c.x-.020,c.y+.085,c.z+.091)],[(0,1,2)],[ivory])
# Crouched asymmetrical planted stance. Long angled thigh plates, shorter
# grounded shins, distinct closed feet and toes, not isolated skinny tubes.
for s in [-1,1]:
 dy=-.17 if s<0 else .13
 hip=(s*.23,-.03,.86);knee=(s*.69,dy,.63);ankle=(s*.86,dy+.18,.14)
 limb('Leg hinge '+str(s),[(hip,.16,.15),(knee,.13,.12),(ankle,.095,.085)],[joint],8)
 limb('Bent armored thigh '+str(s),[(hip,.13,.14),((s*.40,dy-.01,.83),.22,.19),((s*.64,dy,.69),.20,.15),(knee,.13,.12)],[red,edge],8)
 limb('Armored shin '+str(s),[(knee,.15,.14),((s*.76,dy+.06,.40),.18,.13),(ankle,.085,.08)],[red,edge],8)
 limb('Planted foot '+str(s),[(ankle,.10,.08),((s*.88,dy+.33,.08),.16,.09),((s*.88,dy+.46,.045),.13,.045)],[red,edge],6)
 for toe in [-1,1]:
  limb('Toe blade '+str((s,toe)),[((s*.88+toe*.07,dy+.32,.085),.075,.060),((s*.88+toe*.12,dy+.47,.055),.065,.050),((s*.88+toe*.14,dy+.56,.025),.004,.006)],[cream,edge],5)
# Substantial curved upper arms end in exposed articulated elbows.
for side in [-1,1]:
 limb('Shoulder hinge '+str(side),[((side*.27,-.015,1.36),.14,.14),((side*.46,.05,1.31),.15,.14)],[joint],7)
 limb('Swept shoulder armor '+str(side),[((side*.23,-.03,1.43),.13,.16),((side*.43,.045,1.44),.24,.23),((side*.60,.10,1.30),.21,.20),((side*.57,.16,1.20),.12,.12)],[red,breast],7)
 limb('Bent upper arm '+str(side),[((side*.48,.06,1.31),.14,.13),((side*.64,.16,1.15),.185,.155),((side*.74,.28,1.06),.135,.12)],[red,edge],7)
 limb('Elbow joint '+str(side),[((side*.69,.22,1.10),.13,.13),((side*.81,.34,1.02),.125,.12)],[joint],7)
limb('Shield supporting forearm',[((-.76,.30,1.04),.13,.13),((-.86,.46,1.17),.18,.16),((-.91,.58,1.28),.16,.15)],[red,breast],7)
# Broad angular shield-claw with a swollen coral back and ivory cutting keel.
# A hand-authored asymmetric outline replaces the previous oval section stack.
# All front and back surfaces share the same perimeter and are fully closed.
shield_outline=[(-.88,1.79),(-1.07,1.60),(-1.28,1.64),(-1.43,1.38),(-1.56,1.19),(-1.49,.99),(-1.46,.77),(-1.16,.51),(-.51,.16),(-.49,.60),(-.63,1.03),(-.73,1.43)]
sv=[]
for x,z in shield_outline:sv.append((x,.63+.20*(1.35-z),z))
# Raised internal ridge follows the cutting edge with off-center triangular facets.
for i,(x,z) in enumerate(shield_outline):
 sv.append((-.85+(x+.85)*.55,.91+.15*(1-abs(z-.97)),.96+(z-.96)*.66))
front_center=len(sv);sv.append((-.79,1.065,.99))
back_center=len(sv);sv.append((-.99,.35,1.05))
sf=[];sm=[]
for i in range(12):
 k=(i+1)%12
 sf.extend([(i,k,12+k),(i,12+k,12+i),(12+i,12+k,front_center),(k,i,back_center)])
 # Pale edge wraps around upper inner tooth and down the pointed inner cutting face.
 m=1 if i in [8,9,10,11] else 0 if i in [0,2] else 2 if i in [1,4,6] else 3
 sm.extend([m,m,1 if i in [8,9,10,11] else 2 if i%3 else 3,3 if i%3 else 2])
mesh('Broad convex jagged shield claw',sv,sf,[cream,ivory,orange,pink],sm)
limb('Shield opposed articulated thumb',[((-.65,.38,1.20),.13,.13),((-.39,.46,1.08),.16,.14),((-.36,.59,.87),.12,.10),((-.48,.69,.72),.008,.009)],[orange,cream],7)
limb('Rapier forearm cuff',[((.68,.18,1.17),.14,.13),((.88,.34,1.06),.19,.15),((1.03,.47,.92),.14,.12)],[red,edge],8)
limb('Coral rapier knuckle',[((.94,.43,1.06),.16,.145),((1.07,.53,.98),.205,.15),((1.18,.63,.84),.135,.11)],[orange,pink],6)
limb('Long ivory conch rapier',[((.94,.43,1.06),.15,.12),((1.12,.57,.91),.19,.13),((1.29,.69,.67),.13,.09),((1.47,.82,.36),.06,.04),((1.61,.93,.10),.002,.003)],[ivory,cream],6,.04)
limb('Rapier gripping thumb',[((.86,.40,1.01),.08,.075),((1.00,.54,.79),.09,.07),((1.13,.64,.68),.003,.004)],[red,edge],7)
# Replace broad black hinge breaks with carapace-toned living joints;
# narrow thigh and shoulder bulges while retaining their real depth.
for ob in objects:
 if any(t in ob.name for t in ['Leg hinge','Shoulder hinge','Elbow joint']):
  ob.data.materials.clear();ob.data.materials.append(clay if A.clay else red)
 if ob.name.startswith('Bent armored thigh'):
  cx=sum(v.co.x for v in ob.data.vertices)/len(ob.data.vertices)
  for v in ob.data.vertices:v.co.x=cx+(v.co.x-cx)*.87
 if ob.name.startswith('Swept shoulder armor'):
  cz=1.33
  for v in ob.data.vertices:v.co.z=cz+(v.co.z-cz)*.86
 if ob.name=='Broad convex jagged shield claw':
  for v in ob.data.vertices:
   v.co.x=-.82+(v.co.x+.82)*1.12
   v.co.y=.65+(v.co.y-.65)*1.12
# Named closed meshes are preserved for future articulation. No skin or
# armature is claimed: rigid segmentation must be bound and motion-tested.
# Reference image's shield, tapering apex and broad whorls are on screen left.
# Mirror the authored anatomy together, then reverse winding to preserve normals.
for ob in objects:
 for vertex in ob.data.vertices:vertex.co.x*=-1
 for polygon in ob.data.polygons:polygon.flip()
 ob.data.update()
import bmesh
for ob in objects:
 bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
assert all(not r['opposedSideTriangles'] and not r['opposedStripTrianglePairs'] for r in sweeps), 'Folded source sweep refused'
# Model source metadata. Rendering is opt-in and must acquire coordinator lane.
for ob in objects:
 ob['source']='approved-conch/selected-geometry-admission/build_selected_conch.py';ob['quality_accepted']=False
tri=0
for ob in objects:ob.data.calc_loop_triangles();tri+=len(ob.data.loop_triangles)
(OUT/'metrics.json').write_text(json.dumps({'status':'owner-approved low-poly target; actual model unaccepted','triangles':tri,'meshObjects':len(objects),'runtimeIntegrated':False,'acceptance':0},indent=2))
(OUT/'source-sweep-check.json').write_text(json.dumps({'stage':'Before mirroring or recalculation','meshes':sweeps},indent=2))
bpy.ops.object.select_all(action='DESELECT')
for ob in objects:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'conch-study.glb'),export_format='GLB',use_selection=True,export_materials='EXPORT',export_yup=True)
if A.render:
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=False;scene.render.resolution_x=780;scene.render.resolution_y=960;scene.render.resolution_percentage=100;scene.world.color=(.15,.15,.15);scene.view_settings.view_transform='AgX'
 floor=mat('Studio floor',(.025,.035,.045));mesh('Studio ground',[(-50,-50,0),(50,-50,0),(50,50,0),(-50,50,0)],[(0,1,2,3)],[floor])
 def light(name,pos,power,size):
  d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=size;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,1.5))-o.location).to_track_quat('-Z','Y').to_euler()
 light('Warm key',(-3,4,6),650,4);light('Cool fill',(4,2,3),350,4);light('Shell rim',(-1,-4,5),800,3)
 d=bpy.data.cameras.new('Reference three-quarter');cam=bpy.data.objects.new('Reference three-quarter',d);bpy.context.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO';d.ortho_scale=4.70
 cam.location={'front':(-3,7,3.0),'side':(7,1,2.8),'rear':(-3,-7,3.0)}[A.view];cam.rotation_euler=(Vector((0,0,1.62))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/('clay-' if A.clay else 'color-'))+A.view+'.png';bpy.ops.render.render(write_still=True)
