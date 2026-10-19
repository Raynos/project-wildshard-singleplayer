"""Pin actual captures and compare unchanged v3 actual images with the new source."""
import json,hashlib
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
p=Path(__file__).resolve().parent;repo=p.parents[3];base=p.parent/'v3';raw=repo/'tmp/bloomthroat-iguana-complete-next-final-renders';refs=repo.parent/'wildshard-review-site-current/source-evidence/approved-nine-qa/originals'
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
views=['front','left','right','back','top','elevated-front','elevated-left','elevated-right','elevated-back']
def panel(dst,im,xy,size):
 im=im.convert('RGB');im.thumbnail(size);dst.paste(im,(xy[0]+(size[0]-im.width)//2,xy[1]+(size[1]-im.height)//2))
board=Image.new('RGB',(1200,1400),'#101e2e');d=ImageDraw.Draw(board);d.text((15,12),'ACTUAL V3 ABOVE / ACTUAL COMPLETE-NEXT BELOW — IDENTICAL SOURCE CAMERAS',font=font,fill='white')
for i,name in enumerate(views):
 x=i%3*400;y=42+i//3*440;d.text((x+8,y+3),name.upper(),font=font,fill='white');panel(board,Image.open(base/(name+'.webp')),(x,y+25),(400,200));panel(board,Image.open(p/(name+'.webp')),(x,y+227),(400,210))
d.text((15,1375),'Historical v3 capture / fresh candidate capture. Source-only comparison; no gameplay or acceptance.',font=font,fill='white');board.save(p/'v3-paired-nine-board.webp',quality=77)
board=Image.new('RGB',(1000,760),'#101e2e');d=ImageDraw.Draw(board);d.text((15,12),'ACTUAL V3                                    ACTUAL COMPLETE-NEXT',font=font,fill='white');panel(board,Image.open(base/'hero.webp'),(0,45),(500,660));panel(board,Image.open(p/'hero.webp'),(500,45),(500,660));d.text((15,725),'Identical source cameras / historical v3 vs fresh candidate / no acceptance claimed',font=font,fill='white');board.save(p/'v3-paired-hero-board.webp',quality=80)
assert json.loads((base/'cameras.json').read_text())==json.loads((p/'cameras.json').read_text())
files=[];binary=0
for q in sorted(p.iterdir()):
 if not q.is_file() or q.name=='checkpoint.json':continue
 size=q.stat().st_size;cap=5_000_000 if q.suffix=='.json' else 500_000 if 'board' in q.name else 250_000 if q.suffix in ['.webp','.jpg','.png'] else 1_000_000;assert size<cap,(q.name,size,cap)
 if q.suffix in ['.bin','.glb','.webp']:binary+=size
 files.append({'path':str(q.relative_to(repo)),'bytes':size,'sha256':hashlib.sha256(q.read_bytes()).hexdigest()})
assert binary<=4*1024*1024,binary
pins=[]
for q in [refs/'bloomthroat-iguana-hero.png',refs/'iguanaWorldGen.png',refs/'iguanaExplorerGen.png',p.parent/'iguanaClips.ts',p.parent/'audit_glb.py',p.parent/'audit_surface.py',repo/'art/driftwood-isle/approved-puffer/native_export.py']:
 pins.append({'name':q.name,'sha256':hashlib.sha256(q.read_bytes()).hexdigest()})
(p/'checkpoint.json').write_text(json.dumps({'status':'frozen unaccepted source for independent review','files':files,'binaryBytes':binary,'referenceAndDependencyPins':pins,'v3CameraRecordsExactlyEqual':True,'baselineCaptures':{name:hashlib.sha256((base/(name+'.webp')).read_bytes()).hexdigest() for name in ['hero']+views},'rawFinalCaptures':{name:hashlib.sha256((raw/(name+'.png')).read_bytes()).hexdigest() for name in ['hero']+views},'visualAcceptance':False,'runtimeAcceptance':False},indent=2)+'\n')
print(json.dumps({'files':len(files),'binaryBytes':binary,'checkpointSha256':hashlib.sha256((p/'checkpoint.json').read_bytes()).hexdigest()}))
