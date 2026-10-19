"""Freeze the single approved native timing counterfactual, preserving prior proof."""
from pathlib import Path
import hashlib,json,shutil
root=Path('.')
dst=Path('art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate4/fold-aligned-study1')
dst.mkdir(exist_ok=True)
for p in Path('tmp/bellback-fold-aligned-study1').glob('*.json'):
 shutil.copyfile(p,dst/p.name)
original=Path('src/shards/driftwood-isle/generators/bellbackTuckedClips.ts').read_text()
expected='// Isolated native study only. No product import. Original anatomy3 source is preserved.\n'+original.replace('export function bellbackTuckedClips()', 'export function bellbackFoldAlignedStudyClips()').replace("channel('body','position','y',(b,r)=>expression(b,r).bodyY);", "// Study-only counterfactual: only this channel retimes descent; leg expressions retain original bodyY.\n  channel('body','position','y',(b,r)=>{const e=expression(b,r);return e.sub(r('frame',['dims','bodyY']),e.mul(e.n(.3),e.fold));});")
assert Path('docs/reviews/bellback-runtimecandidate4-source/bellbackFoldAlignedStudyClips.ts').read_text()==expected
summary=json.loads((dst/'summary.json').read_text())
assert all(c['reproducible'] for c in summary['results'])
assert not summary['results'][0]['passes5mm']
paths=list(dst.glob('*.json'))+[
 Path('docs/reviews/bellback-runtimecandidate4-source')/p for p in ['bellbackFoldAlignedStudyClips.ts','replay-fold-aligned-study.mjs','freeze-fold-aligned-study.py','fold-aligned-study-review.md','manifest.json']]
paths += [Path(p) for p in ['art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate4/solver-study1/manifest.json','art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate4/build1/build-files.json','scripts/bake-loader.mjs','scripts/bellback-following-admission.mjs','src/engine/physics/rapier.ts','src/engine/physics/rapierBindings.ts','art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native/bellback-v6-native.json','package.json','pnpm-lock.yaml']]
# Pin all installed Rapier JS glue transitively, without copying vendored sources.
paths += list(Path('node_modules/@dimforge/rapier3d-simd').rglob('*.js'))
files=[]
for p in sorted(set(paths)):
 if p==dst/'manifest.json':continue
 b=p.read_bytes();files.append(dict(path=str(p),sha256=hashlib.sha256(b).hexdigest(),bytes=len(b)))
(dst/'manifest.json').write_text(json.dumps(dict(schema='wildshard.bellback.fold-aligned-study.v1',studyOnly=True,acceptance=False,failed=True,sourceDeltaVerified='Only body.position.y channel timing; all other copied source identical except exported study name and comments.',references='Prior solver manifest pins native engine/inputs/Wasm; candidate source freeze and build-files closure are pinned here without altering old proofs. Installed Rapier JS and bake-loader explicitly pinned.',files=files),indent=2)+'\n')
print(hashlib.sha256((dst/'manifest.json').read_bytes()).hexdigest(),len((dst/'manifest.json').read_bytes()))
