"""Exactly pinned, geometry-preserving selected Puffer rig1 derivative. No admission."""
import copy,hashlib,json,sys
from pathlib import Path
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
sys.path.insert(0,str(ROOT/'art/driftwood-isle/approved-puffer'))
from native_export import validate_native
SOURCE='art/driftwood-isle/puffer-complete-remaster/closed-anatomy-study/closed-anatomy-native.json'
REFERENCE='art/driftwood-isle/approved-puffer/unaccepted-v70-motion-rig1-native.json'
SOURCE_SHA='98c4855852fc77ef385b0998e98dc5bdbabf40bb32b815f598c9a922525e5006'
REFERENCE_SHA='b985594b98035df3a006464d5af76b0f2b10eca076fa3366b9d94bc325ba1762'
IDENTITY='puffer-closed-anatomy-98c4855852fc'
def sha(b):return hashlib.sha256(b).hexdigest()
def encode(d):return (json.dumps(d,separators=(',',':'),allow_nan=False)+'\n').encode()
def pinned(path,expected):
 raw=(ROOT/path).read_bytes()
 if sha(raw)!=expected:raise ValueError('Input pin mismatch: '+path)
 return json.loads(raw)
def non_skin(d):
 e=copy.deepcopy(d)
 for p in e['parts']:
  del p['skinIndices'];del p['skinWeights']
 return encode(e)
def transfer(source,reference):
 if source['bones']!=reference['bones']:raise ValueError('Exact ordered bind mismatch')
 out=copy.deepcopy(source);rows=[]
 for name in ('finL','finR','rearL','rearR'):
  label='Volumetric connected '+name
  pi=next(i for i,p in enumerate(source['parts']) if p['name']==label)
  ri=next(i for i,p in enumerate(reference['parts']) if p['name']==label)
  a,b=source['parts'][pi],reference['parts'][ri]
  for k in ('name','positions','colorsLinear','furLen'):
   if a[k]!=b[k]:raise ValueError('Complete ordered fin geometry/paint mismatch: '+name+'/'+k)
  bone=next(i for i,bone in enumerate(source['bones']) if bone['name']==name)
  changed=[]
  for i in range(len(a['positions'])//3):
   lo=4*i;hi=lo+4
   if a['skinIndices'][lo:hi]!=[bone,0,0,0] or a['skinWeights'][lo:hi]!=[1,0,0,0]:raise ValueError('Original fin skin not pure')
   if a['skinIndices'][lo:hi]!=b['skinIndices'][lo:hi] or a['skinWeights'][lo:hi]!=b['skinWeights'][lo:hi]:
    changed.append(i);out['parts'][pi]['skinIndices'][lo:hi]=b['skinIndices'][lo:hi];out['parts'][pi]['skinWeights'][lo:hi]=b['skinWeights'][lo:hi]
  unique={tuple(a['positions'][3*i:3*i+3]) for i in changed}
  if len(changed)!=138 or len(unique)!=24:raise ValueError('Wrong precise transfer support')
  if out['parts'][pi]!=b:raise ValueError('Transferred fin does not equal public exact part')
  rows.append({'partIndex':pi,'name':label,'changedWeightRowIndices':changed,'changedRows':len(changed),'uniqueCoordinates':len(unique),'unchangedDistalRows':len(a['positions'])//3-len(changed)})
 if sum(r['changedRows'] for r in rows)!=552:raise ValueError('Wrong total row count')
 if non_skin(out)!=non_skin(source) or out['parts'][:3]!=source['parts'][:3]:raise ValueError('Protected model values changed')
 validate_native(out)
 return out,rows
if __name__=='__main__':
 s=pinned(SOURCE,SOURCE_SHA);r=pinned(REFERENCE,REFERENCE_SHA);out,rows=transfer(s,r);data=encode(out)
 receipt={'schema':'wildshard.puffer.source-rig-derivative.v1','sourceIdentity':IDENTITY,'rigProfile':'closed-anatomy-rig1','source':SOURCE,'sourceSha256':SOURCE_SHA,'weightReference':REFERENCE,'weightReferenceSha256':REFERENCE_SHA,'derivative':'art/driftwood-isle/puffer-complete-remaster/closed-anatomy-rig1-study/closed-anatomy-rig1-native.json','derivativeSha256':sha(data),'recipeSha256':sha(Path(__file__).read_bytes()),'nonSkinPayloadSha256':sha(non_skin(s)),'geometryPaintTopologyBindsMetadataExact':True,'bodyHeadTailSkinExact':True,'transferredFinPartsExactlyEqualPublicRig1':True,'changedWeightRows':552,'parts':rows,'nativeValidation':validate_native(out),'runtimeAdmission':False,'colliderAcceptance':False,'visualAcceptance':False,'animationAcceptance':False,'limitations':['Same visual geometry, no new likeness gain','No application/product build or promotion','Weighted local envelope audit and world physics/death remain separate','Inherited selected hull crossings remain unresolved']}
 for name,raw in [('closed-anatomy-rig1-native.json',data),('transfer-receipt.json',(json.dumps(receipt,indent=2)+'\n').encode())]:
  target=HERE/name
  with target.open('xb') as f:f.write(raw)
 print(json.dumps({'sourceIdentity':IDENTITY,'derivativeSha256':sha(data),'changedWeightRows':552}))
