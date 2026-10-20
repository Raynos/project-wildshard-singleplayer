"""Integrated grown anatomy, derived from pinned retained next. Never edits base."""
from pathlib import Path
import hashlib,json
B=Path(__file__).resolve().parent
P=B.parent/'complete-character-next'
s=(P/'build_colossus_complete.py').read_text()
assert hashlib.sha256(s.encode()).hexdigest()=='a5b73ef6334c8d9a997e4271365554971e244eed45d4bba4a4489c37b64f3a7f'
s=s.replace('complete-character-next','complete-grown-anatomy').replace('complete character next','complete grown anatomy')
# Preserve slit eye planes and root-embraced heart. Rebuild primary load paths,
# not the rejected exposed-pendant/chunky-eye strategy.
a=s.index('    if any(token in name.lower()');b=s.index('    vertices = []',a)
s=s[:a]+'''    # Individually authored section paths keep existing component ownership.
    side=-1 if name.endswith('-1') else 1
    overrides={
      'Forearm main to outer claw':[(side*1.81,-.17,2.78,.27,.27),(side*2.00,-.36,2.42,.36,.34),(side*2.14,-.43,2.02,.39,.32),(side*2.17,-.42,1.62,.31,.27),(side*2.25,-.47,1.28,.23,.22),(side*2.09,-.67,1.02,.18,.16),(side*1.89,-.76,.96,.075,.09)],
      'Forearm inner braid':[(side*1.86,.08,2.64,.21,.23),(side*1.88,.14,2.25,.26,.27),(side*2.05,.06,1.88,.30,.28),(side*2.04,-.23,1.55,.28,.24),(side*1.96,-.43,1.25,.22,.19)],
      'Middle root digit':[(side*2.10,-.38,1.54,.25,.23),(side*2.10,-.60,1.28,.23,.21),(side*1.94,-.83,1.08,.17,.16),(side*1.71,-.88,1.06,.08,.09)],
      'Inner root digit':[(side*1.94,-.19,1.57,.20,.21),(side*1.82,-.31,1.33,.18,.18),(side*1.70,-.53,1.19,.14,.14),(side*1.64,-.65,1.27,.06,.07)],
      'Opposed root thumb':[(side*1.98,-.19,1.73,.25,.23),(side*1.68,-.18,1.65,.21,.20),(side*1.52,-.35,1.47,.17,.16),(side*1.56,-.54,1.36,.07,.08)],
      'Left scapular arch':[(-1.40,.00,3.77,.25,.28),(-1.00,.45,3.89,.30,.28),(-.61,.62,3.59,.25,.23),(-.38,.43,3.15,.17,.18),(-.06,.28,2.73,.08,.11)],
      'Right scapular arch':[(1.44,.00,3.73,.23,.26),(1.04,.43,3.85,.29,.28),(.68,.60,3.56,.26,.24),(.49,.43,3.16,.18,.20),(.14,.30,2.82,.07,.11)],
      'Rear diagonal trunk':[(-.41,.22,2.20,.20,.23),(-.26,.45,2.72,.28,.24),(.03,.50,3.18,.30,.25),(.37,.36,3.69,.28,.26),(.09,.02,4.19,.27,.24)],
    }
    for key,path in overrides.items():
        if name==key or name.startswith(key+' '):sections=path;break
    if any(t in name.lower() for t in ('calf','ankle','lower leg','toe clasp')):
        # Roots widen continuously into stone, without moving planted toe tips.
        sections=[(x,y,z,w*(1.23 if .20<z<1.2 else 1.08),d*(1.20 if .20<z<1.2 else 1.05),*tail) for x,y,z,w,d,*tail in sections]
    if 'heart clasp' in name or 'heart claw' in name:
        sections=[(x,y+.045,z,w*.90,d*.92,*tail) for x,y,z,w,d,*tail in sections]
    if name=='Central brow nasal keel':
        sections=[(0,-.40,4.60,.25,.13),(0,-.61,4.36,.13,.09),(.005,-.65,4.10,.09,.07),(0,-.60,3.90,.035,.035)]
    if 'Layered pale cheek jaw' in name:
        sections=[(side*.32,-.35,4.44,.16,.14),(side*.28,-.54,4.19,.17,.11),(side*.17,-.63,3.97,.13,.09),(side*.075,-.59,3.75,.04,.045)]
        colors=('cut','lightwood','cut','lightwood','wood','lightwood')
''' +s[b:]
# Coherent forearm taper and torso depth: attached leaves/stone move together.
s=s.replace('y*=1+.48*upper*body','y*=1+.34*upper*body')
s=s.replace('x+=side*.08*math.sin((z-1.1)*math.pi/2.3)','x-=side*.06*math.sin((z-1.1)*math.pi/2.3)')
# Core remains visibly embraced, slightly recessed only in the front half.
s=s.replace("mesh('Exposed turquoise heart',vs,fs", "vs=[(x,y+.065 if y<-.4 else y,z) for x,y,z in vs]\nmesh('Exposed turquoise heart',vs,fs")
# Unequal organic mass hierarchy rather than identical three spear curtains.
s=s.replace('growth(name,center,(extent[0]*.76,extent[1]*.77,extent[2]*.68),yaw,pitch)', '''large=any(t in name.lower() for t in ('shoulder','scapul','back','nape','collar'))
    factor=.96 if large else .83
    growth(name,center,(extent[0]*factor,extent[1]*factor,extent[2]*(.88 if large else .73)),yaw,pitch)''')
s=s.replace("((-.42,.82),(.22,1.12),(.65,.65))","((-.48,.70),(.14,.96),(.58,.52))")
s=s.replace("extent[0]*(.42 if j==1 else .34)","extent[0]*(.56 if j==1 else .46)")
s=s.replace("mid = start + axis * .38","mid = start + axis * .48")
# Retain edit pivots exactly rather than silently re-centering changed geometry.
s=s.replace("for ob in parts:\n    verts=[list(v.co)","prior_pivots={p['name']:p['editPivot'] for p in json.loads((Path(__file__).resolve().parent.parent/'complete-character-next/editable-native.json').read_text())['parts']}\nfor ob in parts:\n    verts=[list(v.co)")
s=s.replace("'editPivot':center","'editPivot':prior_pivots[ob.name]")
(B/'build_colossus_complete.py').write_text(s)
