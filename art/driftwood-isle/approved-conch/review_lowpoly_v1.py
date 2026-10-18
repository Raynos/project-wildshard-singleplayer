"""Compose explicitly labelled source-reference evidence; never a game capture."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[3]
ref=Image.open(ROOT.parent/'generated_images/exec-aed184a8-5e7e-4b35-b7de-247f76ee5030.png').crop((20,300,485,960))
actual=Image.open(ROOT/'tmp/approved-conch/lowpoly-v1/color-front.png')
board=Image.new('RGB',(1000,930),'#111b24');d=ImageDraw.Draw(board)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
for image,x,label in [(ref,15,'REVISED AI STYLE TARGET'),(actual,510,'LOW-POLY STUDY 1: FAIL')]:
 image.thumbnail((475,720));board.paste(image,(x+(475-image.width)//2,70));d.text((x+12,25),label,font=font,fill='#ffffff')
d.text((25,810),'ACTUAL BLENDER MODEL • NOT GAME CAPTURE • ACCEPTANCE 0',font=font,fill='#ffa878')
d.text((25,846),'Closer palette; shell still reads as separate tiers;',font=font,fill='#eeeeee')
d.text((25,877),'oval eyes; broad torso. No fresh human style approval.',font=font,fill='#eeeeee')
board.save(ROOT/'art/driftwood-isle/approved-conch/failed-lowpoly-v1-board.webp',quality=82,method=6)
