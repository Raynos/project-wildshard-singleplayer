"""Read-only hash closure verification with portable capture-relative records."""
from pathlib import Path
import argparse,hashlib,json
p=argparse.ArgumentParser();p.add_argument('--capture-root',required=True);p.add_argument('--hero-reference',required=True);p.add_argument('--world-reference',required=True);p.add_argument('--explorer-reference',required=True);a=p.parse_args()
B=Path(__file__).resolve().parent;R=B.parents[3];C=Path(a.capture_root).resolve()
refs={v.name:v for v in map(Path,[a.hero_reference,a.world_reference,a.explorer_reference])}
count=0
for filename,key in [('final-closure.json','files'),('capture-receipt.json','files'),('capture-receipt.json','originalReferences'),('input-preservation.json','files')]:
 for row in json.loads((B/filename).read_text())[key]:
  label=row['path']
  q=C/label.removeprefix('capture/') if label.startswith('capture/') else refs[Path(label).name] if label.startswith('reference/') else R/label
  data=q.read_bytes();assert len(data)==row['bytes'],label;assert hashlib.sha256(data).hexdigest()==row['sha256'],label
  count+=1
print(json.dumps({'verifiedPins':count,'closureSha256':hashlib.sha256((B/'final-closure.json').read_bytes()).hexdigest()}))
