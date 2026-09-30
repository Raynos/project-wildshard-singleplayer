#!/usr/bin/env bash
# bake → meshopt → capture a review strip. usage: bakecap.sh <tag>
set -uo pipefail
SP=/private/tmp/claude-501/-Users-raynos-projects-games-wildshard-singleplayer/be65981d-8428-4bae-8549-6996f99c15c1/scratchpad/vm
L=/private/tmp/claude-501/-Users-raynos-projects-games-wildshard-singleplayer/be65981d-8428-4bae-8549-6996f99c15c1/scratchpad/browser.lock
cd "$SP"
lockf -k "$L" node rigbake.mjs "$SP/fp-rig.raw.glb" 2>&1 | grep -E "rest|glb |rror|clamp ≤ [1-9]"
(cd /Users/raynos/projects/games/wildshard-singleplayer && pnpm exec gltf-transform meshopt "$SP/fp-rig.raw.glb" public/assets/nine-dragon/lab/viewmodel/fp-rig.glb --level medium 2>&1 | tail -1)
lockf -k "$L" node rigcap.mjs "cap/$1" '[{"shot":"loop-1"},{"steps":[120,0.0166],"snap":"rest"},{"play":"light"},{"steps":[6,0.0166],"snap":"l1"},{"steps":[6,0.0166],"snap":"l2"},{"steps":[4,0.0166],"snap":"l3"},{"steps":[4,0.0166],"snap":"l4"},{"steps":[40,0.0166]},{"play":"charge"},{"steps":[20,0.0166],"snap":"charge"},{"play":"heavy"},{"steps":[10,0.0166],"snap":"h1"},{"steps":[6,0.0166],"snap":"h2"},{"steps":[40,0.0166]},{"play":"parry"},{"steps":[10,0.0166],"snap":"parry"},{"steps":[40,0.0166]},{"left":"grapple_aim"},{"steps":[20,0.0166],"snap":"aim"}]' 2>&1 | grep -E "rror|stats" | cut -c1-160
python3 - "$1" <<'PY'
import sys
from PIL import Image
tag=sys.argv[1]
names=['rest','l1','l2','l3','l4','charge','h1','h2','parry','aim']
ims=[Image.open(f'cap/{tag}/{n}.jpg').crop((0,600,1206,2622)).resize((301,505)) for n in names]
W=Image.new('RGB',(301*5,505*2))
for i,im in enumerate(ims): W.paste(im,((i%5)*301,(i//5)*505))
W.save(f'cmp/{tag}.jpg')
PY
