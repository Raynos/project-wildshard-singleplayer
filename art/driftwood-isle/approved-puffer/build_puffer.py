"""Editable anatomical mesh study. Blender 4.3+, no external assets or addons.
blender -b -t 2 --python build_puffer.py -- --out tmp/approved-puffer --render
Coordinates: X right, Y forward, Z up. Native export converts to game Y-up/Z-forward.
"""
import argparse, json, math, random, sys
from pathlib import Path
import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
p = argparse.ArgumentParser(); p.add_argument('--out', required=True); p.add_argument('--render', action='store_true'); p.add_argument('--samples', type=int, default=24)
opt = p.parse_args(args); OUT = Path(opt.out).resolve(); OUT.mkdir(parents=True, exist_ok=True)
random.seed(487)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
PI = math.pi
COL = {'teal': (.13, .36, .35), 'teal_hi': (.21,.45,.41), 'teal_dark': (.055,.19,.20),
       'ochre': (.82,.39,.07), 'gold': (1,.62,.15), 'cream': (.87,.73,.49), 'ivory': (1,.89,.65),
       'coral': (.66,.22,.12), 'mouth': (.065,.018,.009), 'iris': (.94,.39,.015), 'black': (.006,.012,.012)}
def linear(c): return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
mat = bpy.data.materials.new('Hand-painted reef armor'); mat.use_nodes = True
nodes=mat.node_tree.nodes; shader=nodes.get('Principled BSDF'); shader.inputs['Roughness'].default_value=.78
attr=nodes.new('ShaderNodeVertexColor'); attr.layer_name='Col'; mat.node_tree.links.new(attr.outputs['Color'], shader.inputs['Base Color'])
mesh_objects=[]; records=[]
def mesh(name, verts, faces, color, joint='belly', variation=.08, colors=None):
    data=bpy.data.meshes.new(name); data.from_pydata(verts, [], faces); data.update()
    obj=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(obj); data.materials.append(mat)
    paint=data.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='CORNER')
    base=COL[color] if isinstance(color,str) else color
    for i,face in enumerate(data.polygons):
        rgb=colors[i] if colors is not None else base
        factor=1+random.uniform(-variation,variation)
        rgba=tuple(linear(max(0,min(1,c*factor))) for c in rgb)+(1,)
        for li in face.loop_indices: paint.data[li].color=rgba
    group=obj.vertex_groups.new(name=joint); group.add(list(range(len(verts))),1,'REPLACE')
    mesh_objects.append(obj); records.append((obj,joint)); return obj

def ring_surface(name,rings,color,joint='belly',variation=.06,colors=None):
    n=len(rings[0]); verts=[q for row in rings for q in row]; faces=[]
    for j in range(len(rings)-1):
        for i in range(n):
            a=j*n+i;b=j*n+(i+1)%n;c=(j+1)*n+(i+1)%n;d=(j+1)*n+i
            if (i+j)%2: faces.extend([(a,b,d),(b,c,d)])
            else: faces.extend([(a,b,c),(a,c,d)])
    faces.extend([tuple(range(n-1,-1,-1)),tuple((len(rings)-1)*n+i for i in range(n))])
    return mesh(name,verts,faces,color,joint,variation,colors)

# Authored cross-sections: narrow tail attachment, heavy shoulders, sloped compressed muzzle.
SECTIONS=[(-.79,.10,.62,.14),(-.68,.32,.71,.32),(-.49,.51,.78,.48),(-.24,.62,.80,.56),(0,.65,.77,.57),(.23,.61,.75,.52),(.44,.53,.76,.43),(.63,.41,.79,.32),(.76,.25,.78,.22)]
def section(y):
    for a,b in zip(SECTIONS,SECTIONS[1:]):
        if a[0]<=y<=b[0]:
            t=(y-a[0])/(b[0]-a[0]);return tuple(a[k]*(1-t)+b[k]*t for k in range(1,4))
    return SECTIONS[0][1:] if y<SECTIONS[0][0] else SECTIONS[-1][1:]
def skin(y,a,offset=0):
    w,z,h=section(y);return Vector(((w+offset)*math.sin(a),y,z+(h+offset)*math.cos(a)))
rings=[]
for y,w,z,h in SECTIONS:
    rings.append([(w*math.sin(2*PI*i/32),y,z+h*math.cos(2*PI*i/32)) for i in range(32)])
ring_surface('Continuous cranial torso',rings,'teal_dark')

# Each shingle is a convex curved pentagonal patch that follows the underlying anatomy.
# A thick leading ridge and scalloped taper establish ordered overlaps instead of floating scales.
def armor_patch(name,y,a,length,width,seed):
    rng=random.Random(seed); verts=[]
    # rows back to front; widest shoulder tapers into the overlapping nose.
    for v in range(5):
        t=v/4; yy=y+(t-.5)*length; ww=width*(.35+.65*math.sin(PI*(.12+.79*t)))
        for u in range(5):
            q=(u-2)/2; aa=a+q*ww
            h=.018+.052*math.sin(PI*t)**.65*(1-q*q)+.015*(1-t)
            pt=skin(yy,aa,h);pt.y += .014*math.sin(q*4+seed)
            verts.append(tuple(pt))
    faces=[]; colors=[]
    for v in range(4):
        for u in range(4):
            a0=v*5+u; b=a0+1;c=a0+6;d=a0+5
            for f in ((a0,b,c),(a0,c,d)):
                faces.append(f)
                edge=v==3 or u in (0,3)
                ochre=edge and rng.random()<.17
                base=COL['ochre'] if ochre else COL['teal_hi' if rng.random()<.3 else 'teal']
                colors.append(tuple(c*rng.uniform(.92,1.07) for c in base))
    return mesh(name,verts,faces,'teal',colors=colors,variation=.04)
for row,y in enumerate([-.61,-.43,-.24,-.04,.16,.34,.51,.65]):
    count=9 if row<6 else 7
    for col in range(count):
        a=(col-(count-1)/2)*.33+(.13 if row%2 else 0)
        if row>=6 and abs(a)>.8:continue
        armor_patch(f'Dorsal shingle {row:02}_{col:02}',y,a,.31 if row<6 else .25,.22,100+row*17+col)
# Lower lateral plates curve around cheeks into the throat boundary.
for sign in [-1,1]:
    for row,y in enumerate([-.43,-.20,.03,.24,.43]):
        for a in [1.55,1.88,2.12]: armor_patch(f'Flank {sign} {row} {a}',y,a*sign,.29,.22,300+row*10+int(a*10))

# Sculpted tapered horns: bent centerline, blade-like asymmetric cross section, no cone operator.
def horn(name,base,tip,radius,joint='belly'):
    base=Vector(base);tip=Vector(tip); direction=(tip-base).normalized(); across=direction.cross(Vector((0,1,0)))
    if across.length<.1:across=direction.cross(Vector((1,0,0)))
    across.normalize(); other=direction.cross(across).normalized();rings=[]
    for t,scale in [(0,1),(.22,.78),(.58,.43),(.88,.13),(1,.005)]:
        center=base.lerp(tip,t)+Vector((0,-.05*math.sin(t*PI),.015*math.sin(t*PI)))
        rings.append([tuple(center+radius*scale*(math.cos(i*2*PI/5)*across+math.sin(i*2*PI/5)*other*.72)) for i in range(5)])
    ring_surface(name,rings,'ivory',joint,.14)
for row,(y,length) in enumerate([(-.60,.23),(-.36,.34),(-.08,.29),(.20,.24)]):
    for a in [-.81,0,.81]:
        base=skin(y,a,.055);tip=base+Vector((math.sin(a)*length*.6,-length*.30,length*(.78+.2*math.cos(a))))
        horn(f'Crown spine {row} {a}',base,tip,.085 if a==0 else .071)
for sign in [-1,1]:
    for y,a,length in [(-.52,1.4,.19),(-.28,1.6,.18),(-.01,1.6,.15),(.24,1.5,.14),(-.50,2.0,.13)]:
        base=skin(y,sign*a,.04);horn(f'Flank spine {sign} {y}',base,base+Vector((sign*length,-.05,.10)),.057)

# Throat pouch is a continuous folded surface, intentionally much larger than the face.
verts=[]; faces=[]; colors=[]; N=64; M=18
for j in range(M+1):
    v=j/M; width=.075+.50*math.sin(PI*v)**.7
    z=1.00-.80*v; bulge=.17+.34*math.sin(PI*v)**.6
    for i in range(N+1):
        u=-1+2*i/N
        fold=(.5+.5*math.cos(u*PI*9+v*.8))**2
        ridge=.038*fold*math.sin(PI*v)**.6
        verts.append((width*u,.58+(bulge+ridge)*math.sqrt(max(0,1-u*u)),z+.018*fold*math.sin(PI*v)))
for j in range(M):
    for i in range(N):
        a=j*(N+1)+i;b=a+1;c=a+N+2;d=a+N+1
        for face in [(a,b,c),(a,c,d)]:
            faces.append(face)
            fold=(.5+.5*math.cos((-1+2*(i+.5)/N)*PI*9+j/M*.8))**2
            shade=.77+.23*fold
            colors.append(tuple(c*shade for c in COL['ivory']))
mesh('Organic pleated throat',verts,faces,'ivory',colors=colors,variation=.025)

# Curved tubes follow drawn brow/cheek/lip paths; asymmetric cross sections create fleshy planes.
def tube(name,points,radii,color,joint='head',sides=7):
    rings=[]
    for idx,pt in enumerate(points):
        pt=Vector(pt);tangent=Vector(points[min(idx+1,len(points)-1)])-Vector(points[max(idx-1,0)])
        tangent.normalize();a=tangent.cross(Vector((0,1,0)))
        if a.length<.1:a=tangent.cross(Vector((0,0,1)))
        a.normalize();b=tangent.cross(a).normalized()
        r=radii[idx];rx,ry=(r,r) if isinstance(r,(int,float)) else r
        rings.append([tuple(pt+rx*math.cos(i*2*PI/sides)*a+ry*math.sin(i*2*PI/sides)*b) for i in range(sides)])
    return ring_surface(name,rings,color,joint,.07)

# Eyeballs seated in fleshy sockets and mostly occluded by a downward angry brow.
def eye_surface(name,center,rx,rz,depth,color,joint='head',rings=7,sides=24):
    cx,cy,cz=center;rows=[]
    for j in range(rings+1):
        t=j/rings*PI
        rows.append([(cx+rx*math.sin(t)*math.cos(i*2*PI/sides),cy+depth*math.cos(t),cz+rz*math.sin(t)*math.sin(i*2*PI/sides)) for i in range(sides)])
    return ring_surface(name,rows,color,joint,.025)
for s in [-1,1]:
    eye_surface(f'Coral orbital bed {s}',(s*.38,.697,1.005),.205,.161,.125,'coral',rings=5,sides=14)
    eye_surface(f'Deep socket {s}',(s*.38,.785,1.015),.153,.120,.058,'teal_dark',rings=5,sides=18)
    eye_surface(f'Amber eye {s}',(s*.38,.821,1.018),.115,.100,.047,'iris',rings=7,sides=24)
    eye_surface(f'Black pupil {s}',(s*.365,.862,1.022),.046,.063,.012,'black',rings=5,sides=18)
    eye_surface(f'Eye catchlight {s}',(s*.35,.875,1.056),.012,.019,.003,'ivory',rings=3,sides=10)
    tube(f'Heavy ochre brow {s}',[(s*.16,.79,1.095),(s*.28,.85,1.128),(s*.43,.83,1.166),(s*.56,.72,1.15)], [.045,(.065,.080),(.077,.088),.025],'ochre')
    tube(f'Lower orbital rim {s}',[(s*.20,.78,1.02),(s*.28,.82,.93),(s*.43,.78,.906),(s*.53,.68,.975)],[.025,.035,.046,.025],'cream')
    tube(f'Carved cheek {s}',[(s*.13,.87,.92),(s*.31,.86,.85),(s*.48,.73,.78),(s*.54,.54,.59)], [.028,.053,.06,.025],'ochre')
    # Ivory fold lips converge into a tall triangular hooked beak.
    tube(f'Upper beak {s}',[(s*.005,1.00,1.045),(s*.10,1.025,.98),(s*.175,1.02,.88),(s*.20,.99,.79)], [.026,.042,.045,.025],'ivory')
    tube(f'Lower lip {s}',[(s*.20,.99,.79),(s*.11,1.045,.77),(0,1.052,.765)],[.030,.038,.032],'cream')
# Mouth cavity has geometry, with inset palate and tongue; never a painted black triangle.
mesh('Recessed open gape',[(-.18,.992,.795),(-.12,1.001,.925),(0,1.005,1.015),(.12,1.001,.925),(.18,.992,.795),(0,.85,.86)],[(0,1,5),(1,2,5),(2,3,5),(3,4,5),(4,0,5)],'mouth','head',.02)
tube('Small inner lower palate',[(-.10,.995,.80),(0,1.01,.813),(.10,.995,.80)],[.018,.024,.018],'coral')

# Four broad fins: jointed stalk to five finger rays, a continuous scalloped membrane.
def fin(sign,rear=False):
    joint=('rearL' if sign>0 else 'rearR') if rear else ('finL' if sign>0 else 'finR')
    root=Vector((sign*(.42 if rear else .50),-.41 if rear else .16,.48 if rear else .53))
    wrist=Vector((sign*(.59 if rear else .62),-.48 if rear else .30,.24))
    tube(f'{joint} articulated upper', [root,root.lerp(wrist,.55),wrist],[.12,.14,.13],'teal',joint)
    width=.22 if rear else .29; forward=-.25 if rear else .48
    # Span rays across a fan, each with a slightly different toe length.
    tips=[]
    for k in range(6):
        u=-1+2*k/5
        tips.append(Vector((wrist.x+sign*(.12+width*(u+1)/2),wrist.y+forward*(.65+.35*math.sin(PI*(k+.4)/6)),.045+.025*abs(u))))
    verts=[];faces=[];colors=[]
    for j in range(7):
        t=j/6
        for k,tip in enumerate(tips):
            v=wrist.lerp(tip,t);v.z+=.07*math.sin(PI*t)
            verts.append(tuple(v))
    for j in range(6):
        for k in range(5):
            a=j*6+k;b=a+1;c=a+7;d=a+6
            for f in [(a,b,c),(a,c,d)]:
                faces.append(f if sign>0 else tuple(reversed(f)));colors.append(COL['ivory' if j==5 else 'ochre' if j==4 or (k in (0,4) and j>1) else 'teal_hi' if (j+k)%3 else 'teal'])
    mesh(f'{joint} broad web',verts,faces,'teal',joint,colors=colors)
    for k,tip in enumerate(tips):
        tube(f'{joint} ray {k}',[wrist,wrist.lerp(tip,.53)+Vector((0,0,.07)),tip],[.023,.026,.008],'ochre' if k in (0,5) else 'teal_hi',joint,sides=5)
        horn(f'{joint} ivory toe {k}',tip,tip+Vector((sign*.035,forward*.13,-.012)),.028,joint)
for s in [-1,1]:fin(s);fin(s,True)

# Tail peduncle and upright fan, visible as one small scalloped accent from the back/side.
tube('Tail peduncle',[(0,-.62,.66),(0,-.86,.67),(0,-1.02,.69)],[.19,.13,.105],'teal','tail')
verts=[];faces=[];colors=[]
for j in range(5):
    t=j/4
    for i in range(13):
        a=-1.28+i/12*2.56
        verts.append((.06*math.cos(a),-1.00-.36*t*math.cos(a),.69+.36*t*math.sin(a)))
for j in range(4):
    for i in range(12):
        a=j*13+i;b=a+1;c=a+14;d=a+13
        faces.extend([(a,b,c),(a,c,d)]);colors.extend([COL['ochre' if j==3 else 'teal_hi']]*2)
mesh('Scalloped tail fan',verts,faces,'teal','tail',colors=colors)
for i in range(7):
    a=-1.28+i/6*2.56;end=(.06*math.cos(a),-1-.36*math.cos(a),.69+.36*math.sin(a))
    tube(f'Tail ray {i}',[(0,-1,.69),end],[.018,.01],'ochre','tail',sides=5)

# Rig is intentionally exportable. Rest coordinates are explicit rather than borrowed V1 pivots.
REST={'body':(None,(0,0,.70)), 'belly':('body',(0,0,.70)), 'head':('body',(0,.51,.93)), 'tail':('body',(0,-.70,.67)), 'finL':('body',(.50,.16,.53)), 'finR':('body',(-.50,.16,.53)), 'rearL':('body',(.42,-.41,.48)), 'rearR':('body',(-.42,-.41,.48))}
armdata=bpy.data.armatures.new('Brine Puffer anatomical rig');arm=bpy.data.objects.new('Brine Puffer rig',armdata);bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active=arm;arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name,(parent,head) in REST.items():
    bone=armdata.edit_bones.new(name);bone.head=head;bone.tail=Vector(head)+Vector((0,0,.12))
    if parent:bone.parent=armdata.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');arm.select_set(False)
for obj,joint in records:
    mod=obj.modifiers.new('Anatomical skin','ARMATURE');mod.object=arm;obj.parent=arm
# Deterministic source geometry payload: no glTF reimport is required by native integration.
native={'schema':'wildshard.approved-puffer.mesh.v1','status':'unreviewed study','coordinates':'x-right y-up z-forward','bones':[], 'parts':[]}
for name,(parent,pos) in REST.items():native['bones'].append({'name':name,'parent':parent,'pos':[pos[0],pos[2],pos[1]]})
triangles=0
for obj,joint in records:
    d=obj.data;d.calc_loop_triangles();positions=[];colors=[]
    for tri in d.loop_triangles:
        # Axis conversion is a reflection, so reverse winding.
        for li in reversed(tri.loops):
            v=d.vertices[d.loops[li].vertex_index].co;positions.extend([round(v.x,6),round(v.z,6),round(v.y,6)])
            colors.extend(round(c,5) for c in d.color_attributes['Col'].data[li].color[:3])
    triangles+=len(d.loop_triangles)
    native['parts'].append({'name':obj.name,'joint':joint,'positions':positions,'colorsLinear':colors})
(OUT/'brine-puffer.mesh.json').write_text(json.dumps(native,separators=(',',':')))
# Join parts for compact draw topology while retaining vertex paint and weight groups.
bpy.ops.object.select_all(action='DESELECT')
for obj in mesh_objects:obj.select_set(True)
bpy.context.view_layer.objects.active=mesh_objects[0];bpy.ops.object.join(); creature=bpy.context.object;creature.name='Brine Puffer painted skin'
# Preview-only clips demonstrate actual rig motion and do not substitute for arena pose acceptance.
for clip in ['idle','walk','inflate','hit','die']:
    arm.animation_data_create();act=bpy.data.actions.new(clip);arm.animation_data.action=act
    for frame in [1,13,25]:
        for bone in arm.pose.bones:bone.rotation_mode='XYZ';bone.rotation_euler=(0,0,0);bone.scale=(1,1,1);bone.location=(0,0,0)
        t=(frame-1)/24
        if clip=='idle':arm.pose.bones['tail'].rotation_euler.z=.15*math.sin(t*2*PI)
        if clip=='walk':
            for s,j in [(1,'finL'),(-1,'finR'),(-1,'rearL'),(1,'rearR')]:arm.pose.bones[j].rotation_euler.x=s*.25*math.sin(t*2*PI)
        if clip=='inflate':arm.pose.bones['belly'].scale=(1+.17*math.sin(PI*t),)*3
        if clip=='hit':arm.pose.bones['head'].rotation_euler.x=.16*math.sin(PI*t)
        if clip=='die':arm.pose.bones['body'].rotation_euler.y=1.2*t
        for bone in arm.pose.bones:
            bone.keyframe_insert('rotation_euler',frame=frame);bone.keyframe_insert('scale',frame=frame);bone.keyframe_insert('location',frame=frame)
    track=arm.animation_data.nla_tracks.new();track.name=clip;strip=track.strips.new(clip,1,act);track.mute=True
arm.animation_data.action=None
for bone in arm.pose.bones:bone.rotation_euler=(0,0,0);bone.scale=(1,1,1);bone.location=(0,0,0)
bpy.context.scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');creature.select_set(True);arm.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'brine-puffer-study.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_materials='EXPORT',export_extras=True)
summary={'triangles':triangles,'bones':len(REST),'glbBytes':(OUT/'brine-puffer-study.glb').stat().st_size,'meshJsonBytes':(OUT/'brine-puffer.mesh.json').stat().st_size,'status':'unreviewed; not wired into game','blender':bpy.app.version_string}
(OUT/'metrics.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary))

if opt.render:
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=opt.samples;scene.cycles.use_denoising=False
    scene.render.resolution_x=780;scene.render.resolution_y=960;scene.render.resolution_percentage=100
    scene.world.color=(.17,.17,.17);scene.view_settings.view_transform='AgX'
    floor=bpy.data.materials.new('Studio slate');floor.diffuse_color=(.024,.043,.060,1)
    mesh('Studio floor',[(-200,-200,-.018),(200,-200,-.018),(200,200,-.018),(-200,200,-.018)],[(0,1,2,3)],(.05,.09,.12),'body',0).data.materials.clear()
    bpy.context.collection.objects.get('Studio floor').data.materials.append(floor)
    def light(name,at,power,size,color):
        d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=at;o.rotation_euler=(Vector((0,0,.7))-o.location).to_track_quat('-Z','Y').to_euler()
    light('Warm key',(-3,4,5),600,4,(1,.88,.72));light('Cool fill',(4,1,3),400,4,(.65,.85,1));light('Back rim',(0,-4,4),750,3,(.60,.87,1))
    camdata=bpy.data.cameras.new('Review camera');cam=bpy.data.objects.new('Review camera',camdata);bpy.context.collection.objects.link(cam);scene.camera=cam;camdata.type='ORTHO';camdata.ortho_scale=2.65
    for name,at in [('three-quarter',(3.1,4.5,2.3)),('front',(0,5,1.7)),('side',(5,0,1.7)),('back',(0,-5,1.7))]:
        cam.location=at;cam.rotation_euler=(Vector((0,0,.80))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'inspection.blend'))
