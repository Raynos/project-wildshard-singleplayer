"""Editable approved-target Conch Duelist study. No runtime registration.
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
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*c,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.76;return m
cream=mat('Warm chalk shell',(.82,.64,.40));ivory=mat('Exposed pale shell ridges',(.98,.83,.60));orange=mat('Coral shell growth bands',(.70,.25,.095));pink=mat('Salmon aperture',(.65,.19,.12));dark=mat('Deep coral throat',(.19,.035,.028));red=mat('Burgundy carapace',(.23,.045,.065));edge=mat('Wine red plate edge',(.40,.09,.10));joint=mat('Dark flexible joints',(.065,.025,.033));amber=mat('Amber eye',(.98,.40,.025));black=mat('Slit pupil',(.012,.008,.012));clay=mat('Neutral clay',(.45,.47,.46))
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

# One real helical conch body, tapering to the tall inclined apex. The flared
# aperture is built separately as a continuous thick wall, not a painted hole.
rows=[];N=72;M=90
for j in range(M):
 t=j/(M-1);z=1.55+1.72*t;radius=.69*(1-t)**.80+.012;cx=-.02-.58*t;cy=-.29-.13*t;row=[]
 for i in range(N):
  a=TAU*i/N;phase=TAU*(t*4.8)-a
  ridge=max(0,math.cos(phase))**5
  r=radius*(1+.18*ridge+.022*math.sin(a*12+z*3));spike=max(0,math.cos(a*7+phase*.08))**18*ridge*.065*(1-t)
  row.append((cx+(r+spike)*math.cos(a),cy+(r+spike)*.79*math.sin(a),z+.045*(1-t)*ridge))
 rows.append(row)
loft('Continuous helical conch with growth ridges',rows,[cream,orange,ivory],indices=lambda j,i:2 if math.cos(TAU*(j/(M-1)*4.8)-TAU*i/N)>.72 else (1 if math.cos(TAU*(j/(M-1)*4.8)-TAU*i/N)<-.45 else 0))
# Pointed shoulder lip: asymmetric outline deliberately sampled as authored
# control points, giving a deep conch mouth instead of a circular horn.
outline=[(-.48,1.60),(-.61,1.87),(-.55,2.14),(-.38,2.41),(-.25,2.56),(-.14,2.91),(.03,2.65),(.25,2.53),(.44,2.60),(.46,2.45),(.79,2.52),(.76,2.29),(.58,2.04),(.70,1.94),(.48,1.80),(.23,1.60),(-.05,1.49)]
# Intermediate points preserve blade-like flange peaks, while making lip thickness.
contour=[]
for k,(x,z) in enumerate(outline):
 nx,nz=outline[(k+1)%len(outline)]
 for s in [0,.333,.666]:contour.append((x*(1-s)+nx*s,z*(1-s)+nz*s))
center=Vector((.03,0,2.13));rows=[]
for scale,y in [(.34,-.43),(.70,-.25),(.96,.05),(1,.24),(.95,.31),(.83,.18),(.58,-.16),(.19,-.39),(.035,-.405)]:
 rows.append([(center.x+(x-center.x)*scale,y+.025*math.sin(k*.9),center.z+(z-center.z)*scale) for k,(x,z) in enumerate(contour)])
loft('Thick flared shell aperture and recessed throat',rows,[cream,ivory,pink,dark],indices=lambda j,i:0 if j<2 else (1 if j<4 else (2 if j<7 else 3)))
# Ventral torso and segmented abdomen. Ribbed integrated sections avoid a stack
# of ornamental spheres; shallow overlaps follow real flexion lines.
limb('Tapered ventral torso',[((0,0,.69),.19,.17),((0,0,.85),.30,.23),((0,.02,1.05),.37,.25),((0,.01,1.28),.41,.26),((0,.0,1.47),.26,.19)],[red,edge],16)
for k in range(4):
 z=.80+k*.145;w=.24+k*.033
 limb('Ventral overlapping sternite '+str(k),[((0,.20,z-.06),w*.8,.045),((0,.26,z),w,.07),((0,.23,z+.075),w*.87,.04)],[red,edge],12)
# Angular head tapering into a hooked rostrum, with inset cheek surfaces.
limb('Continuous arrowhead face',[((0,.28,1.17),.025,.02),((0,.42,1.29),.12,.12),((0,.36,1.42),.235,.15),((0,.22,1.55),.28,.15),((0,.12,1.65),.14,.09)],[edge,red],12)
limb('Central curved rostrum',[((0,.35,1.51),.07,.05),((0,.51,1.39),.065,.06),((0,.51,1.23),.022,.025),((0,.45,1.17),.002,.003)],[cream,orange],8)
# Almond eye housings extend directly from long fleshy stalks.
for side in [-1,1]:
 limb('Eyestalk '+str(side),[((side*.16,.24,1.48),.065,.055),((side*.23,.29,1.62),.052,.047),((side*.34,.30,1.85),.055,.05),((side*.39,.29,1.97),.09,.06)],[red,edge],10)
 # Eye outlined by a pointed almond rim with inset amber surface and narrow pupil.
 eye=[]
 for i in range(24):
  a=TAU*i/24;x=.104*math.sin(a);z=.175*math.cos(a);eye.append((side*.38+x, .35,1.94+z+side*x*.65))
 for name,scale,depth,m in [('Almond orbital rim',1,.0,red),('Recessed amber eye',.78,.012,amber),('Vertical slit',.20,.020,black)]:
  rr=[]
  for sc,dy in [(scale,depth),(scale*.78,depth+.014),(0,depth+.022)]:
   rr.append([(side*.38+(p[0]-side*.38)*sc,p[1]+dy,1.94+(p[2]-1.94)*(scale if name=='Vertical slit' else sc)) for p in eye])
  loft(name+' '+str(side),rr,[m])
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
limb('Large left shield claw', [((-.64,.25,1.21),.19,.13),((-.78,.40,1.17),.32,.19),((-.88,.52,.99),.42,.22),((-.88,.61,.77),.36,.23),((-.78,.69,.52),.25,.18),((-.63,.74,.28),.10,.08),((-.55,.76,.14),.003,.004)],[cream,ivory,orange],24,flute=.20)
# Small opposing pincer protrudes beside shield, leaving negative grasp space.
limb('Left opposed pincer', [((-.60,.34,1.17),.12,.11),((-.46,.47,.98),.14,.12),((-.42,.57,.73),.08,.07),((-.49,.65,.59),.002,.003)],[orange,cream],12)
limb('Right forearm cuff',[((.64,.22,1.15),.14,.13),((.84,.37,1.09),.18,.13),((.99,.49,.94),.13,.11)],[red,edge])
limb('Long right conch rapier',[((.90,.42,1.02),.15,.11),((1.06,.56,.91),.17,.105),((1.22,.68,.66),.11,.065),((1.39,.79,.36),.045,.03),((1.49,.86,.12),.002,.003)],[ivory,orange],12,.16)
limb('Right gripping thumb',[((.85,.40,1.0),.08,.07),((.96,.52,.79),.075,.06),((1.10,.65,.70),.002,.003)],[red,edge],10)
# Model source metadata. Rendering is opt-in and must acquire coordinator lane.
for ob in objects:
 ob['source']='approved-conch/build_conch.py';ob['quality_accepted']=False
tri=0
for ob in objects:ob.data.calc_loop_triangles();tri+=len(ob.data.loop_triangles)
(OUT/'metrics.json').write_text(json.dumps({'status':'unaccepted authored anatomy study','triangles':tri,'meshObjects':len(objects),'runtimeIntegrated':False,'acceptance':0},indent=2))
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
 cam.location={'front':(3,7,3.0),'side':(7,1,2.8),'rear':(-3,-7,3.0)}[A.view];cam.rotation_euler=(Vector((0,0,1.62))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/('clay-' if A.clay else 'color-'))+A.view+'.png';bpy.ops.render.render(write_still=True)
