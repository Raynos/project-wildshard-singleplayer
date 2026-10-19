"""Compose a coordinator-authorized static study, never a runtime admission.

Reuses the existing exact semantic ownership checker unchanged. This wrapper's
explicit static-study approval does NOT fill or satisfy the existing harness's
final admission file. Known exposed roots remain defects for visual review.
"""
import hashlib,json,sys
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sys.path.insert(0,str(HERE.parent/'puffer-remaster-assembly'))
import assemble
sys.path.insert(0,str(HERE.parent/'approved-puffer'))
from native_export import validate_native

def build():
 approval=json.loads((HERE/'static-study-approval.json').read_text())
 if approval['scope']!='static complete study only; no runtime admission':raise ValueError('Wrong approval scope')
 pins=json.loads((HERE.parent/'puffer-remaster-assembly/source-pins.json').read_text())
 if approval['componentPins']!=pins:raise ValueError('Changed component tuple')
 body=assemble.load_pin(approval['body'])
 audit=assemble.load_pin(approval['attachmentAudit'])
 if audit['body']['sha256']!=approval['body']['sha256'] or audit['componentPins']!=pins:raise ValueError('Stale audit')
 if not all(audit['checks'].values()):raise ValueError('Changed attachment checks failed')
 actual=[{'name':x['name'],'maxSignedDistance':x['maxSignedDistance']} for x in audit['inheritedExceptions']]
 if approval['preservedExposedRootDefects']!=actual:raise ValueError('Unreviewed attachment exception')
 source={k:assemble.load_pin(p) for k,p in pins.items()}
 result,ownership=assemble.compose_checked(body,source)
 result['status']='Unaccepted complete static remaster study; exposed inherited roots retained as defects; NOT runtime admitted'
 stats=validate_native(result)
 return result,{'staticNativeSchema':stats,'semanticOwnership':ownership,'runtimeAdmitted':False,'qualityScore':None,'approvalSha256':hashlib.sha256((HERE/'static-study-approval.json').read_bytes()).hexdigest()}
if __name__=='__main__':
 result,receipt=build();dest=HERE/'complete-native.json'
 with dest.open('x') as f:f.write(json.dumps(result,separators=(',',':'),allow_nan=False)+'\n')
 receipt['candidateSha256']=hashlib.sha256(dest.read_bytes()).hexdigest();receipt['candidateBytes']=dest.stat().st_size
 with (HERE/'assembly-receipt.json').open('x') as f:json.dump(receipt,f,indent=2);f.write('\n')
 print(json.dumps(receipt,indent=2))
