import unittest
from puffer_surface_topology import validate_closed_surface
from test_puffer_surface_clearance import CUBE,FACES,native_core


class SurfaceTopologyTests(unittest.TestCase):
    def test_closed_cube(self):
        self.assertEqual(validate_closed_surface(CUBE,FACES)['edges'],18)

    def test_open_cube_rejected_even_for_external_query(self):
        with self.assertRaises(ValueError):
            validate_closed_surface(CUBE,FACES[:-1])

    def test_reversed_single_face_rejected(self):
        with self.assertRaises(ValueError):
            validate_closed_surface(CUBE,[tuple(reversed(FACES[0]))]+FACES[1:])

    def test_degenerate_rejected(self):
        with self.assertRaises(ValueError):
            validate_closed_surface(CUBE,FACES+[(0,0,1)])

    def test_exact_native_baseline(self):
        vertices,faces=native_core()
        receipt=validate_closed_surface(vertices,faces)
        self.assertEqual(receipt['triangles'],1018)
        self.assertEqual(receipt['edges'],1527)


if __name__=='__main__':
    unittest.main()
