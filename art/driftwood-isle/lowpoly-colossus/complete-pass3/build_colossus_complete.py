"""Tide-Root Colossus complete pass 3: continuous, overlapping root anatomy study.

Front -Y. All anatomy is closed 3D geometry, with deliberate tapered bends and
broad irregular planes. Approved concept guides visible identity; back is an
interpretation. V1/V2 are preserved. Static study, not runtime/animation approval.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--out', default='tmp/colossus-complete-pass3')
parser.add_argument('--render', action='store_true')
parser.add_argument('--views', default='three-quarter')
a = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
out = Path(a.out).resolve()
out.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def linear(c):
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4


palette = {
    'wood': '795638', 'lightwood': 'A98252', 'cut': 'C39A64',
    'darkwood': '4A392B', 'rootshade': '5C4833',
    'stone': '626C73', 'stoneLight': '89918C', 'stoneDark': '48545A',
    'leaf': '71952D', 'leafLight': '98B63B', 'leafDark': '436528',
    'heart': '13C9C6', 'heartLight': '53E8DC', 'eye': '30EEE0',
    'socket': '172B28',
}
mats = {}
for name, color in palette.items():
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes['Principled BSDF']
    rgb = tuple(linear(int(color[i:i + 2], 16) / 255) for i in (0, 2, 4))
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Roughness'].default_value = .88
    if name in ('heart', 'heartLight', 'eye'):
        shader.inputs['Emission Color'].default_value = (*rgb, 1)
        shader.inputs['Emission Strength'].default_value = .18
    mats[name] = material
parts = []


def mesh(name, vertices, faces, colors):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    for color in dict.fromkeys(colors):
        data.materials.append(mats[color])
    slots = {m.name: i for i, m in enumerate(data.materials)}
    for i, face in enumerate(data.polygons):
        face.material_index = slots[colors[i % len(colors)]]
        face.use_smooth = False
    parts.append(ob)
    return ob


def root(name, sections, colors=('wood', 'lightwood', 'cut', 'wood', 'darkwood', 'rootshade'), twist=0):
    """Swept six-sided root: sections are x,y,z,width,depth, optional roll.

    Unlike V2, sections are perpendicular to the local path, not horizontal.
    The asymmetric cross section and controlled roll form bark ridges that carry
    around each bend; there is no random vertex noise or repeated segment caps.
    """
    vertices = []
    points = [Vector(s[:3]) for s in sections]
    shape = [(1, .12), (.46, .95), (-.60, .83), (-1, -.12), (-.36, -1), (.55, -.72)]
    for i, section in enumerate(sections):
        tangent = (points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]).normalized()
        guide = Vector((0, 1, 0))
        if abs(tangent.dot(guide)) > .94:
            guide = Vector((1, 0, 0))
        right = guide.cross(tangent).normalized()
        depth = tangent.cross(right).normalized()
        roll = twist + (section[5] if len(section) > 5 else 0)
        u = right * math.cos(roll) + depth * math.sin(roll)
        v = depth * math.cos(roll) - right * math.sin(roll)
        for x, y in shape:
            vertices.append(tuple(points[i] + u * x * section[3] + v * y * section[4]))
    faces = [tuple(reversed(range(6)))]
    face_colors = ['darkwood' if colors[0] in ('wood', 'darkwood', 'lightwood') else colors[0]]
    for k in range(len(sections) - 1):
        for j in range(6):
            face = (k * 6 + j, k * 6 + (j + 1) % 6, (k + 1) * 6 + (j + 1) % 6, (k + 1) * 6 + j)
            # A long bent broad side gets one deliberate diagonal planar break.
            # Flat neighboring strips stay coherent rather than checkerboarded.
            if (k + j) % 4 == 1 and len(sections) > 3:
                faces.extend([(face[0], face[1], face[2]), (face[0], face[2], face[3])])
                face_colors.extend([colors[j % len(colors)], colors[(j + (1 if k == 1 else 0)) % len(colors)]])
            else:
                faces.append(face)
                face_colors.append(colors[j % len(colors)])
    faces.append(tuple((len(sections) - 1) * 6 + j for j in range(6)))
    face_colors.append(colors[1 % len(colors)])
    return mesh(name, vertices, faces, face_colors)


def stone(name, center, scale, turn=0):
    """An embedded uneven rock wedge with a broad split face, never a sphere."""
    base = [(-.8,-.6,-.7),(.7,-.7,-.7),(1,.3,-.45),(.3,.85,-.65),(-.85,.45,-.6),
            (-.52,-.65,.45),(.35,-.7,.8),(.77,.13,.5),(.12,.6,1),(-.65,.42,.55),(.0,-.13,1.15)]
    c, s = math.cos(turn), math.sin(turn)
    vs = [(center[0]+(x*c-y*s)*scale[0],center[1]+(x*s+y*c)*scale[1],center[2]+z*scale[2]) for x,y,z in base]
    fs = [(4,3,2,1,0),(0,1,6,5),(1,2,7,6),(2,3,8,7),(3,4,9,8),(4,0,5,9),
          (5,6,10),(6,7,10),(7,8,10),(8,9,10),(9,5,10)]
    return mesh(name,vs,fs,['stoneDark','stone','stoneLight','stone','stoneDark','stone','stoneLight','stone','stoneLight','stone','stone'])


def leaf(name, start, tip, width, color='leaf', roll=0):
    start, tip = Vector(start), Vector(tip)
    axis = tip - start
    side = axis.cross(Vector((0,0,1)))
    if side.length < .001:
        side = Vector((1,0,0))
    side.normalize()
    normal = side.cross(axis.normalized())
    side = (side * math.cos(roll) + normal * math.sin(roll)) * width
    mid = start + axis * .38
    ridge = mid + normal * width * .40
    underside = mid - normal * width * .16
    vs = [start, mid+side, tip, mid-side, ridge, underside]
    return mesh(name,[tuple(v) for v in vs],[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(1,0,5),(2,1,5),(3,2,5),(0,3,5)],
                [color,'leafLight',color,'leafDark','leafDark',color,'leafDark',color])


def canopy(name, center, scale=1, facing=0):
    """Closed, overlapping lobed shoots with offset ridges and trailing growth.

    Each bunch has three irregular lobes, broad bent diamond leaves and a
    deeply rooted stalk. The lobes vary in length and depth, not just rotation.
    No planar shoulder roof, bead row, pyramid peak or isolated leaf triangle.
    """
    import random
    rng=random.Random(sum((i+3)*ord(c) for i,c in enumerate(name)))
    x,y,z=center;c,s=math.cos(facing),math.sin(facing)
    def world(p):
        px,py,pz=p
        return (x+scale*(px*c-py*s),y+scale*(px*s+py*c),z+scale*pz)
    for j in range(3):
        anchor=[(-.27,.14,.02),(.25,.02,-.10),(-.03,-.25,-.18)][j]
        cx=anchor[0]+rng.uniform(-.10,.10)
        cy=anchor[1]+rng.uniform(-.12,.12);cz=anchor[2]+rng.uniform(-.06,.09)
        w=rng.uniform(.26,.36);d=rng.uniform(.28,.40)
        # Uneven six-sided perimeter below two connected off-axis ridges.
        local=[(cx-w,cy-.12,cz-.12),(cx-w*.55,cy-d,cz-.20),
          (cx+w*.45,cy-d*.85,cz-.13),(cx+w,cy-.02,cz-.19),
          (cx+w*.45,cy+d*.67,cz-.11),(cx-w*.60,cy+d*.55,cz-.10),
          (cx-w*.44,cy-.18,cz+.13),(cx+w*.43,cy+.10,cz+.16),
          (cx+.03,cy,cz-.26)]
        fs=[(0,1,6),(1,2,6),(2,3,7,6),(3,4,7),(4,5,7),(5,0,6,7),
            (1,0,8),(2,1,8),(3,2,8),(4,3,8),(5,4,8),(0,5,8)]
        angle=rng.uniform(-.8,.8);ca,sa=math.cos(angle),math.sin(angle)
        local=[(cx+(px-cx)*ca-(py-cy)*sa,cy+(px-cx)*sa+(py-cy)*ca,pz) for px,py,pz in local]
        mesh(name+' lobed crown '+str(j),[world(p) for p in local],fs,
             ['leaf','leafLight','leaf','leafLight','leaf','leafDark','leafDark','leaf','leafDark','leafDark','leaf','leafDark'])
        # Overlapping trailing shoot volumes form uneven, multi-layer hems.
        for k in range(2 if j!=1 else 1):
            sx=cx+(-.13 if k==0 else .15);sy=cy-.13+k*.15
            tip=(sx+rng.uniform(-.20,.20),sy-rng.uniform(.10,.28),cz-rng.uniform(.38,.65))
            leaf(name+' folded drape '+str(j)+'-'+str(k),world((sx,sy,cz+.02)),world(tip),rng.uniform(.17,.25)*scale,'leaf',rng.uniform(-.6,.6))


# Root anatomy: two opposing load paths cradle an open heart, then continue
# through the hips and back. Neither makes a regular circular frame.
root('Crooked pelvic trunk',[(.06,.11,1.60,.13,.20),(-.16,.20,1.97,.32,.31),(.11,.15,2.28,.34,.30),(-.14,.31,2.62,.27,.25)],twist=.2)
root('Left chest load root',[(-.10,-.14,2.27,.13,.15),(-.57,-.09,2.61,.28,.30),(-.88,.04,3.17,.32,.36),(-.78,-.07,3.68,.36,.36),(-1.23,.04,4.02,.36,.34)],twist=-.24)
root('Right chest load root',[(.23,.09,2.20,.15,.18),(.58,.02,2.70,.26,.30),(.80,.00,3.05,.28,.34),(.66,-.14,3.57,.31,.32),(1.10,-.04,3.94,.40,.37)],twist=.28)
root('Left clavicle cascade',[(-1.33,.03,3.99,.28,.31),(-.89,-.37,3.94,.33,.26),(-.52,-.49,3.58,.27,.20),(-.33,-.50,3.34,.07,.08)],twist=-.20)
root('Right clavicle cascade',[(1.33,.12,3.94,.25,.29),(.88,-.34,3.98,.32,.25),(.57,-.48,3.67,.21,.18),(.42,-.54,3.49,.05,.06)],twist=.15)
root('Left lower cradle',[(-.83,-.02,3.14,.22,.24),(-.71,-.41,2.91,.24,.22),(-.40,-.59,2.75,.20,.15),(-.10,-.48,2.48,.10,.10)],twist=.4)
root('Right diagonal cradle',[(.71,.06,3.24,.22,.26),(.78,-.38,2.96,.23,.21),(.42,-.60,2.67,.18,.13),(-.02,-.40,2.61,.06,.08)],twist=-.3)
root('Left upper inward rib',[(-.88,-.15,3.48,.20,.23),(-.65,-.48,3.46,.21,.18),(-.19,-.57,3.40,.035,.065)],twist=.15)
root('Right upper inward rib',[(.76,-.04,3.62,.17,.20),(.67,-.44,3.38,.20,.17),(.29,-.57,3.24,.04,.07)],twist=-.2)
root('Waist front spur',[(-.31,-.13,2.62,.15,.17),(-.16,-.40,2.33,.25,.16),(.05,-.40,2.07,.15,.11),(-.05,-.35,1.83,.025,.05)],twist=.3)
# Deep back: slanted roots traverse one another instead of a solid V panel.
root('Rear diagonal trunk',[(-.41,.22,2.20,.20,.23),(-.19,.51,2.72,.33,.26),(.19,.51,3.19,.37,.27),(.46,.36,3.69,.33,.28),(.09,.02,4.19,.27,.24)],twist=.37)
root('Left scapular arch',[(-1.40,.00,3.77,.25,.28),(-1.00,.47,3.83,.33,.29),(-.55,.63,3.51,.30,.26),(-.33,.48,3.05,.21,.20),(-.01,.32,2.69,.08,.11)],twist=-.35)
root('Right scapular arch',[(1.44,.00,3.73,.23,.26),(1.02,.45,3.80,.33,.29),(.64,.66,3.57,.30,.28),(.45,.48,3.11,.20,.20),(.12,.31,2.81,.07,.11)],twist=.4)
root('Crossback lower root',[(-.76,.17,2.61,.16,.17),(-.53,.55,2.91,.26,.21),(-.05,.69,3.27,.25,.20),(.49,.56,3.51,.17,.17),(.84,.35,3.86,.09,.10)],twist=.25)

for side in (-1,1):
    s=side
    asym=.07 if s>0 else -.04
    # These secondary roots wrap and split the large load-bearing masses.
    root(f'Outer shoulder root {s}',[(s*.79,.09,3.90,.28,.31),(s*1.26,-.02,4.04+asym,.44,.43),(s*1.61,-.10,3.69,.37,.34),(s*1.81,.02,3.25,.28,.28)],twist=s*.3)
    root(f'Arm descending trunk {s}',[(s*1.44,.12,3.83,.29,.33),(s*1.69,.07,3.45,.38,.33),(s*1.82,-.11,3.03,.30,.30),(s*1.73,-.24,2.73,.25,.28),(s*1.98,-.25,2.30,.33,.29)],twist=s*.25)
    root(f'Upper arm crossing bark {s}',[(s*1.28,-.36,3.88,.18,.16),(s*1.51,-.40,3.53,.28,.17),(s*1.72,-.30,3.21,.20,.15),(s*1.88,-.14,2.99,.05,.07)],twist=s*.4)
    root(f'Elbow outer hook {s}',[(s*1.74,.07,3.03,.21,.21),(s*2.00,.04,2.73,.28,.24),(s*2.15,-.13,2.48,.17,.19),(s*2.16,-.23,2.18,.04,.08)],twist=s*.3)
    # Two muscular forearm roots continue into palm and outer finger.
    root(f'Forearm main to outer claw {s}',[(s*1.81,-.17,2.78,.27,.27),(s*2.02,-.38,2.41,.42,.32),(s*2.17,-.45,1.98,.33,.29),(s*2.23,-.39,1.53,.25,.23),(s*2.39,-.37,1.16,.17,.17),(s*2.35,-.66,.84,.12,.12),(s*2.19,-.76,.71,.045,.06)],twist=-s*.22)
    root(f'Forearm inner braid {s}',[(s*1.86,.08,2.64,.21,.23),(s*1.87,.06,2.23,.28,.24),(s*2.00,-.04,1.86,.25,.25),(s*1.96,-.29,1.49,.26,.20),(s*2.08,-.42,1.24,.20,.18)],twist=s*.38)
    root(f'Front forearm blade {s}',[(s*1.89,-.46,2.58,.10,.10),(s*1.98,-.64,2.20,.21,.14),(s*2.03,-.65,1.82,.16,.13),(s*1.91,-.55,1.61,.035,.05)],twist=-s*.15)
    # Broad uneven fork grows from palm; no evenly-spaced four-finger pattern.
    root(f'Inner root hook {s}',[(s*1.99,-.28,1.62,.24,.20),(s*1.82,-.38,1.32,.20,.18),(s*1.80,-.63,1.03,.16,.15),(s*1.99,-.76,.88,.095,.09),(s*2.12,-.78,.79,.035,.045)],twist=-s*.35)
    root(f'Broken inner root prong {s}',[(s*1.87,-.39,1.30,.14,.12),(s*1.62,-.55,1.13,.12,.11),(s*1.56,-.65,.88,.075,.07),(s*1.63,-.72,.76,.025,.035)],twist=s*.25)
    # Bowed thigh, exposed rock, and spiralling calf straps. Roots carry into
    # isolated stones at different heights, avoiding V2's shoe-like rim.
    root(f'Thigh load root {s}',[(s*.31,.11,2.19,.25,.28),(s*.65,.02,1.98,.35,.30),(s*.93,.07,1.66+asym,.33,.28),(s*.94,-.10,1.30,.21,.22)],twist=-s*.37)
    root(f'Thigh oblique bark {s}',[(s*.27,-.19,2.14,.16,.16),(s*.59,-.34,1.85,.23,.18),(s*.88,-.26,1.58,.20,.15),(s*1.04,-.09,1.43,.04,.06)],twist=s*.15)
    stone(f'Embedded knee rock {s}',(s*.91,.09,1.18+asym),(.29,.29,.34),s*.3)
    root(f'Calf rear load {s}',[(s*.89,.17,1.48,.23,.24),(s*1.08,.29,1.05,.28,.27),(s*1.02,.12,.58,.29,.28),(s*.83,-.10,.19,.20,.22)],twist=s*.5)
    root(f'Calf crossing root {s}',[(s*.78,-.13,1.43,.17,.18),(s*.84,-.34,1.06,.22,.20),(s*1.13,-.29,.66,.25,.21),(s*1.30,-.19,.34,.18,.19),(s*1.42,-.35,.12,.05,.07)],twist=-s*.45)
    root(f'Front ankle anchoring root {s}',[(s*1.12,.03,.95,.16,.18),(s*.98,-.40,.55,.22,.18),(s*.84,-.55,.30,.20,.17),(s*.62,-.78,.09,.055,.07)],twist=s*.2)
    stone(f'Outer embedded foot stone {s}',(s*1.36,-.32,.23),(.29,.39,.29),s*.4)
    stone(f'Inner grounded stone {s}',(s*.68,-.52,.18),(.25,.34,.23),-s*.3)
    stone(f'Rear heel stone {s}',(s*1.08,.34,.19),(.26,.28,.24),s*.7)
    root(f'Hip fork {s}',[(s*.18,.03,2.16,.17,.18),(s*.47,.10,2.38,.20,.19),(s*.75,.03,2.45,.09,.09),(s*.85,-.13,2.30,.025,.04)],twist=s*.25)
    root(f'Arm winding bark ridge {s}',[(s*1.38,.24,3.77,.13,.14),(s*1.76,.31,3.44,.21,.17),(s*1.99,.08,3.08,.16,.15),(s*1.86,-.35,2.83,.13,.12),(s*1.71,-.41,2.61,.025,.045)],twist=s*.5)
    root(f'Forearm diagonal living root {s}',[(s*1.83,.16,2.54,.12,.13),(s*2.11,.10,2.22,.20,.17),(s*2.32,-.16,1.96,.21,.15),(s*2.27,-.48,1.66,.14,.11),(s*2.09,-.62,1.44,.03,.05)],twist=-s*.55)
    root(f'Lower leg lateral root {s}',[(s*.78,.13,1.64,.12,.13),(s*1.03,.30,1.28,.18,.16),(s*1.30,.14,.92,.17,.15),(s*1.33,-.18,.58,.15,.13),(s*1.51,-.42,.30,.09,.10),(s*1.58,-.60,.10,.025,.04)],twist=s*.4)
    root(f'Inner toe clasp {s}',[(s*.99,.10,.67,.15,.16),(s*.69,-.08,.46,.17,.15),(s*.52,-.38,.23,.13,.12),(s*.48,-.65,.07,.035,.05)],twist=-s*.4)
    # The core is clasped at distinct depths, with broken tips facing inward.
    root(f'Upper heart clasp {s}',[(s*.78,-.23,3.47,.14,.16),(s*.63,-.57,3.42,.17,.13),(s*.41,-.72,3.32,.12,.10),(s*.25,-.74,3.34,.025,.035)],twist=s*.4)
    root(f'Lower heart claw {s}',[(s*.72,-.19,2.97,.15,.15),(s*.53,-.61,2.85,.18,.14),(s*.29,-.70,2.73,.13,.10),(s*.20,-.68,2.94,.035,.045)],twist=-s*.5)
    # Mantle patches wrap across front and rear; no continuous shoulder bead row.
    canopy(f'Outer shoulder growth {s}',(s*1.40,-.10,4.26+asym),1.18,s*.55)
    canopy(f'Collar growth {s}',(s*.68,.02,4.17),.82 if s>0 else .96,-s*.70)
    canopy(f'Elbow growth {s}',(s*1.86,-.24,3.12+asym),.90 if s>0 else .83,s*.95)
    canopy(f'Forearm outer growth {s}',(s*2.12,.13,1.96),.43,s*1.9)
    canopy(f'Hip growth {s}',(s*.57,-.39,2.20),.70,s*.8)
    canopy(f'Shin growth {s}',(s*1.01,-.23,1.02),.76,s*1.3)

# Rear canopy is staggered between the root layers rather than confined to top.
canopy('Left upper back mantle',(-.71,.49,3.95),1.14,2.8)
canopy('Right lower back mantle',(.61,.64,3.68),1.07,3.5)
canopy('Spinal growth',(-.24,.67,3.24),.87,2.5)
canopy('Low rear hip growth',(.30,.40,2.39),.54,3.6)
canopy('Left forward rib growth',(-.52,-.62,3.71),.54,-.5)

# Heart: faceted prismatic mineral with staggered rings and an offset ridge.
vs=[(-.03,-.41,3.75),(-.27,-.44,3.51),(-.37,-.47,3.22),(-.31,-.43,2.94),(-.11,-.41,2.67),(.12,-.39,2.64),(.34,-.42,2.94),(.38,-.40,3.25),(.23,-.41,3.51),
    (-.10,-.70,3.51),(-.25,-.77,3.23),(-.15,-.76,2.94),(.12,-.77,2.90),(.23,-.73,3.21),(.12,-.68,3.49),(-.01,-.85,3.26),(.00,-.78,3.05),(0,-.10,3.22)]
fs=[(0,1,9),(1,2,10,9),(2,3,11,10),(3,4,11),(4,5,12,11),(5,6,12),(6,7,13,12),(7,8,14,13),(8,0,9,14),
    (9,10,15),(10,11,16,15),(11,12,16),(12,13,15,16),(13,14,15),(14,9,15)]
for i in range(9):fs.append((i,17,(i+1)%9))
mesh('Exposed turquoise heart',vs,fs,['heart','heartLight','heart','heart','heart','heartLight','heart','heartLight','heart','heartLight','heart','heart','heartLight','heart','heart'])

face_start=len(parts)
# Compact split bark mask: flat tapering front, no separate beak or owl disk.
root('Neck rear root',[(-.05,.10,3.73,.24,.24),(.03,.04,4.15,.34,.27),(-.04,-.08,4.48,.31,.26)],twist=.1)
# The forehead is rooted in two converging crown strands. A dark recess
# separates the lower plates, so a single pointed shield cannot dominate.
root('Recessed split mask backing',[(0,-.28,4.60,.23,.17),(0,-.43,4.27,.24,.16),(0,-.44,3.96,.11,.11)],colors=('darkwood','rootshade','darkwood','rootshade','darkwood','rootshade'))
for side in (-1,1):
    root(f'Forked face plate {side}',[(side*.31,-.32,4.68,.15,.13),(side*.23,-.49,4.48,.14,.10),(side*.14,-.61,4.24,.12,.075),(side*.11,-.60,4.06,.105,.07),(side*.055,-.56,3.86,.035,.04)],colors=('wood','lightwood','wood','wood','darkwood','rootshade'),twist=side*.20)
    root(f'Split outer cheek plate {side}',[(side*.34,-.27,4.40,.13,.12),(side*.29,-.47,4.21,.105,.10),(side*.20,-.52,3.99,.07,.07),(side*.15,-.48,3.88,.025,.03)],twist=side*.25)
def face_inlay(name, vertices, color):
    back=[(x,y+.035,z) for x,y,z in vertices]
    return mesh(name,vertices+back,[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],[color])

for s in (-1,1):
    face_inlay(f'Recessed eye socket {s}',[(s*.052,-.708,4.31),(s*.275,-.575,4.44),(s*.252,-.610,4.28),(s*.105,-.706,4.21)],'socket')
    face_inlay(f'Narrow cyan eye {s}',[(s*.102,-.712,4.305),(s*.273,-.610,4.395),(s*.251,-.632,4.335),(s*.123,-.711,4.264)],'eye')
    # A crown root forks into a long side cheek, leaving the narrow centre mask
    # visible and enclosing the eye rather than framing a separate owl disk.
    root(f'Crown cheek flow {s}',[(s*.16,-.43,3.70,.025,.05),(s*.29,-.44,3.98,.10,.10),(s*.38,-.30,4.37,.17,.15),(s*.41,-.13,4.65,.22,.19),(s*.63,-.05,4.88,.20,.17)],twist=s*.25)
    root(f'Brow descending ridge {s}',[(s*.48,-.19,4.61,.12,.12),(s*.31,-.48,4.52,.12,.09),(s*.16,-.62,4.36,.075,.065),(s*.065,-.71,4.24,.025,.035)],twist=s*.25)
# Shorten below the eye line while keeping the recess continuous.
for ob in parts[face_start:]:
    if ob.name=='Neck rear root':continue
    for v in ob.data.vertices:
        if v.co.z<4.27:v.co.z=4.27+(v.co.z-4.27)*.65
# Asymmetric branches occupy depth as well as width. Their large forks derive
# from the original crown, not a perfectly planar deer-antler silhouette.
root('Crown left main',[(-.32,-.09,4.45,.22,.20),(-.62,-.03,4.81,.24,.20),(-.83,.09,5.18,.19,.16),(-.96,.14,5.57,.14,.12),(-1.04,.12,5.98,.055,.065)],twist=-.2)
root('Crown left backward fork',[(-.80,.07,5.12,.16,.14),(-1.15,.29,5.30,.13,.12),(-1.38,.38,5.48,.045,.05)],twist=.3)
root('Crown left broken twig',[(-.95,.14,5.55,.085,.08),(-.79,.30,5.72,.07,.07),(-.76,.32,5.89,.025,.03)],twist=-.1)
root('Crown right main',[(.34,-.06,4.47,.23,.19),(.57,.03,4.82,.22,.18),(.73,.04,5.23,.17,.15),(.47,-.03,5.43,.14,.12),(.45,-.04,5.83,.065,.065)],twist=.25)
root('Crown right outward fork',[(.61,.02,4.96,.16,.14),(1.01,-.12,5.08,.17,.14),(1.19,-.17,5.37,.10,.10),(1.28,-.13,5.52,.04,.05)],twist=-.3)
root('Crown low side fork',[(.40,-.09,4.63,.14,.13),(.89,-.28,4.75,.15,.12),(1.25,-.32,4.92,.10,.09),(1.41,-.29,5.11,.035,.04)],twist=.2)
canopy('Rear nape leaves',(.02,.23,4.32),.68,2.9)

# Complete-pass anatomy: actual depth, asymmetric interlocking stone and root.
# Dark stone is a secondary load path within the roots, not a new armor shell.
for s in (-1,1):
    stone(f'Upper arm embedded slate {s}',(s*1.54,.27,3.44),(.24,.28,.43),s*.45)
    stone(f'Forearm split slate {s}',(s*2.06,.10,2.06),(.24,.22,.38),-s*.52)
    stone(f'Outer thigh embedded slate {s}',(s*.86,.18,1.65),(.28,.25,.36),s*.28)
    stone(f'Shin rising slate {s}',(s*1.09,.06,.85),(.29,.25,.43),-s*.45)
    stone(f'Separate forward toe {s}',(s*1.00,-.66,.16),(.18,.30,.20),s*.16)
    root(f'Splayed living toe {s}',[(s*.95,.13,.64,.18,.18),(s*1.13,-.25,.36,.20,.17),(s*1.19,-.62,.16,.15,.12),(s*1.34,-.89,.055,.035,.035)],twist=s*.33)
    root(f'Flank bowed trunk {s}',[(s*.32,.29,2.25,.16,.19),(s*.66,.59,2.70,.25,.29),(s*.82,.60,3.22,.31,.33),(s*1.01,.35,3.82,.25,.24)],twist=-s*.4)
    root(f'Forearm root split {s}',[(s*1.85,.23,2.66,.13,.17),(s*2.28,.27,2.26,.21,.24),(s*2.40,.00,1.84,.19,.19),(s*2.30,-.27,1.48,.06,.08)],twist=s*.48)
    canopy(f'Arm lateral drape {s}',(s*1.94,-.28,2.59+(s*.06)),.73,s*1.05)
    canopy(f'Thigh lateral growth {s}',(s*.87,.17,1.75),.55,s*1.65)
    canopy(f'Inner ankle growth {s}',(s*.77,.03,.59),.41,-s*.7)
canopy('Left flank cascading moss',(-.79,.47,3.35),.90,2.1)
canopy('Right rear shoulder bridge',(.88,.45,4.02),.93,3.3)
# A continuous shape-space bend affects every named component coherently.
# Keep the head/core relationship; deepen rib and shoulder cage then lean it.
for ob in parts:
    for v in ob.data.vertices:
        x,y,z=v.co
        upper=max(0,min(1,(z-2.15)/1.8))
        body=max(0,1-max(0,abs(x)-1.25)/1.05)
        y*=1+.48*upper*body
        y-=.40*max(0,min(1,(z-2.4)/1.9))
        x*=1+.035*upper
        if z<2.2:
            y+=.13*math.sin(z*1.6)
            x*=1+.07*math.sin(z*1.7)
        # Break rigid bilateral leg rhythm without disconnecting root overlaps.
        if z<2.25:
            y+=.10*math.sin(z*2.0)*(1 if x>0 else -.7)
        v.co=(x,y,z)
    ob.data.update()

# Named connected growth regions are retained for later rigging work.
for ob in parts:
    ob['asset']='tide-root-colossus-lowpoly'
    ob['status']='unaccepted-complete-pass3-study'
    ob['front']='-Y'

bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for ob in parts:
    ob.select_set(True)
bpy.context.view_layer.objects.active=parts[0]
glb=out/'tide-root-colossus-complete-pass3.glb'
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
points=[ob.matrix_world @ Vector(c) for ob in parts for c in ob.bound_box]
lo=[min(v[i] for v in points) for i in range(3)]
hi=[max(v[i] for v in points) for i in range(3)]
triangles=sum(sum(len(f.vertices)-2 for f in ob.data.polygons) for ob in parts)
(out/'metrics-complete-pass3.json').write_text(json.dumps({'status':'unaccepted complete pass 3 integrated growth study','objects':len(parts),'triangles':triangles,'bounds':{'min':lo,'max':hi},'front':'-Y','glbBytes':glb.stat().st_size,'sourceSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'rendered':a.render},indent=2)+'\n')
if a.render:
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=32
    scene.cycles.use_denoising=False
    scene.render.resolution_x=900
    scene.render.resolution_y=1200
    scene.render.resolution_percentage=100
    scene.world.color=(.12,.12,.12)
    scene.view_settings.view_transform='Standard'
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.08))
    floor=bpy.context.object
    m=bpy.data.materials.new('Review floor')
    m.diffuse_color=(.025,.04,.055,1)
    floor.data.materials.append(m)
    def aim(ob,point):
        ob.rotation_euler=(Vector(point)-ob.location).to_track_quat('-Z','Y').to_euler()
    for name,loc,energy,size in [('Key',(-4,-6,9),1500,5),('Fill',(5,-3,5),850,4),('Rim',(0,4,7),1800,3)]:
        bpy.ops.object.light_add(type='AREA',location=loc)
        ob=bpy.context.object
        ob.name=name
        ob.data.energy=energy
        ob.data.shape='DISK'
        ob.data.size=size
        aim(ob,(0,0,3))
    bpy.ops.object.camera_add(location=(7,-15,8))
    cam=bpy.context.object
    cam.data.type='ORTHO'
    cam.data.ortho_scale=7.25
    aim(cam,(0,0,2.95))
    scene.camera=cam
    for name,loc in [('front',(0,-16,6.6)),('three-quarter',(7,-15,7.4)),('back',(-7,15,7.4))]:
        if name not in a.views.split(','):
            continue
        cam.location=loc
        aim(cam,(0,0,2.95))
        scene.render.filepath=str(out/(name+'.png'))
        bpy.ops.render.render(write_still=True)
