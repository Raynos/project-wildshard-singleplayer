"""Bounded JPEG derivative generation: every encoded frame, native selected frames."""
import json,subprocess,pathlib
from PIL import Image,ImageDraw
B=pathlib.Path('tmp/puffer-full-lifecycle-attempt2');O=pathlib.Path('tmp/puffer-full-lifecycle-independent-review'); r=json.loads((B/'report.json').read_text()); video=r['video']
p=subprocess.Popen(['ffmpeg','-threads','1','-v','error','-i',video,'-f','rawvideo','-pix_fmt','rgb24','pipe:1'],stdout=subprocess.PIPE)
markers=[]; n=0; sheet=None; selected={3,10,30,60,100,200,300,400,480,488,489,490,496,500,501,503,505,510,515,520,525,530,535,540,545,550,555,560,565,570,575,580,585,586,590,593,600,603,608,609,610,611,612,613,614,615,616,617,620,625,630,635,639,640,650,660,666,10002,10010,10021,10022,10023,10030,10040,10045,10046}; saved={};native=[]
while True:
 raw=p.stdout.read(390*844*3)
 if not raw:break
 assert len(raw)==390*844*3
 im=Image.frombytes('RGB',(390,844),raw);bits=[int(sum(im.getpixel((14+i*12,110)))>384)for i in range(20)];mark=int(''.join(map(str,bits[4:])),2)if bits[:4]==[1,0,1,0]else None
 markers.append(mark)
 if n%200==0:sheet=Image.new('RGB',(1560,1910),(28,28,28));ImageDraw.Draw(sheet).text((5,2),f'Original encoded frames {n+1}–{min(n+200,6854)}; 25fps; ALL frames, 78x169 thumbnails',(255,255,255))
 tile=im.resize((78,169));x=(n%200%20)*78;y=20+(n%200//20)*189;sheet.paste(tile,(x,y));ImageDraw.Draw(sheet).text((x,y+169),f'{n+1}/{mark if mark else "-"}',fill='white')
 if mark in selected and mark not in saved:
  fn=f'native-e{n+1:05d}-m{mark}.jpg';im.save(O/fn,quality=92);saved[mark]=n+1;native.append({'encodedFrame':n+1,'time':n/25,'marker':mark,'file':fn})
 n+=1
 if n%200==0:sheet.save(O/f'overview-{(n-1)//200+1:02d}.jpg',quality=82)
if n%200:sheet.save(O/f'overview-{(n-1)//200+1:02d}.jpg',quality=82)
assert p.wait()==0 and n==6854
# Native montage pages are conveniences; individual native JPEGs are retained.
for j in range(0,len(native),6):
 canvas=Image.new('RGB',(1170,1748),(25,25,25));d=ImageDraw.Draw(canvas)
 for k,item in enumerate(native[j:j+6]):
  x=k%3*390;y=k//3*874;canvas.paste(Image.open(O/item['file']),(x,y+30));d.text((x+4,y+5),f"e{item['encodedFrame']} / marker {item['marker']} / {item['time']:.2f}s",fill='white')
 canvas.save(O/f'native-sheet-{j//6+1:02d}.jpg',quality=88)
(O/'decode-index.json').write_text(json.dumps({'encodedCount':n,'markers':markers,'selectedNative':native,'selectedMissing':sorted(selected-set(saved)),'overviews':(n+199)//200},indent=2)+'\n');print(n,len(native),sorted(selected-set(saved)))
