#!/bin/bash
# fetch-fonts.sh: the handwriting fonts prep.py writes the handles, "yours" and the caption with (all SIL OFL / Apache,
# from github.com/google/fonts) -> fonts/ next to this script (gitignored)
D="$(cd "$(dirname "$0")" && pwd)/fonts"
mkdir -p "$D"
for p in "ofl/caveat/Caveat%5Bwght%5D.ttf" "ofl/reeniebeanie/ReenieBeanie.ttf" "apache/homemadeapple/HomemadeApple-Regular.ttf" \
  "ofl/nanumpenscript/NanumPenScript-Regular.ttf" "ofl/kalam/Kalam-Regular.ttf" "ofl/zeyada/Zeyada.ttf" \
  "ofl/nothingyoucoulddo/NothingYouCouldDo.ttf" "ofl/labelleaurore/LaBelleAurore.ttf" \
  "ofl/caveatbrush/CaveatBrush-Regular.ttf" "ofl/gochihand/GochiHand-Regular.ttf"; do
  f="$(basename "$p" | sed 's/%5B/[/;s/%5D/]/')"
  [ -f "$D/$f" ] || curl -sfL -o "$D/$f" "https://raw.githubusercontent.com/google/fonts/main/$p" || echo "failed: $p"
done
ls "$D"
