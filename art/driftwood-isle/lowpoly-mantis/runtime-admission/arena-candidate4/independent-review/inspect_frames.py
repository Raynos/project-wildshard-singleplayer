import subprocess,glob,json,hashlib
from PIL import Image,ImageDraw
from pathlib import Path
out=Path('tmp/mantis-candidate4-independent-review')
for name,folder in [('combat','motion')]:
 p='public/review-evidence/mantis-v7-candidate4/live-observer.mp4'
 proc=subprocess.Popen(['ffmpeg','-v','error','-i',p,'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
 i=0; sheets=[]
 while True:
  b=proc.stdout.read(402*874*3)
  if not b: break
  im=Image.frombytes('RGB',(402,874),b)
  if i%48==0: sheet=Image.new('RGB',(8*250,6*310),'#202020'); draw=ImageDraw.Draw(sheet)
  x=i%8*250;y=(i%48)//8*310
  crop=im.crop((70,290,320,580));sheet.paste(crop,(x,y+20));draw.text((x+3,y+3),f'{name} {i} / {i/25:.2f}s',fill='white')
  if i%48==47:
   fn=f'{name}-all-{i//48:02}.webp';sheet.save(out/fn,quality=76);sheets.append(fn)
  if i in [0,150,300,500,750,1000,1250,1500,1597,456]:im.save(out/f'{name}-full-{i:04}.jpg',quality=85)
  i+=1
 if i%48:fn=f'{name}-all-{(i-1)//48:02}.webp';sheet.save(out/fn,quality=76);sheets.append(fn)
 proc.wait();json.dump({'video':p,'sha256':hashlib.sha256(Path(p).read_bytes()).hexdigest(),'frames':i,'range':[0,i-1],'fps':25,'crop':[70,290,320,580],'sheets':sheets},open(out/f'{name}-frame-index.json','w'),indent=2)
