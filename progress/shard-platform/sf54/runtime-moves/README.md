# SF54: Sabre, Spear, GoldenBow and Naizagai move behind Nalati's runtime/

The four Nalati weapon files mix model geometry with gameplay, so they move whole from `src/shards/nalati-grasslands/weapons/`
to `src/shards/nalati-grasslands/runtime/weapons/`. That is where SDK runtime imports are allowed, so sp-x3 can swap their
kit bases onto the SDK families. Only import lines and importer paths change.

- `geometry-hash-before.json` / `-after.json`: the hashes are identical before and after the move. They cover attributes,
  index, groups, draw range, world matrices, the material JSON (texture uuids replaced by texture content and settings,
  `onBeforeCompile`, the program cache key), InstancedMesh matrices and colours. Builds hashed: `buildSabre`,
  `buildSpear`, `buildJavelin`, `goldenBowModel` and `naizagaiModel`; the held viewmodels from the real loadout (sabre,
  spear, Golden Bow and Naizagai, the last two through `upgradeBow` / `upgradeSabre`); the two powers' scene FX; one
  `LightningStrip`; and every profile and move table.
- `before-after-fp-weapons.jpg`: first-person shots of the four weapons at iPhone 16 Pro portrait (402×874 @3×, touch,
  phone tier, muted). Before is a clean HEAD build at f08cdf1e1; after is the candidate commit. The Golden Bow and
  Naizagai are held by seeding both boss rewards as taken. Mean greyscale difference: sabre 0.39, spear 0.28,
  Golden Bow 0.32, Naizagai 0.24 out of 255. Under 0.01 % of pixels differ by more than 24, which is grass motion.
- Debt that moves with the files and needs the coordinator's receipt at push (the pusher regenerates the counts):
  - `wildshard/runtime-commons` +8, for the existing kit imports that sp-x3's SDK swaps retire: Sabre 3, Spear 3,
    GoldenBow 1, Naizagai 1.
  - `wildshard/shard-services`: Sabre, Spear and Naizagai move 1 each from `weapons/` to `runtime/weapons/`, so the
    net change is 0.
  - `shard-coupling --check` does not rise.
