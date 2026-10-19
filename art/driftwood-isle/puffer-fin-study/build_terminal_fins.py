"""Terminal-only edit of retained compact fans. All faces and dorsal web vertices exact."""
import copy,json,math
from pathlib import Path
from build_fins import build as compact_build,BASE,HERE
# Four broad peaks at existing compact perimeter samples. No topology changes.
PEAKS=[(.25,.19),(.065,.24),(-.07,.23),(-.205,.195)]
def build():
 indexed,native=compact_build();indexed=copy.deepcopy(indexed);native=copy.deepcopy(native)
 for mesh,part in zip(indexed['meshes'],native['parts']):
  v=mesh['vertices'];n=len(mesh['rootVertexIndices']);side=1 if mesh['bone']=='finL' else -1
  # The complete root, shoulder and orange-boundary rings (0..2) remain exact.
  # Only terminal upper/sole perimeter rings change; four peaks taper to floor.
  for i in range(n):
   old=v[3*n+i];dx=side*old[0]-.57;dz=old[2]-.435
   if dz<=.12:continue
   angle=math.atan2(dz,dx)
   delta=min(abs(math.atan2(math.sin(angle-math.atan2(z,x)),math.cos(angle-math.atan2(z,x)))) for x,z in PEAKS)
   # Peak vertices preserve original reach. Valleys retract at most 23 mm,
   # preventing a narrow gap from running up the unchanged dorsal surface.
   amount=min(1.,delta/.20)
   retract=.023*amount
   for ring in (3,4):
    vertex=v[ring*n+i];vertex[2]-=retract
   v[3*n+i][1]=.013+.026*amount
  # Rebuild only native position data; colors, faces, rigid binding stay exact.
  part['positions']=[coordinate for face in mesh['triangles']for vi in face for coordinate in v[vi]]
 indexed['status']='unaccepted terminal-edge-only refinement; compact teal web protected exactly'
 native['status']='unaccepted terminal-edge-only forefin payload; not complete creature'
 return indexed,native
if __name__=='__main__':
 m,n=build();(HERE/'terminal-fin-fans-indexed.json').write_text(json.dumps(m,indent=2)+'\n');(HERE/'terminal-fin-native-study.json').write_text(json.dumps(n,separators=(',',':'))+'\n')
