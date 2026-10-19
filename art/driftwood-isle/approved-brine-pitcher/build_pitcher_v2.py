"""Complete Brine Pitcher source. Native +Y up, +Z front; Blender (x,-z,y).
Run blender -b -t 2 -P this.py -- --out <directory> [--render].
No runtime writes. Identity-oriented absolute native binds, rigid articulated anatomy.
"""
import argparse,sys,math,json,hashlib,importlib.util,random
from pathlib import Path
import bpy
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--render',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
spec=importlib.util.spec_from_file_location('codec',ROOT/'art/driftwood-isle/approved-puffer/native_export.py');codec=importlib.util.module_from_spec(spec);spec.loader.exec_module(codec)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
rng=random.Random(1619)
hexes={'wood':'A86B35','woodLight':'D39B50','woodDark':'70482D','red':'AB2941','redLight':'D74C50','redDark':'74213C','throat':'42112C','throatLight':'721C3C','ivory':'F3D897','ivoryLight':'FFE8B0','ivoryShade':'D7AE67','leaf':'6D9C33','leafLight':'B5CB38','leafDark':'316D49','leafVein':'A7B733','stone':'777B80','stoneDark':'535966'}
colors={k:[(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for v in [int(h[i:i+2],16)/255 for i in (0,2,4)]] for k,h in hexes.items()}
materials={}
for k,c in colors.items():
 m=bpy.data.materials.new(k);m.diffuse_color=(*c,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*c,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85;materials[k]=m
bones=[{'name':'body','parent':None,'pos':[0,.7,0]}]
for name,pos in [('head',[0,2.05,0]),('leftHead',[-1.05,1.6,.02]),('rightHead',[1.07,1.48,.05])]:
 bones.append({'name':name,'parent':'body','pos':pos})
for name,pos in [('head',[0,3.38,-.48]),('leftHead',[-1.28,2.66,-.32]),('rightHead',[1.30,2.48,-.28])]:bones.append({'name':name+'Lid','parent':name,'pos':pos})
parts={b['name']:{'name':b['name'],**{k:[] for _,_,_,k in codec.ATTRS}} for b in bones};objects=[];components=[]
def bp(v):return (v[0],-v[2],v[1])
def mesh(name,verts,faces,palette,joint='body'):
 # Explicit triangles preserve authored facet colors in native and GLB.
 tris=[]
 for f in faces:
  for i in range(1,len(f)-1):tris.append((f[0],f[i],f[i+1]))
 data=bpy.data.meshes.new(name);data.from_pydata([bp(v) for v in verts],[],tris);data.update();o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o)
 for k in palette:data.materials.append(materials[k])
 part=parts[joint];bi=[b['name'] for b in bones].index(joint)
 for i,tri in enumerate(tris):
  mi=(i*7+i//3)%len(palette);data.polygons[i].material_index=mi
  for vi in tri:
   part['positions'].extend(float(x) for x in verts[vi]);part['colorsLinear'].extend(colors[palette[mi]]);part['skinIndices'].extend([bi,0,0,0]);part['skinWeights'].extend([1,0,0,0]);part['furLen'].append(0)
 o['nativeJoint']=joint;objects.append(o);components.append({'name':name,'joint':joint,'triangles':len(tris)});return o

def tube(name,rows,palette,joint='body',n=7,cap=True):
 # Parallel-transport ring frame prevents twist/fold on curved timber spans.
 vs=[];previous=None
 for j,(c,r) in enumerate(rows):
  t=(Vector(rows[min(j+1,len(rows)-1)][0])-Vector(rows[max(0,j-1)][0])).normalized()
  u=Vector((1,0,0)) if previous is None else previous
  u=u-t*u.dot(t)
  if u.length<.01:u=Vector((0,0,1))-t*t.z
  u.normalize();v=t.cross(u);previous=u
  vs.extend(tuple(Vector(c)+r*(math.cos(math.tau*i/n)*u+math.sin(math.tau*i/n)*v)) for i in range(n))
 fs=[]
 for j in range(len(rows)-1):
  for i in range(n):fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 if cap:fs.extend([tuple(reversed(range(n))),tuple((len(rows)-1)*n+i for i in range(n))])
 return mesh(name,vs,fs,palette,joint)
wood=['wood','woodLight','wood','woodDark']
tube('Twisting continuous heartwood',[((0,.18,0),.55),((-.08,.62,0),.49),((.12,1.15,-.05),.35),((-.12,1.68,-.10),.30),((0,2.24,-.18),.21),((.10,3.28,-.50),.13)],wood,n=9)
for i in range(9):
 t=math.tau*i/9+.18;dx,dz=math.cos(t),math.sin(t);length=1.35+(.18 if i%2 else 0)
 tube('Buttress root %02d'%i,[((dx*.2,.85,dz*.2),.27),((dx*.64,.48,dz*.65),.24),((dx*1.06,.23,dz*1.0),.15),((dx*length,.045,dz*length),.018)],wood,n=6)
 if i%2==0:tube('Split root toe %02d'%i,[((dx*.8,.30,dz*.8),.14),((dx*1.16-dz*.22,.13,dz*1.16+dx*.22),.09),((dx*1.43-dz*.30,.025,dz*1.43+dx*.30),.012)],wood,n=5)
for side,y in [(-1,1.72),(1,1.57)]:
 tube('Integrated lateral bough '+str(side),[((side*.12,.87,-.05),.27),((side*.53,1.26,-.08),.24),((side*.94,y,-.13),.20),((side*1.31,y+.46,-.33),.13)],wood,n=7)

def leaf(name,base,tip,width,joint='body',large=False):
 b=Vector(base);t=Vector(tip);d=t-b;u=d.cross(Vector((0,1,0)))
 if u.length<.01:u=Vector((1,0,0))
 u.normalize();mid=b+d*.48;ridge=mid+Vector((0,width*.22,0));v=[tuple(b),tuple(b+d*.2-u*width*.63),tuple(mid-u*width),tuple(b+d*.82-u*width*.62),tuple(t),tuple(b+d*.82+u*width*.62),tuple(mid+u*width),tuple(b+d*.2+u*width*.63),tuple(ridge),tuple(mid-Vector((0,width*.1,0)))]
 fs=[(i,(i+1)%8,8) for i in range(8)]+[((i+1)%8,i,9) for i in range(8)]
 mesh(name,v,fs,['leaf','leafLight','leafDark','leafLight'],joint)
 tube(name+' midrib',[(base,width*.055),(tuple(ridge),width*.04),(tip,width*.008)],['leafVein'],joint,n=4)

def vessel(name,c,s):
 x,y,z=c;n=16
 # Bowl inner wall reaches deeply below rim; never a dark painted disk over a closed solid.
 rings=[(.05,.10),(.18,.39),(.48,.59),(.83,.62),(1.12,.49),(1.24,.61),(1.28,.52),(1.06,.43),(.74,.36),(.50,.20)]
 vs=[]
 for j,(h,r) in enumerate(rings):
  for i in range(n):
   t=math.tau*i/n;rr=r*(1+.035*math.sin(i*2.4+j));vs.append((x+s*rr*math.cos(t),y+s*(h+.08*math.sin(t)),z+s*(rr*.85*math.sin(t)+.08*h)))
 fs=[]
 for j in range(len(rings)-1):
  for i in range(n):fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 # +Y vessel axes use clockwise XZ rings: reverse side winding for outward normals.
 fs=[tuple(reversed(f)) for f in fs]
 # separate outer and inner walls retain intentional deep claret palette.
 mesh(name+' red vessel',vs,fs[:5*n]+[tuple(range(n))],['red','redLight','red','redDark'],name)
 mesh(name+' deep inner chamber',vs,fs[6*n:]+[tuple((len(rings)-1)*n+i for i in reversed(range(n)))],['throat','throatLight','redDark'],name)
 mesh(name+' thick ivory lip',vs,fs[5*n:6*n],['ivory','ivoryLight','ivoryShade'],name)
 rv=[];rf=[]
 for i in range(n):
  t=math.tau*i/n
  for k in range(6):
   q=math.tau*k/6;r=.565+.085*math.cos(q);rv.append((x+s*r*math.cos(t),y+s*(1.245+.08*math.sin(t)+.075*math.sin(q)),z+s*(r*.85*math.sin(t)+.10)))
 for i in range(n):
  for k in range(6):rf.append((i*6+k,((i+1)%n)*6+k,((i+1)%n)*6+(k+1)%6,i*6+(k+1)%6))
 mesh(name+' sculpted ivory rim',rv,[tuple(reversed(f)) for f in rf],['ivory','ivoryLight','ivoryShade'],name)
 for i in range(n):
  t=math.tau*i/n;tt=t+math.pi/n;radius=.57*s;cx=x+radius*math.cos(tt);cz=z+radius*.85*math.sin(tt)+.10*s;cy=y+s*(1.24+.08*math.sin(tt));w=.10*s
  # Faceted drooping tooth, four sloped planes, ivory continuous with lip.
  mesh(name+' rim fang %02d'%i,[(cx-w*math.sin(tt),cy,cz+w*math.cos(tt)),(cx+w*math.sin(tt),cy,cz-w*math.cos(tt)),(cx+math.cos(tt)*.07*s,cy+.035*s,cz+math.sin(tt)*.07*s),(cx+math.cos(tt)*.04*s,cy-(.19+.06*(i%3))*s,cz+math.sin(tt)*.04*s)],[(0,1,2),(0,3,1),(1,3,2),(2,3,0)],['ivory','ivoryLight','ivoryShade'],name)
 # Woody sheath climbing back of pitcher, attached to head assembly.
 tube(name+' rear woody keel',[((x,y,z-.12*s),.14*s),((x+.08*s,y+.55*s,z-.40*s),.12*s),((x,y+1.2*s,z-.43*s),.07*s)],wood,name,n=5)
 hinge=next(b['pos'] for b in bones if b['name']==name+'Lid');joint=name+'Lid'
 canopyBase=(x,y+1.90*s,z-.57*s);tip=(x-.10*s,y+1.93*s,z+.78*s)
 tube(name+' living lid stem',[(hinge,.065*s),((x,y+1.65*s,z-.37*s),.075*s),(canopyBase,.045*s)],['leafDark','leafVein'],joint,n=5)
 leaf(name+' hinged leaf canopy',canopyBase,tip,.73*s,joint,True)
 # Three branching veins visually connect hinge to canopy.
 for side in [-1,1]:tube(name+' lid vein '+str(side),[(hinge,.035*s),((x+side*.20*s,y+1.90*s,z-.08*s),.025*s),((x+side*.51*s,y+1.95*s,z+.18*s),.008*s)],['leafVein'],joint,n=4)
vessel('head',(0,2.05,0),1.06);vessel('leftHead',(-1.28,1.60,.02),.78);vessel('rightHead',(1.30,1.48,.05),.73)
for i,(b,t,w) in enumerate([((-.22,.75,.37),(-.66,1.10,.55),.23),((.2,1.13,.29),(.77,1.36,.46),.23),((-.48,1.47,.14),(-.96,1.70,.40),.20),((.40,.54,.55),(.92,.66,.83),.22),((.14,1.86,-.12),(.49,2.10,.04),.18),((-.60,.38,-.38),(-1.05,.60,-.70),.24),((.25,1.43,-.22),(.72,1.63,-.51),.20)]):leaf('Branch leaf %02d'%i,b,t,w)
# Low polygon hollow barnacles on front-facing wood, with real apertures.
for i,(x,y,z,r) in enumerate([(-.42,1.42,.26,.09),(-.29,1.35,.31,.08),(-.13,1.18,.35,.07),(.16,.92,.43,.09),(.29,.80,.40,.08),(.42,.68,.43,.08),(-.71,.26,.77,.085),(-.82,.18,.91,.065),(.65,.19,.87,.08),(.49,.23,.71,.08),(0,.45,.48,.095),(.12,.34,.54,.075)]):
 n=6;vs=[]
 for rr,zz in [(r,z),(r*.80,z+r*.7),(r*.37,z+r*.8),(r*.30,z+r*.24)]:
  vs.extend((x+rr*math.cos(math.tau*k/n),y+rr*math.sin(math.tau*k/n),zz) for k in range(n))
 fs=[(j*n+k,j*n+(k+1)%n,(j+1)*n+(k+1)%n,(j+1)*n+k) for j in range(3) for k in range(n)]
 mesh('Hollow barnacle %02d'%i,vs,fs,['ivory','ivoryShade','ivoryLight'])
# Native artifacts derive from exactly the same triangles and linear colors as GLB.
data={'schema':codec.SCHEMA,'candidate':'brine-pitcher-v1','status':'source candidate; not admitted or gameplay tested','coordinates':'right-handed x-right y-up z-forward; Blender x,-z,y; no reflection','bones':bones,'parts':list(parts.values())}
report=codec.validate_native(data)
raw=json.dumps(data,separators=(',',':'),allow_nan=False).encode();(out/'native-source.json').write_bytes(raw)
dims={'bodyY':.7,'bodyHalfLen':1.55,'bodyRadius':.65,'headRadius':.75,'legLen':.7,'feet':[],'halfWidth':1.93,'capsuleAxis':'y'}
metadata,packed=codec.pack_native_puffer(data,dims,'/assets/driftwood-isle/brine-pitcher-native');metadata['bodies'][0].update(kind='brine-pitcher-matriarch',variant='brine-pitcher-matriarch');(out/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n');(out/'payload.bin').write_bytes(packed)
# Editable hierarchy and actual glTF skin. Native poses use the explicit absolute bind contract above.
arm=bpy.data.armatures.new('Pitcher anatomy');rig=bpy.data.objects.new('Brine Pitcher rig',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for b in bones:
 eb=arm.edit_bones.new(b['name']);eb.head=bp(b['pos']);eb.tail=Vector(eb.head)+Vector((0,0,.20))
 if b['parent']:eb.parent=arm.edit_bones[b['parent']]
bpy.ops.object.mode_set(mode='OBJECT')
for o in objects:
 g=o.vertex_groups.new(name=o['nativeJoint']);g.add(list(range(len(o.data.vertices))),1,'REPLACE');mod=o.modifiers.new('Native rigid skin','ARMATURE');mod.object=rig;o.parent=rig
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'brine-pitcher-v1.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
report.update({'components':components,'nativeBytes':len(raw),'packedBytes':len(packed),'glbBytes':(out/'brine-pitcher-v1.glb').stat().st_size,'visualAcceptance':False,'runtimeAcceptance':False,'colliderAcceptance':False,'sourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()});(out/'construction.json').write_text(json.dumps(report,indent=2)+'\n')
if a.render:
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=False;scene.render.resolution_x=600;scene.render.resolution_y=720;scene.render.resolution_percentage=100;scene.world.color=(.22,.22,.22);scene.view_settings.view_transform='Standard'
 ground=bpy.data.materials.new('Review ground');ground.diffuse_color=(.13,.19,.24,1);bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(ground)
 for name,pos,power,size in [('Key',(-4,-5,8),1000,5),('Fill',(5,-2,5),600,5),('Rim',(0,4,7),850,4)]:
  bpy.ops.object.light_add(type='AREA',location=pos);bpy.context.object.name=name;bpy.context.object.data.energy=power;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=size
 bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=5.0;target=Vector((0,0,2.0))
 views=[('hero',28,15),('front',0,0),('left',-90,0),('right',90,0),('back',180,0),('top',0,89.9),('elevated-front',0,39),('elevated-left',-90,39),('elevated-right',90,39),('elevated-back',180,39)]
 cameras=[]
 for name,az,el in views:
  az=math.radians(az);el=math.radians(el);camera.location=target+Vector((8*math.sin(az)*math.cos(el),-8*math.cos(az)*math.cos(el),8*math.sin(el)));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True);cameras.append({'name':name,'azimuthDegrees':math.degrees(az),'elevationDegrees':math.degrees(el),'actualRender':True})
 (out/'cameras.json').write_text(json.dumps(cameras,indent=2)+'\n')
print('PITCHER_SOURCE_COMPLETE',json.dumps({k:v for k,v in report.items() if k!='components'}))
