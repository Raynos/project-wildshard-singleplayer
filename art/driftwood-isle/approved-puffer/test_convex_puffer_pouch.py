"""Pure structural tests. Synthetic/analytic data, never actual Blender proof."""
import math
import unittest

from convex_puffer_pouch import (convex_hull, controlled_samples, pouch_point,
                                retopologize_pouch, silhouette_directions,
                                signed_volume, validate_convex_surface, normal, sub, dot)


def pouch_fixture():
    parameters = [(lat, 2*math.pi*(i+(.30 if j % 2 and j < 5 else 0))/14)
                  for j, lat in enumerate([-1.50, -1.12, -.68, -.20, .28, .70, 1.10, 1.48])
                  for i in range(14)]
    return parameters, [pouch_point(*p) for p in parameters]


class ConvexPouchTests(unittest.TestCase):
    def setUp(self):
        self.cube = [(x, y, z) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
        self.directions = silhouette_directions([(0, 1, 0), (1, 0, 0), (0, 0, 1), (3, 4.63, 1.41)])

    def test_cube_closed_convex_and_deterministic(self):
        faces = convex_hull(self.cube)
        self.assertEqual(faces, convex_hull(self.cube))
        receipt = validate_convex_surface(self.cube, faces)
        self.assertAlmostEqual(receipt['signedVolume'], 8)
        self.assertEqual(receipt['verticesUsed'], 8)
        self.assertEqual(receipt['triangles'], 12)

    def test_invalid_input_and_coplanar_rejected(self):
        for points in ([(0, 0, 0)]*4, [(0, 0, 0), (1, 0, 0), (0, 1, 0), (1, 1, 0)],
                       self.cube+[(float('nan'), 0, 0)]):
            with self.assertRaises(ValueError):
                convex_hull(points)

    def test_internal_samples_do_not_change_hull(self):
        receipt = validate_convex_surface(self.cube+[(0, 0, 0)], convex_hull(self.cube+[(0, 0, 0)]))
        self.assertEqual(receipt['verticesUsed'], 8)
        self.assertAlmostEqual(receipt['signedVolume'], 8)

    def test_explicit_stagger_sampling_and_anchor_pin(self):
        parameters, original = pouch_fixture()
        lat = [0.0]*len(parameters)
        angles = [0.0]*len(parameters)
        for j in (2, 3, 4):
            for i in (1, 2, 5, 6, 8, 9, 12, 13):
                lat[j*14+i] = .015 * (1 if (j+i) % 2 else -1)
        protected = list(range(14))+list(range(98, 112))
        candidate = controlled_samples(parameters, lat, angles, protected)
        self.assertTrue(all(original[i] == candidate[i] for i in protected))
        self.assertGreater(len({round(p[2], 8) for p in candidate[42:56]}), 1)
        result = retopologize_pouch(original, candidate, protected, self.directions,
                                  max_displacement=.02, silhouette_tolerance=.02,
                                  max_volume_fraction=.02, max_dihedral_degrees=100)
        self.assertEqual({i for f in result['faces'] for i in f}, set(range(len(result['points']))))
        self.assertTrue(set(protected).issubset(result['sourceIndices']))
        self.assertLessEqual(result['receipt']['maximumSampleDisplacement'], .02)
        self.assertLessEqual(result['receipt']['maximumSampledSilhouetteDrift'], .02)
        lat[0] = .01
        with self.assertRaisesRegex(ValueError, 'Protected'):
            controlled_samples(parameters, lat, angles, protected)

    def test_moved_or_discarded_anchors_rejected(self):
        moved = list(self.cube)
        moved[0] = (-1.01, -1, -1)
        with self.assertRaisesRegex(ValueError, 'anchor position'):
            retopologize_pouch(self.cube, moved, [0], self.directions,
                              max_displacement=.1, silhouette_tolerance=.1)
        with self.assertRaisesRegex(ValueError, 'anchor removed'):
            retopologize_pouch(self.cube+[(0, 0, 0)], self.cube+[(0, 0, 0)], [8], self.directions,
                              max_displacement=.1, silhouette_tolerance=.1)

    def test_silhouette_displacement_volume_and_dihedral_limits(self):
        larger = [tuple(1.01*x for x in p) for p in self.cube]
        common = dict(max_displacement=.1, silhouette_tolerance=.1,
                      max_volume_fraction=.1, max_dihedral_degrees=100)
        for key, value, message in [('max_displacement', .001, 'displacement'),
                                    ('silhouette_tolerance', .001, 'silhouette'),
                                    ('max_volume_fraction', .001, 'volume'),
                                    ('max_dihedral_degrees', 80, 'Dihedral')]:
            limits = dict(common, **{key: value})
            with self.assertRaisesRegex(ValueError, message):
                retopologize_pouch(self.cube, larger, [], self.directions, **limits)

    def test_v50_fixed_point_diamond_flips_are_concave(self):
        _, points = pouch_fixture()
        faces = []
        for j in range(7):
            for i in range(14):
                q, r = j*14+i, j*14+(i+1) % 14
                s, t = (j+1)*14+(i+1) % 14, (j+1)*14+i
                faces.extend([(q, r, s), (q, s, t)] if (i+j) % 2 else [(q, r, t), (r, s, t)])
        faces += [(0, i+1, i) for i in range(1, 13)]+[(98, 98+i, 98+i+1) for i in range(1, 13)]
        if signed_volume(points, faces) < 0:
            faces = [tuple(reversed(f)) for f in faces]
        for sector in (0, 2, 10, 12):
            a, b = 42+sector, 42+(sector+1) % 14
            ids = [i for i, f in enumerate(faces) if a in f and b in f]
            f, g = [faces[i] for i in ids]
            c = next(v for v in f if v not in (a, b))
            d = next(v for v in g if v not in (a, b))
            if f[(f.index(a)+1) % 3] != b:
                a, b = b, a
            # Check the specific changed hinge, not an unrelated original edge.
            self.assertLess(dot(normal(points, f), sub(points[d], points[f[0]])), 0)
            self.assertGreater(dot(normal(points, (c, d, b)), sub(points[a], points[c])), .06)
            bad = list(faces)
            bad[ids[0]], bad[ids[1]] = (c, d, b), (d, c, a)
            with self.subTest(sector=sector), self.assertRaisesRegex(ValueError, 'support-plane'):
                validate_convex_surface(points, bad, max_dihedral_degrees=180)
        # A true hull of the same samples passes the support-plane check.
        validate_convex_surface(points, convex_hull(points), max_dihedral_degrees=180)

    def test_open_or_reversed_surface_rejected(self):
        faces = convex_hull(self.cube)
        with self.assertRaisesRegex(ValueError, 'two-manifold'):
            validate_convex_surface(self.cube, faces[:-1])
        with self.assertRaisesRegex(ValueError, 'support-plane'):
            validate_convex_surface(self.cube, [tuple(reversed(f)) for f in faces])


if __name__ == '__main__':
    unittest.main()
