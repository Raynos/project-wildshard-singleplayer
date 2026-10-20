"""Complete Brine Pitcher source. Native +Y up, +Z front; Blender (x,-z,y).
Run blender -b -t 2 -P this.py -- --out <directory> [--render].
No runtime writes. Identity-oriented absolute native binds, rigid articulated anatomy.
"""
import argparse,sys,math,json,hashlib,importlib.util,random
from pathlib import Path
import bpy
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--render',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
spec=importlib.util.spec_from_file_location('codec',ROOT/'art/driftwood-isle/approved-puffer/native_export.py');codec=importlib.util.module_from_spec(spec);spec.loader.exec_module(codec)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
rng=random.Random(1619)
hexes={'wood':'A86B35','woodLight':'D39B50','woodDark':'70482D','red':'AB2941','redLight':'D74C50','redDark':'74213C','throat':'42112C','throatLight':'721C3C','ivory':'F3D897','ivoryLight':'FFE8B0','ivoryShade':'D7AE67','leaf':'6D9C33','leafLight':'B5CB38','leafDark':'316D49','leafVein':'A7B733','stone':'777B80','stoneDark':'535966','stoneLight':'95909C','hoodRed':'9B3035','hoodGold':'9C862A','leafTeal':'3F9270'}
colors={k:[(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for v in [int(h[i:i+2],16)/255 for i in (0,2,4)]] for k,h in hexes.items()}
materials={}
for k,c in colors.items():
 m=bpy.data.materials.new(k);m.diffuse_color=(*c,1);m.use_backface_culling=True;m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*c,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85;materials[k]=m
bones=[{'name':'body','parent':None,'pos':[0,.7,0]}]
for name,pos in [('head',[0,2.05,0]),('leftHead',[-1.05,1.6,.02]),('rightHead',[1.07,1.48,.05])]:
 bones.append({'name':name,'parent':'body','pos':pos})
for name,pos in [('head',[0,3.38,-.48]),('leftHead',[-1.28,2.66,-.32]),('rightHead',[1.30,2.48,-.28])]:bones.append({'name':name+'Lid','parent':name,'pos':pos})
parts={b['name']:{'name':b['name'],**{k:[] for _,_,_,k in codec.ATTRS}} for b in bones};objects=[];components=[]
def bp(v):return (v[0],-v[2],v[1])
def mesh(name,verts,faces,palette,joint='body'):
 # Entire head assemblies lean toward the viewer; no camera or root compensation.
 head=joint.removesuffix('Lid')
 if head in ('head','leftHead','rightHead'):
  origin={'head':(0,2.05,0),'leftHead':(-1.28,1.60,.02),'rightHead':(1.30,1.48,.05)}[head]
  angle=math.radians({'head':19,'leftHead':24,'rightHead':15}[head]);co,si=math.cos(angle),math.sin(angle)
  verts=[(x,origin[1]+co*(y-origin[1])-si*(z-origin[2]),origin[2]+si*(y-origin[1])+co*(z-origin[2])) for x,y,z in verts]

 # Explicit triangles preserve authored facet colors in native and GLB.
 tris=[]
 for f in faces:
  for i in range(1,len(f)-1):tris.append((f[0],f[i],f[i+1]))
 # Reverse triangle order only: preserve the original diagonal and each facet's paint.
 if name.endswith('sculpted ivory rim') or ' rim fang ' in name or name.endswith('hinged leaf canopy') or (name.startswith('Branch leaf ') and not name.endswith('midrib')):
  tris=[(a,c,b) for a,b,c in tris]
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
tube('Twisting continuous heartwood',[((-.10,.18,-.07),.57),((.12,.60,.02),.49),((-.11,1.10,-.06),.36),((.10,1.58,-.14),.27),((-.07,2.18,-.21),.29),((.04,2.81,-.43),.055)],wood,n=8)
# Deliberately asymmetrical root arches and negative spaces, not a radial starburst.
rootpaths=[
 [((-.12,.84,.16),.31),((-.52,.57,.54),.28),((-.73,.36,.77),.21),((-.67,.16,1.12),.13),((-.44,.025,1.42),.015)],
 [((.25,.72,.08),.29),((.65,.56,.36),.27),((.79,.34,.69),.19),((.67,.17,1.03),.12),((.82,.025,1.37),.015)],
 [((-.29,.66,.01),.27),((-.79,.51,.12),.24),((-1.12,.28,.30),.18),((-1.45,.02,.57),.016)],
 [((.18,.56,-.10),.27),((.77,.40,-.12),.25),((1.14,.24,.12),.17),((1.45,.025,.39),.016)],
 [((-.20,.72,-.13),.28),((-.65,.44,-.45),.23),((-.91,.25,-.88),.14),((-1.23,.025,-1.12),.012)],
 [((.08,.74,-.18),.29),((.46,.48,-.59),.23),((.86,.27,-.84),.15),((1.14,.025,-1.23),.012)],
 [((-.04,.55,-.19),.25),((-.09,.39,-.72),.23),((.13,.19,-1.05),.13),((.06,.02,-1.44),.014)]]
for i,rows in enumerate(rootpaths):
 tube('Interwoven arch root %02d'%i,rows,wood,n=6)
 c=rows[-2][0];t=rows[-1][0]
 tube('Root fork %02d'%i,[(c,.095),((t[0]+.16,.045,t[2]-.12),.065),((t[0]+.26,.018,t[2]-.18),.009)],wood,n=5)
for side,y in [(-1,1.72),(1,1.57)]:
 tube('Integrated lateral bough '+str(side),[((side*.04,.76,-.05),.29),((side*.46,1.07,-.04),.27),((side*.91,1.28,-.14),.22),((side*1.30,y+.20,-.29),.16)],wood,n=7)
# Angular embedded rock cluster occupies the spaces below arched living roots.
for i,(x,z,r) in enumerate([(-.30,.56,.36),(.32,.72,.32),(-.73,-.28,.31),(.63,-.52,.32),(0,-.66,.30)]):
 vs=[(x+r*math.cos(k*math.tau/7),.04,z+r*math.sin(k*math.tau/7)) for k in range(7)]
 vs += [(x+r*.80*math.cos(k*math.tau/7+.12),r*(.68+.10*math.sin(k*2)),z+r*.8*math.sin(k*math.tau/7+.12)) for k in range(7)]
 vs += [(x-.08,r*1.14,z+.04)]
 fs=[tuple(reversed(range(7)))]+[(k,(k+1)%7,(k+1)%7+7,k+7) for k in range(7)]+[(k+7,(k+1)%7+7,14) for k in range(7)]
 mesh('Embedded rock %02d'%i,vs,[tuple(reversed(f)) for f in fs],['stone','stoneDark','stoneLight'])

def leaf(name,base,tip,width,joint='body',large=False):
 b=Vector(base);t=Vector(tip);d=t-b;u=d.cross(Vector((0,1,0)))
 if u.length<.01:u=Vector((1,0,0))
 u.normalize();mid=b+d*.48;ridge=mid+Vector((0,width*.22,0));v=[tuple(b),tuple(b+d*.2-u*width*.63),tuple(mid-u*width),tuple(b+d*.82-u*width*.62),tuple(t),tuple(b+d*.82+u*width*.62),tuple(mid+u*width),tuple(b+d*.2+u*width*.63),tuple(ridge),tuple(mid-Vector((0,width*.1,0)))]
 fs=[(i,(i+1)%8,8) for i in range(8)]+[((i+1)%8,i,9) for i in range(8)]
 mesh(name,v,fs,['leaf','leafLight','leafDark','leafLight'],joint)
 tube(name+' midrib',[(base,width*.055),(tuple(ridge),width*.04),(tip,width*.008)],['leafVein'],joint,n=4)

def vessel(name,c,s):
 x,y,z=c;n=12
 # Bowl inner wall reaches deeply below rim; never a dark painted disk over a closed solid.
 rings=[(-.13,.16),(.13,.42),(.43,.66),(.78,.69),(1.08,.59),(1.21,.68),(1.25,.55),(1.02,.44),(.70,.35),(.45,.16)]
 vs=[]
 for j,(h,r) in enumerate(rings):
  for i in range(n):
   t=math.tau*i/n;rr=r*(1+.06*math.sin(i*2.4+j*.3));vs.append((x+s*rr*math.cos(t),y+s*(h+.08*math.sin(t)),z+s*(rr*.85*math.sin(t)+.08*h)))
 fs=[]
 for j in range(len(rings)-1):
  for i in range(n):fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 # +Y vessel axes use clockwise XZ rings: reverse side winding for outward normals.
 fs=[tuple(reversed(f)) for f in fs]
 # separate outer and inner walls retain intentional deep claret palette.
 mesh(name+' red vessel',vs,fs[:5*n]+[tuple(range(n))],['red','redLight','red','redDark'],name)
 mesh(name+' deep inner chamber',vs,fs[6*n:]+[tuple((len(rings)-1)*n+i for i in reversed(range(n)))],['throat','throatLight','redDark'],name)
 mesh(name+' thick ivory lip',vs,fs[5*n:6*n],['ivory','ivoryLight','ivoryShade'],name)
 # One continuous fleshy annulus with irregular lower lobes, not an attached tooth necklace.
 rv=[];rf=[];rn=24;cross=8
 for i in range(rn):
  t=math.tau*i/rn;wave=.032*math.sin(3*t+.4)+.022*math.sin(7*t)
  lobe=(.10+.24*max(0,math.sin(t)))*(.30+.70*(i%2))
  for k in range(cross):
   q=math.tau*k/cross;r=.625+wave+(.15+.018*math.sin(5*t))*math.cos(q)
   droop=lobe*max(0,-math.sin(q))
   rv.append((x+s*r*math.cos(t),y+s*(1.245+.08*math.sin(t)+.135*math.sin(q)-droop),z+s*(r*.85*math.sin(t)+.10)))
 for i in range(rn):
  for k in range(cross):rf.append((i*cross+k,((i+1)%rn)*cross+k,((i+1)%rn)*cross+(k+1)%cross,i*cross+(k+1)%cross))
 mesh(name+' sculpted ivory rim',rv,rf,['ivory','ivoryLight','ivory','ivoryShade'],name)
 # Internal crimson flesh thorns are actual closed geometry extending into the chamber.
 for i in range(9):
  t=math.tau*i/9
  tube(name+' inner flesh lobe '+str(i),[((x+.48*s*math.cos(t),y+1.12*s,z+s*(.39*math.sin(t)+.10)),.055*s),((x+.39*s*math.cos(t),y+(.79+.05*(i%3))*s,z+s*(.30*math.sin(t)+.10)),.006*s)],['redDark','red','redLight'],name,n=4)
 # Woody sheath climbing back of pitcher, attached to head assembly.
 tube(name+' rear woody keel',[((x,y,z-.12*s),.14*s),((x+.08*s,y+.55*s,z-.40*s),.12*s),((x,y+1.2*s,z-.43*s),.07*s)],wood,name,n=5)
 hinge=next(b['pos'] for b in bones if b['name']==name+'Lid');joint=name+'Lid'
 # Grown rearward hood: irregular perimeter and two nested crown bands.
 # Crown tilts toward the viewer rather than presenting the predecessor's flat red slab.
 hv=[];hn=12
 for level in range(2):
  for band in [1,.52]:
   for k in range(hn):
    t=math.tau*k/hn;xx=.89*math.cos(t)*(1+.075*math.sin(3*t+.5))*band
    zz=-.49+.52*math.sin(t)*band
    yy=1.98-.72*(zz+.49)+.09*xx+.14*(1-band)+.045*math.sin(4*t)*band
    hv.append((x+s*xx,y+s*(yy-(.11 if level else 0)),z+s*zz))
 hv += [(x-.035*s,y+2.17*s,z-.49*s),(x-.035*s,y+2.06*s,z-.49*s)]
 top=[];bottom=[]
 for k in range(hn):
  j=(k+1)%hn
  top.extend([(k,j,hn+j,hn+k),(hn+k,hn+j,48)])
  bottom.extend([(24+k,24+j,36+j,36+k),(36+k,36+j,49)])
 sides=[(k,24+k,24+(k+1)%hn,(k+1)%hn) for k in range(hn)]
 mesh(name+' hood green crown',hv,[tuple(reversed(f)) for f in top],['leafLight','leaf','leafTeal','leaf','leafLight'],joint)
 mesh(name+' hood crimson underside',hv,bottom+[tuple(reversed(f)) for f in sides],['hoodRed','red','redDark','hoodGold'],joint)
 # Closed broad fan grows from the rear lip into the hood underside; no free vein tips.
 fan=[(x,y+1.14*s,z-.43*s),(x-.64*s,y+1.89*s,z-.52*s),(x-.34*s,y+2.01*s,z-.52*s),(x,y+2.05*s,z-.50*s),(x+.34*s,y+2.02*s,z-.49*s),(x+.65*s,y+1.98*s,z-.48*s)]
 fan += [(xx,yy,zz-.075*s) for xx,yy,zz in fan]
 ff=[(0,k+1,k) for k in range(1,5)]+[(6,k+6,k+7) for k in range(1,5)]+[(k,(k+1)%6,(k+1)%6+6,k+6) for k in range(6)]
 mesh(name+' living flared hinge',fan,ff,['leafVein','hoodGold','leafDark','leafVein'],joint)
vessel('head',(0,2.05,0),1.06);vessel('leftHead',(-1.28,1.60,.02),.78);vessel('rightHead',(1.30,1.48,.05),.73)
for i,(b,t,w) in enumerate([((-.22,.75,.37),(-.66,1.10,.55),.23),((.2,1.13,.29),(.77,1.36,.46),.23),((-.48,1.47,.14),(-.96,1.70,.40),.20),((.40,.54,.55),(.92,.66,.83),.22),((.14,1.86,-.12),(.49,2.10,.04),.18),((-.60,.38,-.38),(-1.05,.60,-.70),.24),((.25,1.43,-.22),(.72,1.63,-.51),.20)]):
 leaf('Branch leaf %02d'%i,b,t,w*1.38)
 for k,offset in enumerate([(-.16,-.12,.13),(.13,.06,-.10)]):
  leaf('Branch leaf cluster %02d %02d'%(i,k),b,(t[0]+offset[0],t[1]+offset[1],t[2]+offset[2]),w*1.06)
# Rear overlapping bark buttresses and folded foliage make a complete walk-around body.
for i,rows in enumerate([
 [((-.32,.25,-.24),.25),((-.40,.83,-.28),.24),((-.19,1.40,-.30),.21),((.03,2.23,-.35),.11)],
 [((.39,.21,-.30),.24),((.29,.70,-.45),.25),((.48,1.04,-.35),.19),((1.18,1.58,-.27),.10)],
 [((-.60,.20,.36),.23),((-.30,.57,.29),.25),((.07,1.02,.20),.18),((-.03,1.72,.03),.09)]
]):tube('Overlapping bark buttress '+str(i),rows,wood,n=6)
for i,(b,t,w) in enumerate([
 ((-.15,1.04,-.34),(-.64,1.23,-.68),.29),((.13,1.47,-.30),(.62,1.66,-.64),.25),
 ((.07,1.98,-.32),(-.32,2.16,-.63),.24),((-.47,.56,-.43),(-.93,.75,-.78),.31),
 ((.40,.45,-.44),(.84,.67,-.93),.30),((-.65,1.10,-.10),(-1.11,1.34,-.32),.26)
]):
 leaf('Branch leaf rear '+str(i),b,t,w)
 leaf('Branch leaf rear companion '+str(i),b,(t[0]+.19,t[1]-.18,t[2]-.10),w*.8)
# Low polygon hollow barnacles on front-facing wood, with real apertures.
for i,(x,y,z,r) in enumerate([(-.42,1.42,.26,.09),(-.29,1.35,.31,.08),(-.13,1.18,.35,.07),(.16,.92,.43,.09),(.29,.80,.40,.08),(.42,.68,.43,.08),(-.71,.26,.77,.085),(-.82,.18,.91,.065),(.65,.19,.87,.08),(.49,.23,.71,.08),(0,.45,.48,.095),(.12,.34,.54,.075)]):
 n=6;vs=[]
 for rr,zz in [(r,z),(r*.80,z+r*.7),(r*.37,z+r*.8),(r*.30,z+r*.24)]:
  vs.extend((x+rr*math.cos(math.tau*k/n),y+rr*math.sin(math.tau*k/n),zz) for k in range(n))
 fs=[(j*n+k,j*n+(k+1)%n,(j+1)*n+(k+1)%n,(j+1)*n+k) for j in range(3) for k in range(n)]
 mesh('Hollow barnacle %02d'%i,vs,fs,['ivory','ivoryShade','ivoryLight'])
# Native artifacts derive from exactly the same triangles and linear colors as GLB.
data={'schema':codec.SCHEMA,'candidate':'brine-pitcher-grown-fan-anatomy','status':'source candidate; not admitted or gameplay tested','coordinates':'right-handed x-right y-up z-forward; Blender x,-z,y; no reflection','bones':bones,'parts':list(parts.values())}
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
