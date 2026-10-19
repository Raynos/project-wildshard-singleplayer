"""Keep the complete first attempt before the bounded shoulder-root correction."""
import ast,hashlib,json,shutil
from pathlib import Path
here=Path(__file__).resolve().parent;root=here.parents[3];raw=root/'tmp/mantis-complete-pass2';failed=here/'failed-root-gap';failed.mkdir(exist_ok=True)
source=here/'build_mantis_complete.py';original=source.read_text();normalized='\n'.join(line.rstrip() for line in original.splitlines())+'\n'
assert ast.dump(ast.parse(original))==ast.dump(ast.parse(normalized))
def sha(b):return hashlib.sha256(b).hexdigest()
for p in here.iterdir():
 if p.is_file() and (p.suffix=='.webp' or p.name in ['mantis-study-complete-pass2.glb','mantis-mesh-complete-pass2.json','metrics-complete-pass2.json','preflight.json','cameras.json']):shutil.copyfile(p,failed/p.name)
(failed/'build_mantis_complete.py').write_text(normalized)
provenance={'status':'FAILED: visible upper-arm attachment gap; never accepted','executedSourceSha256':sha(original.encode()),'normalizedSourceSha256':sha(normalized.encode()),'whitespaceOnlyAstEquivalent':True,'editableSource':'art/driftwood-isle/lowpoly-mantis/complete-pass2/failed-root-gap/build_mantis_complete.py','exactExecutedSource':'tmp/mantis-complete-pass2-failed-root-gap/build_mantis_complete.capture.py','rawCaptureDirectory':'tmp/mantis-complete-pass2-failed-root-gap','normalizedSourceDidNotDirectlyProduceCapture':True,'normalization':'Trailing whitespace only; AST without location attributes compared exactly'}
(failed/'source-provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
(failed/'README.md').write_text('# Failed first pass2 attempt\n\nVisible upper-arm roots were separated from the rebuilt curved prothorax.\nThe manifold preflight passed but did not prove anatomical attachment.\nAll twenty real capture previews and boards, mesh, GLB and editable source\nare preserved here. source-provenance.json preserves exact executed source\ntext and hashes; the standalone Python source differs only by trailing\nwhitespace and has proven identical AST. No score or admission is claimed.\n')
failedraw=raw.with_name('mantis-complete-pass2-failed-root-gap');raw.rename(failedraw);raw.mkdir()
(failedraw/'build_mantis_complete.capture.py').write_text(original)
(failedraw/'render_matched.capture.py').write_text((here/'render_matched.py').read_text())
manifest={'files':{str(p.relative_to(root)):sha(p.read_bytes()) for p in failed.iterdir() if p.is_file()},'rawHashes':{str(p.relative_to(root)):sha(p.read_bytes()) for p in failedraw.glob('*/*.png')}}
(failed/'evidence.json').write_text(json.dumps(manifest,indent=2)+'\n')
# The only geometry correction: move both roots into the curved neck cross-section.
assert 'sh=(s*.14,-.22,1.94)' in normalized
corrected=normalized.replace('sh=(s*.14,-.22,1.94)','sh=(s*.12,.10,1.94)');source.write_text(corrected)
(here/'capture-source-provenance.json').write_text(json.dumps({'executedSourceSha256':sha(corrected.encode()),'publicSourceSha256':sha(corrected.encode()),'exactSourceExecutedForFinalCapture':True,'failedExecutedSourceSha256':sha(original.encode()),'failedNormalizedSourceSha256':sha(normalized.encode()),'failedWhitespaceNormalizationAstEquivalent':True,'correction':'Both shoulder roots move from (side*.14,-.22,1.94) to (side*.12,.10,1.94) to seat inside the curved prothorax. No other geometry changes.'},indent=2)+'\n')
print('FAILED PRESERVED',failed,'FINAL SOURCE',sha(corrected.encode()))
