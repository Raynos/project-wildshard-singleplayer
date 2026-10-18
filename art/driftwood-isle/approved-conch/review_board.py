"""Compose explicitly labelled source-reference evidence; never a game capture."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[3]
ref=Image.open(ROOT/'art/driftwood-isle/concepts/2026-10-18/conch-duelist-explorer-gameplay.webp').crop((20,300,485,960))
actual=Image.open(ROOT/'tmp/approved-conch/clay-front.png')
board=Image.new('RGB',(1000,930),'#111b24');d=ImageDraw.Draw(board)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
for image,x,label in [(ref,15,'APPROVED AI TARGET'),(actual,510,'FAILED CLAY STUDY 1')]:
 image.thumbnail((475,720));board.paste(image,(x+(475-image.width)//2,70));d.text((x+12,25),label,font=font,fill='#ffffff')
d.text((25,810),'ACTUAL BLENDER MODEL • NOT GAME CAPTURE • ACCEPTANCE 0',font=font,fill='#ffa878')
d.text((25,846),'Wrong handedness; obstructed aperture; narrow whorls;',font=font,fill='#eeeeee')
d.text((25,877),'mechanical torso; inflated shield. No runtime/performance claim.',font=font,fill='#eeeeee')
board.save(ROOT/'art/driftwood-isle/approved-conch/failed-study-1-board.webp',quality=82,method=6)
