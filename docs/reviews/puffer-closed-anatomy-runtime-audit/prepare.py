"""Read-only native inputs; transient codec fixture for the real runtime decoder."""
import sys,json,hashlib,base64,math,collections
from pathlib import Path
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'art/driftwood-isle/approved-puffer'))
from native_export import validate_native,pack_native_puffer
from measure_native_preview import measure
PATHS={'selected':'art/driftwood-isle/puffer-complete-remaster/closed-anatomy-study/closed-anatomy-native.json','public70':'art/driftwood-isle/approved-puffer/unaccepted-v70-motion-rig1-native.json'}
def hash(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def fixture(key):
 p=ROOT/PATHS[key];d=json.loads(p.read_bytes());dims,measured=measure(d,weighted=True)
 # Existing phase calibration is an animation-clock parameter, not floor padding.
 calibrated={**dims,'legLen':.24/(2*math.sin(.36))}
 measured['candidate']='puffer-closed-anatomy audit input' if key=='selected' else 'public V70 rig1 audit input'
 measured['sourceSha256']=hash(p)
 measured['scope']='Diagnostic weighted rest measurement only; no candidate admission or collision acceptance'
 metadata,payload=pack_native_puffer(d,calibrated)
 parts=[]
 for a in d['parts']:
  weights=collections.Counter(tuple((d['bones'][a['skinIndices'][i+j]]['name'],a['skinWeights'][i+j]) for j in range(4) if a['skinWeights'][i+j]>0) for i in range(0,len(a['skinIndices']),4))
  parts.append({'name':a['name'],'triangles':len(a['positions'])//9,'weightClasses':[{'influences':k,'vertices':v} for k,v in weights.items()]})
 return {'path':PATHS[key],'sha256':hash(p),'validation':validate_native(d),'parts':parts,'bones':d['bones'],'measurement':measured,'phaseDimensions':calibrated,'metadata':metadata,'payloadBase64':base64.b64encode(payload).decode()}
if __name__=='__main__': print(json.dumps(fixture(sys.argv[1])))
