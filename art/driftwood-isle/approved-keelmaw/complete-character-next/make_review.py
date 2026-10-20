"""Pinned actual source capture pairs, no AI-render substitution or image warp."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
RAW=ROOT/'tmp/keelmaw-complete-character';OUT=HERE/'review';OUT.mkdir(exist_ok=True)
REF=ROOT/'art/driftwood-isle/concepts/approved-nine-2026-10-19'
views=['front','left','right','back','top','elevated-front','elevated-left','elevated-right','elevated-back']
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def label(im,words,size=16):
 d=ImageDraw.Draw(im);d.rectangle((0,0,im.width,36),fill='#142331');d.text((10,8),words,font=ImageFont.truetype(font,size),fill='white')
def fit(im,size):
 im=im.copy();im.thumbnail(size);return im
pins=[]
for variant,dirname in [('candidate','final'),('baseline','baseline')]:
 for name in ['hero']+views:
  p=RAW/dirname/(name+'.png');im=Image.open(p).convert('RGB');pins.append({'role':variant,'view':name,'path':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'dimensions':list(im.size)})
  im=im.resize((480,576));label(im,'ACTUAL '+variant.upper()+' / '+name.upper(),14);im.save(OUT/(variant+'-'+name+'.webp'),quality=72)
for kind,file in [('explorer','keelmawExplorerCorrectedGen.png'),('world','keelmawWorldGen.png')]:
 sheet=Image.open(REF/file).convert('RGB');w,h=sheet.size;board=Image.new('RGB',(1500,1260),'#142331');d=ImageDraw.Draw(board);d.text((15,8),'KEELMAW | AI '+kind.upper()+' / FRESH BASELINE / COMPLETE CANDIDATE',font=ImageFont.truetype(font,21),fill='white')
 for i,name in enumerate(views):
  col=i%3;row=i//3;x=col*500;y=44+row*390
  crop=sheet.crop((int(col*w/3),int((.04+row*.3033333333)*h),int((col+1)*w/3),int((.04+(row+1)*.3033333333)*h)))
  d.text((x+8,y+4),name.upper(),font=ImageFont.truetype(font,17),fill='white')
  for k,(heading,im) in enumerate([('AI REFERENCE',crop),('BASELINE',Image.open(RAW/'baseline'/(name+'.png'))),('CANDIDATE',Image.open(RAW/'final'/(name+'.png'))) ]):
   d.text((x+k*166+4,y+28),heading,font=ImageFont.truetype(font,13),fill='white');im=fit(im,(162,330));board.paste(im,(x+k*166+(166-im.width)//2,y+53+(330-im.height)//2))
 d.text((15,1220),'Actual source renders, not gameplay. Original hero authoritative; AI hidden-angle anatomy/cameras approximate.',font=ImageFont.truetype(font,19),fill='white');board.save(OUT/(kind+'-matched-nine-board.webp'),quality=72)
board=Image.new('RGB',(1500,720),'#142331');d=ImageDraw.Draw(board)
for k,(title,path) in enumerate([('AUTHORITATIVE AI HERO',REF/'keelmaw-hero.png'),('FRESH BASELINE',RAW/'baseline/hero.png'),('COMPLETE CANDIDATE',RAW/'final/hero.png')]):
 d.text((k*500+12,12),title,font=ImageFont.truetype(font,20),fill='white');im=fit(Image.open(path).convert('RGB'),(495,650));board.paste(im,(k*500+(500-im.width)//2,48+(650-im.height)//2))
board.save(OUT/'hero-matched-board.webp',quality=75)
c=json.loads((RAW/'final/cameras.json').read_text());b=json.loads((RAW/'baseline/cameras.json').read_text());keys=['name','azimuthDegrees','elevationDegrees','orthoScale','cameraRollDegrees','targetBlender','cameraBlender','resolution','samples']
assert [{k:r[k] for k in keys} for r in c]==[{k:r[k] for k in keys} for r in b]
receipt={'scope':'Matched actual Blender source mesh renders. Native and GLB exact structural parity audited separately. Not native runtime admission or gameplay.','cameraProtocol':'Same explicit camera, target, orthographic scale, lighting, resolution, samples and ground for baseline and candidate; no per-image crops. Top rolls 90 degrees to match Explorer category. AI world top differs. Fresh paired framing differs from historical clipped renders.','cameraEquality':True,'rawCameraBoundsValid':False,'framingCorrection':'Pre-render Blender camera matrices were stale; use independent verifiedFraming below, not raw cameras.json framingNDC. Rendered PNG cameras are current.','verifiedFraming':{v:json.loads((RAW/d/'verified-framing.json').read_text()) for v,d in [('candidate','final'),('baseline','baseline')]},'candidateCameras':c,'baselineCameras':b,'rawPins':pins,'referencePins':[{ 'path':str((REF/n).relative_to(ROOT)),'sha256':hashlib.sha256((REF/n).read_bytes()).hexdigest()} for n in ['keelmaw-hero.png','keelmawWorldGen.png','keelmawExplorerCorrectedGen.png']]}
(OUT/'capture-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
for p in OUT.glob('*.webp'):assert p.stat().st_size< (500000 if 'board' in p.name else 250000),(p,p.stat().st_size)
print('MATCHED_CAPTURES',len(pins),'RAW_PNGS',sum(p.stat().st_size for p in OUT.glob('*.webp')),'PREVIEW_BYTES')
