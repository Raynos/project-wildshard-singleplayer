"""Fail closed on paired controls; read actual PNGs, never synthesize capture evidence."""
import json,hashlib,pathlib
from PIL import Image,ImageChops,ImageDraw
out=pathlib.Path('tmp/conch-color-view-qa/received-shadow-attempt1')
r=json.loads((out/'report.json').read_text())
assert r['completed'] and not r['errors'] and len(r['pairs'])==9
assert r['identityBefore']==r['identityAfter']
assert r['setup']['initial']==r['restored']
prior=json.loads(pathlib.Path('tmp/conch-color-view-qa/attempt1/actual-runtime-geometry.json').read_text())
actual=json.loads((out/'actual-runtime-geometry.json').read_text())
for key in ['geometry','candidateGraph','baselineGraph','bounds','directions']:assert prior[key]==actual[key]
summary=[]
for p in r['pairs']:
 assert p['onRestoredByteIdentical'] and not p['onOffByteIdentical']
 a,b,c=[p['states'][s] for s in ['on','off','restored']]
 for k in ['lights','root','camera','gameFrame','gameTime']:assert a[k]==b[k]==c[k],k
 # Before warm-up is the prior camera's CSM transform; compare rendered states only.
 for s,receive in [(a,True),(b,False),(c,True)]:
  for m,original in zip(s['meshes'],p['before']):
   assert m['receiveShadow']==receive and m['castShadow']==original['castShadow']==True
   expected=dict(original,receiveShadow=receive);assert m==expected
 assert p['before']==p['after']
 for aa,bb,cc in zip(a['programs'],b['programs'],c['programs']):
  for ap,bp,cp in zip(aa,bb,cc):
   assert ap['programId']==cp['programId']!=bp['programId']
   assert ap['fragment']==cp['fragment']!=bp['fragment']
 view=p['common']['view'];im1=Image.open(out/f'{view}-on.png').convert('RGB');im2=Image.open(out/f'{view}-off.png').convert('RGB')
 diff=ImageChops.difference(im1,im2);n=sum(px!=(0,0,0) for px in diff.get_flattened_data())
 summary.append(dict(view=view,changedPixels=n,diffBounds=diff.getbbox(),onRestoredByteIdentical=True,onProgram=a['programs'][0][0]['programId'],offProgram=b['programs'][0][0]['programId']))
for label in ['on','off']:
 shader=r['pairs'][0]['states'][label]['programs'][0][0]['fragment'];(out/f'actual-candidate-{label}.frag').write_text(shader)
# Contact sheet is labelled crops of genuine captures, for review only; raw captures retained.
for batch in range(3):
 sheet=Image.new('RGB',(804,3*520),'#181820');d=ImageDraw.Draw(sheet)
 for row,p in enumerate(r['pairs'][batch*3:batch*3+3]):
  view=p['common']['view']
  for col,label in enumerate(['on','off']):
   im=Image.open(out/f'{view}-{label}.png').convert('RGB');sheet.paste(im.crop((0,250,402,750)),(col*402,row*520+20));d.text((col*402+8,row*520+3),f'{view}: receiveShadow {label.upper()} (crop)',fill='white')
 sheet.save(out/f'review-crops-{batch+1}.webp',quality=90)
bytes_=sum(f.stat().st_size for f in out.rglob('*') if f.is_file());assert bytes_<35*1024*1024
summary={'checks':'All paired controls passed','pairs':summary,'outputBytes':bytes_,'pngCount':len(list(out.glob('*.png'))),'identityUnchanged':True,'allOriginalFlagsRestored':True}
(out/'verification.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
