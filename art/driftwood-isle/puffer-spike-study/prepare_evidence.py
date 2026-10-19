"""Compose actual rendered frames into one labelled portrait comparison.

Images stay in ignored temporary/native Site storage, never Git. Geometry is
rendered by render_comparison.py; this script adds labels, not model pixels.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
p=argparse.ArgumentParser();p.add_argument('--renders',type=Path,required=True);a=p.parse_args()
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',22)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
board=Image.new('RGB',(1200,2380),'#101c27');draw=ImageDraw.Draw(board)
draw.text((22,16),'BRINE PUFFER | SPIKE HIERARCHY STUDY',font=font,fill='white')
draw.text((22,50),'Actual Blender bind mesh | One proposal | Unaccepted | No whole-model score',font=small,fill='#bad2dc')
files=[]
for row,shot in enumerate(('hero','front','elevated-side')):
    for col,variant in enumerate(('v71','spike-study')):
        src=a.renders/f'{variant}-{shot}.png';image=Image.open(src).convert('RGB')
        assert image.size==(600,740)
        x=col*600;y=90+row*760
        board.paste(image,(x,y));draw.rectangle((x,y,x+600,y+32),fill='#132530')
        draw.text((x+12,y+6),('A · RETAINED V71'if col==0 else'B · SPIKE STUDY')+' | '+shot.upper(),font=small,fill='white')
        # Native Site individual files also receive burned-in labels.
        labeled=image.copy();ld=ImageDraw.Draw(labeled);ld.rectangle((0,0,600,32),fill='#132530');ld.text((12,6),('V71'if col==0 else'SPIKE STUDY')+' | '+shot.upper()+' | UNACCEPTED',font=small,fill='white')
        dest=a.renders/f'{variant}-{shot}.webp';labeled.save(dest,quality=88);files.append(dest)
out=a.renders/'spike-hierarchy-comparison.webp';board.save(out,quality=88);files.append(out)
receipt={'status':'Labelled actual-render evidence; not runtime proof','files':[{ 'name':f.name,'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()}for f in files]}
(a.renders/'evidence-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt,indent=2))
