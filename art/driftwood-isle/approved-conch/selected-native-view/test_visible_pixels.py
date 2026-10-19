import unittest
from PIL import Image
from visible_pixels import warm_pixels


class VisibilityGuard(unittest.TestCase):
    def test_blue_ceiling_is_rejected(self):
        self.assertEqual(warm_pixels(Image.new('RGB', (402, 874), (20, 35, 65))), 0)

    def test_warm_character_region_is_counted(self):
        image = Image.new('RGB', (402, 874), (20, 35, 65))
        image.paste((180, 110, 40), (100, 300, 200, 500))
        self.assertEqual(warm_pixels(image), 20000)


if __name__ == '__main__':
    unittest.main()
