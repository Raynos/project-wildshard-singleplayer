"""Low-poly style study from revised concept; no fresh human approval claimed. No runtime registration.
Blender -b -t 2 --python-exit-code 1 -P this.py -- --out tmp/approved-conch --render --clay
Coordinate frame: X lateral, +Y face, +Z up. All anatomy authored as surfaces.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
P=argparse.ArgumentParser();P.add_argument('--out',required=True);P.add_argument('--render',action='store_true');P.add_argument('--clay',action='store_true');P.add_argument('--view',default='front',choices=['front','side','rear'])
A=P.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []);OUT=Path(A.out).resolve();OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
TAU=math.tau;objects=[]
def mat(name,c):
 c=tuple(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in c);m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*c,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.76;return m
cream=mat('Warm chalk shell',(.95,.77,.51));ivory=mat('Exposed pale shell ridges',(.98,.88,.68));orange=mat('Coral shell growth bands',(.96,.42,.20));pink=mat('Salmon aperture',(.88,.30,.15));dark=mat('Deep coral throat',(.42,.10,.045));red=mat('Burgundy carapace',(.46,.15,.20));edge=mat('Wine red plate edge',(.58,.21,.28));joint=mat('Dark flexible joints',(.065,.025,.033));amber=mat('Amber eye',(.98,.40,.025));black=mat('Slit pupil',(.012,.008,.012));clay=mat('Neutral clay',(.45,.47,.46))
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

def limb(name,profile,mats,facets=12,flute=.06):
 # Swept elliptical sections oriented across the anatomical centerline.
 rows=[]
 for j,(p,w,d) in enumerate(profile):
  p=Vector(p);t=Vector(profile[min(j+1,len(profile)-1)][0])-Vector(profile[max(0,j-1)][0]);t.normalize();u=t.cross(Vector((0,1,0))).normalized();v=t.cross(u).normalized()
  rows.append([tuple(p+u*(w*math.cos(a)*(1+flute*math.cos(3*a)))+v*(d*math.sin(a))) for a in [TAU*i/facets for i in range(facets)]])
 return loft(name,rows,mats,indices=lambda j,i:1 if len(mats)>1 and (i+j)%5==0 else 0)

# Broad angular continuous conch. Bands are cut into each surface triangle
# at the actual growth-phase boundary, rather than coloring whole grid cells:
# this prevents staircase/checkerboard paint while retaining deliberate planes.
N=18;M=25;grid=[];phase_grid=[]
for j in range(M):
 t=j/(M-1);cx=-.25-.91*t;cy=-.30-.12*t;z=1.53+1.65*t
 envelope=.82*(1-t)**.55+.008
 for i in range(N):
  angle=TAU*i/N;phase=TAU*t*3.8-angle
  radius=envelope+.13*(1-t)*math.cos(phase)+.055*(1-t)*math.cos(2*phase)
  grid.append((cx+radius*math.cos(angle),cy+radius*.80*math.sin(angle),z+.04*(1-t)*math.sin(angle+.7)))
  phase_grid.append(math.cos(phase)-.20)
vs=[];fs=[];colors=[];lookup={}
def vertex_key(point):
 key=tuple(round(c,8) for c in point)
 if key not in lookup:lookup[key]=len(vs);vs.append(point)
 return lookup[key]
def clip(poly,positive):
 result=[]
 for current,nxt in zip(poly,poly[1:]+poly[:1]):
  p,v=current;q,w=nxt;inside=v>=0 if positive else v<=0;next_inside=w>=0 if positive else w<=0
  if inside:result.append(current)
  if inside!=next_inside:
   factor=v/(v-w);result.append((tuple(p[k]+factor*(q[k]-p[k]) for k in range(3)),0))
 return result
for j in range(M-1):
 for i in range(N):
  q=j*N+i;r=j*N+(i+1)%N;u=(j+1)*N+(i+1)%N;v=(j+1)*N+i
  for triangle in [(q,r,u),(q,u,v)]:
   poly=[(grid[k],phase_grid[k]) for k in triangle]
   for positive,material in [(True,2),(False,1)]:
    clipped=clip(poly,positive)
    for k in range(1,len(clipped)-1):
     ids=tuple(vertex_key(clipped[n][0])for n in [0,k,k+1])
     if len(set(ids))==3:fs.append(ids);colors.append(material)
for end in [0,M-1]:
 ids=[vertex_key(grid[end*N+i]) for i in range(N)]
 fs.append(tuple(reversed(ids)) if end==0 else tuple(ids));colors.append(0)
shell=mesh('Broad angular conch with aligned helical growth bands',vs,fs,[cream,orange,ivory],colors)
# Pointed shoulder lip: asymmetric outline deliberately sampled as authored
# control points, giving a deep conch mouth instead of a circular horn.
outline=[(-.24,1.63),(-.38,1.94),(-.39,2.30),(-.14,2.91),(.08,2.55),(.28,2.52),(.79,2.58),(.78,2.32),(.55,2.10),(.67,2.00),(.36,1.84),(.06,1.60)]
# Intermediate points preserve blade-like flange peaks, while making lip thickness.
contour=[]
for k,(x,z) in enumerate(outline):
 nx,nz=outline[(k+1)%len(outline)]
 for s in [0,.5]:contour.append((x*(1-s)+nx*s,z*(1-s)+nz*s))
center=Vector((.03,0,2.13));rows=[]
for scale,y in [(.34,-.43),(.70,-.25),(.96,.05),(1,.24),(.95,.31),(.83,.18),(.58,-.16),(.19,-.39),(.035,-.405)]:
 rows.append([(center.x+(x-center.x)*scale,y+.025*math.sin(k*.9),center.z+(z-center.z)*scale) for k,(x,z) in enumerate(contour)])
loft('Thick flared shell aperture and recessed throat',rows,[cream,ivory,pink,dark],indices=lambda j,i:0 if j<2 else (1 if j<4 else (2 if j<6 else 3)))
# Excavate the underlying solid shell too: otherwise its outer front wall
# obstructs the separate lip and falsely fills the mouth with a cone.
cut=[]
for y in [-1.20,1.20]:
 cut.extend([(center.x+(x-center.x)*.86,y,center.z+(z-center.z)*.86-max(0,1.90-z)*1.1) for x,z in contour])
n=len(contour);faces=[tuple(reversed(range(n))),tuple(n+i for i in range(n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
cutter=mesh('Temporary conch aperture excavation',cut,faces,[dark]);bpy.context.view_layer.objects.active=shell
mod=shell.modifiers.new('Excavate real deep shell cavity','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
bpy.ops.object.modifier_apply(modifier=mod.name);objects.remove(cutter);bpy.data.objects.remove(cutter,do_unlink=True)
# Ventral torso and segmented abdomen. Ribbed integrated sections avoid a stack
# of ornamental spheres; shallow overlaps follow real flexion lines.
limb('Tapered ventral torso',[((0,0,.69),.19,.17),((0,0,.85),.25,.21),((0,.02,1.05),.29,.23),((0,.01,1.28),.32,.24),((0,.0,1.47),.26,.19)],[red,edge],16)
# A single continuous curved ventral breastplate with integrated shallow folds.
rows=[]
for j in range(7):
 z=.74+j/6*.66;t=j/6;w=.17+.105*math.sin(math.pi*t);row=[]
 for i in range(12):
  a=TAU*i/12;front=max(0,math.sin(a));y=.07+.20*math.sin(a)+.012*math.cos(t*TAU*2)*front**4
  row.append((w*math.cos(a),y,z))
 rows.append(row)
loft('Continuous folded breastplate',rows,[red,edge],indices=lambda j,i:1 if j%6==0 else 0)
# Purposeful broad brow / sharp down-pointing facial wedge, with a raised
# orange central keel. The face has no separate button-like nose.
outline_face=[(-.24,.30,1.58),(-.21,.40,1.42),(0,.49,1.19),(.21,.40,1.42),(.24,.30,1.58),(0,.31,1.61)]
vs=outline_face+[(0,.56,1.45)]+[(x,y-.12,z) for x,y,z in outline_face]
fs=[(i,(i+1)%6,6) for i in range(6)]+[(i,7+i,7+(i+1)%6,(i+1)%6) for i in range(6)]+[tuple(7+i for i in reversed(range(6)))]
face=mesh('Pointed coral facial wedge',vs,fs,[orange,ivory,red],[0,0,1,0,0,1]+[2]*7)
# Outline runs inward when projected to X/Z; flip the complete closed wedge.
for poly in face.data.polygons:poly.flip()
face.data.update()
# Almond eye housings extend directly from long fleshy stalks.
for side in [-1,1]:
 limb('Eyestalk '+str(side),[((side*.16,.24,1.48),.065,.055),((side*.23,.29,1.62),.052,.047),((side*.34,.30,1.85),.055,.05),((side*.39,.29,1.97),.09,.06)],[red,edge],10)
 # Eye outlined by a pointed almond rim with inset amber surface and narrow pupil.
 eye=[]
 for i in range(24):
  a=TAU*i/24;z=.16*math.cos(a);x=.095*math.sin(a)*abs(math.sin(a))**.45+side*.48*z;eye.append((side*.38+x, .35,1.94+z))
 # Thick open orbital annulus surrounds a visibly recessed almond lens.
 rr=[]
 for sc,dy in [(1,0),(.94,.055),(.76,.061),(.70,.020)]:
  rr.append([(side*.38+(p[0]-side*.38)*sc,p[1]+dy,1.94+(p[2]-1.94)*sc) for p in eye])
 loft('Open almond orbital rim '+str(side),rr,[red,edge],cap=False)
 vs=[(side*.38,.385,1.94)]+[(side*.38+(p[0]-side*.38)*.72,.376,1.94+(p[2]-1.94)*.72) for p in eye]
 mesh('Recessed amber lens '+str(side),vs,[(0,1+i,1+(i+1)%24) for i in range(24)],[amber])
 mesh('Vertical pupil slit '+str(side),[(side*.38-.014,.39,1.94),(side*.38,.39,2.046),(side*.38+.014,.39,1.94),(side*.38,.39,1.835)],[(0,1,2),(0,2,3)],[black])
# Bent, weight-bearing digitigrade legs, each with continuous tapering armored
# thigh and shin rather than ball joints. Three splayed toe blades grip ground.
for s in [-1,1]:
 hip=(s*.22,-.03,.85);knee=(s*.62,.04,.63);ankle=(s*.70,.22,.15)
 limb('Hind leg flexible hinge '+str(s),[(hip,.16,.16),(knee,.13,.12),(ankle,.085,.085)],[joint])
 limb('Broad hooked thigh '+str(s),[(hip,.13,.15),((s*.40,.0,.79),.20,.17),(knee,.15,.14),((s*.65,.06,.53),.09,.09)],[red,edge])
 limb('Shin blade '+str(s),[((s*.62,.04,.63),.13,.12),((s*.68,.12,.42),.12,.10),(ankle,.075,.065)],[red,edge])
 for toe in [-1,0,1]:
  limb('Ground toe '+str((s,toe)),[(ankle,.075,.06),((s*.70+toe*.065,.31,.08),.07,.045),((s*.70+toe*.14,.47 if toe==0 else .41,.025),.006,.008)],[edge,cream],8)
# Arm chain, matching asymmetric defensive left and thrusting right functions.
for s in [-1,1]:
 limb('Shoulder and elbow '+str(s),[((s*.28,.0,1.34),.18,.18),((s*.48,.02,1.36),.21,.17),((s*.61,.15,1.17),.15,.13),((s*.70,.28,1.05),.11,.10)],[red,edge])
# Broad shield claw: lenticular shell cross-sections, powerful high knuckle,
# fluted sweeping face and sharpened downturned terminal point.
rows=[]
for cx,cy,z,w,d in [(-.64,.25,1.43,.13,.06),(-.78,.40,1.27,.32,.12),(-.87,.52,1.05,.36,.15),(-.84,.61,.79,.27,.13),(-.73,.69,.51,.17,.09),(-.61,.74,.27,.055,.04),(-.55,.76,.14,.002,.002)]:
 # Horizontal blade contours maintain a broad upper root and a sharp lower tip.
 rows.append([(cx+w*math.cos(a),cy+d*math.sin(a)*(1+.25*abs(math.sin(a))),z+.025*math.cos(a*3)) for a in [TAU*i/20 for i in range(20)]])
shield=loft('Flattened thick tapered shield claw',rows,[cream,ivory,orange],indices=lambda j,i:2 if 0<i<5 else (1 if i in [5,6] else 0))
# Rows descend, so reverse winding for a correctly outward blade.
for poly in shield.data.polygons:poly.flip()
# Small opposing pincer protrudes beside shield, leaving negative grasp space.
limb('Left opposed pincer', [((-.60,.34,1.17),.12,.11),((-.46,.47,.98),.14,.12),((-.42,.57,.73),.08,.07),((-.49,.65,.59),.002,.003)],[orange,cream],12)
limb('Right forearm cuff',[((.64,.22,1.15),.14,.13),((.84,.37,1.09),.18,.13),((.99,.49,.94),.13,.11)],[red,edge])
limb('Long right conch rapier',[((.90,.42,1.02),.15,.11),((1.06,.56,.91),.17,.105),((1.22,.68,.66),.11,.065),((1.39,.79,.36),.045,.03),((1.49,.86,.12),.002,.003)],[ivory,orange],12,.16)
limb('Right gripping thumb',[((.85,.40,1.0),.08,.07),((.96,.52,.79),.075,.06),((1.10,.65,.70),.002,.003)],[red,edge],10)
# Reference image's shield, tapering apex and broad whorls are on screen left.
# Mirror the authored anatomy together, then reverse winding to preserve normals.
for ob in objects:
 for vertex in ob.data.vertices:vertex.co.x*=-1
 for polygon in ob.data.polygons:polygon.flip()
 ob.data.update()
# Model source metadata. Rendering is opt-in and must acquire coordinator lane.
for ob in objects:
 ob['source']='approved-conch/build_conch_lowpoly_v5.py';ob['quality_accepted']=False
tri=0
for ob in objects:ob.data.calc_loop_triangles();tri+=len(ob.data.loop_triangles)
(OUT/'metrics.json').write_text(json.dumps({'status':'owner-approved low-poly target; actual model unaccepted','triangles':tri,'meshObjects':len(objects),'runtimeIntegrated':False,'acceptance':0},indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'conch-source.blend'))
bpy.ops.object.select_all(action='DESELECT')
for ob in objects:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'conch-study.glb'),export_format='GLB',use_selection=True,export_materials='EXPORT',export_yup=True)
if A.render:
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=False;scene.render.resolution_x=780;scene.render.resolution_y=960;scene.render.resolution_percentage=100;scene.world.color=(.15,.15,.15);scene.view_settings.view_transform='AgX'
 floor=mat('Studio floor',(.025,.035,.045));mesh('Studio ground',[(-50,-50,0),(50,-50,0),(50,50,0),(-50,50,0)],[(0,1,2,3)],[floor])
 def light(name,pos,power,size):
  d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=size;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,1.5))-o.location).to_track_quat('-Z','Y').to_euler()
 light('Warm key',(-3,4,6),650,4);light('Cool fill',(4,2,3),350,4);light('Shell rim',(-1,-4,5),800,3)
 d=bpy.data.cameras.new('Reference three-quarter');cam=bpy.data.objects.new('Reference three-quarter',d);bpy.context.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO';d.ortho_scale=4.05
 cam.location={'front':(-3,7,3.0),'side':(7,1,2.8),'rear':(-3,-7,3.0)}[A.view];cam.rotation_euler=(Vector((0,0,1.62))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/('clay-' if A.clay else 'color-'))+A.view+'.png';bpy.ops.render.render(write_still=True)
