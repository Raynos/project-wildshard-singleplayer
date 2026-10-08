# Wildshard Admin

**Status:** `unread` 2026-10-08. SF68 (E462, G248–G251): the third site, with no game in it. Portrait-first for iPhone Safari,
public and unlisted. It's rebuilt from committed reports on every deploy and has four tools:
- **memory explorer:** the itemized and SF64 reports by situation and build; GPU vs RAM by owner, then by asset; the 1.0 GB line;
  measured, estimated and unattributed shown apart; a compare view;
- **loading explorer:** empty until SF67 commits its benchmark;
- **playtest reports:** each round's top 10, with clips and stills;
- **plan dashboard:** effort %, milestones, decisions, what's waiting for Jake.

**Link:** https://wildshard-admin.vercel.app (first deploy build `9aa669b39`, `version.json` reports the commit)
**Plan:** SHARD-PLATFORM, row SF68
**Made by:**
- the SF68 Opus UI lane: `aff2888b2` (`admin/`, captures in `progress/shard-platform/sf68/`);
- sp-x2's data pipeline: `7ea6e6cb7` (`scripts/admin-data.mjs`);
- deploys: `bash admin/tools/deploy.sh`, run by the coordinator.

Known gaps:
- the data bundle covers SHARD-PLATFORM only, so the dashboard groups rows by status, not by plan section;
- the loading explorer is empty until SF67's benchmark exists.
