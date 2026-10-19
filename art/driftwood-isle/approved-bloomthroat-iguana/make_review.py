"""Actual ten source renders paired with original approved concept evidence."""
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json,hashlib,sys
root=Path(__file__).resolve().parent;version=sys.argv[1];out=root/version;renders=root.parents[2]/'tmp'/('bloomthroat-iguana-'+version+'-renders');refs=root.parents[3]/'wildshard-review-site-current/source-evidence/approved-nine-qa/originals'
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',17);small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
views=['front','left','right','back','top','elevated-front','elevated-left','elevated-right','elevated-back']
def fit(im,size):im=im.copy().convert('RGB');im.thumbnail(size);return im
def panel(dst,im,xy,size):im=fit(im,size);dst.paste(im,(xy[0]+(size[0]-im.width)//2,xy[1]+(size[1]-im.height)//2))
provenance=[]
for name in ['hero']+views:
 raw=renders/(name+'.png');im=Image.open(raw).convert('RGB');d=ImageDraw.Draw(im);d.rectangle((0,0,600,48),fill='#101e2e');d.text((10,6),'BLOOMTHROAT IGUANA '+version.upper()+' / '+name.upper(),font=font,fill='white');d.text((10,28),'ACTUAL SOURCE RENDER / NOT GAMEPLAY / NOT ACCEPTED',font=small,fill='#bdcfdd');im.save(out/(name+'.webp'),quality=81);provenance.append({'view':name,'rawSha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'output':name+'.webp'})
hero=Image.new('RGB',(1000,760),'#101e2e');d=ImageDraw.Draw(hero);d.text((15,12),'APPROVED HERO                          ACTUAL SOURCE '+version.upper(),font=font,fill='white');panel(hero,Image.open(refs/'bloomthroat-iguana-hero.png'),(0,45),(500,660));panel(hero,Image.open(out/'hero.webp'),(500,45),(500,660));d.text((15,724),'Original hero is authoritative. Reconstruction is approximate; no likeness score claimed.',font=small,fill='white');hero.save(out/'paired-hero-board.webp',quality=80)
for context,ref in [('world','iguanaWorldGen.png'),('explorer','iguanaExplorerGen.png')]:
 board=Image.new('RGB',(1200,1420),'#101e2e');d=ImageDraw.Draw(board);d.text((15,10),'BLOOMTHROAT / '+context.upper()+' TARGET vs ACTUAL '+version.upper()+' SOURCE',font=font,fill='white');reference=Image.open(refs/ref).convert('RGB')
 # Sheet cell crop retains the original labels: top 62, 3x3 content to 970.
 for i,name in enumerate(views):
  x=(i%3)*400;y=45+(i//3)*440;d.text((x+8,y+5),str(i+1).zfill(2)+' '+name.upper(),font=small,fill='white');col=i%3;row=i//3;crop=reference.crop((col*512,62+row*303,(col+1)*512,62+(row+1)*303));panel(board,crop,(x,y+28),(400,190));panel(board,Image.open(out/({'left':'right','right':'left','elevated-left':'elevated-right','elevated-right':'elevated-left'}.get(name,name)+'.webp')),(x,y+220),(400,215))
 d.text((12,1385),'AI reference above; actual source below. Side views paired by facing direction; AI hidden surfaces inferred.',font=small,fill='white');board.save(out/(context+'-paired-nine-board.webp'),quality=76)
(out/'capture-provenance.json').write_text(json.dumps({'sourceVersion':version,'context':'Blender source only; no runtime scene','views':provenance,'referenceHeroSha256':hashlib.sha256((refs/'bloomthroat-iguana-hero.png').read_bytes()).hexdigest()},indent=2)+'\n')
