"""Label and downsize actual 3D captures without altering their content."""
from pathlib import Path
import json,hashlib
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parent;raw=root.parents[2]/'tmp/pearlglass-medusa-v2';out=root/'v2';font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18);small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
views=['front','left','right','back','top','elevated-front','elevated-left','elevated-right','elevated-back'];board=Image.new('RGB',(900,1200),'#182733');draw=ImageDraw.Draw(board);draw.text((20,14),'PEARLGLASS MEDUSA | AUTHORED V2',font=font,fill='white');draw.text((20,40),'Actual 3D source captures. Candidate, not gameplay acceptance.',font=small,fill='#adc8d6');receipts=[]
for idx,name in enumerate(['hero']+views):
 src=raw/(name+'.png');im=Image.open(src).convert('RGB');canvas=Image.new('RGB',(600,766),'#182733');canvas.paste(im,(0,46));d=ImageDraw.Draw(canvas);d.text((12,8),'MEDUSA V2 | '+name.upper(),font=font,fill='white');d.text((12,29),'Actual authored 3D capture | +Y-up native rig',font=small,fill='#adc8d6');dest=out/(name+'.webp');canvas.save(dest,quality=80,method=6);assert dest.stat().st_size<250000
 receipts.append({'view':name,'rawSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'previewSha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'bytes':dest.stat().st_size})
 if idx:
  tile=canvas.resize((300,383),Image.Resampling.LANCZOS);board.paste(tile,(((idx-1)%3)*300,65+((idx-1)//3)*378))
board.save(out/'nine-view-board.webp',quality=80,method=6);assert (out/'nine-view-board.webp').stat().st_size<500000;(out/'capture-provenance.json').write_text(json.dumps(receipts,indent=2)+'\n')
Image.open(root.parents[2]/'tmp/pearlglass-medusa-v1/hero.png').save(root/'failed-first-pass-hero.webp',quality=78)
print('Prepared actual hero and nine views; raw captures retained separately.')
