"""Verify and pair actual unchanged complete-pass2 captures with complete-pass3; no synthetic views."""
import hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw
here=Path(__file__).resolve().parent
root=here.parents[3]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
records=[]
for kind,old_dir in [('hero','bellback-complete-pass2/hero'),('nine','bellback-complete-pass2/nine')]:
 new_dir=root/'tmp/bellback-complete-pass3'/kind
 old_dir=root/'tmp'/old_dir
 new=json.loads((new_dir/f'capture-{kind}.json').read_text())
 old=json.loads((old_dir/f'capture-{kind}.json').read_text())
 assert sha(root/old['source'])==old['source_sha256']
 assert sha(root/new['source'])==new['source_sha256']
 assert old['lights']==new['lights']
 for a,b in zip(old['shots'],new['shots']):
  for key in ['name','camera','target','ortho_scale']:assert a[key]==b[key],key
  op=old_dir/(a['name']+'.png');np=new_dir/(b['name']+'.png')
  assert sha(op)==a['image_sha256'];assert sha(np)==b['image_sha256']
  # Portrait paired frame preserves both actual full frames at matched display scale.
  board=Image.new('RGB',(780,1050),'#15212b');d=ImageDraw.Draw(board)
  for i,(p,title) in enumerate([(op,'A | Retained complete pass 2 | '+a['name']),(np,'B | Complete pass 3 | '+b['name'])]):
   im=Image.open(p).convert('RGB');im.thumbnail((760,490));board.paste(im,((780-im.width)//2,30+i*520));d.text((16,12+i*520),title,fill='white')
  out=here/('paired-'+a['name']+'-board.webp');board.save(out,quality=86)
  assert out.stat().st_size<=500000
  records.append({'view':a['name'],'baseline_png':str(op.relative_to(root)),'baseline_sha256':sha(op),'candidate_png':str(np.relative_to(root)),'candidate_sha256':sha(np),'paired_board':str(out.relative_to(root)),'paired_board_sha256':sha(out),'camera':a['camera'],'target':a['target'],'ortho_scale':a['ortho_scale']})
 report={'status':'Verified actual paired complete-pass2 and complete-pass3 static renders; retained complete-pass2 PNGs reused unchanged','baseline_source_sha256':old['source_sha256'],'candidate_source_sha256':new['source_sha256'],'same_lights':True,'pairs':records}
(here/'paired-captures.json').write_text(json.dumps(report,indent=2)+'\n')
print('Verified',len(records),'actual matched pairs')
