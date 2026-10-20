"""Package bounded review previews only; raw PNGs stay ignored. Does not score likeness."""
import json,hashlib,shutil
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
RAW=ROOT/'tmp/pitcher-complete-next-20261020';FINAL=RAW/'final';BASE=RAW/'baseline'
views=['hero','front','left','right','back','top','elevated-front','elevated-left','elevated-right','elevated-back']
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def label(image,title):
 image=image.convert('RGB');d=ImageDraw.Draw(image);d.rectangle((0,0,image.width,36),fill='#142331');d.text((9,8),title,font=ImageFont.truetype(font,14),fill='white');return image
for path,title,output in [(FINAL,'NEXT ACTUAL SOURCE',HERE),(BASE,'V3 SAME-RUN BASELINE',HERE/'baseline')]:
 output.mkdir(exist_ok=True)
 for view in views:
  im=Image.open(path/(view+'.png')).resize((480,576));label(im,title+' / '+view.upper()).save(output/(view+'.webp'),quality=68)
for name in ['native-source.json','metadata.json','payload.bin','brine-pitcher-v1.glb','construction.json','source-audit.json','cameras.json']:
 shutil.copyfile(FINAL/name,HERE/name)
hero=Image.open(ROOT/'art/driftwood-isle/concepts/approved-nine-2026-10-19/brine-pitcher-hero.png').convert('RGB')
board=Image.new('RGB',(1440,636),'#142331')
for i,(im,title) in enumerate([(hero,'APPROVED AI HERO'),(Image.open(BASE/'hero.png'),'V3 SAME-RUN ACTUAL'),(Image.open(FINAL/'hero.png'),'NEXT ACTUAL / UNACCEPTED')]):
 im=im.convert('RGB');im.thumbnail((480,590));board.paste(im,(i*480+(480-im.width)//2,40+(590-im.height)//2));d=ImageDraw.Draw(board);d.text((i*480+12,12),title,font=ImageFont.truetype(font,17),fill='white')
board.save(HERE/'paired-hero-board.webp',quality=70)
board=Image.new('RGB',(1200,1200),'#142331');d=ImageDraw.Draw(board)
for i,view in enumerate(views[1:]):
 x=i%3*400;y=i//3*400;d.text((x+7,y+8),view.upper()+' | V3 / NEXT',font=ImageFont.truetype(font,16),fill='white')
 for j,path in enumerate([BASE,FINAL]):
  im=Image.open(path/(view+'.png')).convert('RGB');im.thumbnail((196,350));board.paste(im,(x+j*200+(200-im.width)//2,y+38))
board.save(HERE/'baseline-paired-nine-board.webp',quality=68)
label(Image.open(RAW/'candidate/hero.png').resize((480,576)),'FAILED CLOSED-HOOD INTERMEDIATE').save(HERE/'failed-closed-hood/hero.webp',quality=66)
receipt={'schema':'wildshard.pitcher.complete-next.captures.v1','rawDirectory':str(RAW.relative_to(ROOT)),'candidate':'final','baseline':'baseline','failedIntermediate':'candidate','actualSourceRenders':True,'nativeRuntimeRenders':False,'cameraLightingUnchanged':True,'rubric':{'silhouette':.35,'mouthExpression':.30,'details':.20,'facetStyle':.15},'score':None,'visualAcceptance':False,'runtimeAcceptance':False,'rawImageHashes':{f'{kind}/{view}.png':hashlib.sha256((RAW/kind/(view+'.png')).read_bytes()).hexdigest() for kind in ['final','baseline','candidate'] for view in views},'files':{str(p.relative_to(HERE)):{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in sorted(HERE.rglob('*')) if p.is_file() and '__pycache__' not in str(p) and p.name not in ['checkpoint.json','capture-provenance.json']}}
(HERE/'capture-provenance.json').write_text(json.dumps(receipt,indent=2)+'\n')
print('packaged',len(receipt['files']),'files')
