"""Read-only guard for this warm-colored Conch against the blue arena ceiling.
Not a visual quality score; independent direct image inspection remains required.
"""
import json
import sys
from PIL import Image


def warm_pixels(image):
    return sum(r > b * 1.1 and r > g * .95 and r > 50
               for r, g, b in image.convert('RGB').get_flattened_data())


if __name__ == '__main__':
    with Image.open(sys.argv[1]) as image:
        count = warm_pixels(image)
        print(json.dumps({'warmCharacterPixels': count, 'minimum': 500,
                          'visibleCandidate': count > 500, 'size': list(image.size)}))
