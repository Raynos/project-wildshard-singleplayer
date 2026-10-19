import subprocess,json,hashlib
from pathlib import Path
from PIL import Image,ImageDraw
video=Path('tmp/mantis-onset-capture1/qa/video/page@8563bab3fe2db8bb40a0166c56837b05.webm')
out=Path('tmp/mantis-onset-independent-visual');out.mkdir(exist_ok=True)
p=subprocess.Popen(['ffmpeg','-v','error','-i',str(video),'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
size=402*874*3;unique=[];seen={};index=[];i=0
while True:
 raw=p.stdout.read(size)
 if not raw:break
 assert len(raw)==size
 sha=hashlib.sha256(raw).hexdigest()
 if sha not in seen:
  seen[sha]=i;unique.append(i)
  im=Image.frombytes('RGB',(402,874),raw)
  im.crop((50,280,350,635)).resize((150,178)).save(out/f'frame-{i:04d}.png')
  if i%100==0:im.save(out/f'full-{i:04d}.jpg',quality=90)
 index.append({'frame':i,'decodedPixelSha256':sha,'representative':seen[sha]});i+=1
assert p.wait()==0
sheets=[]
for start in range(0,len(unique),64):
 subset=unique[start:start+64];sheet=Image.new('RGB',(8*150,8*198),(32,32,32));draw=ImageDraw.Draw(sheet)
 for j,frame in enumerate(subset):
  x=j%8*150;y=j//8*198;sheet.paste(Image.open(out/f'frame-{frame:04d}.png'),(x,y+20));draw.text((x+3,y+3),f'{frame} ({frame/25:.2f}s)',fill='white')
 name=f'all-{start//64:02d}.jpg';sheet.save(out/name,quality=90);sheets.append({'path':str(out/name),'encodedRepresentatives':subset})
receipt={'encodedFrames':len(index),'uniqueDecodedFullFrames':len(unique),'exactDuplicateFrames':len(index)-len(unique),'scope':'Every encoded frame mapped by full-frame decoded RGB hash; only exact duplicates reuse a visual representative. Crop excludes HUD; full frames remain authoritative.','sheets':sheets,'index':index}
Path('docs/reviews/mantis-onset-independent/capture1/video-index.json').write_text(json.dumps(receipt,indent=2)+'\n')
print({k:v for k,v in receipt.items() if k not in ['sheets','index']});print('sheets',len(sheets))
