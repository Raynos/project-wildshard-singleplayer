"""Create a separate all-span crown correspondence candidate; no original edits."""
from pathlib import Path
import hashlib
HERE=Path(__file__).resolve().parent
source=(HERE/'build_bellback_v6_frame1.py').read_text()
assert hashlib.sha256(source.encode()).hexdigest()=='8c5f87075b5e4c878b8dc766d09020a80ffb97a4e36e07f7e57ce1b3bebb78a7'
old="  shift=({'Barrel timber hull':4,'Lower timber jaw':3}.get(name,0) if j==0 else 0)"
new=old+"\n  # Whole-crown side-fold audit: transport correspondence only on these two spans.\n  if name=='Crown tie':shift={2:2,4:5}.get(j,0)"
assert source.count(old)==1
candidate=source.replace(old,new).replace('bellback-study-v6-frame1.glb','bellback-study-v6-frame2.glb').replace('metrics-v6-frame1.json','metrics-v6-frame2.json')
output=HERE/'build_bellback_v6_frame2.py'
if output.exists() and output.read_text()!=candidate:raise RuntimeError('Refuse overwriting different candidate')
output.write_text(candidate);print(hashlib.sha256(candidate.encode()).hexdigest())
