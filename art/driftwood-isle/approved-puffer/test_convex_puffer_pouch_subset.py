"""Pure mapped-identity tests; no Blender or actual-export validation."""
import math
import unittest

from convex_puffer_pouch import pouch_point, silhouette_directions
from convex_puffer_pouch_subset import retopologize_pouch_subset


class SubsetPouchTests(unittest.TestCase):
    def setUp(self):
        self.cube = [(x, y, z) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
        self.directions = silhouette_directions([(0, 1, 0), (1, 0, 0), (0, 0, 1), (3, 4.63, 1.41)], 72)
        self.limits = dict(max_displacement=0, silhouette_tolerance=0,
                           max_volume_fraction=0, max_dihedral_degrees=180)

    def run_subset(self, reference, ids, protected=(), points=None, **overrides):
        return retopologize_pouch_subset(reference, ids, [reference[i] for i in ids] if points is None else points,
                                        protected, self.directions, **dict(self.limits, **overrides))

    def test_reordered_identity_and_interior_removal(self):
        reference = self.cube+[(0, 0, 0)]
        ids = list(reversed(range(8)))
        result = self.run_subset(reference, ids, range(8))
        self.assertIsNone(result['oldToNew'][8])
        self.assertEqual(result['receipt']['explicitlyRemovedOldIds'], [8])
        for new, old in enumerate(result['newToOld']):
            self.assertEqual(result['points'][new], reference[old])
            self.assertEqual(result['oldToNew'][old], new)
        self.assertEqual({i for f in result['faces'] for i in f}, set(range(len(result['points']))))

    def test_duplicate_ids_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            self.run_subset(self.cube, [0, 1, 2, 3, 4, 5, 6, 6])

    def test_removed_and_moved_anchor_rejected(self):
        with self.assertRaisesRegex(ValueError, 'anchor removed'):
            self.run_subset(self.cube, list(range(7)), [7])
        points = list(self.cube)
        points[0] = (-.99, -1, -1)
        with self.assertRaisesRegex(ValueError, 'anchor position'):
            self.run_subset(self.cube, list(range(8)), [0], points, max_displacement=.1)

    def test_hull_cannot_silently_discard_protected_interior_point(self):
        reference = self.cube+[(0, 0, 0)]
        with self.assertRaisesRegex(ValueError, 'anchor discarded'):
            self.run_subset(reference, list(range(9)), [8])

    def test_deleted_corner_volume_loss_measured_against_full_reference(self):
        with self.assertRaisesRegex(ValueError, 'Full-reference convex volume'):
            self.run_subset(self.cube, list(range(7)), silhouette_tolerance=10, max_volume_fraction=.01)
        result = self.run_subset(self.cube, list(range(7)), silhouette_tolerance=10, max_volume_fraction=.2)
        self.assertAlmostEqual(result['receipt']['referenceConvexVolume'], 8)
        self.assertAlmostEqual(result['receipt']['volumeFractionChange'], 1/6)

    def test_deleted_corner_silhouette_loss_cannot_be_hidden(self):
        self.directions.append((1, 1, 1))  # This exposes the deleted corner in projection.
        with self.assertRaisesRegex(ValueError, 'Full-reference sampled silhouette'):
            self.run_subset(self.cube, list(range(7)), max_volume_fraction=1)

    def test_pouch_58_68_study_preserves_full_reference_accounting(self):
        reference = [pouch_point(lat, 2*math.pi*(i+(.30 if j % 2 and j < 5 else 0))/14)
                     for j, lat in enumerate([-1.50, -1.12, -.68, -.20, .28, .70, 1.10, 1.48]) for i in range(14)]
        ids = [i for i in range(112) if i not in (58, 68)]
        protected = list(range(14))+list(range(98, 112))
        result = self.run_subset(reference, ids, protected, silhouette_tolerance=.01, max_volume_fraction=.01)
        self.assertEqual(result['receipt']['referenceSampleCount'], 112)
        self.assertEqual(result['receipt']['explicitlyRemovedOldIds'], [58, 68])
        self.assertIsNone(result['oldToNew'][58])
        self.assertIsNone(result['oldToNew'][68])
        self.assertGreater(result['receipt']['volumeFractionChange'], .007)
        self.assertGreater(result['receipt']['maximumSampledSilhouetteDrift'], .005)
        self.assertTrue(set(protected).issubset(result['newToOld']))


if __name__ == '__main__':
    unittest.main()
