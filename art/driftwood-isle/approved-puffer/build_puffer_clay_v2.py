"""Clay anatomy redesign after failed first study. No plates, paint chips or runtime wiring.
Blender: -b -t 2 --python-exit-code 1 -P <this> -- --out tmp/approved-puffer-clay-v2 --render
"""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--render',action='store_true')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--'in sys.argv else []);out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
PI=math.pi
clay=bpy.data.materials.new('Neutral clay');clay.diffuse_color=(.43,.46,.46,1);clay.use_nodes=True;clay.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.43,.46,.46,1);clay.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.86
shadow=bpy.data.materials.new('Socket clay');shadow.diffuse_color=(.12,.14,.14,1)
objects=[]
def mesh(name,vs,fs,material=clay,smooth=False):
    d=bpy.data.meshes.new(name);d.from_pydata(vs,[],fs);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);d.materials.append(material)
    for poly in d.polygons:poly.use_smooth=smooth
    objects.append(o);return o

def rings(name,rows,material=clay,smooth=False):
    n=len(rows[0]);vs=[v for r in rows for v in r];fs=[]
    for j in range(len(rows)-1):
        for i in range(n):
            a=j*n+i;b=j*n+(i+1)%n;c=(j+1)*n+(i+1)%n;d=(j+1)*n+i
            fs.extend([(a,b,c),(a,c,d)])
    fs.extend([tuple(reversed(range(n))),tuple((len(rows)-1)*n+i for i in range(n))])
    return mesh(name,vs,fs,material,smooth)

def interp(rows,t):
    for x,y in zip(rows,rows[1:]):
        if x[0]<=t<=y[0]:
            f=(t-x[0])/(y[0]-x[0]);return [x[i]*(1-f)+y[i]*f for i in range(1,len(x))]
    return rows[0][1:] if t<rows[0][0] else rows[-1][1:]
def gauss(x,c,s):return math.exp(-((x-c)/s)**2)
# Height, half-width, centerline fore/aft, half-depth. Upper crown leans markedly rearward.
BODY=[(.24,.10,-.17,.18),(.32,.36,-.15,.40),(.45,.51,-.10,.57),(.62,.60,-.10,.66),(.82,.62,-.10,.77),(1.00,.56,-.12,.84),(1.14,.48,-.16,.76),(1.26,.36,-.22,.58),(1.36,.21,-.28,.34),(1.42,.035,-.31,.07)]
rows=[]
for j in range(43):
    z=.24+j/42*1.18;w,cy,depth=interp(BODY,z);row=[]
    for i in range(96):
        angle=2*PI*i/96;x=w*math.sin(angle);y=cy+depth*math.cos(angle)
        # One continuous cranium: eye depressions and eyebrow ridges are displaced in the same surface.
        if math.cos(angle)>0:
            front=math.cos(angle)**2
            for sign in [-1,1]:
                y-=.115*gauss(x,sign*.34,.14)*gauss(z,1.02,.105)*front
                # Heavy brow descends toward the beak, wrapping outer orbital edge.
                brow_z=1.10+.11*(abs(x)-.16)
                y+=.105*gauss(x,sign*.35,.22)*gauss(z,brow_z,.064)*front
                y+=.044*gauss(x,sign*.49,.11)*gauss(z,.93,.16)*front
            # The muzzle is part of the skull, projecting above a low wide real gape.
            y+=.20*gauss(x,0,.24)*gauss(z,.91,.15)*front
        row.append((x,y,z))
    rows.append(row)
body=rings('Continuous sloped skull and torso',rows,smooth=True)
for poly in body.data.polygons:poly.flip()
body.data.update()
# Boolean mouth aperture: lower and wider than the failed triangular nose shape.
outline=[(-.205,.805),(-.22,.855),(-.175,.915),(-.10,.951),(0,.974),(.10,.951),(.175,.915),(.22,.855),(.205,.805),(.10,.785),(-.10,.785)]
vs=[]
for y in [.58,1.30]:vs.extend([(x,y,z) for x,z in outline])
n=len(outline);fs=[tuple(reversed(range(n))),tuple(n+i for i in range(n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
cutter=mesh('Mouth cutter',vs,fs)
bpy.context.view_layer.objects.active=body;mod=body.modifiers.new('True recessed open mouth','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter;bpy.ops.object.modifier_apply(modifier=mod.name)
objects.remove(cutter);bpy.data.objects.remove(cutter,do_unlink=True)
mesh('Inner mouth shadow',[(x*.90,.605,.87+(z-.87)*.88)for x,z in outline],[tuple(range(n))],shadow)
# Elliptical eye lenses are buried behind the brow surface, not mounted as frontal cylinders.
def lens(name,c,size,material=clay):
    cx,cy,cz=c;rx,ry,rz=size;rr=[]
    for j in range(9):
        t=PI*j/8
        rr.append([(cx+rx*math.sin(t)*math.cos(2*PI*i/24),cy+ry*math.cos(t),cz+rz*math.sin(t)*math.sin(2*PI*i/24))for i in range(24)])
    return rings(name,rr,material,True)
for s in [-1,1]:
    lens(f'Recessed eyeball {s}',(s*.34,.438,1.025),(.105,.069,.086))
    lens(f'Pupil indication {s}',(s*.328,.503,1.026),(.040,.008,.054),shadow)
# Seven broad irregular folds, arcing away from the mouth into the pouch rather than pumpkin fluting.
folds=[(-.90,.050,.13),(-.64,.040,.15),(-.34,.059,.16),(-.025,.035,.18),(.29,.052,.16),(.60,.043,.14),(.87,.054,.12)]
vs=[];fs=[];U=42;V=16
for j in range(V+1):
    t=j/V;z=.846-.60*t
    width=.19+.38*math.sin(PI*t)**.68
    if t>.80:width*=1-.38*(t-.8)/.2
    for i in range(U+1):
        u=-1+2*i/U;shift=.07*math.sin(t*PI)*math.sin(u*2.3)
        ridge=sum(h*gauss(u,c+shift,spread)for c,h,spread in folds)*math.sin(PI*t)**.8
        x=width*u;y=.45+(.38+.13*math.sin(PI*t)+ridge)*math.sqrt(max(0,1-u*u))
        vs.append((x,y,z+.012*math.sin(u*8+1)*math.sin(PI*t)))
for j in range(V):
    for i in range(U):
        q=j*(U+1)+i
        fs.extend([(q,q+1,q+U+2),(q,q+U+2,q+U+1)])
mesh('Seven organic throat pleats',vs,fs,smooth=False)
# Fin feet are continuous wide fleshy volumes from body into ground-splayed lobes.
def foot(s,rear=False):
    # center x/y/z, half spread across X, half depth normal Y.
    profile=[(0,s*.46,-.35 if rear else .22,.57,.10,.13),(.23,s*.53,-.39 if rear else .27,.43,.14,.14),(.52,s*.63,-.48 if rear else .40,.24,.21,.14),(.80,s*.72,-.60 if rear else .58,.10,.26,.13),(1,s*.74,-.66 if rear else .67,.055,.27,.09)]
    rr=[]
    for k in range(13):
        t=k/12;cx,cy,z,spread,depth=interp(profile,t);row=[]
        for i in range(24):
            ang=2*PI*i/24
            # A flattened footprint with 5 broad terminal fin rays. No skinny wrist break.
            scallop=.025*math.cos(5*ang)*t**5
            x=cx+spread*math.cos(ang);y=cy+depth*math.sin(ang)+scallop;zz=z+.065*math.sin(ang)*(1-.55*t)
            row.append((x,y,max(.025,zz)))
        rr.append(row)
    ob=rings(('Rear'if rear else'Front')+f' weight-bearing fin {s}',rr,smooth=True)
    for poly in ob.data.polygons:poly.flip()
    ob.data.update()
for s in [-1,1]:foot(s);foot(s,True)
# The tail is compact: one rear stalk joining a modest vertical fan; no disk/wheel.
rr=[]
for t in [0,.3,.65,1]:
    rr.append([(.10*(1-t*.6)*math.cos(2*PI*i/12),-.72-.30*t,.67+.09*(1-t*.6)*math.sin(2*PI*i/12))for i in range(12)])
rings('Short tail attachment',rr,smooth=True)
vs=[];fs=[]
for j in range(5):
    t=j/4
    for i in range(15):
        theta=-1.08+i/14*2.16
        vs.append((.035*math.cos(theta),-1.0-.20*t*math.cos(theta),.67+.23*t*math.sin(theta)))
for j in range(4):
    for i in range(14):q=j*15+i;fs.extend([(q,q+1,q+16),(q,q+16,q+15)])
mesh('Modest tail fan',vs,fs)
# All decorative plates, crown spines and paint deliberately absent pending silhouette review.
tri=0
for ob in objects:ob.data.calc_loop_triangles();tri+=len(ob.data.loop_triangles)
(out/'metrics.json').write_text(json.dumps({'status':'clay anatomy study; unaccepted','triangles':tri,'purpose':'matched-camera silhouette and base anatomy only'},indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out/'clay-anatomy.blend'))
if a.render:
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False
    scene.render.resolution_x=780;scene.render.resolution_y=960;scene.render.resolution_percentage=100;scene.world.color=(.17,.17,.17);scene.view_settings.view_transform='AgX'
    floor=bpy.data.materials.new('Floor');floor.diffuse_color=(.026,.04,.05,1)
    mesh('Ground',[(-100,-100,0),(100,-100,0),(100,100,0),(-100,100,0)],[(0,1,2,3)],floor)
    def light(name,xyz,power,size):
        d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=xyz;o.rotation_euler=(Vector((0,0,.7))-o.location).to_track_quat('-Z','Y').to_euler()
    light('Key',(-3,4,5),550,4);light('Fill',(4,1,3),280,4);light('Rim',(0,-4,4),500,3)
    cd=bpy.data.cameras.new('Matched reference camera');cam=bpy.data.objects.new('Matched reference camera',cd);bpy.context.collection.objects.link(cam);scene.camera=cam;cd.type='ORTHO';cd.ortho_scale=2.33
    # Reference shows a front three-quarter creature, face to image right, slight look-down.
    cam.location=(3.1,4.5,2.15);cam.rotation_euler=(Vector((0,-.04,.74))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/'matched-clay.png');bpy.ops.render.render(write_still=True)
