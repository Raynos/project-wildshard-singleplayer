"""Label actual Conch V9 render evidence; no concept pixels enter model panels."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import argparse
p=argparse.ArgumentParser();p.add_argument('--out',default='tmp/conch-v9');a=p.parse_args()
r=Path(__file__).resolve().parents[3];out=r/a.out
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',19)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',15)
ref=Image.open(r/'art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/conch-duelist-lowpoly.webp').crop((20,300,495,965))
board=Image.new('RGB',(1000,910),'#111b24');d=ImageDraw.Draw(board)
for im,x,label in [(ref,10,'APPROVED LOW-POLY TARGET'),(Image.open(out/'color-front.png'),510,'ACTUAL CONCH V9 — UNACCEPTED')]:
 im.thumbnail((480,770));board.paste(im,(x+(480-im.width)//2,60));d.text((x+8,22),label,font=small,fill='white')
d.text((20,847),'ACTUAL BLENDER MODEL | NOT GAME CAPTURE | REVIEW PENDING',font=font,fill='#ffb17d')
board.save(out/'comparison-v9-board.webp',quality=85,method=6)
views=['front','left','right','back','top','diag-front','diag-left','diag-right','diag-back']
if all((out/f'color-v9-{v}.png').exists() for v in views):
 board=Image.new('RGB',(1050,1595),'#111b24');d=ImageDraw.Draw(board)
 d.text((18,15),'CONCH V9 • ACTUAL NINE-VIEW GEOMETRY • +Y FRONT',font=font,fill='white')
 for i,v in enumerate(views):
  x=(i%3)*350;y=50+(i//3)*500;im=Image.open(out/f'color-v9-{v}.png');im.thumbnail((344,463));board.paste(im,(x+(350-im.width)//2,y+28));d.text((x+10,y+4),v.upper(),font=font,fill='#90d9ea')
 d.text((18,1560),'Fixed half-dome / shared scale / studio render / independent review pending',font=small,fill='#ffb17d')
 board.save(out/'nine-view-v9-board.webp',quality=83,method=6)
