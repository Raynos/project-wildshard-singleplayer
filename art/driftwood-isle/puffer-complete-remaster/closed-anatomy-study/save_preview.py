"""Bounded labelled full-resolution actual render, no retained PNG cache."""
import sys
from pathlib import Path
from PIL import Image,ImageDraw
raw,dest,label=sys.argv[1:]
im=Image.open(raw).convert('RGB');draw=ImageDraw.Draw(im)
draw.rectangle((0,0,im.width,26),fill=(8,17,23));draw.text((12,7),label,fill=(235,242,242))
im.save(dest,format='WEBP',quality=90,method=6)
assert Path(dest).stat().st_size<250000
