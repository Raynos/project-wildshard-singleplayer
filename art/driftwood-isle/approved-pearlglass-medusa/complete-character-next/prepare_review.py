"""Downsize actual source captures, retaining raw hashes and matched v2 pairs."""
from pathlib import Path
import json,hashlib
from PIL import Image,ImageDraw,ImageFont
out=Path(__file__).resolve().parent;root=out.parents[3];raw=root/'tmp/pearlglass-medusa-complete-next';old=root/'tmp/pearlglass-medusa-v2'
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18);small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
views=['hero','front','left','right','back','top','elevated-front','elevated-left','elevated-right','elevated-back'];receipts=[]
board=Image.new('RGB',(900,1200),'#182733');draw=ImageDraw.Draw(board);draw.text((16,12),'MEDUSA | COMPLETE CHARACTER NEXT',font=font,fill='white');draw.text((16,38),'Actual 3D source captures. No runtime or quality admission.',font=small,fill='#adc8d6')
for idx,name in enumerate(views):
 src=raw/(name+'.png');im=Image.open(src).convert('RGB');assert im.size==(600,720)
 canvas=Image.new('RGB',(600,766),'#182733');canvas.paste(im,(0,46));d=ImageDraw.Draw(canvas);d.text((12,7),'MEDUSA COMPLETE NEXT | '+name.upper(),font=font,fill='white');d.text((12,29),'Actual authored 3D capture | not a game screenshot',font=small,fill='#adc8d6');dest=out/(name+'.webp');canvas.save(dest,quality=80,method=6);assert dest.stat().st_size<250000
 prev=old/(name+'.png');oldimage=Image.open(prev).convert('RGB');assert oldimage.size==im.size
 pair=Image.new('RGB',(1200,766),'#182733');pair.paste(oldimage,(0,46));pair.paste(im,(600,46));pd=ImageDraw.Draw(pair);pd.text((12,8),'V2 | '+name.upper(),font=font,fill='white');pd.text((612,8),'COMPLETE NEXT | '+name.upper(),font=font,fill='white');pd.text((12,29),'Matched actual source cameras / lighting. Neither is gameplay evidence.',font=small,fill='#adc8d6');paired=out/(name+'-paired.webp');pair.save(paired,quality=78,method=6);assert paired.stat().st_size<250000
 receipts.append({'view':name,'rawSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'v2RawSha256':hashlib.sha256(prev.read_bytes()).hexdigest(),'previewSha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'pairedSha256':hashlib.sha256(paired.read_bytes()).hexdigest(),'rawDimensions':list(im.size)})
 if idx:board.paste(canvas.resize((300,383),Image.Resampling.LANCZOS),(((idx-1)%3)*300,65+((idx-1)//3)*378))
board.save(out/'nine-view-board.webp',quality=80,method=6);assert (out/'nine-view-board.webp').stat().st_size<500000
(out/'capture-provenance.json').write_text(json.dumps(receipts,indent=2)+'\n')
print('Prepared ten source previews, ten matched v2 pairs and nine-view board.')
