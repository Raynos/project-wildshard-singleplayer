"""Extract every encoded frame; no temporal resampling, all large sheets stay in tmp."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess,json
D=Path('tmp/conch-readable-qa/motion4-windup-interruptions-run2');O=D/'independent-review';O.mkdir(exist_ok=True)
video=next((D/'video').glob('*.webm'));w,h=161,180;cols,rows=8,6;label=18
command=['ffmpeg','-threads','1','-i',str(video),'-vf','crop=322:360:40:250,scale=161:180','-fps_mode','passthrough','-f','rawvideo','-pix_fmt','rgb24','-']
p=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=open(O/'decode.log','w'))
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
index=0;sheet=None;files=[]
while True:
 data=p.stdout.read(w*h*3)
 if not data:break
 assert len(data)==w*h*3
 if index%48==0:sheet=Image.new('RGB',(cols*w,rows*(h+label)),(15,15,15))
 tile=Image.frombytes('RGB',(w,h),data);x=(index%cols)*w;y=((index//cols)%rows)*(h+label)
 sheet.paste(tile,(x,y+label));ImageDraw.Draw(sheet).text((x+2,y+1),f'E{index} {index/25:.2f}s',font=font,fill='white')
 if index%48==47:
  name=f'allframes-{index//48:03d}.jpg';sheet.save(O/name,quality=88);files.append({'file':name,'first':index-47,'last':index})
 index+=1
if index%48:
 name=f'allframes-{(index-1)//48:03d}.jpg';sheet.save(O/name,quality=88);files.append({'file':name,'first':index-index%48,'last':index-1})
assert p.wait()==0
(O/'sheets.json').write_text(json.dumps({'frames':index,'crop':[40,250,322,360],'tile':[w,h],'encodedCadence':25,'files':files},indent=2)+'\n')
print(index,len(files))
