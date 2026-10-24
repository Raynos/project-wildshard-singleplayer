"""A/B board for the Hi3D refine experiment (HI3D-REFINE H5): today's game prop vs the Hi3D-refined one, iPhone portrait.

  python3 scripts/img2mesh/ab_board.py <A dir> <B dir> <renders dir> <out.jpg> "<title>" name=refpath [name=refpath …]

<A dir> and <B dir> are build_props.py output dirs (<name>/<name>.glb + <name>.json): A built as today, B with
REFINE=<hi3d dir>. Per prop, three rows: reference · A · B at yaw 35°; the same at yaw 215° (the far side, where Hi3D
invents detail, or the reference's side when the generation faces −Z); a 3× close-up of the 215° view's centre. Every
render is scripts/img2mesh/render_still.py of the final game GLB (same light, same camera), cached in <renders dir>.
Each cell is labelled on the image itself.
"""
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
BLENDER = os.environ.get("BLENDER") or "/opt/homebrew/bin/blender"
W = 1170  # iPhone portrait width
CELL = (W - 4 * 12) // 3
LABEL = 58
BG, INK, DIM, PANEL = (14, 26, 36), (235, 242, 244), (150, 175, 186), (200, 208, 214)
ARMS = (("A", "today"), ("B", "Hi3D 1024"))


def render(glb, png, yaw, size=CELL):
    if not os.path.exists(png):
        subprocess.run([BLENDER, "-b", "-P", os.path.join(HERE, "render_still.py"), "--", glb, png, "--size",
                        str(size), "--yaw", str(yaw)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return Image.open(png)


def close_up(glb, png):
    """The centre third of a 3×-size render at yaw 215: texel and normal-map detail at phone size."""
    img = render(glb, png, 215, 3 * CELL)
    c = img.width // 3
    return img.crop((c, c, 2 * c, 2 * c))


def fit(img):
    img = img.convert("RGB")
    img.thumbnail((CELL, CELL))
    out = Image.new("RGB", (CELL, CELL), PANEL)
    out.paste(img, ((CELL - img.width) // 2, (CELL - img.height) // 2))
    return out


def stats(d, name):
    glb = os.path.join(d, name, name + ".glb")
    meta = json.load(open(os.path.join(d, name, name + ".json")))
    return f"{meta.get('tris', '?')} tris · {os.path.getsize(glb) / 1024:.0f} KB"


def main():
    adir, bdir, rdir, out, title = sys.argv[1:6]
    pairs = [p.split("=", 1) for p in sys.argv[6:]]
    os.makedirs(rdir, exist_ok=True)
    font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 22)
    small = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 18)
    head = 70
    block = 3 * (CELL + LABEL + 12)
    sheet = Image.new("RGB", (W, head + len(pairs) * (block + 16) + 12), BG)
    d = ImageDraw.Draw(sheet)
    d.text((12, 12), title, fill=INK, font=font)
    d.text((12, 42), "A = today's pipeline · B = same generation + Hi3D · same tris, same atlas", fill=DIM, font=small)
    y = head
    for name, ref in pairs:
        cells = [[(fit(Image.open(ref)), f"{name}", "reference")], [(None, "", "")], [(None, "", "")]]
        for arm, (tag, what) in zip((adir, bdir), ARMS):
            glb = os.path.join(arm, name, name + ".glb")
            for row, yaw in enumerate((35, 215)):
                png = os.path.join(rdir, f"{name}.{tag}.{yaw}.png")
                cells[row].append((fit(render(glb, png, yaw)), f"{tag} · {what}", f"yaw {yaw}° · {stats(arm, name)}"))
            png = os.path.join(rdir, f"{name}.{tag}.close.png")
            cells[2].append((fit(close_up(glb, png)), f"{tag} · {what}", "close-up, yaw 215° ×3"))
        for row in cells:
            x = 12
            for img, label, sub in row:
                if img is not None:
                    sheet.paste(img, (x, y))
                    ImageDraw.Draw(sheet).text((x + 8, y + 6), label.split(" · ")[0], fill=(20, 20, 20), font=font)
                    d.text((x, y + CELL + 6), label, fill=INK, font=small)
                    d.text((x, y + CELL + 30), sub, fill=DIM, font=small)
                x += CELL + 12
            y += CELL + LABEL + 12
        y += 16
    sheet.save(out, quality=82, optimize=True)
    print(out, sheet.size)


if __name__ == "__main__":
    main()
