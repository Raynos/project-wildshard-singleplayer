"""Offline audit only: immutable identities and geometry/skin correspondence."""
import sys,json,hashlib,math,collections
from pathlib import Path
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(OUT));from prepare import PATHS
H=ROOT.parent/'wildshard-review-site-current/dist/puffer-engine'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
s=json.loads((ROOT/PATHS['selected']).read_bytes());p=json.loads((ROOT/PATHS['public70']).read_bytes())
rows=[]
for a,b in zip(s['parts'],p['parts']):
 fields={k:a[k]==b[k] for k in a};row={'name':a['name'],'equalFields':fields,'selectedTriangles':len(a['positions'])//9,'publicTriangles':len(b['positions'])//9}
 if a['name'].startswith('Volumetric connected '):
  changed=[i for i in range(len(a['positions'])//3) if a['skinIndices'][i*4:i*4+4]!=b['skinIndices'][i*4:i*4+4] or a['skinWeights'][i*4:i*4+4]!=b['skinWeights'][i*4:i*4+4]]
  row['changedWeightRows']=len(changed);row['changedUniqueCoordinates']=len({tuple(a['positions'][i*3:i*3+3]) for i in changed})
 rows.append(row)
pins=json.loads((ROOT/'practice/shared-arena/pins.json').read_text())['enemies']['puffer']
filechecks=[{'path':f,'expected':expected,'actual':sha(H/f) if (H/f).exists() else None} for f,expected in pins['files'].items()]
inv=ROOT.parent/'wildshard-review-site-current/dist/assets/arena-lighting-neutral-gray-v2/app-inventory.json'
inventory=json.loads(inv.read_text());invchecks=[{'path':r['path'],'expected':r['sha256'],'actual':sha(H/r['path']) if (H/r['path']).exists() else None} for r in inventory]
manifest=json.loads((H/'practice-product/shard.json').read_text())
named={f['name']:{'path':f['path'],'sha256':sha(H/'practice-product'/f['path'])} for f in manifest['files']}
dims=json.loads((ROOT/'art/driftwood-isle/approved-puffer/v70-gait5-dimensions.json').read_text())
oldSegment=dims['bodyHalfLen'];oldRadius=dims['bodyRadius'];by=dims['bodyY']
violations=[]
for pi,part in enumerate(s['parts']):
 for i in range(len(part['positions'])//3):
  if any(s['bones'][j]['name'] in ('body','belly') and w>0 for j,w in zip(part['skinIndices'][4*i:4*i+4],part['skinWeights'][4*i:4*i+4])):
   x,y,z=part['positions'][3*i:3*i+3];distance=math.sqrt(x*x+(y-by)**2+max(0,abs(z)-oldSegment)**2);gap=distance-oldRadius
   if gap>0:violations.append({'part':part['name'],'vertex':i,'outside':gap,'position':[x,y,z]})
from transfer_puffer_v70_rig1_weights import transfer_v70_native_bytes
try:
 transfer_v70_native_bytes((ROOT/PATHS['selected']).read_bytes())
 transfer_rejection='UNEXPECTED ACCEPT'
except ValueError as e:
 transfer_rejection=str(e)
report={'existingV70TransferRefusesSelected':transfer_rejection,'selectedSha256':sha(ROOT/PATHS['selected']),'publicSha256':sha(ROOT/PATHS['public70']),'exactOrderedBones':s['bones']==p['bones'],'parts':rows,'selectedBodyBellyVerticesOutsidePublicRestCapsule':len(violations),'worstPublicCapsuleViolation':max(violations,key=lambda v:v['outside']) if violations else None,'publicHost':'current Site77 retained puffer-engine host (local copy, no fresh network request)','publicPreview':json.loads((H/'puffer-preview.json').read_text()),'sharedArenaPinSha256':sha(ROOT/'practice/shared-arena/pins.json'),'sharedArenaContentSha256':sha(ROOT/'practice/shared-arena/content.ts'),'publicProductSourceHash':manifest['build']['sourceHash'],'sharedArenaFileChecks':filechecks,'fallbackAppInventorySha256':sha(inv),'fallbackAppInventoryChecks':invchecks,'namedFiles':named}
(OUT/'source-and-host-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'parts':rows,'oldCapsuleViolations':len(violations),'worst':report['worstPublicCapsuleViolation'],'sharedPins':len(filechecks),'sharedMismatches':[r for r in filechecks if r['expected']!=r['actual']],'inventoryCount':len(invchecks),'inventoryMismatches':[r for r in invchecks if r['expected']!=r['actual']]}))
