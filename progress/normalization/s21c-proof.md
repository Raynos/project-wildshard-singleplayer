# S2.1 sol-s21c proof — 2026-10-01

Source audit and narrow same-clock phone proof. **The full comparator remains red.** No pending exception, ignored field, trace re-baseline or new id mapping was added. Full gate, push and milestone pin remain the lead/integration holder's work.

## Source checkpoints

- `f64ab22b`: typed, scope-bound `app.world.trample` getter and `registerTrample`; S34 consumes it in `e4146b1e`.
- `6e7d3940`: Pine boot labels/bytes and Compare art/pairs authored in the shard; procedural fallback query; Blender area/models data; scoped trample installation. Restores elite installation before the split world/creature/frame passes, correcting the resource change introduced by `c8ae074e`. R1 independently restored the mesh/skinned scene.
- `885bccef`: generic level-keyed debug handles and plugin quest reader, preserving `quest.pine` schema (lead B40).
- `758d10fa`: original `i * CELL` Blender arithmetic, preserving floating-point operation order.
- `cb51fddf`: S35c forest synth installer activated as the first kit action, with typed Audio|null guard.
- `0d4dfcfe`: far FX keep original hare placement/draw eligibility and bird departure cleanup while brains remain held. The source fix excludes the unused diagnostic scheduler precision candidate.

Focused validation: 41 source cases across eight files; 28 probe/quest cases across four files; eight Blender cases; three audio activation cases; 22 life/scheduler cases; owned-file lint green. The trample port also has its focused scope lifecycle fixture. These are checkpoint checks, not a substitute for the lead's full gate.

The final source grep for `'pine-hollow'`, `"pine-hollow"`, `isPine`, `pinePhoneCuts` and `PINE_HOLLOW_PHONE` under engine/game/kit/main returned no matches at the final audit. Music/Stems changes were handled by S3.5b/c. No hot main/bootstrap/Game/index/ratchet working-tree copy was committed by this builder.

## RAF captures and comparison

Before: `20fcbf54745913fecd7696d993d012401aebab75`. After: `0d4dfcfe8e7a924339b5b1e12bc814b48f9fa16f`. Both sides explicitly use native `--clock=raf`.

```sh
node scripts/parity.mjs --export=<SHA> --lane=m5 --shards=all --tiers=phone --only=fingerprint+poses --clock=raf --jobs=1 --retry=0 --out=<DIR>
node scripts/parity.mjs --export=<SHA> --lane=m5 --shards=all --tiers=phone --only=walk+combat+leak --clock=raf --jobs=1 --retry=0 --out=<DIR>
```

Raw directories: `/private/tmp/e357-s21c/{before-raf,before-game-raf,final-raf,final-game-raf}/run-1`. Initial after-885 captures also remain under `{after-raf,after-game-raf}`. P1's harness internally leases browser lanes; run these commands directly, without an outer browser-lane wrapper. All own browser pools and previews closed.

[s21c-comparison.json](s21c-comparison.json) retains exact red/new comparator rows, pose scores, resource totals, combat, pause and leak results. Long diagnostic arrays are represented by length and SHA256; raw captures retain them. Only the existing committed rename maps and ambient info are used by comparison. [s21c-poses.jpg](s21c-poses.jpg) is the inspected 12-pose montage.

- 12/12 masked pose SSIM pass >=0.99; minimum 0.995545994 (Driftwood beach). All boot error lists empty.
- All 12 walk traces match exactly, including every trace sample and endpoints; no stuck points. Pine lookout now has the baseline's 348 samples and endpoint (34.926,57.477,211.280). Nalati cave likewise restored after R2 `2df2a111`.
- All four pause/resume diffs empty. Pine/Driftwood/Nine Dragon scene census, physics census and GPU totals exactly match pre-S2.
- Pine: 2417 boot colliders, 404 textures, meshes676/skinned170, texture bytes567729880, buffers41667444, total609397324. Three pose calls/tris exact: gate104/1152418, cabin146/1324294, pond92/950098.
- Nalati physics is back to 2772 colliders and instances1722; remaining mesh315→313, textures128→126 and GPU total250481940→237463876 go to R2. The final captured Nalati leak has beds0→1. Sound parity remains S35c/lead-owned; later source fixes require a new after snapshot.

Remaining red/new fields are recorded verbatim in the JSON: system ids/order, registry metadata, save preload keys, audio requests/score, Driftwood HUD/ambient, Nalati resources/budgets/bed lifecycle, and Pine/Nalati sound events. No full-green claim is made.

## Pond causal proof

The extra 8863 pond triangles began with `ef114096`: scheduling paused ambient FX before placement/visibility retirement. Actual renderer instrumentation on 885 found six wildlife instances: five hares still at default (0,-999,0) plus one woodpecker 311m away. Pre-S2 had five genuinely seated hares. One wildlife instance is 8887 triangles; spray median -24 explains the aggregate +8863.

Causal candidate `ea65ae74c73e66666254f303644af9ba9445e1f6` is 885 plus only the owned life/math/test correction. It restores all three pose draw/triangle counts exactly. Raw renderer/instance data: `/private/tmp/e357-s21c/pond-draws/`; causal gameplay: `/private/tmp/e357-s21c/pond-causal-game/run-1`. The correction seats hares immediately, keeps cheap reseating and view eligibility before scheduler decisions, and expires bird departure visibility without advancing a held brain. 06§6.6 permits paused brains/bodies; it does not authorize default-world placement or extra drawn animals.

## Corrected residual diagnoses

**Remote prop rotations:** my preliminary diagnosis was wrong: missing bodyType also includes creature hitboxes. Filtering actual Rapier WORLD group (`collisionGroups() >>> 16 === 1`) yields **2079/2079 colliders byte-identical in the same order** between 20fcbf54 and 885. The 25 no-parent differences are HITBOX-group animal body/fore capsules, not world props. Far pose holding came from `63edbe16` S2.6 bodyDt scheduling. 06§8 expressly lists far creatures holding still as the S2.6 boarded difference; any further review belongs to that creature/scheduler board. No prop-orientation source fix is justified by these dumps.

**Token-7:** baseline 20fcbf54 already has `taken:token-7` and `token:7` in pauseResume.before.quest.pine, as do 885+life and final0d. Touch moved/yaw/dodge/used fields are exact. Token rows have no touch:true, and their source placement/radius did not change. The harness explicitly presses USE near a prompt in its phone touch leg. New `voices:ui-glyph` is a sound-log delta; a new quest pickup or placement/state regression is not established. Relayed to lead; S35c had already ended when the followup was sent.

## Next

Lead/integration: retain red proof; re-run the after side on the selected current HEAD after the audio and Nalati resource fixes. Account for remaining structural rows through approved mappings/changes, then full two-tier gate and milestone review. Hot holders: sol-v2 owns main/bootstrap/indexes/manifests; Game.ts and lint/ratchet.json remain lead-held. No additional S2.1 source change is pending here.
