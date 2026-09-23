"""Native icons + launch art for the iOS / Android shells (docs/plans/NATIVE-APPS.md N-A).

Sources are the Pine Hollow hero paintings in art/ (the same key art as the web build):
  icon  = the top 1024² of art/hero-pine-hollow-portrait.png (planet, cabin, sunset) — opaque, as the App Store wants
  splash = art/hero-pine-hollow-landscape.png, cover-cropped per slot

Writes every slot `cap add` created, in place, plus the Play listing icon (art/native-app/round-1-icons/). Run from
the repo root (`@capacitor/assets` would do this, but its pinned sharp binary does not load on this Mac):
  python3 scripts/native-icons.py
"""
import json
import pathlib
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
icon = Image.open(ROOT / 'art/hero-pine-hollow-portrait.png').convert('RGB').crop((0, 0, 1024, 1024))
land = Image.open(ROOT / 'art/hero-pine-hollow-landscape.png').convert('RGB')
icon.resize((512, 512), Image.LANCZOS).save(ROOT / 'art/native-app/round-1-icons/play-icon-512.png')  # the Play listing icon


def cover(src: Image.Image, w: int, h: int) -> Image.Image:
    s = max(w / src.width, h / src.height)
    big = src.resize((round(src.width * s), round(src.height * s)), Image.LANCZOS)
    x, y = (big.width - w) // 2, (big.height - h) // 2
    return big.crop((x, y, x + w, y + h))


# ── iOS ──
ios = ROOT / 'ios/App/App/Assets.xcassets'
icon.save(ios / 'AppIcon.appiconset/AppIcon-512@2x.png')
splash_dir = ios / 'Splash.imageset'
for old in splash_dir.glob('splash-*'):
    old.unlink()
cover(land, 2732, 2732).save(splash_dir / 'splash-2732x2732.jpg', quality=85, optimize=True)
(splash_dir / 'Contents.json').write_text(json.dumps({
    'images': [{'idiom': 'universal', 'filename': 'splash-2732x2732.jpg', 'scale': '1x'}],
    'info': {'version': 1, 'author': 'xcode'},
}, indent=2) + '\n')

# ── Android ──
res = ROOT / 'android/app/src/main/res'
for density, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    d = res / f'mipmap-{density}'
    small = icon.resize((px, px), Image.LANCZOS)
    small.save(d / 'ic_launcher.png')
    mask = Image.new('L', (px, px), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, px - 1, px - 1), fill=255)
    rnd = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    rnd.paste(small, (0, 0), mask)
    rnd.save(d / 'ic_launcher_round.png')
    # adaptive foreground: 108 dp canvas, the launcher shows the middle 72 dp — the painting is full-bleed
    icon.resize((px * 9 // 4, px * 9 // 4), Image.LANCZOS).save(d / 'ic_launcher_foreground.png')
(res / 'values/ic_launcher_background.xml').write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#11161B</color>\n</resources>\n')
# splash slots: JPEG, not PNG — a photographic painting is ~10x smaller (drawables accept .jpg under the same name)
for p in [*res.glob('drawable*/splash.png'), *res.glob('drawable*/splash.jpg')]:
    with Image.open(p) as old:
        w, h = old.size
    p.unlink()
    cover(land, w, h).save(p.with_suffix('.jpg'), quality=85, optimize=True)
print('native icons + splash written')
