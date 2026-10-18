"""Owner-approved low-poly identity, unaccepted model study. Blender 4.3.2.
Front is -Y. Reproducible, texture-free, real volumes; no production replacement.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--out', default='tmp/lowpoly-colossus');p.add_argument('--render',action='store_true');p.add_argument('--views',default='three-quarter');a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def linear(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
palette={'wood':'997044','lightwood':'C9975D','cut':'E0B47A','darkwood':'634B33','stone':'666D73','stoneLight':'90948F','leaf':'739721','leafLight':'ABC52E','leafDark':'426B27','heart':'16D9D2','heartLight':'65F3E3','eye':'39EEE4','socket':'26352F'}
mats={}
for name,h in palette.items():
    m=bpy.data.materials.new(name);m.use_nodes=True;s=m.node_tree.nodes['Principled BSDF'];rgb=tuple(linear(int(h[i:i+2],16)/255) for i in (0,2,4));s.inputs['Base Color'].default_value=(*rgb,1);s.inputs['Roughness'].default_value=.88
    if name in ('heart','heartLight','eye'):s.inputs['Emission Color'].default_value=(*rgb,1);s.inputs['Emission Strength'].default_value=.18
    mats[name]=m
parts=[]
def mesh(name,vs,fs,colors):
    d=bpy.data.meshes.new(name);d.from_pydata(vs,[],fs);d.update();bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free();ob=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(ob)
    for c in dict.fromkeys(colors):d.materials.append(mats[c])
    slots={m.name:i for i,m in enumerate(d.materials)}
    for i,f in enumerate(d.polygons):f.material_index=slots[colors[i%len(colors)]];f.use_smooth=False
    parts.append(ob);return ob

def root(name,sections,colors=('wood','lightwood','wood','darkwood','wood','cut')):
    # Authored bent broad six-sided cross sections, not cylinders or skin noise.
    vs=[];n=6
    for x,y,z,w,d in sections:
        for i in range(n):
            t=2*math.pi*i/n+math.pi/6;vs.append((x+w*math.cos(t),y+d*math.sin(t),z))
    fs=[tuple(reversed(range(n)))]
    for k in range(len(sections)-1):
        for i in range(n):fs.append((k*n+i,k*n+(i+1)%n,(k+1)*n+(i+1)%n,(k+1)*n+i))
    fs.append(tuple((len(sections)-1)*n+i for i in range(n)));return mesh(name,vs,fs,colors)

def rock(name,pos,scale,colors=('stone','stoneLight','stone')):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=pos);ob=bpy.context.object;ob.name=name
    for v in ob.data.vertices:v.co.x*=scale[0];v.co.y*=scale[1];v.co.z*=scale[2]
    for c in dict.fromkeys(colors):ob.data.materials.append(mats[c])
    for f in ob.data.polygons:f.material_index=f.index%len(ob.data.materials)
    parts.append(ob);return ob

def leaf(name,start,tip,width,color='leaf'):
    s,t=Vector(start),Vector(tip);v=t-s;side=v.cross(Vector((0,0,1))).normalized()*width
    mid=s+v*.42;ridge=mid+Vector((0,-.07,.10));back=mid+Vector((0,.055,-.04));vs=[s,mid+side,t,mid-side,ridge,back]
    return mesh(name,[tuple(v) for v in vs],[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(1,0,5),(2,1,5),(3,2,5),(0,3,5)],[color,'leafLight',color,'leafDark'])
def foliage(name,c,scale=1):
    x,y,z=c
    for i,(dx,dy,dz) in enumerate([(-.55,-.1,-.25),(-.15,-.5,-.45),(.37,-.4,-.35),(.5,.12,-.15),(0,.3,.1)]):leaf(name+str(i),c,(x+dx*scale,y+dy*scale,z+dz*scale),.20*scale)

# Chest is a genuine open frame, with two deep side buttresses and no front billboard.
root('Pelvic root keel',[(0,.05,1.55,.12,.17),(0,.08,2.05,.48,.35),(0,.13,2.55,.39,.30)])
root('Rear trunk spine',[(0,.32,2.35,.25,.21),(0,.44,3.05,.37,.22),(0,.30,3.8,.47,.26),(0,.13,4.12,.32,.24)],('darkwood','wood'))
for side in (-1,1):
    s=side
    root(f'Chest side {s}',[(s*.18,.05,2.25,.15,.20),(s*.64,.04,2.70,.28,.33),(s*.83,.06,3.35,.29,.37),(s*.67,.06,3.90,.39,.38),(s*.28,.02,4.12,.27,.25)])
    root(f'Heart frame {s}',[(s*.08,-.33,2.42,.10,.12),(s*.50,-.44,2.71,.17,.18),(s*.69,-.43,3.18,.17,.19),(s*.48,-.40,3.62,.19,.20)],('lightwood','wood','cut','wood'))
    root(f'Upper rib {s}',[(s*.18,-.50,3.46,.05,.07),(s*.57,-.50,3.51,.22,.16),(s*.75,-.35,3.69,.20,.19)],('lightwood','cut','wood'))
    root(f'Lower rib {s}',[(s*.20,-.51,2.64,.055,.08),(s*.57,-.50,2.88,.19,.14),(s*.70,-.35,3.10,.17,.18)],('wood','lightwood'))
    # Bowed load-bearing legs, asymmetric front root straps and integrated boulder feet.
    root(f'Thigh {s}',[(s*.86,.03,1.10,.32,.31),(s*.74,.10,1.59,.34,.32),(s*.38,.10,2.12,.31,.29)])
    rock(f'Knee stone {s}',(s*.88,.02,1.18),(.35,.32,.40))
    root(f'Shin {s}',[(s*1.08,-.05,.27,.40,.36),(s*.91,.12,.82,.30,.29),(s*.87,.08,1.22,.29,.30)])
    root(f'Shin front strap {s}',[(s*1.30,-.40,.14,.10,.12),(s*1.02,-.40,.49,.20,.17),(s*.86,-.23,.95,.20,.18)],('lightwood','cut','wood'))
    for j,(dx,dy,sc) in enumerate([(-.26,-.21,.35),(.12,-.40,.38),(.39,-.06,.28),(-.04,.26,.31)]):rock(f'Foot boulder {s} {j}',(s*(1.03+dx),dy,.20),(sc,.39,.29))
    root(f'Shoulder {s}',[(s*.71,.03,3.77,.37,.36),(s*1.17,.06,3.91,.47,.40),(s*1.47,.02,3.64,.34,.35)])
    root(f'Upper arm {s}',[(s*1.78,.04,2.69,.29,.29),(s*1.66,.08,3.20,.32,.32),(s*1.30,.04,3.79,.36,.34)])
    rock(f'Elbow {s}',(s*1.78,.05,2.74),(.30,.31,.31),('darkwood','wood'))
    root(f'Forearm {s}',[(s*1.96,-.17,1.96,.32,.29),(s*1.98,-.06,2.35,.38,.35),(s*1.77,.04,2.81,.28,.29)],('lightwood','wood','cut','wood'))
    # Four independent curved fingers and a side thumb enclose real grip gaps.
    root(f'Palm {s}',[(s*2.02,-.18,1.44,.36,.24),(s*2.03,-.16,1.87,.43,.29),(s*1.96,-.15,2.18,.29,.25)],('wood','lightwood','wood','cut'))
    for j in range(3):
        x=s*(1.77+j*.25);y=-.20+(j%2)*.055;z=1.58-abs(j-1)*.08
        root(f'Finger {s} {j}',[(x-s*.09,y-.26,.94+abs(j-1)*.10,.075,.10),(x+s*.08,y-.15,1.13+abs(j-1)*.08,.115,.13),(x+s*.14,y,z,.14,.15)],('wood','lightwood','cut','wood'))
    root(f'Thumb {s}',[(s*1.65,-.55,1.17,.07,.09),(s*1.47,-.54,1.44,.13,.14),(s*1.66,-.25,1.87,.20,.17)],('lightwood','cut','wood'))
    foliage(f'Shoulder leaves {s}',(s*1.19,-.12,4.12),1.1)
    foliage(f'Elbow leaves {s}',(s*1.87,-.16,2.94),.70)
    foliage(f'Knee leaves {s}',(s*.77,-.18,1.62),.60)
    foliage(f'Ankle leaves {s}',(s*1.02,-.13,.60),.52)

# Turquoise heart hangs within the root cage with air around both sides.
rock('Faceted turquoise heart',(0,-.39,3.15),(.43,.38,.62),('heart','heartLight','heart'))
# Wedge-shaped face: cheek wedges, beak and dark inset eye sockets.
root('Head trunk',[(0,.02,3.83,.27,.24),(0,-.02,4.24,.48,.33),(0,.02,4.56,.38,.28)],('wood','lightwood'))
mesh('Central face wedge',[(-.20,-.35,4.36),(.20,-.35,4.36),(.13,-.49,3.96),(0,-.66,3.86),(-.13,-.49,3.96),(0,-.59,4.24),(0,.03,4.29)],[(0,1,5),(1,2,5),(2,3,5),(3,4,5),(4,0,5),(0,6,1),(1,6,2),(2,6,3),(3,6,4),(4,6,0)],['cut','lightwood','wood'])
for s in (-1,1):
    mesh(f'Brow cheek {s}',[(s*.04,-.54,4.23),(s*.48,-.28,4.54),(s*.50,-.30,4.25),(s*.26,-.49,4.10),(s*.18,-.39,3.94),(s*.41,-.20,4.14),(s*.23,.02,4.43)],[(0,1,2),(0,2,3),(3,2,5),(3,5,4),(0,3,4),(0,4,6),(0,6,1),(1,6,5,2),(4,5,6)],['cut','lightwood','wood'])
    mesh(f'Eye socket {s}',[(s*.09,-.555,4.25),(s*.37,-.391,4.37),(s*.29,-.465,4.15)],[(0,1,2)],['socket'])
    mesh(f'Turquoise eye {s}',[(s*.14,-.562,4.25),(s*.30,-.443,4.31),(s*.27,-.477,4.20)],[(0,1,2)],['eye'])
    root(f'Crown main {s}',[(s*.28,.01,4.40,.29,.25),(s*.65,.03,4.80,.25,.21),(s*.86,.05,5.18,.19,.17),(s*.80,.03,5.63,.13,.12),(s*.87,.02,5.89,.07,.075)],('lightwood','cut','wood'))
    root(f'Crown outer {s}',[(s*.58,.03,4.74,.18,.17),(s*1.12,.05,4.91,.16,.14),(s*1.41,.08,5.19,.09,.095),(s*1.47,.08,5.41,.055,.06)],('lightwood','cut','wood'))
    root(f'Crown fork {s}',[(s*.85,.05,5.23,.13,.11),(s*1.12,.07,5.45,.10,.09),(s*1.12,.07,5.70,.045,.05)],('lightwood','cut'))
foliage('Back crown leaves',(.28,.30,4.35),.8)
foliage('Back left mantle',(-.8,.36,3.99),.9)
foliage('Back right mantle',(.8,.36,3.99),.9)
# Named articulated transforms are retained for later rigging, no untested animation claims.
for ob in parts:ob['asset']='tide-root-colossus-lowpoly';ob['status']='unaccepted-study'
bpy.ops.object.select_all(action='DESELECT')
for ob in parts:ob.select_set(True)
bpy.context.view_layer.objects.active=parts[0]
bpy.ops.export_scene.gltf(filepath=str(out/'tide-root-colossus-wip.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in parts)
(out/'metrics.json').write_text(json.dumps({'status':'unaccepted study','objects':len(parts),'triangles':triangles,'height':5.89,'front':'-Y','glbBytes':(out/'tide-root-colossus-wip.glb').stat().st_size,'rendered':a.render},indent=2)+'\n')
if a.render:
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False
    scene.render.resolution_x=900;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
    scene.world.color=(.12,.12,.12);scene.view_settings.view_transform='Standard'
    # Neutral presentation floor, never included in GLB.
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.08));floor=bpy.context.object;m=bpy.data.materials.new('Review floor');m.diffuse_color=(.025,.04,.055,1);floor.data.materials.append(m)
    def aim(ob,point):ob.rotation_euler=(Vector(point)-ob.location).to_track_quat('-Z','Y').to_euler()
    for name,loc,energy,size in [('Key',(-4,-6,9),1500,5),('Fill',(5,-3,5),850,4),('Rim',(0,4,7),1800,3)]:
        bpy.ops.object.light_add(type='AREA',location=loc);ob=bpy.context.object;ob.name=name;ob.data.energy=energy;ob.data.shape='DISK';ob.data.size=size;aim(ob,(0,0,3))
    bpy.ops.object.camera_add(location=(7,-15,8));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=7.25;aim(cam,(0,0,2.95));scene.camera=cam
    for name,loc in [('front',(0,-16,6.6)),('three-quarter',(7,-15,7.4)),('back',(-7,15,7.4))]:
        if name not in a.views.split(','):continue
        cam.location=loc;aim(cam,(0,0,2.95));scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
