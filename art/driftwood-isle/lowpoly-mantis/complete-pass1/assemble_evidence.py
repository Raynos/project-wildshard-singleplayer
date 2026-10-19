"""Label and resize real captures; no repainting or generated target pixels."""
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw,ImageFont
import json,hashlib,shutil
root=Path(__file__).resolve().parents[4];here=Path(__file__).resolve().parent;raw=root/'tmp/mantis-complete-pass1';font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',19)
views=['hero','front','left','right','back','top','diag-front','diag-left','diag-right','diag-back']
for candidate in ['baseline','candidate']:
 for view in views:
  im=Image.open(raw/candidate/(view+'.png')).convert('RGB');im.save(here/(candidate+'-'+view+'.webp'),quality=90,method=6)
 b=Image.new('RGB',(1080,1580),'#0b1722');d=ImageDraw.Draw(b);d.text((15,10),candidate.upper()+' / REAL MATCHED NINE',font=font,fill='white')
 for i,view in enumerate(views[1:]):
  x=(i%3)*360;y=45+(i//3)*505;im=ImageOps.contain(Image.open(raw/candidate/(view+'.png')),(350,470));b.paste(im,(x+(360-im.width)//2,y+28));d.text((x+12,y),view,font=font,fill='white')
 b.save(here/(candidate+'-nine-board.webp'),quality=88,method=6)
b=Image.new('RGB',(1440,1030),'#0b1722');d=ImageDraw.Draw(b)
ims=[Image.open(root/'art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/splinter-mantis-lowpoly.webp').crop((5,270,505,970)),Image.open(raw/'baseline/hero.png'),Image.open(raw/'candidate/hero.png')]
for i,(label,im) in enumerate(zip(['APPROVED ORIGINAL','V7 BASELINE','COMPLETE PASS1 / UNREVIEWED'],ims)):
 d.text((i*480+12,15),label,font=font,fill='white');im=ImageOps.contain(im,(460,940));b.paste(im,(i*480+(480-im.width)//2,55+(940-im.height)//2))
b.save(here/'matched-hero-board.webp',quality=90,method=6)
for name in ['mantis-study-complete-pass1.glb','mantis-mesh-complete-pass1.json','metrics-complete-pass1.json']:
 shutil.copyfile(raw/'candidate'/name,here/name)
shutil.copyfile(raw/'cameras.json',here/'cameras.json')
files=[p for p in here.iterdir() if p.is_file() and p.name!='evidence.json']
evidence={'status':'unreviewed static study; no promotion','rawFrames':'tmp/mantis-complete-pass1/{baseline,candidate}/{hero,front,left,right,back,top,diag-front,diag-left,diag-right,diag-back}.png','rawHashes':{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in raw.glob('*/*.png')},'files':{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}}
(here/'evidence.json').write_text(json.dumps(evidence,indent=2)+'\n')
