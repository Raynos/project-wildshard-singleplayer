"""Explicit orbital and fin topology correction after three failed studies. No plates, paint chips or runtime wiring.
Blender: -b -t 2 --python-exit-code 1 -P <this> -- --out tmp/approved-puffer-clay-v4 --render
"""
import argparse, json, math, sys
from pathlib import Path
import bpy, bmesh
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
                y-=.14*gauss(x,sign*.34,.15)*gauss(z,1.025,.095)*front
                # Heavy brow descends toward the beak, wrapping outer orbital edge.
                brow_z=1.10+.22*(abs(x)-.16)
                y+=.045*gauss(x,sign*.35,.24)*gauss(z,brow_z,.09)*front
                y+=.09*gauss(x,sign*.49,.13)*gauss(z,.96,.17)*front
            # The muzzle is part of the skull, projecting above a low wide real gape.
            y+=.18*gauss(x,0,.24)*gauss(z,.94,.12)*front
            # Jaw, pouch and torso share these very same vertices. Seven deep broad pleats
            # grow out of the lower cheek volume and fade into the chin instead of a separate pad.
            throat_mask=gauss(z,.565,.29)*front
            y+=.42*gauss(x,0,.48)*throat_mask
            for center,amplitude,spread in [(-.45,.13,.040),(-.30,.16,.047),(-.15,.13,.043),(.015,.17,.051),(.17,.14,.041),(.32,.15,.047),(.46,.12,.039)]:
                curved=center*(.78+.22*math.sin(PI*(z-.24)/.62))+.015*math.sin(z*9+center*12)
                y+=amplitude*gauss(x,curved,spread)*throat_mask
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
# The aperture rim is a solid annulus. The eyeball sits BEHIND its inner edge.
# Outer ring tapers into the skull; the upper quadrant is a genuine projecting overhang.
def skull_front(x,z):
    w,cy,dep=interp(BODY,max(.24,min(1.42,z)))
    return cy+dep*math.sqrt(max(.015,1-(x/max(w,.01))**2))
for sign in [-1,1]:
    cx=sign*.34;cz=1.025;n=32;rr=[]
    # Outer seam -> brow crest -> actual aperture -> recessed return -> buried outer seam.
    for level,(rx,rz) in enumerate([(.225,.18),(.178,.132),(.114,.067),(.116,.068),(.225,.18)]):
        row=[]
        for i in range(n):
            theta=2*PI*i/n;dx=rx*math.cos(theta);dz=rz*math.sin(theta)+sign*.23*dx
            x=cx+dx;z=cz+dz;upper=max(0,math.sin(theta))
            if level==0:y=skull_front(x,z)+.009
            elif level==1:y=.59+.115*upper**.5
            elif level==2:y=.60+.047*upper
            elif level==3:y=.415
            else:y=skull_front(x,z)-.095
            row.append((x,y,z))
        rr.append(row)
    vs=[v for row in rr for v in row];fs=[]
    for row in range(5):
        nxt=(row+1)%5
        for i in range(n):
            j=(i+1)%n;fs.extend([(row*n+i,row*n+j,nxt*n+j),(row*n+i,nxt*n+j,nxt*n+i)])
    rim=mesh(f'Continuous orbital rim {sign}',vs,fs,smooth=True)
    bm=bmesh.new();bm.from_mesh(rim.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(rim.data);bm.free()
    # Boolean union makes the orbital shell part of the same anatomical volume.
    bpy.context.view_layer.objects.active=body
    mod=body.modifiers.new('Integrated orbital overhang','BOOLEAN');mod.operation='UNION';mod.solver='EXACT';mod.object=rim
    bpy.ops.object.modifier_apply(modifier=mod.name)
    objects.remove(rim);bpy.data.objects.remove(rim,do_unlink=True)
    lens(f'Eye behind slanted lid {sign}',(sign*.34,.545,1.025),(.128,.068,.097))
    lens(f'Pupil behind aperture {sign}',(sign*.328,.609,1.026),(.043,.006,.055),shadow)
# Throat geometry is now continuous in the torso surface above; no separate jaw object.
# Fin feet are continuous wide fleshy volumes from body into ground-splayed lobes.
def foot(sign,rear=False):
    root=Vector((sign*.46,-.37 if rear else .20,.49))
    wrist=Vector((sign*.63,-.48 if rear else .38,.19))
    # Full fan spreads both inward and outward from the wrist, with five distinct weight-bearing rays.
    tips=[]
    for k in range(5):
        u=-1+2*k/4
        tips.append(Vector((sign*(.67+u*.26),(-.75 if rear else .78)+.07*math.sin(PI*k/4),.045)))
    vs=[];fs=[];steps=9;across=25
    for lower in [False,True]:
        for j in range(steps):
            t=j/(steps-1)
            for i in range(across):
                u=i/(across-1);v=u*4;ray=min(3,int(v));f=v-ray
                end=tips[ray].lerp(tips[ray+1],f)
                center=root.lerp(wrist,min(1,t*2.3)).lerp(end,t**1.5)
                # Each lobe stands proud of its membrane; grooves terminate before the wrist.
                raised=.035*(.5+.5*math.cos(v*2*PI))**2*math.sin(PI*t)**.5
                center.z+=(.045+raised)*math.sin(PI*t) if not lower else -.025*math.sin(PI*t)
                center.y+=(-.022 if rear else .022)*(math.cos(v*2*PI))*t**5
                vs.append(tuple(center))
    layer=steps*across
    for side in range(2):
        offset=side*layer
        for j in range(steps-1):
            for i in range(across-1):
                q=offset+j*across+i;faces=[(q,q+1,q+across+1),(q,q+across+1,q+across)]
                for face in faces:fs.append(face if (sign>0)==(side==0) else tuple(reversed(face)))
    for j in range(steps-1):
        for i in [0,across-1]:
            q=j*across+i;fs.extend([(q,q+across,q+across+layer),(q,q+across+layer,q+layer)])
    for i in range(across-1):
        q=(steps-1)*across+i;fs.extend([(q,q+1,q+1+layer),(q,q+1+layer,q+layer)])
    mesh(('Rear'if rear else'Front')+f' articulated fan fin {sign}',vs,fs,smooth=True)
for sign in [-1,1]:foot(sign);foot(sign,True)
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
(out/'metrics.json').write_text(json.dumps({'status':'clay v4 explicit orbital topology; unaccepted','triangles':tri,'purpose':'matched-camera silhouette and base anatomy only'},indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out/'clay-anatomy.blend'))
if a.render:
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False
    scene.render.resolution_x=780;scene.render.resolution_y=960;scene.render.resolution_percentage=100;scene.world.color=(.17,.17,.17);scene.view_settings.view_transform='AgX'
    floor=bpy.data.materials.new('Floor');floor.diffuse_color=(.026,.04,.05,1)
    mesh('Ground',[(-100,-100,0),(100,-100,0),(100,100,0),(-100,100,0)],[(0,1,2,3)],floor)
    def light(name,xyz,power,size):
        d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=xyz;o.rotation_euler=(Vector((0,0,.7))-o.location).to_track_quat('-Z','Y').to_euler()
    light('Key',(-3,4,5),550,4);light('Fill',(4,1,3),280,4);light('Rim',(0,-4,4),500,3)
    cd=bpy.data.cameras.new('Matched reference camera');cam=bpy.data.objects.new('Matched reference camera',cd);bpy.context.collection.objects.link(cam);scene.camera=cam;cd.type='ORTHO';cd.ortho_scale=3.1
    # Reference shows a front three-quarter creature, face to image right, slight look-down.
    cam.location=(3.0,4.7,2.05);cam.rotation_euler=(Vector((0,-.04,.74))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/'matched-clay.png');bpy.ops.render.render(write_still=True)
