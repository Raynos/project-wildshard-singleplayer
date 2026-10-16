# Driftwood per-file GLB download choice

Re-emitted from `6de4c222f` through the SDK named intake, writer and full
on-disk validator under `ea80b0876`'s gzip-9 ≤ plain rule.

The 112 GLBs retain all 423 decoded buffer views, accessor/scene/material/
skin/animation rows and logical names. 21 use lossless meshopt; 91 retain
plain source bytes. No geometry, materials, tier selection or runtime code
changes in this follow-up.

Gzip-9 totals: plain sources **9,530,728 B**, prior all-meshopt sweep
**9,284,667 B**, selected output **8,126,582 B**. The per-file choice saves
**1,158,085 B** against the prior sweep and **1,404,146 B** against plain.
Raw selected output is 23,109,744 B (plain sources 29,296,160 B).

The table records gzip-9 bytes for each candidate and the selected encoding.

| Logical GLB | Plain B | Meshopt B | Selected | Download B |
| --- | ---: | ---: | --- | ---: |
| `models/fixed/boat-gear.glb` | 29,591 | 30,447 | plain | 29,591 |
| `models/fixed/boat-hull.glb` | 45,301 | 50,096 | plain | 45,301 |
| `models/fixed/boat-sail.glb` | 2,314 | 2,892 | plain | 2,314 |
| `models/fixed/bridge-posts.glb` | 3,325 | 3,360 | plain | 3,325 |
| `models/fixed/bridge-specimen-posts.glb` | 3,272 | 2,849 | meshopt | 2,849 |
| `models/fixed/captain-hat.glb` | 18,885 | 21,268 | plain | 18,885 |
| `models/fixed/cargo-barrel-lying.glb` | 3,662 | 4,243 | plain | 3,662 |
| `models/fixed/cargo-barrel.glb` | 3,810 | 4,337 | plain | 3,810 |
| `models/fixed/cargo-coil.glb` | 8,553 | 8,389 | meshopt | 8,389 |
| `models/fixed/cargo-crate-broken.glb` | 3,527 | 3,303 | meshopt | 3,303 |
| `models/fixed/cargo-crate.glb` | 2,213 | 2,205 | meshopt | 2,205 |
| `models/fixed/castaway-smoke.glb` | 1,669 | 1,408 | meshopt | 1,408 |
| `models/fixed/cove-glow.glb` | 14,636 | 15,651 | plain | 14,636 |
| `models/fixed/cove-pools.glb` | 1,645 | 1,878 | plain | 1,645 |
| `models/fixed/cove-rocks.glb` | 492,146 | 692,235 | plain | 492,146 |
| `models/fixed/cove-structure.glb` | 461,126 | 555,496 | plain | 461,126 |
| `models/fixed/cover-bush.glb` | 3,960 | 4,813 | plain | 3,960 |
| `models/fixed/cover-bushFar.glb` | 1,469 | 1,673 | plain | 1,469 |
| `models/fixed/cover-daisy.glb` | 5,122 | 5,489 | plain | 5,122 |
| `models/fixed/cover-daisyFar.glb` | 864 | 1,032 | plain | 864 |
| `models/fixed/cover-driftwood.glb` | 198,918 | 227,187 | plain | 198,918 |
| `models/fixed/cover-fern.glb` | 2,346 | 2,953 | plain | 2,346 |
| `models/fixed/cover-fernFar.glb` | 1,616 | 1,936 | plain | 1,616 |
| `models/fixed/cover-hibiscus.glb` | 4,293 | 5,236 | plain | 4,293 |
| `models/fixed/cover-hibiscusFar.glb` | 1,818 | 2,083 | plain | 1,818 |
| `models/fixed/cover-pebble.glb` | 5,692 | 9,845 | plain | 5,692 |
| `models/fixed/cover-shells.glb` | 3,052 | 3,894 | plain | 3,052 |
| `models/fixed/cover-starfish.glb` | 1,029 | 1,307 | plain | 1,029 |
| `models/fixed/cover-tuft.glb` | 1,477 | 1,610 | plain | 1,477 |
| `models/fixed/cover-tuftFar.glb` | 796 | 993 | plain | 796 |
| `models/fixed/drift-log-long.glb` | 1,901 | 2,540 | plain | 1,901 |
| `models/fixed/drift-log-pale.glb` | 1,884 | 2,517 | plain | 1,884 |
| `models/fixed/drift-log-short.glb` | 1,891 | 2,508 | plain | 1,891 |
| `models/fixed/gull.glb` | 2,804 | 3,369 | plain | 2,804 |
| `models/fixed/hut-flames.glb` | 1,220 | 1,387 | plain | 1,220 |
| `models/fixed/hut-kit.glb` | 173,247 | 176,045 | plain | 173,247 |
| `models/fixed/iron-sword-blade.glb` | 6,407 | 7,140 | plain | 6,407 |
| `models/fixed/iron-sword-fittings.glb` | 14,545 | 14,908 | plain | 14,545 |
| `models/fixed/lookout.glb` | 246,842 | 222,138 | meshopt | 222,138 |
| `models/fixed/mooring-lines.glb` | 3,613 | 4,741 | plain | 3,613 |
| `models/fixed/npc-castaway-arm.glb` | 3,334 | 4,374 | plain | 3,334 |
| `models/fixed/npc-castaway-body.glb` | 22,354 | 25,446 | plain | 22,354 |
| `models/fixed/npc-castaway-camp.glb` | 14,749 | 18,492 | plain | 14,749 |
| `models/fixed/npc-castaway-flames.glb` | 2,592 | 3,437 | plain | 2,592 |
| `models/fixed/npc-castaway-head.glb` | 11,301 | 13,947 | plain | 11,301 |
| `models/fixed/npc-trader-body.glb` | 32,955 | 38,175 | plain | 32,955 |
| `models/fixed/npc-trader-fore.glb` | 4,801 | 5,680 | plain | 4,801 |
| `models/fixed/npc-trader-head.glb` | 21,150 | 24,173 | plain | 21,150 |
| `models/fixed/npc-trader-upper.glb` | 3,534 | 4,567 | plain | 3,534 |
| `models/fixed/pier-specimen-jetty-deck.glb` | 115,766 | 86,022 | meshopt | 86,022 |
| `models/fixed/pier-specimen-landing-cloth.glb` | 3,260 | 4,084 | plain | 3,260 |
| `models/fixed/pier-specimen-landing-deck.glb` | 135,976 | 101,163 | meshopt | 101,163 |
| `models/fixed/pier-specimen-long-deck.glb` | 215,663 | 155,532 | meshopt | 155,532 |
| `models/fixed/pier-world-0-cloth.glb` | 3,243 | 3,963 | plain | 3,243 |
| `models/fixed/pier-world-0-deck.glb` | 301,883 | 219,063 | meshopt | 219,063 |
| `models/fixed/pier-world-1-cloth.glb` | 3,259 | 4,180 | plain | 3,259 |
| `models/fixed/pier-world-1-deck.glb` | 193,492 | 142,817 | meshopt | 142,817 |
| `models/fixed/pier-world-2-deck.glb` | 282,748 | 204,093 | meshopt | 204,093 |
| `models/fixed/pier-world-3-cloth.glb` | 3,244 | 4,108 | plain | 3,244 |
| `models/fixed/pier-world-3-deck.glb` | 204,189 | 150,780 | meshopt | 150,780 |
| `models/fixed/reef-fish.glb` | 827 | 1,047 | plain | 827 |
| `models/fixed/sailcloth-cape.glb` | 9,199 | 11,506 | plain | 9,199 |
| `models/fixed/sea-glass-chime.glb` | 26,107 | 32,547 | plain | 26,107 |
| `models/fixed/shipwreck-glow.glb` | 1,988 | 2,186 | plain | 1,988 |
| `models/fixed/shipwreck-kit.glb` | 511,178 | 588,170 | plain | 511,178 |
| `models/fixed/shrine-fireflies.glb` | 3,262 | 2,538 | meshopt | 2,538 |
| `models/fixed/shrine-glyphs.glb` | 7,991 | 6,483 | meshopt | 6,483 |
| `models/fixed/shrine-kit.glb` | 953,549 | 1,065,437 | plain | 953,549 |
| `models/fixed/shrine-specimen-glyphs.glb` | 6,560 | 4,271 | meshopt | 4,271 |
| `models/fixed/shrine-specimen-kit.glb` | 956,400 | 1,105,640 | plain | 956,400 |
| `models/fixed/shrine-specimen-water.glb` | 829 | 997 | plain | 829 |
| `models/fixed/shrine-water.glb` | 951 | 1,140 | plain | 951 |
| `models/fixed/trade-counter.glb` | 45,038 | 52,809 | plain | 45,038 |
| `models/fixed/trailside.glb` | 1,025,123 | 725,837 | meshopt | 725,837 |
| `models/fixed/trophy-drop.glb` | 43,481 | 53,188 | plain | 43,481 |
| `models/fixed/trophy-plaques.glb` | 44,087 | 52,302 | plain | 44,087 |
| `models/fixed/waterfall-puffs.glb` | 6,284 | 4,970 | meshopt | 4,970 |
| `models/fixed/waterfall-rings.glb` | 911 | 1,122 | plain | 911 |
| `models/fixed/waterfall-sheet.glb` | 10,013 | 11,030 | plain | 10,013 |
| `models/fixed/wendell-head.glb` | 37,613 | 64,384 | plain | 37,613 |
| `models/fixed/wreck-glow.glb` | 2,207 | 2,297 | plain | 2,207 |
| `models/fixed/wreck-kit.glb` | 666,412 | 716,504 | plain | 666,412 |
| `models/fixed/wreck-rocks.glb` | 432,287 | 618,977 | plain | 432,287 |
| `models/reef/coral/default.glb` | 2,345 | 4,013 | plain | 2,345 |
| `models/reef/coral/fan.glb` | 873 | 1,253 | plain | 873 |
| `models/reef/coral/staghorn.glb` | 3,331 | 6,417 | plain | 3,331 |
| `models/reef/coral/tube.glb` | 1,828 | 3,566 | plain | 1,828 |
| `models/reef/star/default.glb` | 801 | 1,448 | plain | 801 |
| `models/reef/star/tint-1.glb` | 808 | 1,471 | plain | 808 |
| `models/reef/star/tint-2.glb` | 801 | 1,460 | plain | 801 |
| `models/reef/weed/default.glb` | 1,523 | 2,352 | plain | 1,523 |
| `models/reef/weed/tint-1.glb` | 1,524 | 2,381 | plain | 1,524 |
| `models/reef/weed/tint-2.glb` | 1,531 | 2,378 | plain | 1,531 |
| `models/reef/weed/tint-3.glb` | 1,520 | 2,365 | plain | 1,520 |
| `world/ground/ground.glb` | 1,058,342 | 378,490 | meshopt | 378,490 |
| `world/ground/slab.glb` | 35,709 | 33,814 | meshopt | 33,814 |
| `models/hibiscus/desktop/flowering.glb` | 30,582 | 48,213 | plain | 30,582 |
| `models/hibiscus/desktop/leaf.glb` | 25,236 | 40,198 | plain | 25,236 |
| `models/hibiscus/desktop/small.glb` | 30,635 | 48,249 | plain | 30,635 |
| `models/hibiscus/phone/flowering.glb` | 19,262 | 30,265 | plain | 19,262 |
| `models/hibiscus/phone/leaf.glb` | 13,959 | 21,875 | plain | 13,959 |
| `models/hibiscus/phone/small.glb` | 19,280 | 30,334 | plain | 19,280 |
| `models/palms/desktop/leaning.glb` | 8,837 | 17,862 | plain | 8,837 |
| `models/palms/desktop/tall.glb` | 9,034 | 17,996 | plain | 9,034 |
| `models/palms/desktop/young.glb` | 8,390 | 16,420 | plain | 8,390 |
| `models/palms/phone/leaning.glb` | 7,403 | 14,938 | plain | 7,403 |
| `models/palms/phone/tall.glb` | 7,790 | 15,457 | plain | 7,790 |
| `models/palms/phone/young.glb` | 7,352 | 14,310 | plain | 7,352 |
| `models/zipline/parked.glb` | 4,227 | 5,235 | plain | 4,227 |
| `models/zipline/specimen.glb` | 34,890 | 37,348 | plain | 34,890 |
| `models/zipline/trolley.glb` | 3,859 | 4,142 | plain | 3,859 |
| `models/zipline/world.glb` | 34,785 | 33,538 | meshopt | 33,538 |
