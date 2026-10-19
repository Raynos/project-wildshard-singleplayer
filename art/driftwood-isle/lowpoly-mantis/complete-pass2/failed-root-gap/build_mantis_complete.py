"""Splinter Mantis: editable study of human-approved low-poly target; model unaccepted.
Blender 4.3: blender -b -t 2 --python-exit-code 1 -P this.py -- --out tmp/lowpoly-mantis [--render --view front]
Palette swatches are sRGB, explicitly decoded for Blender linear material inputs.
X lateral, -Y forward, Z up. Render lane permission required. No runtime wiring.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
P=argparse.ArgumentParser();P.add_argument('--out',required=True);P.add_argument('--render',action='store_true');P.add_argument('--view',choices=['front','side','rear','all'],default='front');P.add_argument('--clay',action='store_true');P.add_argument('--samples',type=int,default=24);P.add_argument('--height',type=int,default=1100)
A=P.parse_args(sys.argv[sys.argv.index('--')+1:]);OUT=Path(A.out).resolve();OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
objects=[];pivots={}
def mat(name,c):
 c=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c)
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=.88;return m
wood=mat('Honey driftwood',(.43,.235,.095));warm=mat('Warm broad wood plane',(.65,.37,.155));light=mat('Cut wood plane',(.89,.61,.29));dark=mat('Recessed wood hinge',(.20,.105,.045));ivory=mat('Pale hooked cutting edge',(.95,.80,.49));green=mat('Leaf green',(.26,.45,.045));lime=mat('Sunward leaf plane',(.57,.72,.09));shade=mat('Leaf folded plane',(.13,.27,.035));eye=mat('Vivid green compound eyes',(.24,.64,.018));eyeLight=mat('Eye upper facet',(.46,.80,.045));clay=mat('Neutral clay',(.48,.49,.47))
def pivot(name,at,parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=at
 if parent:o['parent_joint']=parent
 pivots[name]=o;return o
pivot('body',(0,.3,1.4))
def mesh(name,vs,fs,mats,indices=None,joint='body'):
 d=bpy.data.meshes.new(name);d.from_pydata(vs,[],fs);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o)
 for m in mats:d.materials.append(clay if A.clay else m)
 for f,i in zip(d.polygons,indices or [0]*len(fs)):f.material_index=i
 # Authored global points retained, with anatomical pivot metadata for integration.
 o['joint']=joint;o['pivot']=list(pivots[joint].location);objects.append(o);return o

def loft(name,profile,mats,joint='body',n=6):
 rows=[]
 for j,(p,w,d) in enumerate(profile):
  p=Vector(p);t=(Vector(profile[min(j+1,len(profile)-1)][0])-Vector(profile[max(j-1,0)][0])).normalized();u=t.cross(Vector((0,1,0)))
  if u.length<.01:u=t.cross(Vector((0,0,1)))
  u.normalize();v=t.cross(u).normalized()
  rows.append([tuple(p+u*w*math.cos(math.tau*i/n)+v*d*math.sin(math.tau*i/n)) for i in range(n)])
 vs=[v for row in rows for v in row];fs=[];mi=[]
 for j in range(len(rows)-1):
  for i in range(n):
   a=j*n+i;b=j*n+(i+1)%n;c=(j+1)*n+(i+1)%n;d=(j+1)*n+i
   tone=min(len(mats)-1,1 if i in [1,2] else (2 if i==3 else 0))
   if name.startswith(('Rising prothorax','Abdomen','Walking femur','Walking tibia','Overlapping dorsal')) and j%2==i%2:
    # Deliberate large diagonal bark planes across the anatomical segments.
    fs.extend([(a,b,c),(a,c,d)]);mi.extend([tone,(tone+1)%len(mats)])
   else:fs.append((a,b,c,d));mi.append(tone)
 fs += [tuple(reversed(range(n))),tuple((len(rows)-1)*n+i for i in range(n))];mi += [0,0]
 return mesh(name,vs,fs,mats,mi,joint)

def leaf_stations(base,tip,width,depth,wing=False):
 b=Vector(base);axis=Vector(tip)-b;side=axis.cross(Vector((0,-1,.12))).normalized();normal=side.cross(axis).normalized()
 # The wing's alternating broad folds are geometry, not arbitrary painted facets.
 stations=[(.12,.32,.45,.12,-.18),(.32,.86,1.10,-.26,.19),(.55,1,.90,.22,-.29),(.73,.77,1.15,-.16,.15),(.90,.23,.40,.10,-.10)] if wing else [(.22,.67,1,.25,-.3),(.50,1,1,-.18,-.3),(.76,.66,1,-.18,.2)]
 rows=[]
 for f,w,fold,le,re in stations:
  c=b+axis*f+normal*math.sin(f*math.pi)*depth*.9+side*width*(.55*math.sin(f*math.pi)-.22*math.sin(2*f*math.pi))
  rows.append((c-side*width*w+normal*depth*le,c+side*width*w+normal*depth*re,c+normal*depth*w*fold,c-normal*depth*.55*w))
 return rows,normal

def leaf(name,base,tip,width,depth,joint='body',mats=None):
 rows,_=leaf_stations(base,tip,width,depth,name.startswith('Leaf wing'))
 vs=[tuple(base),tuple(tip)];left=[];right=[];ridge=[];back=[]
 for row in rows:
  for indices,point in zip([left,right,ridge,back],row):
   indices.append(len(vs));vs.append(tuple(point))
 fs=[];mi=[]
 for mid,idx in [(ridge,0),(back,2)]:
  for border,k in [(left,0),(right,1)]:
   fs.append((0,border[0],mid[0]));mi.append((idx+k)%3)
   for j in range(len(rows)-1):
    fs.extend([(border[j],border[j+1],mid[j+1]),(border[j],mid[j+1],mid[j])])
    if name.startswith('Leaf wing'):
     # Wide interlocking triangles follow the five unchanged folded stations.
     front=[[(1,0),(0,2),(1,0),(0,1)],[(0,1),(2,0),(0,1),(1,2)]]
     backtones=[[(2,0),(0,1),(2,0),(0,2)],[(0,2),(1,0),(0,2),(2,1)]]
     mi.extend((front if mid is ridge else backtones)[k][j])
    else:mi.extend([(idx+k)%3]*2)
   fs.append((border[-1],1,mid[-1]));mi.append((idx+k)%3)
 return mesh(name,vs,fs,mats or [green,lime,shade],mi,joint)

# Horizontal tapered abdomen with three broad imbricated tergites.
loft('Abdomen core',[((0,.14,1.47),.27,.25),((0,.64,1.38),.39,.29),((0,1.12,1.30),.31,.22),((0,1.55,1.18),.035,.04)],[wood,warm,light],n=8)
for i in range(3):
 y=.35+i*.35
 loft('Abdominal tergite '+str(i),[((0,y,1.48-i*.055),.31-i*.035,.23),((0,y+.18,1.45-i*.055),.36-i*.045,.27),((0,y+.37,1.39-i*.055),.25-i*.04,.19)],[wood,warm,light],n=6)
# Curved insect prothorax: the ascending basal stem bends into a horizontal
# cervical arch. Shells are seated on this SAME centerline, not a straight beam.
neck=[((0,.36,1.40),.265,.22),((0,.23,1.65),.205,.175),
      ((0,.15,1.94),.155,.13),((0,-.01,2.23),.135,.115),
      ((0,-.31,2.49),.14,.12),((0,-.60,2.58),.145,.12),
      ((0,-.89,2.55),.125,.105)]
loft('Rising prothorax curved cervical arch',neck,[wood,warm,light],n=7)
loft('Integrated pale throat',[((0,.05,1.73),.062,.035),((0,-.01,1.98),.065,.036),((0,-.20,2.23),.06,.035),((0,-.43,2.43),.035,.03),((0,-.69,2.46),.018,.018)],[light,ivory,warm],n=5)
for side in [-1,1]:
 for j in range(5):
  p=Vector(neck[j+1][0]);p2=Vector(neck[j][0]);t=(p-p2).normalized()
  base=p+Vector((side*.07,.015,.055))
  tip=p2+Vector((side*(.25-j*.024),.10,-.075))
  leaf('Imbricated thorax bark '+str((side,j)),base,tip,.105-j*.008,.062,mats=[wood,warm,light])
 leaf('Rear neck collar '+str(side),(side*.08,-.69,2.58),(side*.23,-.40,2.72),.075,.055,mats=[wood,warm,light])
for j in range(4):
 p=Vector(neck[j+1][0]);q=Vector(neck[j+2][0])
 loft('Overlapping dorsal curved neck shell '+str(j),[
  (tuple(p+Vector((0,.09,-.06))),.16-j*.018,.055),
  (tuple(p.lerp(q,.52)+Vector((0,.09,.045))),.18-j*.018,.075),
  (tuple(q+Vector((0,.035,.06))),.10-j*.012,.045)], [wood,warm,light],n=7)
pivot('head',(0,-.37,2.53),'body')
# complete-pass2 skull: a closed, deep insect head with a narrow raised facial keel.
# Three staggered octagonal rings form crown, cheek sockets and converging jaw.
# Unlike the former shield, the sides wrap around the eyes to a deep occiput.
skull_rows=[
 [(0,-.49,2.75),(.12,-.41,2.73),(.24,-.26,2.71),(.17,-.08,2.68),(0,-.02,2.67),(-.17,-.08,2.68),(-.24,-.26,2.71),(-.12,-.41,2.73)],
 [(0,-.76,2.57),(.115,-.67,2.59),(.27,-.43,2.57),(.20,-.19,2.52),(0,-.10,2.51),(-.20,-.19,2.52),(-.27,-.43,2.57),(-.115,-.67,2.59)],
 [(0,-.77,2.35),(.075,-.69,2.39),(.17,-.50,2.43),(.13,-.28,2.40),(0,-.20,2.40),(-.13,-.28,2.40),(-.17,-.50,2.43),(-.075,-.69,2.39)]]
vs=[v for row in skull_rows for v in row];fs=[];mi=[]
for j in range(2):
 for i in range(8):
  a=j*8+i;b=j*8+(i+1)%8;c=(j+1)*8+(i+1)%8;d=(j+1)*8+i
  fs.extend([(a,b,c),(a,c,d)])
  mi.extend(([1,0] if i in [0,7] else [0,2]) if j==0 else ([1,0] if i in [0,7] else [2,0]))
fs.extend([tuple(reversed(range(8))),tuple(range(16,24))]);mi.extend([0,2])
mesh('Volumetric pointed insect skull',vs,fs,[warm,light,wood],mi,'head')
for s in [-1,1]:
 # Flush kite-shaped eye lenses on the oblique socket plane, not pale plugs.
 # Boundary runs from inner brow through temple, cheek and lower inner edge.
 perimeter=[(.075,-.667,2.63),(.220,-.487,2.69),(.298,-.455,2.58),(.220,-.585,2.445),(.095,-.710,2.50)]
 perimeter=[(.19+(x-.19)*1.12,y-.012,2.555+(z-2.555)*1.05) for x,y,z in perimeter]
 vs=[(s*x,y,z) for x,y,z in perimeter]+[(s*.212,-.655,2.565)]
 vs += [(s*x,y+.025,z) for x,y,z in perimeter]
 fs=[(i,(i+1)%5,5) for i in range(5)]+[tuple(6+i for i in reversed(range(5)))]+[(i,6+i,6+(i+1)%5,(i+1)%5) for i in range(5)]
 mesh('Inset green compound eye '+str(s),vs,fs,[eye,eyeLight,shade],[1,0,0,0,1,2]+[2]*5,'head')
 # Brow ridge and cheek flange overlap lens boundaries and grow into the skull.
 loft('Integrated eye socket rim '+str(s),[((s*.08,-.65,2.66),.018,.018),((s*.19,-.53,2.71),.026,.022),((s*.275,-.38,2.66),.025,.023)],[wood,warm,light],'head',5)
 loft('Tucked cheek shell '+str(s),[((s*.26,-.36,2.55),.032,.03),((s*.22,-.49,2.44),.031,.026),((s*.065,-.72,2.34),.005,.006)],[wood,warm,light],'head',5)
 leaf('Swept crown splinter '+str(s),(s*.09,-.26,2.65),(s*.24,.04,2.78),.065,.045,'head',[wood,warm,light])
 # Compact articulated jaw overlaps the lower facial keel, with tucked tooth tips.
 loft('Compact mandible '+str(s),[((s*.062,-.67,2.35),.038,.029),((s*.050,-.76,2.29),.025,.026),((s*.018,-.79,2.27),.003,.004)],[dark,warm,ivory],'head',5)
 # Deliberate twig bends and single leaf terminal; no bark grain.
 ant=[((s*.19,-.35,2.67),.04,.035),((s*.30,-.32,2.99),.032,.025),((s*.46,-.30,3.34),.024,.018),((s*.62,-.37,3.60),.011,.009)]
 loft('Twig antenna '+str(s),ant,[warm,light], 'head',5)
 leaf('Antenna leaf '+str(s),(s*.60,-.36,3.56),(s*.82,-.34,3.89),.085,.025,'head')
 # Four wing volumes arranged in a backwards/upwards fan.
 for j in range(2):
  name='wing'+str(s)+'_'+str(j);base=(s*.18,.42+j*.17,1.64-j*.13);pivot(name,base,'body')
  tip={(-1,0):(-.68,1.52,3.35),(1,0):(.42,1.68,2.90),(-1,1):(-1.20,1.83,2.47),(1,1):(.96,1.85,1.99)}[(s,j)]
  width={(-1,0):.49,(1,0):.38,(-1,1):.43,(1,1):.32}[(s,j)];depth=.23 if j==0 else .18
  leaf('Leaf wing '+name,base,tip,width,depth,name)
  # Follow the exact leaf ridge positions, including its bow and twist.
  # The rib is half embedded in the actual folded volume at every station.

  rows,normal=leaf_stations(base,tip,width,depth,True)
  rib=[(base,.036,.027)]
  for left,right,ridge,back in rows:
   rib.append((tuple(ridge-normal*.012),.027,.024))
  rib.append((tip,.004,.004))
  loft('Seated folded wing midrib '+name,rib,[wood,warm],name,5)
 # Walking pairs: explicit hip, knee and ankle pivots, four feet on ground.
 for j in range(2):
  hip=(s*.24,.15+j*.64,1.43-j*.10);knee=(s*(.74+j*.08),.00+j*.95,1.06);ankle=(s*(1.06+j*.16),-.37+j*1.63,.12)
  name='leg'+str(s)+'_'+str(j);pivot(name,hip,'body');pivot(name+'_knee',knee,name)
  loft('Walking femur '+name,[(hip,.17,.14),((s*.43,.08+j*.82,1.34),.19,.145),((s*.61,.04+j*.9,1.15),.19,.13),(knee,.115,.10)],[wood,warm,light],name,5)
  loft('Walking tibia '+name,[(knee,.13,.10),((s*(.82+j*.10),-.10+j*1.10,.84),.125,.095),((s*(.96+j*.14),-.25+j*1.44,.39),.065,.055),(ankle,.044,.04)],[wood,warm,light],name+'_knee',5)
  loft('Ground tarsus '+name,[(ankle,.048,.04),((ankle[0]+s*.04,ankle[1]-.12,.055),.048,.04),((ankle[0]+s*.09,ankle[1]-.24,.025),.005,.006)],[dark,warm],name+'_knee',5)
  loft('Angular ankle cuff '+name,[((ankle[0]-s*.035,ankle[1]+.04,.23),.063,.055),(ankle,.055,.047),((ankle[0]+s*.025,ankle[1]-.075,.07),.027,.025)],[wood,warm,light],name+'_knee',5)
  for digit in [-1,1]:
   loft('Articulated foot claw '+name+'_'+str(digit),[((ankle[0]+s*.03,ankle[1]-.075,.07),.025,.022),((ankle[0]+s*.07+digit*.045,ankle[1]-.17,.047),.027,.023),((ankle[0]+s*.08+digit*.06,ankle[1]-.25,.019),.003,.004)],[dark,wood,warm],name+'_knee',5)
  leaf('Femur leaf plate '+name,(s*.46,-.055+j*.84,1.35),(s*.72,-.12+j*.86,.73),.13,.07,name)
 # The two raptorial limbs are independent of the four weight-bearing legs.
 sh=(s*.14,-.22,1.94);el=(s*.59,-.76,1.62);wr=(s*1.03,-.95,2.30)
 name='raptor'+str(s);pivot(name,sh,'body');pivot(name+'_elbow',el,name);pivot(name+'_hook',wr,name+'_elbow')
 loft('Raptorial upper arm '+str(s),[(sh,.085,.075),((s*.26,-.42,1.85),.095,.08),((s*.44,-.66,1.66),.073,.06),(el,.064,.055)],[wood,warm,light],name,6)
 loft('Raised raptorial forearm '+str(s),[(el,.065,.055),((s*.75,-.86,1.83),.08,.063),((s*.94,-.94,2.12),.10,.075),(wr,.085,.065)],[wood,warm,light],name+'_elbow',6)
 # The hook is a longitudinal tapered shell with a diamond-like section.
 # Its broad ridge sweeps in depth; both boundaries taper into a sharpened bevel.
 outer=[(1.03,2.30),(1.21,2.10),(1.34,1.78),(1.31,1.40),(1.12,1.02),(.82,.73)]
 inner=[(1.03,2.30),(1.08,2.04),(1.12,1.73),(1.08,1.39),(.97,1.08),(.82,.73)]
 centers=[-1.02,-1.02,-1.07,-1.17,-1.26,-1.33]
 thickness=[.055,.075,.066,.05,.033,.002]
 vs=[]
 # Each station is one nonzero six-point closed cross section, collapsing only
 # visually at the tip. The wrist and tip caps keep a strictly closed surface.
 for j,((ox,oz),(ix,iz)) in enumerate(zip(outer,inner)):
  if j==0:ix-=.045;iz-=.015
  if j==5:ox+=.008;oz+=.010
  rx=ox*.60+ix*.40;rz=oz*.60+iz*.40;t=thickness[j];y=centers[j]
  for x,dy,z in [(ox,-t*.17,oz),(rx,-t,rz),(ix,-t*.09,iz),(ix,t*.09,iz),(rx,t*.72,rz),(ox,t*.17,oz)]:vs.append((s*x,y+dy,z))
 fs=[];mi=[]
 for j in range(5):
  for i in range(6):
   a=j*6+i;b=j*6+(i+1)%6;c=(j+1)*6+(i+1)%6;d=(j+1)*6+i
   fs.append((a,b,c,d));mi.append([1,0,2,0,1,2][i])
 fs.extend([tuple(reversed(range(6))),tuple(range(30,36))]);mi.extend([0,0])
 mesh('Swept bevelled wood sickle '+str(s),vs,fs,[warm,wood,light],mi,name+'_hook')
 # Joined ivory edge with unequal hooked teeth, tapered through the same sweep.
 contour=inner+[(.86,1.25),(1.02,1.32),(.83,1.58),(1.05,1.66),(.88,1.93),(1.03,2.01)]
 def edge_y(z):
  for j in range(5):
   if outer[j+1][1]<=z<=outer[j][1]:
    t=(outer[j][1]-z)/(outer[j][1]-outer[j+1][1]);return centers[j]*(1-t)+centers[j+1]*t
  return centers[-1]
 # Bevel the whole saw silhouette with an inner raised ridge; no square plank rim.
 center=Vector((sum(x for x,z in contour)/len(contour),sum(z for x,z in contour)/len(contour)))
 vs=[];n=len(contour)
 for depth,inset in [(-1,.045),(-1,0),(1,0),(1,.045)]:
  for x,z in contour:
   pt=Vector((x,z));pt=pt.lerp(center,inset)
   # The silhouette edge stays thin; the inset ridge takes the cutting thickness.
   thick=(.008 if inset==0 else .038)*min(1,max(.10,(z-.73)/.35))
   vs.append((s*pt.x,edge_y(pt.y)-.018+depth*thick,pt.y))
 fs=[];mi=[]
 for ring in range(3):
  for i in range(n):fs.append((ring*n+i,ring*n+(i+1)%n,(ring+1)*n+(i+1)%n,(ring+1)*n+i));mi.append(0 if ring!=1 else 1)
 fs.extend([tuple(reversed(range(n))),tuple(3*n+i for i in range(n))]);mi.extend([0,0])
 mesh('Bevelled continuous ivory teeth '+str(s),vs,fs,[ivory,light],mi,name+'_hook')

# Overlapping hip collars and dorsal abdominal shields anchor the four legs.
for side in [-1,1]:
 for j in range(2):
  leaf('Coxal bark shield '+str((side,j)),(side*.19,.18+j*.60,1.61),(side*.43,.42+j*.64,1.15),.145,.09,mats=[wood,warm,light])
 leaf('Lateral tail splinter '+str(side),(side*.12,1.03,1.37),(side*.30,1.72,1.20),.13,.075,mats=[wood,warm,light])
for s in [-1,1]:
 leaf('Curved lateral chest splinter '+str(s),(s*.10,.00,2.10),(s*.19,.31,1.70),.060,.040,mats=[wood,warm,light])

# Narrow the complete cranial assembly and pitch its pointed face forward.
# Antennae and eye volumes follow the same transform, preserving attachment.
angle=.24;co=math.cos(angle);si=math.sin(angle)
for ob in objects:
 if ob['joint']=='head':
  for v in ob.data.vertices:
   y=(v.co.y+.37)*.80;z=(v.co.z-2.53)*(.88 if not ob.name.startswith(('Twig antenna','Antenna leaf')) else 1)
   v.co.x*=.88;v.co.y=-.88+y*co-z*si;v.co.z=2.57+y*si+z*co
pivots['head'].location=(0,-.88,2.57)
for ob in objects:
 if ob['joint']=='head':ob['pivot']=list(pivots['head'].location)

for o in objects:
 o['quality_accepted']=False
 # Recalculate consistent outward normals on closed surfaces.
 bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False)
tri=0;boundary_edges=0;nonmanifold_edges=0;degenerate_faces=0
for o in objects:
 o.data.calc_loop_triangles();tri+=len(o.data.loop_triangles)
 uses={}
 for f in o.data.polygons:
  degenerate_faces+=int(f.area<1e-10)
  for edge in f.edge_keys:
   key=tuple(sorted(edge));uses[key]=uses.get(key,0)+1
 boundary_edges+=sum(v==1 for v in uses.values());nonmanifold_edges+=sum(v>2 for v in uses.values())
(OUT/'metrics-complete-pass2.json').write_text(json.dumps({'status':'unaccepted low-poly study','triangles':tri,'meshObjects':len(objects),'boundaryEdges':boundary_edges,'nonmanifoldEdges':nonmanifold_edges,'degenerateFaces':degenerate_faces,'swatchSpace':'sRGB decoded to linear','pivots':{k:list(v.location) for k,v in pivots.items()},'runtimeIntegrated':False,'anatomy':'4 walking legs + 2 raptorial limbs; 4 thick wings; 2 antennae'},indent=2))
# Portable mesh data gives future adapters exact authored pivots; no old rig reuse.
(OUT/'mantis-mesh-complete-pass2.json').write_text(json.dumps({'coordinateFrame':'X right, -Y front, Z up','parts':[{'name':o.name,'joint':o['joint'],'vertices':[list(v.co) for v in o.data.vertices],'faces':[list(p.vertices) for p in o.data.polygons],'materialIndices':[p.material_index for p in o.data.polygons],'colors':[list(m.diffuse_color) for m in o.data.materials]} for o in objects]},separators=(',',':')))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mantis-study-complete-pass2.blend'))
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'mantis-study-complete-pass2.glb'),export_format='GLB',use_selection=True,export_yup=True)
if A.render:
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=A.samples;scene.cycles.use_denoising=False;scene.render.resolution_x=round(A.height*780/1100);scene.render.resolution_y=A.height;scene.render.resolution_percentage=100;scene.world.color=(.15,.15,.15);scene.view_settings.view_transform='AgX'
 ground=mat('Dark studio ground',(.027,.037,.045));mesh('Ground',[(-50,-50,0),(50,-50,0),(50,50,0),(-50,50,0)],[(0,1,2,3)],[ground])
 def light_at(name,pos,power,size):
  d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,1.7))-o.location).to_track_quat('-Z','Y').to_euler()
 light_at('Key',(-3,-4,7),700,4);light_at('Fill',(4,-2,4),400,4);light_at('Rim',(0,5,5),850,3)
 d=bpy.data.cameras.new('Study camera');cam=bpy.data.objects.new('Study camera',d);bpy.context.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO'
 # All camera framing derives from the full model bounds before adding ground.
 points=[o.matrix_world @ v.co for o in objects if o.name!='Ground' for v in o.data.vertices]
 center=Vector(tuple((min(p[i] for p in points)+max(p[i] for p in points))/2 for i in range(3)))
 views={'front':(-5.5,-8,3.4),'front-center':(0,-10,2.7),'front-right':(5.5,-8,3.4),'side':(9,0,2.8),'rear-right':(6,8,3.4),'rear':(0,10,2.8),'rear-left':(-6,8,3.4),'left':(-9,0,2.8),'top':(0,-.5,11)}
 cameras={}
 for label in (list(views) if A.view=='all' else [A.view]):
  cam.location=Vector(views[label]);cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();bpy.context.view_layer.update()
  inv=cam.matrix_world.inverted();local=[inv @ p for p in points]
  xmin,xmax=min(p.x for p in local),max(p.x for p in local);ymin,ymax=min(p.y for p in local),max(p.y for p in local)
  # Center projected bounds; 10% margin protects antennae and hook tips.
  cam.location += cam.rotation_euler.to_matrix() @ Vector(((xmin+xmax)/2,(ymin+ymax)/2,0))
  d.ortho_scale=max(ymax-ymin,(xmax-xmin)*scene.render.resolution_y/scene.render.resolution_x)*1.10
  cameras[label]={'location':list(cam.location),'rotation':list(cam.rotation_euler),'orthoScale':d.ortho_scale}
  scene.render.filepath=str(OUT/('clay-complete-pass2-' if A.clay else 'color-complete-pass2-'))+label+'.png';bpy.ops.render.render(write_still=True)
 (OUT/'cameras-complete-pass2.json').write_text(json.dumps(cameras,indent=2))
