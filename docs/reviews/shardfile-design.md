# Shardfile Design

**Status:** `read` (Jake, 2026-10-16 ~10:40 Cancun: *"I read the short file plan, the artifact … It's alright … it looks solid to me."*; sent 2026-10-15, version 3 added the review and the every-folder section). The shardfile as two things: the source folder people edit (TypeScript `data/` and `generators/` run at build, standalone `runtime/`) and the built output `out/<slug>/` the engine loads (index `shard.json` format 2, one JSON file per section, blobs by kind, a temporary verbatim `runtime/` copy, seven validation checks). Also covers `wildshard build`, the ruler on the output, the migration rows (mostly Codex), and real Sky Reach and Signal Dunes examples.
**Link:** https://claude.ai/artifact/5YV7KwGf9BsJ4Zudt2uwtv
**Plan:** SHARD-PLATFORM G447–G449
**Made by:** a design agent (Opus 5.5) wrote `progress/shard-platform/shardfile-design-2026-10-15/README.md` (`2ead9dfa1`, `e6980c490`); the plan-status agent (`wildshard-v`) made the page
