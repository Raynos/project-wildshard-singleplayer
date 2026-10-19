"""Deterministic reconstruction from preserved pass2, with complete growth volumes."""
from pathlib import Path
import hashlib,json
base=Path(__file__).resolve().parent
repo=base.parents[3]
def rec(p):return {'path':str(p.relative_to(repo)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
preserved=[p for d in ('complete-pass1','complete-pass2') for p in (base.parent/d).rglob('*') if p.is_file() and '__pycache__' not in str(p)]
(base/'predecessor-preservation.json').write_text(json.dumps({'files':[rec(p) for p in sorted(preserved)]},indent=2)+'\n')
s=(base.parent/'complete-pass2/build_colossus_complete.py').read_text().replace('complete-pass2','complete-pass3').replace('complete pass 2','complete pass 3')
a=s.index('def canopy(');b=s.index('# Root anatomy:',a)
s=s[:a]+'''def canopy(name, center, scale=1, facing=0):
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


'''+s[b:]
s=s.replace(".66 if s>0 else .93",".82 if s>0 else .96")
s=s.replace(".68 if s>0 else .84",".90 if s>0 else .83")
s=s.replace("# Forearm leaves are concentrated at the upper arm braid, not repeated bands.","canopy(f'Forearm outer growth {s}',(s*2.12,.13,1.96),.43,s*1.9)")
s=s.replace("(s*.57,-.39,2.20),.62","(s*.57,-.39,2.20),.70")
s=s.replace("(s*1.01,-.23,1.02),.68","(s*1.01,-.23,1.02),.76")
s=s.replace("# Ankle roots stay exposed beneath the shin bunch.","canopy(f'Inner ankle growth {s}',(s*.77,.03,.59),.41,-s*.7)")
# Crystal: shifted front ridge and irregular intermediate planes, fuller than a diamond.
a=s.index('# Heart:');b=s.index('# Integrated long bark mask:',a)
s=s[:a]+'''# Heart: faceted prismatic mineral with staggered rings and an offset ridge.
vs=[(-.03,-.41,3.75),(-.27,-.44,3.51),(-.37,-.47,3.22),(-.31,-.43,2.94),(-.11,-.41,2.67),(.12,-.39,2.64),(.34,-.42,2.94),(.38,-.40,3.25),(.23,-.41,3.51),
    (-.10,-.70,3.51),(-.25,-.77,3.23),(-.15,-.76,2.94),(.12,-.77,2.90),(.23,-.73,3.21),(.12,-.68,3.49),(-.01,-.85,3.26),(.00,-.78,3.05),(0,-.10,3.22)]
fs=[(0,1,9),(1,2,10,9),(2,3,11,10),(3,4,11),(4,5,12,11),(5,6,12),(6,7,13,12),(7,8,14,13),(8,0,9,14),
    (9,10,15),(10,11,16,15),(11,12,16),(12,13,15,16),(13,14,15),(14,9,15)]
for i in range(9):fs.append((i,17,(i+1)%9))
mesh('Exposed turquoise heart',vs,fs,['heart','heartLight','heart','heart','heart','heartLight','heart','heartLight','heart','heartLight','heart','heart','heartLight','heart','heart'])

''' +s[b:]
# Compact split face: keep the eye plane and forehead, shorten only lower mask.
a=s.index('# Integrated long bark mask:');b=s.index('# Asymmetric branches',a)
face=s[a:b]
face=face.replace("# Integrated long bark mask:","# Compact split bark mask:")
face="face_start=len(parts)\n"+face+'''# Shorten below the eye line while keeping the recess continuous.
for ob in parts[face_start:]:
    if ob.name=='Neck rear root':continue
    for v in ob.data.vertices:
        if v.co.z<4.27:v.co.z=4.27+(v.co.z-4.27)*.65
'''
s=s[:a]+face+s[b:]
# Asymmetric vertical crown: replace the antler-like equal fan by two crooked trunks.
a=s.index("root('Crown left main'");b=s.index("canopy('Rear nape leaves'",a)
s=s[:a]+'''root('Crown left main',[(-.32,-.09,4.45,.22,.20),(-.62,-.03,4.81,.24,.20),(-.83,.09,5.18,.19,.16),(-.96,.14,5.57,.14,.12),(-1.04,.12,5.98,.055,.065)],twist=-.2)
root('Crown left backward fork',[(-.80,.07,5.12,.16,.14),(-1.15,.29,5.30,.13,.12),(-1.38,.38,5.48,.045,.05)],twist=.3)
root('Crown left broken twig',[(-.95,.14,5.55,.085,.08),(-.79,.30,5.72,.07,.07),(-.76,.32,5.89,.025,.03)],twist=-.1)
root('Crown right main',[(.34,-.06,4.47,.23,.19),(.57,.03,4.82,.22,.18),(.73,.04,5.23,.17,.15),(.47,-.03,5.43,.14,.12),(.45,-.04,5.83,.065,.065)],twist=.25)
root('Crown right outward fork',[(.61,.02,4.96,.16,.14),(1.01,-.12,5.08,.17,.14),(1.19,-.17,5.37,.10,.10),(1.28,-.13,5.52,.04,.05)],twist=-.3)
root('Crown low side fork',[(.40,-.09,4.63,.14,.13),(.89,-.28,4.75,.15,.12),(1.25,-.32,4.92,.10,.09),(1.41,-.29,5.11,.035,.04)],twist=.2)
''' +s[b:]
(base/'build_colossus_complete.py').write_text(s)
