# Engine-backed deployment shell

J189/J190 replaces local engine, game, SDK, author tooling and seven shard
projects with immutable repo pins. Production stays on the same Vercel
project, domain and secrets. Native and OTA remain parked. The same-origin
API functions stay until the separate API switch.

The release has two independent inputs. The operator first updates the
artifact inputs in `engine.pin.json` with organization GitHub read access:

Before the shell bump, release engine from its clean main checkout. First
require green `ci` and `ring-1` on the pushed engine fix. The kit's old
single-phase helper tagged a new version commit before CI had seen it;
engine now requires two phases using the published helper in `leftover`:

```sh
cd "$HOME/projects/games/wildshard/engine"
WS_FULL_SUITE=1 WS_VITEST_MAX_WORKERS=2 ASSISTED_BY=Codex:gpt-6.1-sol \
GIT_SSH_COMMAND='ssh -o ServerAliveInterval=20 -o ServerAliveCountMax=120 -o TCPKeepAlive=yes' \
bash ../leftover/src/repo-kit/release.sh v0.1.1 --prepare
# Require both workflows green on the exact release commit printed above.
WS_FULL_SUITE=1 WS_VITEST_MAX_WORKERS=2 ASSISTED_BY=Codex:gpt-6.1-sol \
GIT_SSH_COMMAND='ssh -o ServerAliveInterval=20 -o ServerAliveCountMax=120 -o TCPKeepAlive=yes' \
bash ../leftover/src/repo-kit/release.sh v0.1.1 --finish
```

Prepare pushes the version/stamp commit through normal hooks and creates
no tag. Finish repeats normal checks and verifies exact-SHA green `ci`
and `ring-1`, then tags that explicit SHA without another commit. All SSH
pushes keep the keepalives and all hooks.

The newer full-push profile serializes native/performance proofs before
the ordinary pool. To use that complete inventory during either helper
phase, acquire its real machine lease first, from a clean existing engine
checkout:

```sh
WS_FULL_SUITE=1 ASSISTED_BY=Codex:gpt-6.1-sol \
GIT_SSH_COMMAND='ssh -o ServerAliveInterval=20 -o ServerAliveCountMax=120 -o TCPKeepAlive=yes' \
python3 scripts/heavy-lane.py full-test -- env WS_PUSH_GATE_PROFILE=full-v1 \
  bash "$HOME/projects/games/wildshard/leftover/src/repo-kit/release.sh" v0.1.2 --prepare
# After exact release-commit ci and ring-1 are green, repeat with --finish.
```

Do not set the profile without the authenticated lease. The helper remains
unchanged and repeats its full checks; no test result is fabricated or
quarantined locally by this command. Then return to the shell checkout:

```sh
cd "$HOME/projects/games/wildshard-singleplayer"
node scripts/engine-pin.mjs bump v0.1.1 \
  shard-driftwood=<40-character-commit-or-tag>
```

Unspecified shard revisions stay pinned. The command resolves and verifies
immutable tags, requires exact-SHA green engine CI and ring-1 plus shard CI,
and refuses a lower save epoch. There is no sharddev on the release path.
CI's default GitHub token installs only the public engine. It never fetches
or queries the seven private shard author repos. Those revisions are
provenance pins checked by the operator bump; the build reads engine's
admitted product tarballs. No active project source remains tracked here.
Engine builds
its admitted product pins once. The shell packages and tests that exact
artifact, including a final size gate without `--cooks-after`.

The second input is `.github/deploy-pin.json`. `pinned` is a pure production
hold. A held push still builds, proves and stages an unaliased Vercel URL;
it cannot promote. Before changing mode, the operator must prove that exact
staged URL in both Chromium and WebKit with service workers enabled, plus
its real Vercel headers and same-origin API functions. The local phone
proof alone is not this check. Jake's J195 authorizes v0.1.2 promotion as
soon as every staged proof passes; no additional coordinator go is needed.
Production remains held until those exact staged proofs pass.

Read the exact stage URL from the held workflow's "Stage the proven
artifact" result, then run from this checkout (phone profile, muted):

```sh
scripts/browser-lane.sh node scripts/prove-release.mjs "$STAGED_URL" --vercel --existing-bypass
```

This proves title, Driftwood, Pine, Nalati and the real title-to-grid tap on
Chromium and WebKit, then reloads under the active service worker and checks
that settings carried and old progress did not. Manual `--vercel` visits
also hold the real loading card, check its first and admitted destination,
completed measured phases and complete safe native clipboard export, then
use normal movement inputs to cross the road into Ember. They earn a save,
exit to the title and tap GRID again, requiring Ember's actual card and
restored pose within three millimetres. Chromium's GRID leg uses its default
SwiftShader backend to cover the inherited shader-budget starvation mode;
the standalone visits use Metal on macOS. No progress or saved pose is
seeded. `--extended` runs these additional journeys on a local built artifact
without claiming Vercel headers, APIs or worker control. The Vercel proof
also reads the actual HTML/version/worker/module caching headers and calls
all four deployed API
functions with OPTIONS and unauthenticated GET. No inbox data is read or
written. `--existing-bypass` uses the existing Vercel CLI account to read an
existing project automation token into process memory; it never creates one
or changes protection. Alternatively provide the existing
`VERCEL_AUTOMATION_BYPASS_SECRET` through the environment. The proof uses
[Vercel's documented bypass headers](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)
without printing the credential. The new staged origin proves worker
control across reloads; it cannot prove adoption by a physical PWA already
installed on the production origin. The real IndexedDB migration proof
separately covers persistence and identity-only carry on both browsers.

Only after every staged proof passes, the release operator runs these
commands under Jake's J195 go, from this checkout with organization GitHub
access and the existing production Vercel automation credentials already
configured in CI:

```sh
node scripts/deploy-pin.mjs mode newest-ci-green --go '<Jake release go>'
scripts/commit.sh 'chore(release): lift the production hold

Release the staged and proven engine-backed shell after the explicit release go.

Assisted-by: Codex:gpt-6.1-sol' -- .github/deploy-pin.json
python3 scripts/push-loop.py --push HEAD
```

The push starts the promoting workflow. Do not also dispatch it: a second
run rebuilds and updates players twice. After promotion, rerun the same
Vercel proof against `https://wildshard-singleplayer.vercel.app` from the
mode commit's checkout; production is that commit's own rebuild.

The workflow admits only newest CI-green main with an exact-SHA green
boot smoke, rechecks main and the save-epoch floor, then promotes the sealed
artifact. An engine pin bump alone never releases a held production build.

J179's rule is **fix forward**. `deploy-pin.mjs rollback` is retired and
refuses without changing the pin. The only emergency rollback is a manual
Vercel rollback by the release operator after Jake explicitly authorizes it,
using an existing Vercel account with project deployment access:

```sh
vercel rollback <previous-production-deployment-url> --scope raynos-projects
DEPLOY_SHA=<previous-production-commit> DEPLOY_EXPECTED_BUILD=<expected-build-id> node scripts/deploy-version.mjs verify
```

Use the previous deployment's actual URL and build ID from Vercel's
production history. Do not emulate rollback by pinning an old Git SHA.
A rollback hides epoch-one progress and exposes the untouched epoch-zero
data again; the next forward release resumes epoch one. Native and OTA
remain parked throughout.

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

`release-archives.json` names the inactive pre-split scripts and test
fixtures that still reference the old source tree. Their exact blobs are
frozen history, excluded from package scripts and CI. The shell inventory
gate refuses new unrecorded legacy imports or changes to those blobs.
