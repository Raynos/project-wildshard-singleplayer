"""Preserve real source capture pairs and exact provenance; no scores or acceptance."""
from pathlib import Path
import hashlib,json
from PIL import Image,ImageDraw,ImageFont
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3];RAW=ROOT/'tmp/pitcher-grown-fan-20261020'
views=['hero','front','left','right','back','top','elevated-front','elevated-left','elevated-right','elevated-back']
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def label(im,title):
 im=im.convert('RGB');d=ImageDraw.Draw(im);d.rectangle((0,0,im.width,34),fill='#142331');d.text((7,8),title,font=ImageFont.truetype(font,13),fill='white');return im
for kind,title,dest in [('final','GROWN FAN / ACTUAL',HERE),('predecessor','SELECTED NEXT / ACTUAL',HERE/'predecessor')]:
 dest.mkdir(exist_ok=True)
 for view in views:label(Image.open(RAW/kind/(view+'.png')).resize((480,576)),title+' / '+view.upper()).save(dest/(view+'.webp'),quality=68)
board=Image.new('RGB',(1440,636),'#142331');d=ImageDraw.Draw(board)
hero=ROOT/'art/driftwood-isle/concepts/approved-nine-2026-10-19/brine-pitcher-hero.png'
for i,(path,title) in enumerate([(hero,'APPROVED HERO'),(RAW/'predecessor/hero.png','SELECTED NEXT / ACTUAL'),(RAW/'final/hero.png','GROWN FAN / UNACCEPTED')]):
 im=Image.open(path).convert('RGB');im.thumbnail((480,590));board.paste(im,(i*480+(480-im.width)//2,40+(590-im.height)//2));d.text((i*480+9,12),title,font=ImageFont.truetype(font,17),fill='white')
board.save(HERE/'paired-hero-board.webp',quality=70)
board=Image.new('RGB',(1200,1200),'#142331');d=ImageDraw.Draw(board)
for i,view in enumerate(views[1:]):
 x=i%3*400;y=i//3*400;d.text((x+7,y+8),view.upper()+' | NEXT / GROWN FAN',font=ImageFont.truetype(font,13),fill='white')
 for j,kind in enumerate(['predecessor','final']):
  im=Image.open(RAW/kind/(view+'.png')).convert('RGB');im.thumbnail((196,350));board.paste(im,(x+j*200+(200-im.width)//2,y+38))
board.save(HERE/'paired-nine-board.webp',quality=68)
board=Image.new('RGB',(960,636),'#142331');d=ImageDraw.Draw(board)
for i,kind in enumerate(['predecessor','candidate']):
 im=Image.open(RAW/('supplemental-'+kind)/'hero.png').convert('RGB');im.thumbnail((480,590));board.paste(im,(i*480+(480-im.width)//2,40+(590-im.height)//2));d.text((i*480+9,12),kind.upper()+' / SCALE 6 / SUPPLEMENT',font=ImageFont.truetype(font,15),fill='white')
board.save(HERE/'supplemental-hero-board.webp',quality=70)
paths=[p for p in RAW.rglob('*') if p.is_file()]
receipt={'schema':'wildshard.pitcher.grown-fan.captures.v1','rawDirectory':str(RAW.relative_to(ROOT)),'sourceRenders':True,'nativeRuntimeRenders':False,'scoringCameraLightingUnchanged':True,'predecessorFreshRerender':True,'supplementalOnlyChange':'orthographic scale 6 identically on both hero views','score':None,'visualAcceptance':False,'runtimeAcceptance':False,'files':{str(p.relative_to(ROOT)):{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in paths}}
(HERE/'raw-evidence-manifest.json').write_text(json.dumps(receipt,indent=2)+'\n')
# Freeze actual source export alongside script milestone; deterministic source equality is checked.
for name in ['native-source.json','payload.bin','metadata.json']:
 assert (HERE/name).read_bytes()==(RAW/'final'/name).read_bytes(),name
print('packaged',len(paths),'raw files')
