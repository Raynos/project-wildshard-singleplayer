# Engine-backed deployment shell

J189/J190 replaces local engine, game, SDK, author tooling and seven shard
projects with immutable installed repos. Production stays on the same Vercel
project, domain and secrets. Native and OTA remain parked. The same-origin
API functions stay until the separate API switch.

`engine.pin.json` is the only release input pin. Bump it with:

```sh
node scripts/engine-pin.mjs bump v0.1.1 \
  shard-driftwood=<40-character-commit-or-tag>
```

Unspecified shard revisions stay pinned. The command resolves and verifies
immutable tags, requires exact-SHA green engine CI and ring-1 plus shard CI,
and refuses a lower save epoch. There is no sharddev on the release path.
CI installs the pinned engine and all seven shard projects in disposable
checkouts; no project source remains tracked in this shell. Engine builds
its admitted product pins once. The shell packages and tests that exact
artifact, including a final size gate without `--cooks-after`.

Epoch 1 uses `wildshard.save.v2@1.` and `wildshard-saves@1`. Progress starts
fresh once. Settings, graphics, controls and device identity carry. A cached
epoch-zero build cannot enumerate epoch-one progress. Old save imports are
refused before writes or server shutdown. A denied storage write never
reloads the phone. E7's first server release and player_save rows must use
saveEpoch >= 1 and follow this same monotonically increasing integer.

The shell retains its storage workflow and repo-size policy until another
running home is proved. Shard J186 deletions are recorded in their pinned
`test/lift-disposition.json` files. Native, archives, API and admin source
remain parked; the old admin and size-watch schedules are retired.

The original art archives and human-written shard README files remain as
J18 history, including the parked Template 2 corpus sources. No first-party
shard implementation remains; the shell never compiles archived files.
