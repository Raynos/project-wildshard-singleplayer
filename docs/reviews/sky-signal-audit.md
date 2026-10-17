# Sky and Signal Audit

**Status:** `read` (Jake answered its questions, 2026-10-17 ~10:05 Cancun: G480; sent ~10:00). Independent read-only audit of the W1 spike numbers at `e33958a4d`: Sky 521 → 528 (7.8 %; 7 lines of GLSL moved into `data/rocSlate.json` by `5d9b7a813` escape the ruler), Signal 392 honest (9.5 %). The cut was mostly a move into `generators/` (Sky 686 moved / 46 JSON / 38 deleted; Signal 885 / 84 / 14; runtime code −2 / +6). The shard file ships zero TS (both unclosed: Sky 14 escapes, Signal 4); the app bundle ships their TS plus generated JSON that duplicates the product. ~2,640 platform lines with only Sky and Signal as users are ungraded. Plan to zero: approved features, existing hosts and new features N1–N10 (declared runtime entry, world scene assembly, declared input/tier/slots, weapon-action burst, trail ribbon, fire FX, terrain skirt, eased shared field, Explorer catalogue), plus one new AS command for a host-private shared field.
**Link:** https://claude.ai/artifact/3a9aKhBc7J9jPQ22jN1oaZ
**Plan:** SHARD-PLATFORM W1 spike (G471, G472)
**Made by:** an Opus subagent of the plan agent ran the audit; the plan-status agent (`wildshard-v`) made the page
