"""Lossless frame coverage, lossy contact-sheet presentation; full phone video stays authoritative."""
import sys, pathlib, subprocess, json
from PIL import Image, ImageDraw
folder=pathlib.Path(sys.argv[1]); videos=list((folder/'video').glob('*.webm'))
assert len(videos)==1
out=folder/'frame-review';out.mkdir(exist_ok=True)
meta=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate','-of','json',str(videos[0])]))['streams'][0]
w,h=meta['width'],meta['height'];a,b=map(float,meta['r_frame_rate'].split('/'));fps=a/b
proc=subprocess.Popen(['ffmpeg','-v','error','-i',str(videos[0]),'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
assert proc.stdout is not None
n=0;sheets=[];sheet=None
while True:
 raw=proc.stdout.read(w*h*3)
 if not raw:break
 assert len(raw)==w*h*3
 if n%48==0:sheet=Image.new('RGB',(8*161,6*198),(22,24,30))
 assert sheet is not None
 tile=Image.frombytes('RGB',(w,h),raw).crop((40,240,362,600)).resize((161,180),Image.Resampling.LANCZOS)
 x=n%8*161;y=(n%48)//8*198;sheet.paste(tile,(x,y+18));ImageDraw.Draw(sheet).text((x+3,y+2),f'E{n}  {n/fps:.2f}s',fill='white')
 n+=1
 if n%48==0:
  name=f'allframes-{len(sheets)+1:02d}.jpg';sheet.save(out/name,quality=88);sheets.append({'sheet':name,'firstFrame':n-48,'lastFrame':n-1});sheet=None
if sheet is not None:
 name=f'allframes-{len(sheets)+1:02d}.jpg';sheet.save(out/name,quality=88);sheets.append({'sheet':name,'firstFrame':n-n%48,'lastFrame':n-1})
assert proc.wait()==0
(out/'index.json').write_text(json.dumps({'encodedFrames':n,'fps':fps,'crop':[40,240,322,360],'note':'Every encoded frame, including loading/duplicates. Creature crop only; original portrait video authoritative. Encoded frame E is not engine render frame R.','sheets':sheets},indent=2)+'\n');print(n,len(sheets))
