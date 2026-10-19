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
wood=mat('Honey driftwood',(.52,.29,.12));warm=mat('Warm broad wood plane',(.69,.42,.19));light=mat('Cut wood plane',(.86,.60,.31));dark=mat('Recessed wood hinge',(.20,.105,.045));ivory=mat('Pale hooked cutting edge',(.95,.80,.49));green=mat('Leaf green',(.26,.45,.045));lime=mat('Sunward leaf plane',(.51,.68,.075));shade=mat('Leaf folded plane',(.13,.27,.035));eye=mat('Chartreuse compound eyes',(.46,.73,.08));eyeLight=mat('Eye upper facet',(.65,.86,.19));clay=mat('Neutral clay',(.48,.49,.47))
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
   fs.append((a,b,c,d));mi.append(min(len(mats)-1,1 if i in [1,2] else (2 if i==3 else 0)))
 fs += [tuple(reversed(range(n))),tuple((len(rows)-1)*n+i for i in range(n))];mi += [0,0]
 return mesh(name,vs,fs,mats,mi,joint)

def leaf(name,base,tip,width,depth,joint='body',mats=None):
 # A real lenticular volume with three ridge stations, six broad front facets.
 b=Vector(base);t=Vector(tip);axis=t-b;side=axis.cross(Vector((0,-1,.12))).normalized();normal=side.cross(axis).normalized()
 vs=[tuple(b),tuple(t)];left=[];right=[];ridge=[];back=[]
 for f,w in [(.22,.67),(.50,1),(.76,.66)]:
  # A bowed midrib and staggered edges make real folded leaf planes.
  c=b+axis*f+normal*math.sin(f*math.pi)*depth*.7+side*width*.16*math.sin(f*math.pi)
  left.append(len(vs));vs.append(tuple(c-side*width*w+normal*depth*(.25 if f<.4 else -.18)))
  right.append(len(vs));vs.append(tuple(c+side*width*w+normal*depth*(-.3 if f<.6 else .2)))
  ridge.append(len(vs));vs.append(tuple(c+normal*depth*w))
  back.append(len(vs));vs.append(tuple(c-normal*depth*.55*w))
 fs=[];mi=[]
 for mid,idx in [(ridge,0),(back,2)]:
  for border,k in [(left,0),(right,1)]:
   fs.append((0,border[0],mid[0]));mi.append((idx+k)%3)
   for j in range(2):fs.extend([(border[j],border[j+1],mid[j+1]),(border[j],mid[j+1],mid[j])]);mi.extend([(idx+k)%3]*2)
   fs.append((border[-1],1,mid[-1]));mi.append((idx+k)%3)
 return mesh(name,vs,fs,mats or [green,lime,shade],mi,joint)

# Horizontal tapered abdomen with three broad imbricated tergites.
loft('Abdomen core',[((0,.14,1.47),.27,.25),((0,.64,1.38),.39,.29),((0,1.12,1.30),.31,.22),((0,1.55,1.18),.035,.04)],[wood,warm,light],n=8)
for i in range(3):
 y=.35+i*.35
 loft('Abdominal tergite '+str(i),[((0,y,1.48-i*.055),.31-i*.035,.23),((0,y+.18,1.45-i*.055),.36-i*.045,.27),((0,y+.37,1.39-i*.055),.25-i*.04,.19)],[wood,warm,light],n=6)
# Long rising mantid prothorax. Neck is a purposeful continuous bent form.
loft('Rising prothorax',[((0,.38,1.40),.34,.26),((0,.03,1.66),.29,.24),((0,-.27,1.98),.235,.19),((0,-.52,2.32),.19,.16),((0,-.87,2.57),.16,.13)],[wood,warm,light],n=7)
leaf('Pale ventral thorax ridge',(0,-.17,1.56),(0,-1.04,2.48),.095,.07,mats=[light,ivory,warm])
# Five overlapping bark scales flow down each side of the prothorax.
for side in [-1,1]:
 for j in range(5):
  z=1.42+j*.215;y=.27-j*.225
  leaf('Imbricated thorax bark '+str((side,j)),(side*.18,y-.15,z+.24),(side*(.41-j*.032),y+.25,z-.12),.165-j*.009,.10,mats=[wood,warm,light])
 # Shoulder collar fans backwards from the neck, never floating ornaments.
 leaf('Rear neck collar '+str(side),(side*.10,-.67,2.45),(side*.39,-.27,2.66),.13,.11,mats=[wood,warm,light])
pivot('head',(0,-.37,2.53),'body')
# Broad inverted triangle head: cheek corners, thick rear cranium, central keel.
mesh('Triangular mantis head',[(-.37,-.38,2.76),(.37,-.38,2.76),(0,-.73,2.23),(-.26,-.18,2.65),(.26,-.18,2.65),(0,-.37,2.29),(0,-.65,2.60),(0,-.77,2.48)],[(0,6,7),(6,1,7),(0,7,2),(7,1,2),(0,3,4,1,6),(0,2,5,3),(1,4,5,2),(3,5,4)],[warm,light,wood],[1,1,0,1,0,2,2,2],'head')
for s in [-1,1]:
 # Faceted convex compound eye with a broad green cap seated in the cheek.
 eyeob=loft('Compound eye '+str(s),[((s*.27,-.43,2.53),.12,.13),((s*.34,-.59,2.52),.17,.17),((s*.34,-.69,2.51),.105,.12)],[eye,eyeLight,shade],'head',7)
 loft('Mandible '+str(s),[((s*.065,-.66,2.32),.04,.03),((s*.065,-.77,2.24),.025,.022),((s*.025,-.80,2.22),.002,.003)],[dark,ivory], 'head',5)
 leaf('Brow horn '+str(s),(s*.20,-.29,2.58),(s*.40,.02,2.82),.12,.08,'head',[wood,warm,light])
 # Deliberate twig bends and single leaf terminal; no bark grain.
 ant=[((s*.19,-.35,2.67),.04,.035),((s*.30,-.32,2.99),.032,.025),((s*.46,-.30,3.34),.024,.018),((s*.62,-.37,3.60),.011,.009)]
 loft('Twig antenna '+str(s),ant,[warm,light], 'head',5)
 leaf('Antenna leaf '+str(s),(s*.60,-.36,3.56),(s*.82,-.34,3.89),.085,.025,'head')
 # Four wing volumes arranged in a backwards/upwards fan.
 for j in range(2):
  name='wing'+str(s)+'_'+str(j);base=(s*.18,.42+j*.17,1.64-j*.13);pivot(name,base,'body')
  tip=(s*(.77 if j==0 else 1.17),1.35+j*.40,3.23-j*1.05)
  leaf('Leaf wing '+name,base,tip,.37 if j==0 else .33,.22,name)
  loft('Wing woody leading rib '+name,[(base,.045,.035),((s*.49,1.00+j*.35,2.35-j*.57),.035,.025),(tip,.003,.003)],[wood,warm],name,5)
 # Walking pairs: explicit hip, knee and ankle pivots, four feet on ground.
 for j in range(2):
  hip=(s*.24,.15+j*.64,1.43-j*.10);knee=(s*(.74+j*.08),.00+j*.95,1.06);ankle=(s*(1.06+j*.16),-.37+j*1.63,.12)
  name='leg'+str(s)+'_'+str(j);pivot(name,hip,'body');pivot(name+'_knee',knee,name)
  loft('Walking femur '+name,[(hip,.17,.14),((s*.43,.08+j*.82,1.34),.225,.165),((s*.61,.04+j*.9,1.15),.19,.13),(knee,.115,.10)],[wood,warm,light],name,5)
  loft('Walking tibia '+name,[(knee,.13,.10),((s*(.82+j*.10),-.10+j*1.10,.84),.155,.105),((s*(.96+j*.14),-.25+j*1.44,.39),.095,.075),(ankle,.044,.04)],[wood,warm,light],name+'_knee',5)
  loft('Ground tarsus '+name,[(ankle,.048,.04),((ankle[0]+s*.04,ankle[1]-.12,.055),.048,.04),((ankle[0]+s*.09,ankle[1]-.24,.025),.005,.006)],[dark,warm],name+'_knee',5)
  leaf('Femur leaf plate '+name,(s*.46,-.055+j*.84,1.35),(s*.72,-.12+j*.86,.73),.13,.07,name)
 # The two raptorial limbs are independent of the four weight-bearing legs.
 sh=(s*.17,-.40,2.04);el=(s*.64,-.79,1.72);wr=(s*1.03,-.95,2.30)
 name='raptor'+str(s);pivot(name,sh,'body');pivot(name+'_elbow',el,name);pivot(name+'_hook',wr,name+'_elbow')
 loft('Raptorial upper arm '+str(s),[(sh,.18,.145),((s*.30,-.53,2.00),.205,.155),((s*.50,-.72,1.80),.145,.11),(el,.10,.09)],[wood,warm,light],name,6)
 loft('Raised raptorial forearm '+str(s),[(el,.105,.09),((s*.78,-.86,1.85),.135,.12),((s*.94,-.94,2.12),.165,.13),(wr,.14,.11)],[wood,warm,light],name+'_elbow',6)
 # A continuous hooked blade with a solid pale serrated inner edge.
 # Anatomical outline is extruded in depth; broad wood face remains curved.
 outer=[(1.03,2.30),(1.23,2.10),(1.37,1.78),(1.36,1.40),(1.18,1.02),(.89,.73)]
 inner=[(1.03,2.30),(1.07,2.04),(1.13,1.73),(1.11,1.39),(1.02,1.08),(.89,.73)]
 vs=[]
 for depth in [-.10,.10]:
  vs.extend([(s*x,-1.04+depth-(2.30-z)*.10,z) for x,z in outer+list(reversed(inner[1:-1]))])
 n=len(vs)//2
 fs=[tuple(reversed(range(n))),tuple(n+i for i in range(n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 mesh('Broad continuous wood hook '+str(s),vs,fs,[warm,wood,light],[0,1]+[2 if i<5 else 0 for i in range(n)],name+'_hook')
 # A broad connected edge; teeth are silhouette corners, not floating wedges.
 contour=inner+[(.84,1.28),(1.02,1.32),(.81,1.60),(1.05,1.66),(.85,1.95),(1.03,2.01)]
 vs=[]
 for depth in [-.065,.065]:
  vs.extend([(s*x,-1.065+depth-(2.30-z)*.10,z) for x,z in contour])
 n=len(contour);fs=[tuple(reversed(range(n))),tuple(n+i for i in range(n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 mesh('Continuous ivory serrated edge '+str(s),vs,fs,[ivory,light],[0,0]+[1]*n,name+'_hook')

# Overlapping hip collars and dorsal abdominal shields anchor the four legs.
for side in [-1,1]:
 for j in range(2):
  leaf('Coxal bark shield '+str((side,j)),(side*.19,.18+j*.60,1.61),(side*.46,.42+j*.64,1.11),.18,.12,mats=[wood,warm,light])
 leaf('Lateral tail splinter '+str(side),(side*.12,1.03,1.37),(side*.30,1.72,1.20),.13,.075,mats=[wood,warm,light])
# Narrow the complete cranial assembly and pitch its pointed face forward.
# Antennae and eye volumes follow the same transform, preserving attachment.
angle=.24;co=math.cos(angle);si=math.sin(angle)
for ob in objects:
 if ob['joint']=='head':
  for v in ob.data.vertices:
   y=v.co.y+.37;z=v.co.z-2.53
   v.co.x*=.74;v.co.y=-.88+y*co-z*si;v.co.z=2.57+y*si+z*co
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
(OUT/'metrics-v4.json').write_text(json.dumps({'status':'unaccepted low-poly study','triangles':tri,'meshObjects':len(objects),'boundaryEdges':boundary_edges,'nonmanifoldEdges':nonmanifold_edges,'degenerateFaces':degenerate_faces,'swatchSpace':'sRGB decoded to linear','pivots':{k:list(v.location) for k,v in pivots.items()},'runtimeIntegrated':False,'anatomy':'4 walking legs + 2 raptorial limbs; 4 thick wings; 2 antennae'},indent=2))
# Portable mesh data gives future adapters exact authored pivots; no old rig reuse.
(OUT/'mantis-mesh-v4.json').write_text(json.dumps({'coordinateFrame':'X right, -Y front, Z up','parts':[{'name':o.name,'joint':o['joint'],'vertices':[list(v.co) for v in o.data.vertices],'faces':[list(p.vertices) for p in o.data.polygons],'materialIndices':[p.material_index for p in o.data.polygons],'colors':[list(m.diffuse_color) for m in o.data.materials]} for o in objects]},separators=(',',':')))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mantis-study-v4.blend'))
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'mantis-study-v4.glb'),export_format='GLB',use_selection=True,export_yup=True)
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
  scene.render.filepath=str(OUT/('clay-v4-' if A.clay else 'color-v4-'))+label+'.png';bpy.ops.render.render(write_still=True)
 (OUT/'cameras-v4.json').write_text(json.dumps(cameras,indent=2))
