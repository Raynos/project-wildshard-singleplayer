"""Substantial angular-whorl V9 rebuild from approved low-poly concept; no fresh human approval claimed. No runtime registration.
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
cream=mat('Warm chalk shell',(.95,.77,.51));ivory=mat('Exposed pale shell ridges',(.98,.88,.68));orange=mat('Coral shell growth bands',(.95,.36,.14));pink=mat('Salmon aperture',(.88,.30,.15));dark=mat('Deep coral throat',(.42,.10,.045));red=mat('Burgundy carapace',(.46,.15,.20));edge=mat('Wine red plate edge',(.58,.21,.28));joint=mat('Dark flexible joints',(.065,.025,.033));amber=mat('Amber eye',(.98,.58,.008));black=mat('Slit pupil',(.008,.006,.008));clay=mat('Neutral clay',(.45,.47,.46))
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

# V9: radial surface carries deep continuous helical shoulders. Radius and
# paint share the growth phase. No independent horizontal disc or ring tiers.
N=12;M=31;grid=[];phase_grid=[]
def whorl_profile(phase):
 # Broad authored shoulder plateau, long sloping flank and shallow root.
 # This is a continuous periodic profile, not an oscillating pinched cone.
 knots=[(0,.97),(.12,1.16),(.29,1.18),(.72,.94),(1,.97)]
 for (a,r0),(b,r1) in zip(knots,knots[1:]):
  if a<=phase<=b:return r0+(r1-r0)*(phase-a)/(b-a)
 return .97
for j in range(M):
 t=j/(M-1);cx=-.25-.94*t;cy=-.34-.12*t;z=1.36+2.24*t
 envelope=.94*(1-t)**.64+.004
 for i in range(N):
  angle=TAU*i/N+.08;phase=(t*3.20-angle/TAU)%1
  radius=envelope*whorl_profile(phase)
  grid.append((cx+radius*math.cos(angle),cy+radius*.80*math.sin(angle),z+.08*(1-t)*math.cos(angle)))
  phase_grid.append(math.cos(TAU*(phase-.20))-.66)
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
# Open basal seat; top cap fans use the same phase-boundary split vertices
# as the side surfaces. This avoids the V8 cap T-junctions.
end=M-1;center_top=tuple(sum(grid[end*N+i][axis] for i in range(N))/N for axis in range(3));ci=vertex_key(center_top)
for i in range(N):
 p=grid[end*N+i];q=grid[end*N+(i+1)%N];v=phase_grid[end*N+i];w=phase_grid[end*N+(i+1)%N];edge_points=[p]
 if (v>=0)!=(w>=0):
  fac=v/(v-w);edge_points.append(tuple(p[k]+fac*(q[k]-p[k]) for k in range(3)))
 edge_points.append(q)
 for a,b in zip(edge_points,edge_points[1:]):fs.append((ci,vertex_key(a),vertex_key(b)));colors.append(0)
shell=mesh('Continuous broad shouldered hollow conch',vs,fs,[cream,orange,ivory],colors)
# Give the authored surface a real interior and closed basal seat before the
# aperture is opened. Cutting a shell wall cannot expose a solid planar cap.
import bmesh
bm=bmesh.new();bm.from_mesh(shell.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(shell.data);bm.free()
bpy.context.view_layer.objects.active=shell
mod=shell.modifiers.new('Real conch wall thickness','SOLIDIFY');mod.thickness=.055;mod.thickness_clamp=.5;mod.offset=-1;mod.use_even_offset=True;mod.use_quality_normals=True
bpy.ops.object.modifier_apply(modifier=mod.name)
# Continuous substantial lip, with deep backwards throat, sits in a genuinely
# excavated shell wall. The pointed outer upper corner is the conch's ear.
outline=[(-.50,1.55),(-.56,1.95),(-.43,2.36),(-.12,2.79),(.34,2.80),(.97,2.96),(.98,2.67),(.73,2.40),(.96,2.28),(.64,2.03),(.30,1.71),(-.02,1.49)]
center=Vector((.20,0,2.18));contour=outline
rows=[]
for scale,y in [(.40,-.46),(.78,-.24),(1.0,.06),(1.02,.23),(.91,.30),(.76,.13),(.48,-.23),(.10,-.44),(.006,-.445)]:
 rows.append([(center.x+(x-center.x)*scale,y,center.z+(z-center.z)*scale) for x,z in contour])
loft('Deep flared angular shell mouth',rows,[cream,ivory,pink,dark,orange],indices=lambda j,i: (0 if j<2 else 1 if j<4 else (4 if j==4 else 2 if j==5 else 3)))
cut=[]
for y in [-.20,1.50]:
 cut.extend([(center.x+(x-center.x)*.84,y,center.z+(z-center.z)*.84) for x,z in contour])
n=len(contour);faces=[tuple(reversed(range(n))),tuple(n+i for i in range(n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
cutter=mesh('Temporary aperture excavation',cut,faces,[dark]);bpy.context.view_layer.objects.active=shell
mod=shell.modifiers.new('True shell mouth cavity','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
bpy.ops.object.modifier_apply(modifier=mod.name);objects.remove(cutter);bpy.data.objects.remove(cutter,do_unlink=True)
# Trim only the low front-right collar which falsely crossed the neck in V7.
cut=[(-.48,-.22,0),(1.6,-.22,0),(1.6,1.5,0),(-.48,1.5,0),(-.48,-.22,1.90),(1.6,-.22,1.90),(1.6,1.5,1.90),(-.48,1.5,1.90)]
cutter=mesh('Temporary lower collar trim',cut,[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],[dark]);bpy.context.view_layer.objects.active=shell
mod=shell.modifiers.new('Remove false collar','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
bpy.ops.object.modifier_apply(modifier=mod.name);objects.remove(cutter);bpy.data.objects.remove(cutter,do_unlink=True)
# Compact crouched abdomen; tucked front plates preserve space under the head.
limb('Tapered ventral torso',[((0,-.03,.67),.18,.17),((0,-.04,.85),.28,.22),((0,-.03,1.10),.29,.23),((0,-.02,1.37),.32,.24),((0,0,1.49),.25,.20)],[red,edge],10)
rows=[]
for z,w,depth in [(.67,.10,.10),(.78,.20,.14),(.92,.22,.15),(1.10,.23,.15),(1.20,.20,.13)]:
 rows.append([(w*math.cos(a),.11+depth*math.sin(a),z+.02*math.cos(a)) for a in [TAU*i/8 for i in range(8)]])
loft('Continuous ventral armor',rows,[red,edge],indices=lambda j,i:1 if j==0 and i<3 else 0)
# A broad coral brow closes into a hooked, raised beak. No pale triangle mask.
outline_face=[(-.28,.36,1.57),(-.25,.44,1.39),(-.12,.55,1.24),(-.02,.65,1.10),(.10,.55,1.26),(.25,.44,1.42),(.27,.35,1.57),(0,.37,1.60)]
vs=outline_face+[(0,.64,1.42)]+[(x,y-.16,z) for x,y,z in outline_face]
n=len(outline_face);fs=[(i,(i+1)%n,n) for i in range(n)]+[(i,n+1+i,n+1+(i+1)%n,(i+1)%n) for i in range(n)]+[tuple(n+1+i for i in reversed(range(n)))]
face=mesh('Coral hooked face and brow',vs,fs,[orange,cream,pink],[0,0,2,2,0,0,1,0]+[2]*(n+1))
for sign in [-1,1]:
 mesh('Inset nostril '+str(sign),[(sign*.065,.607,1.47),(sign*.12,.574,1.45),(sign*.105,.587,1.414)],[(0,1,2)],[joint])
# Leaf-shaped pointed eyes have thickness and an actual amber inset, complete
# on all sides. Long stalks lean apart instead of looking like oval antennae.
for side in [-1,1]:
 c=Vector((side*.42,.43,1.98+(0.06 if side<0 else -.04)))
 limb('Eyestalk '+str(side),[((side*.16,.33,1.48),.065,.060),((side*.25,.36,1.67),.055,.050),((side*.35,.39,1.86),.055,.046),(tuple(c),.075,.055)],[red,edge],7)
 # Angular leaf corners, pointed diagonal endpoints; no elliptical sampling.
 shape=[(-side*.16,.24),(-side*.135,.015),(-side*.015,-.14),(side*.13,-.17),(side*.14,.015),(side*.05,.13)]
 rows=[]
 for scale,dy in [(.78,-.075),(1,0),(.96,.055),(.69,.060)]:
  rows.append([(c.x+x*scale,c.y+dy,c.z+z*scale) for x,z in shape])
 eye=loft('Thick pointed eye housing '+str(side),rows,[red,edge],cap=False,indices=lambda j,i:1 if j==2 else 0)
 # Close back and inset front; the amber is actual shallow convex geometry.
 mesh('Eye back '+str(side),rows[0],[tuple(range(6))],[red])
 rim=rows[-1];lens=[(c.x,c.y+.065,c.z)]+[(x,c.y+.058,z) for x,y,z in rim]
 mesh('Amber inset eye '+str(side),lens,[(0,i+1,(i+1)%6+1) for i in range(6)],[amber])
 mesh('Black pointed slit '+str(side),[(c.x-.018,c.y+.069,c.z),(c.x-.005,c.y+.069,c.z+.13),(c.x+.023,c.y+.069,c.z+.01),(c.x+.016,c.y+.069,c.z-.11)],[(0,1,2),(0,2,3)],[black])
 mesh('Eye glint '+str(side),[(c.x-.037,c.y+.071,c.z+.07),(c.x-.012,c.y+.071,c.z+.045),(c.x-.018,c.y+.071,c.z+.095)],[(0,1,2)],[ivory])
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
# Broad shoulders below the eyes, with elbow articulation.
for s in [-1,1]:
 limb('Pauldron '+str(s),[((s*.24,-.02,1.40),.16,.16),((s*.45,.01,1.40),.24,.21),((s*.61,.06,1.28),.19,.17)],[red,edge],8)
 limb('Upper arm '+str(s),[((s*.47,.03,1.35),.14,.13),((s*.64,.14,1.14),.16,.13),((s*.78,.30,1.04),.12,.11)],[red,edge],8)
# Huge convex shield claw: shaped faceted closed sections. Its dimensional
# ridge makes it read as a heavy armored claw rather than a narrow flat blade.
rows=[]
for cx,cy,z,w,d in [(-.73,.35,1.62,.12,.10),(-.91,.44,1.48,.37,.20),(-1.02,.53,1.26,.49,.26),(-1.02,.60,.97,.48,.29),(-.93,.66,.70,.39,.25),(-.78,.70,.42,.23,.17),(-.61,.72,.20,.003,.004)]:
 rows.append([(cx+w*math.cos(a),cy+d*math.sin(a),z+.065*math.cos(a)) for a in [TAU*i/8 for i in range(8)]])
loft('Large convex claw shield',rows,[cream,ivory,orange,pink],indices=lambda j,i:(1 if i in [0,1] else 2 if i in [2,3,4,5] else 0))
limb('Shield opposed thumb',[((-.65,.32,1.18),.14,.13),((-.44,.44,1.01),.16,.13),((-.42,.57,.75),.09,.07),((-.53,.66,.61),.004,.005)],[orange,cream],8)
limb('Rapier forearm cuff',[((.68,.18,1.17),.14,.13),((.88,.34,1.06),.19,.15),((1.03,.47,.92),.14,.12)],[red,edge],8)
limb('Long ivory conch rapier',[((.94,.43,1.06),.15,.12),((1.12,.57,.91),.19,.13),((1.29,.69,.67),.13,.09),((1.47,.82,.36),.06,.04),((1.61,.93,.10),.002,.003)],[ivory,cream],6,.04)
limb('Rapier gripping thumb',[((.86,.40,1.01),.08,.075),((1.00,.54,.79),.09,.07),((1.13,.64,.68),.003,.004)],[red,edge],7)
# Reference image's shield, tapering apex and broad whorls are on screen left.
# Mirror the authored anatomy together, then reverse winding to preserve normals.
for ob in objects:
 for vertex in ob.data.vertices:vertex.co.x*=-1
 for polygon in ob.data.polygons:polygon.flip()
 ob.data.update()
import bmesh
for ob in objects:
 bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
# Model source metadata. Rendering is opt-in and must acquire coordinator lane.
for ob in objects:
 ob['source']='approved-conch/build_conch_lowpoly_v9.py';ob['quality_accepted']=False
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
 d=bpy.data.cameras.new('Reference three-quarter');cam=bpy.data.objects.new('Reference three-quarter',d);bpy.context.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO';d.ortho_scale=4.70
 cam.location={'front':(-3,7,3.0),'side':(7,1,2.8),'rear':(-3,-7,3.0)}[A.view];cam.rotation_euler=(Vector((0,0,1.62))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/('clay-' if A.clay else 'color-'))+A.view+'.png';bpy.ops.render.render(write_still=True)
