"""Transient real-codec fixture, unchanged numeric dimensions, no product."""
import base64,json,sys,hashlib
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,'art/driftwood-isle/approved-puffer')
from native_export import pack_native_puffer,validate_native
paths={'candidate':'art/driftwood-isle/puffer-complete-remaster/rigid-unit-candidate/rigid-unit-native.json','original':'art/driftwood-isle/puffer-complete-remaster/closed-anatomy-rig1-study/closed-anatomy-rig1-native.json'}
p=Path(paths[sys.argv[1]]);data=json.loads(p.read_bytes());dims=json.loads(Path('art/driftwood-isle/approved-puffer/v70-gait5-dimensions.json').read_bytes())
metadata,payload=pack_native_puffer(data,dims)
print(json.dumps({'sourceSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'validation':validate_native(data),'metadata':metadata,'payloadBase64':base64.b64encode(payload).decode()}))
