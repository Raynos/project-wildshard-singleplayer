"""Label full-frame delivery derivatives only. Never alter original renderer PNGs."""
from pathlib import Path
import argparse
from io import BytesIO
import hashlib
import json
from PIL import Image,ImageDraw,ImageFont,__version__
p=argparse.ArgumentParser();p.add_argument('--raw',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();raw=a.raw.resolve();out=a.out.resolve()
if out.exists():raise RuntimeError('Refuse existing preview attempt')
out.mkdir(parents=True)
sha=lambda b:hashlib.sha256(b).hexdigest();receipt=json.loads((raw/'capture-receipt.json').read_bytes());frames={r['file']:r for r in receipt['frames']};assert len(frames)==20
for name,row in frames.items():assert sha((raw/name).read_bytes())==row['sha256']
font=ImageFont.truetype('DejaVuSans.ttf',24);small=ImageFont.truetype('DejaVuSans.ttf',18);title=ImageFont.truetype('DejaVuSans.ttf',30)
def load(name):
 image=Image.open(raw/name);assert image.size==tuple(frames[name]['resolution']);return image.convert('RGB')
def encode(image,name,cap):
 original=image
 for scale in [1,.9,.8,.7]:
  image=original if scale==1 else original.resize((round(original.width*scale),round(original.height*scale)),Image.Resampling.LANCZOS)
  for quality in [84,80,76,72,68,64,60]:
   buf=BytesIO();image.save(buf,format='WEBP',quality=quality,method=6)
   if len(buf.getvalue())<=cap:
    data=buf.getvalue();(out/name).write_bytes(data);return {'file':name,'bytes':len(data),'sha256':sha(data),'resolution':list(image.size),'preEncodingResolution':list(original.size),'deliveryScale':scale,'quality':quality,'method':6}
 raise RuntimeError('Preview cannot fit budget; original frames retained')

results=[]
groups=[['front','left','right'],['back','top','diag-front'],['diag-left','diag-right','diag-back']]
for index,views in enumerate(groups,1):
 board=Image.new('RGB',(1060,2360),(21,29,40));draw=ImageDraw.Draw(board);draw.text((24,18),f'Conch | matched static source | sheet {index}/3',font=title,fill='white');draw.text((24,66),'SELECTED BASELINE',font=font,fill=(222,225,230));draw.text((548,66),'ARTICULATED CANDIDATE',font=font,fill=(222,225,230))
 sources=[]
 for row,view in enumerate(views):
  top=110+row*735;draw.text((24,top),view.upper(),font=font,fill='white')
  for column,variant in enumerate(['selected','articulated']):
   name=f'{view}-{variant}.png';im=load(name);board.paste(im,(24+column*524,top+30));sources.append(frames[name])
 draw.text((24,2322),'Actual frozen geometry | no pose edits | static only, not quality/motion admission',font=small,fill=(207,217,227))
 r=encode(board,f'matched-static-sheet-{index}.webp',105000);r.update(sources=sources,operations=['Opaque RGB conversion','Full-frame side-by-side placement at original pixel dimensions; no crop or image retouch','Labels in outside margins','Optional additional delivery-only LANCZOS scale, recorded explicitly','Lossy WebP encoding']);results.append(r)
board=Image.new('RGB',(1600,1070),(21,29,40));draw=ImageDraw.Draw(board);draw.text((20,16),'SELECTED BASELINE | retained hero',font=title,fill='white');draw.text((820,16),'ARTICULATED CANDIDATE | same hero',font=title,fill='white')
for x,variant in [(10,'selected'),(810,'articulated')]:board.paste(load(f'hero-{variant}.png'),(x,62))
draw.text((20,1036),'Actual frozen models | same original camera, materials and lighting | no motion/quality admission',font=small,fill=(207,217,227))
r=encode(board,'matched-static-hero-board.webp',100000);r.update(sources=[frames[f'hero-{v}.png'] for v in ['selected','articulated']],operations=['Opaque RGB conversion','Original full-frame pixels arranged side by side; no crop','Labels outside frames','Optional additional delivery-only LANCZOS scale, recorded explicitly','Lossy WebP encoding']);results.append(r)
for name,row in frames.items():
 im=load(name);im.thumbnail((360,600),Image.Resampling.LANCZOS)
 r=encode(im,Path(name).stem+'.webp',14000);r.update(sources=[row],operations=['Opaque RGB conversion','Aspect-preserving LANCZOS thumbnail, max360x600','Optional additional delivery-only LANCZOS scale, recorded explicitly','Lossy WebP encoding; raw frame unchanged']);results.append(r)
for name,row in frames.items():assert sha((raw/name).read_bytes())==row['sha256']
manifest={'status':'delivery previews, raw captures unchanged','pillow':__version__,'sourceReceiptSha256':sha((raw/'capture-receipt.json').read_bytes()),'converterSha256':sha(Path(__file__).read_bytes()),'totalPreviewBytes':sum(r['bytes'] for r in results),'outputs':results}
assert manifest['totalPreviewBytes']<=700000
(out/'preview-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps({'files':len(results),'totalBytes':manifest['totalPreviewBytes']}))
