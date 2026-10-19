"""Real-source regressions. Does not build or admit any app/product."""
import subprocess,sys,tempfile,shutil,json
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
def audit(path):return subprocess.run([sys.executable,str(HERE/'audit_source_v3.py'),str(path)],capture_output=True,text=True)
latest=ROOT/'tmp/brine-pitcher-v4'
r=audit(latest);assert r.returncode==0,r.stderr
for folder,message in [('v1','Inward ivory rim winding'),('v2','Single-sided material required')]:
 r=audit(HERE/folder);assert r.returncode!=0 and message in r.stderr,r.stderr
scratch=ROOT/'tmp/brine-pitcher-audit-mutation';scratch.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(dir=scratch) as d:
 d=Path(d)
 for name in ['native-source.json','brine-pitcher-v1.glb','metadata.json','payload.bin','construction.json']:shutil.copyfile(latest/name,d/name)
 data=json.loads((d/'native-source.json').read_text());data['parts'][0]['positions'][0]+=.01;(d/'native-source.json').write_text(json.dumps(data))
 r=audit(d);assert r.returncode!=0 and 'parity mismatch' in r.stderr,r.stderr
print('4 source regressions pass: final geometry, pre-fix rim refusal, double-sided intermediate refusal, changed native vertex refusal.')
