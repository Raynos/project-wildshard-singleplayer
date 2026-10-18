"""Splinter Mantis: editable study of human-approved low-poly target; model unaccepted.
Blender 4.3: blender -b -t 2 --python-exit-code 1 -P this.py -- --out tmp/lowpoly-mantis [--render --view front]
Palette swatches are sRGB, explicitly decoded for Blender linear material inputs.
X lateral, -Y forward, Z up. Render lane permission required. No runtime wiring.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
P=argparse.ArgumentParser();P.add_argument('--out',required=True);P.add_argument('--render',action='store_true');P.add_argument('--view',choices=['front','side','rear'],default='front');P.add_argument('--clay',action='store_true')
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
 for f,w in [(.25,.65),(.53,1),(.77,.68)]:
  c=b+axis*f
  left.append(len(vs));vs.append(tuple(c-side*width*w))
  right.append(len(vs));vs.append(tuple(c+side*width*w))
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
loft('Rising prothorax',[((0,.38,1.40),.30,.23),((0,.14,1.69),.25,.21),((0,-.07,2.03),.18,.16),((0,-.22,2.35),.18,.14),((0,-.38,2.55),.20,.16)],[wood,warm,light],n=7)
leaf('Pale ventral thorax ridge',(0,-.10,1.53),(0,-.56,2.51),.115,.075,mats=[light,ivory,warm])
for s in [-1,1]:
 for j in range(3):
  z=1.63+j*.27;y=.26-j*.19
  leaf('Broad thorax side plate '+str((s,j)),(s*.15,y-.15,z-.12),(s*(.39-j*.035),y+.12,z+.29),.13,.075,mats=[wood,warm,light])
pivot('head',(0,-.37,2.53),'body')
# Broad inverted triangle head: cheek corners, thick rear cranium, central keel.
mesh('Triangular mantis head',[(-.39,-.38,2.73),(.39,-.38,2.73),(0,-.73,2.23),(-.26,-.18,2.65),(.26,-.18,2.65),(0,-.37,2.29),(0,-.65,2.60),(0,-.77,2.48)],[(0,6,7),(6,1,7),(0,7,2),(7,1,2),(0,3,4,1,6),(0,2,5,3),(1,4,5,2),(3,5,4)],[warm,light,wood],[1,1,0,1,0,2,2,2],'head')
for s in [-1,1]:
 leaf('Eye '+str(s),(s*.16,-.64,2.37),(s*.39,-.44,2.66),.14,.11,'head',[eye,eyeLight,shade])
 loft('Mandible '+str(s),[((s*.09,-.66,2.38),.065,.045),((s*.10,-.77,2.27),.045,.035),((s*.025,-.80,2.23),.002,.003)],[dark,ivory], 'head',5)
 leaf('Brow horn '+str(s),(s*.20,-.29,2.58),(s*.36,-.18,2.87),.10,.06,'head',[wood,warm,light])
 # Deliberate twig bends and single leaf terminal; no bark grain.
 ant=[((s*.19,-.35,2.67),.04,.035),((s*.30,-.32,2.99),.032,.025),((s*.46,-.30,3.34),.024,.018),((s*.62,-.37,3.60),.011,.009)]
 loft('Twig antenna '+str(s),ant,[warm,light], 'head',5)
 leaf('Antenna leaf '+str(s),(s*.60,-.36,3.56),(s*.82,-.34,3.89),.085,.025,'head')
 # Four wing volumes arranged in a backwards/upwards fan.
 for j in range(2):
  name='wing'+str(s)+'_'+str(j);base=(s*.18,.42+j*.17,1.64-j*.13);pivot(name,base,'body')
  tip=(s*(.83 if j==0 else 1.15),1.12+j*.35,3.28-j*.65)
  leaf('Leaf wing '+name,base,tip,.40 if j==0 else .35,.12,name)
  loft('Wing woody leading rib '+name,[(base,.045,.035),((s*.53,.78+j*.28,2.40-j*.35),.035,.025),(tip,.003,.003)],[wood,warm],name,5)
 # Walking pairs: explicit hip, knee and ankle pivots, four feet on ground.
 for j in range(2):
  hip=(s*.24,.15+j*.64,1.43-j*.10);knee=(s*(.74+j*.08),.00+j*.95,1.06);ankle=(s*(1.06+j*.16),-.37+j*1.63,.12)
  name='leg'+str(s)+'_'+str(j);pivot(name,hip,'body');pivot(name+'_knee',knee,name)
  loft('Walking femur '+name,[(hip,.13,.12),((s*.48,.08+j*.82,1.29),.17,.13),(knee,.10,.09)],[wood,warm,light],name,5)
  loft('Walking tibia '+name,[(knee,.105,.08),((s*(.91+j*.12),-.18+j*1.29,.61),.10,.075),(ankle,.045,.04)],[wood,warm,light],name+'_knee',5)
  loft('Ground tarsus '+name,[(ankle,.048,.04),((ankle[0]+s*.04,ankle[1]-.12,.055),.048,.04),((ankle[0]+s*.09,ankle[1]-.24,.025),.005,.006)],[dark,warm],name+'_knee',5)
  leaf('Femur leaf plate '+name,(s*.47,-.03+j*.84,1.32),(s*.68,-.06+j*.86,.83),.095,.045,name)
 # The two raptorial limbs are independent of the four weight-bearing legs.
 sh=(s*.19,-.22,2.08);el=(s*.69,-.53,1.77);wr=(s*1.03,-.65,2.34)
 name='raptor'+str(s);pivot(name,sh,'body');pivot(name+'_elbow',el,name);pivot(name+'_hook',wr,name+'_elbow')
 loft('Raptorial upper arm '+str(s),[(sh,.14,.12),((s*.43,-.39,1.99),.13,.10),(el,.09,.08)],[wood,warm,light],name,6)
 loft('Raised raptorial forearm '+str(s),[(el,.10,.08),((s*.91,-.59,2.02),.13,.11),(wr,.14,.11)],[wood,warm,light],name+'_elbow',6)
 # Hook's sectional sweep curves outwards then inwards, into a sharp terminal.
 hook=[(wr,.11,.12),((s*1.18,-.69,2.13),.20,.14),((s*1.25,-.73,1.79),.22,.12),((s*1.22,-.78,1.41),.19,.09),((s*1.08,-.82,1.02),.075,.055),((s*.87,-.88,.76),.004,.005)]
 loft('Curved woody hook '+str(s),hook,[wood,warm,light],name+'_hook',6)
 # Three substantial ivory teeth seated in inside edge, true wedge volumes.
 for j in range(3):
  z=1.98-j*.33;x=1.12-j*.015;y=-.74-j*.035
  leaf('Hook cutting tooth '+str((s,j)),(s*x,y,z+.12),(s*(x-.31),y-.02,z-.29),.145,.075,name+'_hook',[ivory,light,warm])

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
(OUT/'metrics-v2.json').write_text(json.dumps({'status':'unaccepted low-poly study','triangles':tri,'meshObjects':len(objects),'boundaryEdges':boundary_edges,'nonmanifoldEdges':nonmanifold_edges,'degenerateFaces':degenerate_faces,'swatchSpace':'sRGB decoded to linear','pivots':{k:list(v.location) for k,v in pivots.items()},'runtimeIntegrated':False,'anatomy':'4 walking legs + 2 raptorial limbs; 4 thick wings; 2 antennae'},indent=2))
# Portable mesh data gives future adapters exact authored pivots; no old rig reuse.
(OUT/'mantis-mesh-v2.json').write_text(json.dumps({'coordinateFrame':'X right, -Y front, Z up','parts':[{'name':o.name,'joint':o['joint'],'vertices':[list(v.co) for v in o.data.vertices],'faces':[list(p.vertices) for p in o.data.polygons],'materialIndices':[p.material_index for p in o.data.polygons],'colors':[list(m.diffuse_color) for m in o.data.materials]} for o in objects]},separators=(',',':')))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mantis-study-v2.blend'))
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'mantis-study-v2.glb'),export_format='GLB',use_selection=True,export_yup=True)
if A.render:
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=False;scene.render.resolution_x=780;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.world.color=(.15,.15,.15);scene.view_settings.view_transform='AgX'
 ground=mat('Dark studio ground',(.027,.037,.045));mesh('Ground',[(-50,-50,0),(50,-50,0),(50,50,0),(-50,50,0)],[(0,1,2,3)],[ground])
 def light_at(name,pos,power,size):
  d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,1.7))-o.location).to_track_quat('-Z','Y').to_euler()
 light_at('Key',(-3,-4,7),700,4);light_at('Fill',(4,-2,4),400,4);light_at('Rim',(0,5,5),850,3)
 d=bpy.data.cameras.new('Study camera');cam=bpy.data.objects.new('Study camera',d);bpy.context.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO';d.ortho_scale=5.15
 cam.location={'front':(-4,-8,3.5),'side':(8,.3,3.1),'rear':(-4,8,3.7)}[A.view];cam.rotation_euler=(Vector((0,.35,1.94))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/('clay-v2-' if A.clay else 'color-v2-'))+A.view+'.png';bpy.ops.render.render(write_still=True)
