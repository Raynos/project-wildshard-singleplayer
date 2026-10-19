# Review storage headroom audit

2026-10-19. Read-only audit; no cleanup authorized or performed by this report. About1.4GiB local free space remained. Native Site61 deployment archive is264,294,400 bytes against268,435,456-byte ceiling.

Four temporary decoded-review image sets contain13,546 JPGs,1,232,867,328 allocated bytes. Each complete directory file set matches its retained full-frame representative and sheet index, and all sheet SHA256 values match. These are potential reproducible derivatives, not raw captures:

- tmp/mantis-early-knee-independent-visual direct files only:601,690,112 allocated bytes.
- Its supplement1 subdirectory:233,033,728 bytes.
- Its moving1 subdirectory:76,001,280 bytes.
- tmp/mantis-precontact-independent-visual2:322,142,208 bytes.

All four inspect_video.py scripts and video-index.json files are tracked under docs/reviews/mantis-early-knee-independent/{capture1,supplement1,moving1}/ and docs/reviews/mantis-precontact-independent/capture2/. Relevant checkpoint c606ef2dc2a4027fa037129eb5343ca000139169. Recipes retain decoding, deduplication, JPEG settings and chronological sheet layout. Byte-identical JPEG regeneration across library versions was not established; no image files were removed.

Each original video matched its recorded SHA in both the repository raw run and native Site source-evidence copy:

- Early-knee main:0dd504ff1ed622b2c43a8dc1bc386f3aa0fb8a585caceb0855c4ada906d9b32f.
- Supplement:faca0448ac5a83dbc2a327a8c9f2c622d8ec52b6804943d693b4eb5d587b13e8.
- Moving:223182d0041d050a814899e96ca7d4f55e110a15dd6d8f836b2a89f875d93954.
- Precontact:130fd5eeca4507c74e133bb7d3766709119fab9bee8f9ed43154df642bc26821.

No blanket cleanup of temporary directories, mirrors, Git objects, old publication archives, failed evidence or backups is justified. Preserve complete raw videos/traces, scripts, indices and review text.

The Site has43 remaining PNGs totaling12,692,742 bytes. A bounded23-image pool in assets/four-enemy-progress and assets/four-enemy-milestones totals7,928,264 bytes. Their exact original capture PNGs exist, but need native source preservation before any delivery conversion. Input size is not a savings estimate. A separate lossless conversion study is authorized to measure exact decoded-RGBA equality and savings, without changing current public delivery.

The existing72-entry captured-lossless-delivery.json was independently rechecked: original/delivery hashes, dimensions and full RGBA equality all pass; prior18,116,836-byte savings are supported. Five3,292,228-byte Rapier copies offer only a hypothetical deduplication ceiling; exact identity/routing/host closure was not audited, so no shared-runtime rewrite is proposed.
