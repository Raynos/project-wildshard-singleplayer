# V55 isolated actual-engine playable evidence

Current reviewed candidate: V55, 3.81/5 from independent hero + nine-view Blender review; unaccepted.

Built from engine source c4339d90a93ccc289540e3a72c1e9cbf221d98fb with the exact config hash and asset commit recorded in the receipt. Native input commit: 6fe68af59d05ef4d56c8b65e7dfd8a46471262cf. Builder commit: 4caa8849e4dd800860b4f2c5b288126af5e14574. The existing clean-build setup is documented in approved-puffer/NATIVE-PREVIEW.md.

Product command (under the build lease):
`node scripts/build-puffer-native-preview.mjs art/driftwood-isle/approved-puffer/unaccepted-native-v55-preview-dimensions.json attack tmp/puffer-native-preview/v55-attack art/driftwood-isle/approved-puffer/native-v55-preview-candidate.json`

App command (under the build lease):
`PUFFER_PREVIEW_DIR=tmp/puffer-native-preview/v55-attack node scripts/build-puffer-native-preview.mjs --app tmp/puffer-native-preview-v55-attack-dist`

Serve the complete app directory at `/puffer-engine/`. Tested this mounted route in a copied existing Site, including real keyboard approach, touch attacks, two local reward coins, actual player defeat, and Retry restoring 100 health and the opponent. All sampled persistence surfaces stayed empty. Zero JS/HTTP errors. Timestamped inputs, samples, and 137-file artifact hashes are in the receipt.

This is a cloud software-WebGL test. Lighting uses the isolated arena empty-look fixed lights plus AgX/grade, no LUT; it is not full Driftwood Noon or Model Explorer Solid/Paint. No phone performance, human playtest or complete rig/visual acceptance claim. V38 tested fallback and the older public practice fixture remain preserved.

HUD-fixed config source: d940e51eec5090e10ecbb815db6dbfe6feae554b. Initial/close-defeat/Retry views showed no obvious head/body separation; close weapon occlusion prevents full containment certification. V51 live fallback is preserved.
