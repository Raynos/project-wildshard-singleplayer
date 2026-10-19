"""Do not turn manifoldness or fixed normals into evidence against source folds."""
import json,unittest
from pathlib import Path
P=Path(__file__).resolve().parent
ALLOWED={'Raised breast carapace -1','Raised breast carapace 1','Swept shoulder armor -1','Swept shoulder armor 1'}
def read(name):return json.loads((P/name).read_text())
def failed(r):return {m['mesh'] for m in r['meshes'] if m['opposedSideTriangles'] or m['opposedStripTrianglePairs']}
class SourceGate(unittest.TestCase):
 def test_selected_baseline_negative_control(self):self.assertEqual(failed(read('baseline-source-sweep.json')),ALLOWED)
 def test_transport_only_negative_control(self):self.assertEqual(failed(read('rejected-transport-only-sweep.json')),ALLOWED)
 def test_corrected_source_no_opposed_triangles_or_pairs(self):
  r=read('source-sweep-check.json');self.assertEqual(len(r['meshes']),36);self.assertEqual(failed(r),set());self.assertGreater(min(x['minimumOutwardRadialCosine'] for x in r['meshes']),.02)
 def test_exact_indexed_four_mesh_scope(self):
  r=read('indexed-diff.json');self.assertTrue(r['passed']);self.assertEqual(r['unchangedMeshCount'],47);self.assertEqual(set(r['changedMeshes']),ALLOWED)
  for m in r['meshes']:self.assertTrue(set(m['changes'])<={'positions','normals'})
 def test_exact_glb_indices_materials_and_untouched_parts(self):
  r=read('glb-indexed-diff.json');self.assertTrue(r['passed']);self.assertEqual(r['exactUnchangedMeshes'],47);self.assertTrue(r['sourceIndexedOrientedTrianglesExact'])
 def test_no_crossings(self):self.assertTrue(all(m['properNonadjacentCrossings']==0 for m in read('corrected-crossings.json')['meshes']))
 def test_cap_shading_preserved_not_repaired(self):
  a,b=read('baseline-facet-normals.json'),read('corrected-facet-normals.json')
  self.assertFalse(a['passed']);self.assertFalse(b['passed']) # Deliberately stricter all-solid/unit-facet diagnostic is NOT our native contract.
  aa={m['mesh']:m['normalFacetDeviations'] for m in a['meshes'] if m['normalFacetDeviations']};bb={m['mesh']:m['normalFacetDeviations'] for m in b['meshes'] if m['normalFacetDeviations']}
  self.assertEqual(aa,bb);self.assertEqual(sum(map(len,aa.values())),21);self.assertGreater(b['minimumFacetNormalCosine'],0)
if __name__=='__main__':unittest.main()
