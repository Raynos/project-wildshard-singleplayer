from pathlib import Path
import hashlib,json
base=Path(__file__).resolve().parent
old=base.parent/'complete-pass1'
repo=base.parents[3]
def rec(p):return {'path':str(p.relative_to(repo)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(base/'predecessor-preservation.json').write_text(json.dumps({'files':[rec(p) for p in sorted(old.rglob('*')) if p.is_file()]},indent=2)+'\n')
s=(old/'build_colossus_complete.py').read_text().replace('complete-pass1','complete-pass2').replace('complete pass 1','complete pass 2')
a=s.index('def canopy(');b=s.index('# Root anatomy:',a)
s=s[:a]+'''def canopy(name, center, scale=1, facing=0):
    """Grown clustered mantle: unequal pointed volumes, no dome plus apron motif."""
    import random
    rng=random.Random(sum((i+1)*ord(c) for i,c in enumerate(name)))
    x,y,z=center
    c,s=math.cos(facing),math.sin(facing)
    def world(p):
        px,py,pz=p
        return (x+scale*(px*c-py*s),y+scale*(px*s+py*c),z+scale*pz)
    # An oblique low central body and unequal outgrowths share the rooted seat.
    for j in range(4 if scale>.85 else 2):
        cx=(-.33+j*.22)+rng.uniform(-.13,.12)
        cy=rng.uniform(-.19,.18)
        cz=rng.uniform(-.15,.12)
        rx=rng.uniform(.23,.43);ry=rng.uniform(.22,.39)
        h=rng.uniform(.20,.42)
        phase=rng.random()*2
        vs=[]
        for k in range(5):
            theta=phase+k*math.tau/5
            vs.append(world((cx+math.cos(theta)*rx,cy+math.sin(theta)*ry,cz+rng.uniform(-.15,.01))))
        vs += [world((cx-.07,cy+.01,cz+h)),world((cx+.04,cy-.04,cz-.17))]
        fs=[]
        for k in range(5):
            fs += [(k,(k+1)%5,5),((k+1)%5,k,6)]
        mesh(name+' angled growth '+str(j),vs,fs,['leaf','leafDark','leafLight','leafDark','leaf','leafDark','leafLight','leaf','leaf','leafDark'])
        # Pointed growth is part of the same bunch, leaning in varied directions.
        if j%2==0:
            leaf(name+' tapered shoot '+str(j),world((cx,cy,cz+.1)),world((cx+rng.uniform(-.35,.35),cy-.23,cz-rng.uniform(.24,.54))),rng.uniform(.17,.28)*scale,'leaf',rng.uniform(-.7,.7))


'''+s[b:]
# Replace the broad beak/shield with paired split bark plates and dark seam.
a=s.index('# Coordinates integrate brow');b=s.index('def face_inlay',a)
s=s[:a]+'''# The forehead is rooted in two converging crown strands. A dark recess
# separates the lower plates, so a single pointed shield cannot dominate.
root('Recessed split mask backing',[(0,-.28,4.60,.23,.17),(0,-.43,4.27,.24,.16),(0,-.44,3.96,.11,.11)],colors=('darkwood','rootshade','darkwood','rootshade','darkwood','rootshade'))
for side in (-1,1):
    root(f'Forked face plate {side}',[(side*.31,-.32,4.68,.15,.13),(side*.23,-.49,4.48,.14,.10),(side*.14,-.61,4.24,.12,.075),(side*.11,-.60,4.06,.105,.07),(side*.055,-.56,3.86,.035,.04)],colors=('wood','lightwood','wood','wood','darkwood','rootshade'),twist=side*.20)
    root(f'Split outer cheek plate {side}',[(side*.34,-.27,4.40,.13,.12),(side*.29,-.47,4.21,.105,.10),(side*.20,-.52,3.99,.07,.07),(side*.15,-.48,3.88,.025,.03)],twist=side*.25)
''' +s[b:]
# Tighten the eyes to the actual narrow paired mask surface.
s=s.replace("(s*.310,-.575,4.44)","(s*.275,-.575,4.44)").replace("(s*.282,-.610,4.28)","(s*.252,-.610,4.28)")
# Hands are grown hooks with one primary fork, not parallel digit rows.
a=s.index('    # Deliberately varied curling digit');b=s.index('    # Bowed thigh',a)
s=s[:a]+'''    # Broad uneven fork grows from palm; no evenly-spaced four-finger pattern.
    root(f'Inner root hook {s}',[(s*1.99,-.28,1.62,.24,.20),(s*1.82,-.38,1.32,.20,.18),(s*1.80,-.63,1.03,.16,.15),(s*1.99,-.76,.88,.095,.09),(s*2.12,-.78,.79,.035,.045)],twist=-s*.35)
    root(f'Broken inner root prong {s}',[(s*1.87,-.39,1.30,.14,.12),(s*1.62,-.55,1.13,.12,.11),(s*1.56,-.65,.88,.075,.07),(s*1.63,-.72,.76,.025,.035)],twist=s*.25)
''' +s[b:]
# Less uniform cap locations: broad shoulder hierarchy, limited subordinate patches.
s=s.replace("canopy(f'Collar growth {s}',(s*.68,.02,4.17),.90,-s*.70)","canopy(f'Collar growth {s}',(s*.68,.02,4.17),.66 if s>0 else .93,-s*.70)")
s=s.replace("canopy(f'Elbow growth {s}',(s*1.86,-.24,3.12+asym),.80,s*.95)","canopy(f'Elbow growth {s}',(s*1.86,-.24,3.12+asym),.68 if s>0 else .84,s*.95)")
s=s.replace("canopy(f'Forearm side growth {s}',(s*2.08,.07,2.09),.47,s*1.6)","# Forearm leaves are concentrated at the upper arm braid, not repeated bands.")
s=s.replace("canopy(f'Inner calf growth {s}',(s*.79,-.18,.58),.48,-s*.7)","# Ankle roots stay exposed beneath the shin bunch.")
# Crystal has smaller irregular color planes rather than a broad flat cyan face.
s=s.replace("['heartLight','heart','heart','heart','heart','heartLight','heart','heart'])","['heart','heartLight','heart','heart','heartLight','heart','heart','heart'])")
# Continuous shaping preserves overlap, with broader hunched chest and staggered knees.
s=s.replace('y-=.25*max(0,min(1,(z-2.4)/1.9))','y-=.40*max(0,min(1,(z-2.4)/1.9))\n        x*=1+.035*upper\n        if z<2.2:\n            y+=.13*math.sin(z*1.6)\n            x*=1+.07*math.sin(z*1.7)')
(base/'build_colossus_complete.py').write_text(s)
