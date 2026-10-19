import json,pathlib,subprocess,io
from PIL import Image
O=pathlib.Path('tmp/puffer-full-lifecycle-independent-review');d=json.loads((O/'decode-index.json').read_text());r=json.loads(pathlib.Path('tmp/puffer-full-lifecycle-attempt2/report.json').read_text());extra=[]
for marker in [541,542,543,544,546,547,548,549,551,552,553,554,556,557,558,559,561,665]:
 if marker not in d['markers']:continue
 n=d['markers'].index(marker);raw=subprocess.check_output(['ffmpeg','-threads','1','-v','error','-ss',str(n/25),'-i',r['video'],'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1']);im=Image.frombytes('RGB',(390,844),raw);fn=f'extra-e{n+1:05d}-m{marker}.jpg';im.save(O/fn,quality=92);extra.append({'marker':marker,'encodedFrame':n+1,'file':fn})
# True last encoded frame, independently decoded.
n=6853;raw=subprocess.check_output(['ffmpeg','-threads','1','-v','error','-ss',str(n/25),'-i',r['video'],'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1']);Image.frombytes('RGB',(390,844),raw).save(O/'extra-last-e06854.jpg',quality=92);extra.append({'marker':10046,'encodedFrame':6854,'file':'extra-last-e06854.jpg'})
from PIL import ImageDraw
for j in range(0,len(extra),6):
 canvas=Image.new('RGB',(1170,1748),(25,25,25));dr=ImageDraw.Draw(canvas)
 for k,it in enumerate(extra[j:j+6]):
  x=k%3*390;y=k//3*874;canvas.paste(Image.open(O/it['file']),(x,y+30));dr.text((x+4,y+5),f"e{it['encodedFrame']} / marker {it['marker']}",fill='white')
 canvas.save(O/f'extra-sheet-{j//6+1:02d}.jpg',quality=88)
(O/'extra-index.json').write_text(json.dumps(extra,indent=2)+'\n');print(len(extra))
