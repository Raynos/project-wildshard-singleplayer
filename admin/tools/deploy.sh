#!/usr/bin/env bash
# Deploy the admin site (SHARD-PLATFORM SF68, G248–G251): wildshard-admin, public and unlisted, rebuilt from the
# committed reports on every deploy (G250). The dedicated admin workflow runs it on report changes.
#
#   bash admin/tools/deploy.sh [REV]    # ships the resolved commit, not the working tree
#
# It builds from a clean `git archive HEAD` export (nobody's half-finished files ship), then uploads the static output
# to the Vercel project `wildshard-admin` (scope raynos-projects). The project must exist and be named before the first
# deploy (global Vercel notes): create it, then commit its ids as admin/vercel-project.json
#   {"projectId":"prj_…","orgId":"team_HPUh311dFa6AoKlBNtS9Oiph","projectName":"wildshard-admin"}
# so this upload never names a project after a build directory. The workflow replaces the missing Git link.
set -euo pipefail

repo="$(git rev-parse --show-toplevel)"
cd "$repo"
full="$(git rev-parse --verify "${1:-HEAD}^{commit}")"
sha="${full:0:9}"
if [ ! -f admin/vercel-project.json ]; then
  echo "deploy-admin: admin/vercel-project.json is missing; create the Vercel project wildshard-admin first (see the header)" >&2
  exit 1
fi
dirty="$(git status --porcelain -- admin | grep -v '^??' || true)"
if [ -n "$dirty" ]; then
  echo "deploy-admin: admin/ has uncommitted edits; HEAD ($sha) ships without them:" >&2
  echo "$dirty" >&2
fi

work="$(mktemp -d "${TMPDIR:-/tmp}/wildshard-admin-deploy.XXXXXX")"
work="$(cd "$work" && pwd -P)"
trap 'rm -rf "$work"' EXIT
# the site, sp-x2's admin-data pipeline and every report path it reads (scripts/admin-data.mjs exportedAdminTree)
reports=(progress/memory art/playtest docs/plans/SHARD-PLATFORM.md)
if git cat-file -e "$full:progress/loading/sf67" 2>/dev/null; then reports+=(progress/loading/sf67); fi
# the Progress card: every committed effort recount folder (the newest is read), and what the share script measures
# (scripts/admin-data.mjs SHARE_INPUTS: it runs `node scripts/shard-platform.mjs --json` inside this export)
while IFS= read -r folder; do reports+=("$folder"); done < <(git ls-tree -d --name-only "$full" -- progress/shard-platform/ | grep '^progress/shard-platform/effort-recount-' || true)
share=(src lint/shard-platform.json lint/legacy-shards.json test/proof scripts/shard-platform.mjs scripts/check-graph.mjs scripts/legacy-shards.mjs \
  scripts/link-node-modules.mjs)
git archive "$full" admin tsconfig.json package.json scripts/admin-data.mjs scripts/admin-data scripts/memory-report-data.mjs \
  scripts/memory-report-blocks.mjs "${share[@]}" "${reports[@]}" | tar -x -C "$work"
node scripts/link-node-modules.mjs "$repo" "$work"

echo "deploy-admin: building $sha"
# ADMIN_REV: the export has no .git, so the pipeline reads this clean archive and records HEAD's full sha as its pin
(cd "$work" && python3 "$repo/scripts/heavy-lane.py" build -- env ADMIN_REV="$full" node node_modules/vite/bin/vite.js build --config admin/vite.config.ts --logLevel warn)

mkdir -p "$work/dist-admin/.vercel"
cp "$work/admin/vercel-project.json" "$work/dist-admin/.vercel/project.json"

echo "deploy-admin: uploading"
deploy=(vercel deploy "$work/dist-admin" --prod --yes --scope raynos-projects)
if [ -n "${VERCEL_BUILD_TOKEN:-}" ]; then deploy+=(--token "$VERCEL_BUILD_TOKEN"); fi
url="$("${deploy[@]}" | grep -Eo "https://[^ ]+vercel.app" | tail -1)"
echo "deploy-admin: $url"

live="https://wildshard-admin.vercel.app"
# The production alias can briefly serve the preceding deployment after Vercel reports Ready.
# Verify the exact pin with uncached reads; never mark a different build green.
for attempt in {1..12}; do
  build="$(curl -fsS -H 'Cache-Control: no-cache' "$live/version.json" | sed -E 's/.*"build":"([^"]+)".*/\1/' || true)"
  if [ "$build" = "$sha" ]; then
    echo "deploy-admin: live at $live (build $build)"
    exit 0
  fi
  sleep 5
done
echo "deploy-admin: $live reports build $build, not $sha" >&2
exit 1
