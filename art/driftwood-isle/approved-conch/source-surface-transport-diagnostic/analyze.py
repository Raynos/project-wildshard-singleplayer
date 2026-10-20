"""Post-capture verification only. No tuning or image-based parameter search."""
from pathlib import Path
import json,hashlib
from PIL import Image,ImageDraw
import numpy as np
D=Path(__file__).parent; E=D/'evidence';report=json.loads((E/'report.json').read_text());assert report['completed'] and not report['errors'];assert report['hostBefore']==report['hostAfter'];assert all(report['restored'].values())
rows=[]
for pair in report['pairs']:
 view=pair['view'];ob=json.loads((E/pair['file']).read_text());st=ob['states'];base=st['baseline-native'];raw=st['raw-source'];cand=st['source-contract-native'];rest=st['restored-baseline']
 images={k:np.asarray(Image.open(E/v['file']).convert('RGB')).astype(np.int16) for k,v in pair['images'].items()}
 assert np.array_equal(images['baseline-native'],images['restored-baseline'])
 for s in st.values():
  for key in ['lights','rig','clocks','shadow','renderer','composer']:assert s[key]==base[key],(view,key)
  assert s['comparison']['camera']==base['comparison']['camera']
  assert all(d['castShadow'] and d['receiveShadow'] for d in s['draws'])
  assert all(d['camera']==base['draws'][0]['camera'] for d in s['draws'])
  assert s['rig']['root']==s['rig']['sourceRoot']
 assert len(cand['draws'])==len(raw['draws'])==95
 cm={d['material']['name']:d['material'] for d in cand['draws']};rm={d['material']['name']:d['material'] for d in raw['draws']};assert cm==rm
 for draw in cand['draws']+raw['draws']:
  mat=draw['material'];assert mat['type']=='MeshStandardMaterial' and mat['vertexColors']==False and mat['flatShading']==False and mat['side']==2
 for kind in ['source-contract-native','raw-source']:
  program_ids=set(d['program'] for d in st[kind]['draws']); assert len(program_ids)==1
  shaders=ob['shaders'][next(iter(program_ids))]
  for sh in shaders: assert hashlib.sha256((E/sh['file']).read_bytes()).hexdigest()==sh['sha256']
 ci=cand['draws'][0]['program'];ri=raw['draws'][0]['program']
 cs={sh['type']:(E/sh['file']).read_text() for sh in ob['shaders'][ci]};rs={sh['type']:(E/sh['file']).read_text() for sh in ob['shaders'][ri]}
 assert cs[35632]==rs[35632]
 assert cs[35633].replace('#define USE_SKINNING\n','')==rs[35633]
 assert '#define SHADOWMAP_TYPE_PCF' in cs[35633] and '#define SHADOWMAP_TYPE_PCF' in rs[35633]
 delta=np.abs(images['source-contract-native']-images['raw-source']);mask=np.any(delta,axis=2);ys,xs=np.where(mask)
 baseline=np.abs(images['baseline-native']-images['raw-source'])
 rows.append({'view':view,'sourceNativeVsRaw':{'differentPixels':int(mask.sum()),'totalPixels':int(mask.size),'meanAbsoluteChannelDelta':float(delta.mean()),'maximumChannelDelta':int(delta.max()),'pixelsOver8':int(np.any(delta>8,axis=2).sum()),'differenceBounds':[int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())] if len(xs) else None},'baselineVsRaw':{'differentPixels':int(np.any(baseline,axis=2).sum()),'meanAbsoluteChannelDelta':float(baseline.mean())},'restoredBaselineByteIdentical':pair['images']['baseline-native']['sha256']==pair['images']['restored-baseline']['sha256']})
result={'scope':'Descriptive residuals only; not image tuning, likeness score, performance or admission','quartets':rows,'hostUnchanged':True,'allStateChecks':True,'sourceMaterialSettingsEqual':True,'fragmentShadersIdentical':True,'vertexShaderOnlyDifference':'USE_SKINNING','filter':'unchanged PCF','nativeDrawGroups':95,'productionPerformanceClaim':False}
(D/'analysis.json').write_text(json.dumps(result,indent=2)+'\n')
for kind in ['baseline-native','source-contract-native','raw-source']:
 board=Image.new('RGB',(402*3,906*3),'#111111');draw=ImageDraw.Draw(board)
 for i,pair in enumerate(report['pairs']):
  x=i%3*402;y=i//3*906;draw.text((x+8,y+8),pair['view']+' | '+kind,fill='white');board.paste(Image.open(E/pair['images'][kind]['file']),(x,y+32))
 board.save(D/(kind+'-nine-view.jpg'),quality=88)
print(json.dumps(result,indent=2))
