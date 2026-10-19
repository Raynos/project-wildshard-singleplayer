"""Decode all encoded frames, make chronological review sheets; preserve mapping."""
import subprocess,pathlib,json,sys,hashlib
from PIL import Image,ImageDraw
video=sys.argv[1];out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
# Keep full 402x874 frame shape for visual review, 1/3 display-scale, no selection or time skips.
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',video]));(out/'probe.json').write_text(json.dumps(probe,indent=2))
p=subprocess.Popen(['ffmpeg','-v','error','-i',video,'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
w,h=402,874;idx=0;mapping=[];last=None;tiles=[];sheetidx=0
# Ignore compression-noise differences only for exact duplicate pixels; no lossy dedup.
def flush():
 global tiles,sheetidx
 if not tiles:return
 sheet=Image.new('RGB',(134*8,310*8),(25,25,25));draw=ImageDraw.Draw(sheet)
 for j,(im,frame) in enumerate(tiles):
  x=(j%8)*134;y=(j//8)*310;sheet.paste(im.resize((134,291)),(x,y+19));draw.text((x+2,y+2),f'encoded {frame}',fill='white')
 sheet.save(out/f'sheet-{sheetidx:03}.jpg',quality=87);sheetidx+=1;tiles=[]
while True:
 raw=p.stdout.read(w*h*3)
 if not raw:break
 assert len(raw)==w*h*3
 digest=hashlib.sha256(raw).hexdigest()
 if digest!=last:
  if len(tiles)==64:flush()
  tiles.append((Image.frombytes('RGB',(w,h),raw),idx));unique=[sheetidx,len(tiles)-1]
 mapping.append({'encoded':idx,'sheet':unique[0],'tile':unique[1],'duplicatePrevious':digest==last})
 last=digest;idx+=1
flush();assert p.wait()==0
(out/'frame-map.json').write_text(json.dumps(mapping,separators=(',',':')))
print({'encoded':idx,'sheets':sheetidx,'unique':sum(not r['duplicatePrevious'] for r in mapping)})
