"""Deterministic byte-level roundtrip, without writing old inputs or outputs."""
import copy
import json
import unittest
import zlib
from prepare import BASE, HERE, ROOT, prepare

class CandidateTests(unittest.TestCase):
    def test_rebuild_matches_frozen_candidate(self):
        for name, payload in prepare().items():
            self.assertEqual(payload, (HERE/name).read_bytes(), name)

    def test_metadata_changes_only_append_declared_attribute(self):
        before = json.loads((BASE/'native/metadata.json').read_bytes())
        after = json.loads((HERE/'metadata.json').read_bytes())
        original = zlib.decompress((BASE/'native/payload.bin').read_bytes())
        binary = zlib.decompress((HERE/'payload.bin').read_bytes())
        self.assertEqual(binary[:len(original)], original)
        cursor = len(original)
        recovered = copy.deepcopy(after)
        for body, old_body in zip(recovered['bodies'], before['bodies'], strict=True):
            for part, old_part in zip(body['hard'], old_body['hard'], strict=True):
                self.assertEqual(part['row']['attrs'].pop(), ['aAuthoredColour','f32',3,False])
                self.assertEqual(part['offsets'].pop(), cursor)
                color = next(i for i, a in enumerate(old_part['row']['attrs']) if a[0]=='color')
                source = old_part['offsets'][color]
                size = old_part['row']['count'] * 12
                self.assertEqual(binary[cursor:cursor+size], original[source:source+size])
                cursor += size
        self.assertEqual(cursor, len(binary))
        recovered['file'] = before['file']
        recovered['bytes'] = before['bytes']
        self.assertEqual(recovered, before)

    def test_graph_has_one_exact_change(self):
        original = json.loads((ROOT/'src/shards/driftwood-isle/data/lookGraphs.json').read_bytes())['looks']['driftwood-creature']
        graph = json.loads((HERE/'graph.json').read_bytes())
        self.assertEqual(graph['nodes']['paint'], {'op':'attribute','name':'aAuthoredColour','type':'vec3'})
        graph['nodes']['paint'] = original['nodes']['paint']
        self.assertEqual(graph, original)

if __name__ == '__main__':
    unittest.main()
