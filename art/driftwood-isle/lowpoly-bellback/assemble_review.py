"""Label unaltered Bellback renders and produce compact review evidence."""
import argparse, json, hashlib
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
p=argparse.ArgumentParser();p.add_argument('--version',required=True);p.add_argument('--input',required=True);a=p.parse_args()
here=Path(__file__).resolve().parent;src=Path(a.input);font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18);small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',15)
receipt=json.loads((src/'capture-nine.json').read_text());sheet=Image.new('RGB',(1200,1610),'#172833');d=ImageDraw.Draw(sheet)
d.text((20,15),f'BELLBACK {a.version.upper()} | NINE ACTUAL 3D VIEWS | NOT ACCEPTED',font=font,fill='white')
outputs=[]
for i,shot in enumerate(receipt['shots']):
 name=shot['name'];image=Image.open(src/(name+'.png')).convert('RGB');destination=here/f'bellback-{a.version}-{name}.webp';image.save(destination,quality=84,method=6);outputs.append(destination)
 image.thumbnail((392,480));x=(i%3)*400;y=(i//3)*510+55;sheet.paste(image,(x+(400-image.width)//2,y+30));d.text((x+12,y+5),name.upper().replace('-',' '),font=font,fill='white')
d.text((18,1590),'Fixed world lighting and pose. Hidden anatomy inferred. No runtime or animation acceptance.',font=small,fill='#d1e2dd')
board=here/f'bellback-{a.version}-nine-board.webp';sheet.save(board,quality=86,method=6);outputs.append(board)
receipt_path=here/f'capture-{a.version}-nine.json';receipt_path.write_bytes((src/'capture-nine.json').read_bytes());outputs.append(receipt_path)
closure={'status':'Actual nine-view evidence; independent likeness review required','source_sha256':receipt['source_sha256'],'capture_script_sha256':receipt['capture_script_sha256'],'files':[{'path':str(p.relative_to(here.parents[2])),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in outputs]}
(here/f'closure-{a.version}-nine.json').write_text(json.dumps(closure,indent=2)+'\n');print(json.dumps(closure,indent=2))
