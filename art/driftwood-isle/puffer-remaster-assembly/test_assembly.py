"""Synthetic in-memory integration tests. No assembled candidate is written."""
import copy
import json
import unittest
from unittest.mock import patch
from assemble import (HERE, FIELDS, CORE, TAIL, FINS, load_pin, audit_sources,
                      compose_checked, authorize, canonical, digest, parts)


class AssemblyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((HERE/'source-pins.json').read_text())
        cls.source = {key: load_pin(pin) for key, pin in cls.manifest.items()}

    def body(self):
        return copy.deepcopy(self.source['baseline'])

    def test_exact_source_scope(self):
        records, report = audit_sources(self.source)
        self.assertEqual(report['scope'], 'PASS')
        self.assertEqual(len(records), 8)
        self.assertEqual(len(report['changedSpikes']), 6)

    def test_hash_drift_rejected(self):
        pin = dict(self.manifest['tail'], sha256='0'*64)
        with self.assertRaisesRegex(ValueError, 'Hash mismatch'):
            load_pin(pin)

    def test_pending_admission_rejected(self):
        with self.assertRaisesRegex(ValueError, 'not authorized'):
            authorize(self.manifest, json.loads((HERE/'admission-pending.json').read_text()))

    def test_changed_admission_tuple_rejected(self):
        with self.assertRaisesRegex(ValueError, 'tuple mismatch'):
            authorize(self.manifest, {'status': 'root-approved-input-tuple', 'componentPins': {}})

    def test_repeatable_and_nonmutating(self):
        body = self.body()
        before = canonical(body)
        a, _ = compose_checked(body, self.source)
        b, _ = compose_checked(body, self.source)
        self.assertEqual(digest(canonical(a)), digest(canonical(b)))
        self.assertEqual(canonical(body), before)
        self.assertEqual(parts(a)[TAIL], parts(self.source['tail'])[TAIL])
        self.assertEqual(parts(a)[FINS[0]], parts(self.source['fins'])[FINS[0]])
        self.assertEqual(parts(a)[CORE], parts(self.source['spikes'])[CORE])

    def test_retopology_and_order_independence(self):
        body = self.body()
        p = parts(body)[CORE]
        # Reorder every triangle, cycle its corners, and add an unrelated body
        # triangle. This simulates changed body soup offsets without moving spikes.
        n = len(p['positions']) // 9
        for field, width in FIELDS.items():
            chunks = [p[field][i*3*width:(i+1)*3*width] for i in range(n)]
            p[field] = sum([c[width:]+c[:width] for c in reversed(chunks)], [])
            extra = list(chunks[0])
            if field == 'positions':
                extra = [x+0.00031 for x in extra]
            p[field].extend(extra)
        body['parts'].reverse()
        result, _ = compose_checked(body, self.source)
        for field, width in FIELDS.items():
            self.assertEqual(parts(result)[CORE][field][-3*width:], p[field][-3*width:])
        self.assertEqual(result['bones'], body['bones'])

    def test_tail_body_overlap_rejected(self):
        body = self.body()
        parts(body)[TAIL]['positions'][0] += .001
        with self.assertRaisesRegex(ValueError, 'Overlapping body/part edit'):
            compose_checked(body, self.source)

    def test_fin_body_overlap_rejected(self):
        body = self.body()
        parts(body)[FINS[1]]['colorsLinear'][0] += .001
        with self.assertRaisesRegex(ValueError, 'Overlapping body/part edit'):
            compose_checked(body, self.source)

    def spike_index(self, body):
        from assemble import geometry_index, find_triangle
        records, _ = audit_sources(self.source)
        pos = records[0]['triangles'][0]['before']['positions']
        return find_triangle(parts(body)[CORE], geometry_index(parts(body)[CORE]),
                             [pos[i:i+3] for i in (0, 3, 6)])[0]

    def test_missing_spike_rejected(self):
        body = self.body()
        i = self.spike_index(body)
        parts(body)[CORE]['positions'][i*9] += .001
        with self.assertRaisesRegex(ValueError, 'Missing or ambiguous'):
            compose_checked(body, self.source)

    def test_duplicate_spike_rejected(self):
        body = self.body()
        i = self.spike_index(body)
        p = parts(body)[CORE]
        for field, width in FIELDS.items():
            p[field].extend(p[field][i*3*width:(i+1)*3*width])
        with self.assertRaisesRegex(ValueError, 'Missing or ambiguous'):
            compose_checked(body, self.source)

    def test_spike_material_overlap_rejected(self):
        body = self.body()
        i = self.spike_index(body)
        parts(body)[CORE]['colorsLinear'][i*9] += .001
        with self.assertRaisesRegex(ValueError, 'materials/binding'):
            compose_checked(body, self.source)

    def test_spike_bind_overlap_rejected(self):
        body = self.body()
        i = self.spike_index(body)
        parts(body)[CORE]['skinIndices'][i*12] = 0
        with self.assertRaisesRegex(ValueError, 'materials/binding'):
            compose_checked(body, self.source)

    def test_reversed_spike_rejected(self):
        body = self.body()
        i = self.spike_index(body)
        p = parts(body)[CORE]
        for field, width in FIELDS.items():
            offset = i*3*width
            old = p[field][offset:offset+3*width]
            p[field][offset:offset+3*width] = old[:width]+old[2*width:]+old[width:2*width]
        with self.assertRaisesRegex(ValueError, 'Missing or ambiguous'):
            compose_checked(body, self.source)

    def test_pivot_drift_rejected(self):
        body = self.body()
        body['bones'][2]['pos'][1] += .01
        with self.assertRaisesRegex(ValueError, 'Changed bones'):
            compose_checked(body, self.source)

    def test_duplicate_part_rejected(self):
        body = self.body()
        body['parts'].append(copy.deepcopy(body['parts'][0]))
        with self.assertRaisesRegex(ValueError, 'Duplicate semantic'):
            compose_checked(body, self.source)

    def test_unrelated_spike_source_change_rejected(self):
        source = copy.deepcopy(self.source)
        source['spikes']['parts'][1]['positions'][0] += .01
        with self.assertRaisesRegex(ValueError, 'unrelated part'):
            audit_sources(source)

    def test_new_cage_attachment_admission(self):
        body = self.body()
        admission = {'status': 'root-approved-input-tuple',
                     'componentPins': self.manifest,
                     'body': {'path': 'synthetic-body', 'sha256': 'body-pin'},
                     'attachmentAudit': {'path': 'synthetic-audit', 'sha256': 'audit-pin'},
                     'reviewReference': 'synthetic unit-test review only'}
        receipt = {'bodySha256': 'body-pin', 'componentPins': self.manifest,
                   'verdict': 'PASS', 'checks': {
                       'tailRootBurial': True, 'forefinRootBurial': True,
                       'spikeRootClearance': True, 'inheritedExceptionsReviewed': True,
                       'identityTransforms': True}}
        with patch('assemble.load_pin', side_effect=[receipt, body]):
            self.assertEqual(authorize(self.manifest, admission), body)
        receipt['bodySha256'] = 'stale-body-pin'
        with patch('assemble.load_pin', return_value=receipt):
            with self.assertRaisesRegex(ValueError, 'Stale attachment body'):
                authorize(self.manifest, admission)
        receipt['bodySha256'] = 'body-pin'
        receipt['checks']['spikeRootClearance'] = False
        with patch('assemble.load_pin', return_value=receipt):
            with self.assertRaisesRegex(ValueError, 'Incomplete new-cage'):
                authorize(self.manifest, admission)

    def test_nonfinite_rejected(self):
        body = self.body()
        parts(body)[CORE]['positions'][0] = float('nan')
        with self.assertRaisesRegex(ValueError, 'Invalid positions'):
            compose_checked(body, self.source)


if __name__ == '__main__':
    unittest.main(verbosity=2)
