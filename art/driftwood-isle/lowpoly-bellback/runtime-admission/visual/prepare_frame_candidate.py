"""Create a separate editable candidate; preserve the original source byte-for-byte."""
from pathlib import Path
import hashlib
HERE=Path(__file__).resolve().parent
original=HERE.parents[1]/'build_bellback_v6.py'
source=original.read_text()
assert hashlib.sha256(source.encode()).hexdigest()=='952a8ddca0991a5aaaf1044d3a0498626567d6805881b77e43450c65f1e90a1d'
old='  for i in range(n):fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i));ids.append(i%len(mats))'
new='''  # Bounded V6-frame1 candidate: only the first hull/jaw span has a 180-degree
  # ring-frame flip. Change correspondence, never ring positions or triangle winding.
  # Hull shift4 is the exact half-turn. Odd pentagonal jaw shift3 leaves a36-degree
  # turn and maximizes the minimum split-triangle alignment of the two tied shifts.
  shift=({'Barrel timber hull':4,'Lower timber jaw':3}.get(name,0) if j==0 else 0)
  for i in range(n):fs.append((j*n+(i+shift)%n,j*n+(i+1+shift)%n,(j+1)*n+(i+1)%n,(j+1)*n+i));ids.append(i%len(mats))'''
assert source.count(old)==1
candidate=source.replace(old,new).replace("bellback-study-v6.glb","bellback-study-v6-frame1.glb").replace("metrics-v6.json","metrics-v6-frame1.json")
output=HERE/'build_bellback_v6_frame1.py'
if output.exists() and output.read_text()!=candidate:raise RuntimeError('Refuse overwriting different candidate')
output.write_text(candidate)
print(hashlib.sha256(candidate.encode()).hexdigest())
