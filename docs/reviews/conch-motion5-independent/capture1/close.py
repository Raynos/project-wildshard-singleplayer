import json,hashlib
from pathlib import Path
p=Path('tmp/conch-motion5-qa/actual-run1');o=Path('docs/reviews/conch-motion5-independent/capture1');s=json.loads((p/'run-summary.json').read_text());r=json.loads((p/'report.json').read_text())
paths={'source':'art/driftwood-isle/approved-conch/motion5-study/conchMotion5Preview.ts','sourceFreeze':'art/driftwood-isle/approved-conch/motion5-study/freeze-manifest.json','buildPin':'tmp/conch-motion5-preview/reviewed-build-pin.json','hostInventory':'tmp/conch-motion5-preview-dist/motion5-host-files.json','preview':'tmp/conch-motion5-preview-dist/conch-preview.json','video':str(next((p/'video').glob('*.webm'))),'trace':str(p/'render-trace.json'),'events':str(p/'events.json'),'geometry':str(p/'runtime-geometry.json'),'contact':str(p/'weighted-contact.json'),'framesIndex':str(p/'streamed-frame-review/index.json'),'actualReport':str(p/'report.json'),'mountedReport':'tmp/conch-motion5-qa/mounted-run1/report.json'}
checks={}
for k,v in paths.items():
 if k=='source':continue
 h=hashlib.sha256(Path(v).read_bytes()).hexdigest();assert h==s['hashes'][k],(k,h);checks[k]={'path':v,'sha256':h,'matches':True}
h=hashlib.sha256((p/'encoded-frames.json').read_bytes()).hexdigest();assert h==r['encodedFramesSha256'];checks['encodedFrames']={'sha256':h,'matches':True}
(o/'hash-verification.json').write_text(json.dumps(checks,indent=2)+'\n')
cycles=[{'kind':c['kind'],'firstObservation':c['start']['frame'],'lastObservation':c['end']['frame'],'startWallSeconds':c['start']['wallTime']/1000,'endWallSeconds':c['end']['wallTime']/1000,'uninterrupted':c.get('uninterrupted',False)} for c in r['coverage']['cycles'] if c.get('complete')]
(o/'cycle-ranges.json').write_text(json.dumps(cycles,indent=2)+'\n')
print('Verified',len(checks),'hashes; cycles',len(cycles),'uninterrupted',sum(c['uninterrupted'] for c in cycles))
v=json.loads(Path('tmp/conch-motion5-preview-dist/conch-preview.json').read_text());i=json.loads(Path('tmp/conch-motion5-preview/motion5/product/shard.json').read_text())
assert v['sourceHash']==i['build']['sourceHash']==s['hashes']['source']
checks['productSourceHash']={'value':v['sourceHash'],'matches':True,'method':'Equality of validated product build.sourceHash, preview.sourceHash and run-summary.hashes.source; not independently rebuilt.'}
f=Path(paths['source']);fh=hashlib.sha256(f.read_bytes()).hexdigest();assert fh==json.loads(Path(paths['sourceFreeze']).read_text())['files'][str(f)]
checks['factoryFile']={'path':str(f),'sha256':fh,'matchesFrozenManifest':True}
(o/'hash-verification.json').write_text(json.dumps(checks,indent=2)+'\n')
