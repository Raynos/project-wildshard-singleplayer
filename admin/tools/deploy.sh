#!/usr/bin/env bash
# Deploy the admin site (SHARD-PLATFORM SF68, G248–G251): wildshard-admin, public and unlisted, rebuilt from the
# committed reports on every deploy (G250). The coordinator runs it; builders don't deploy.
#
#   bash admin/tools/deploy.sh          # ships HEAD's committed reports, not the working tree
#
# It builds from a clean `git archive HEAD` export (nobody's half-finished files ship), then uploads the static output
# to the Vercel project `wildshard-admin` (scope raynos-projects). The project must exist and be named before the first
# deploy (global Vercel notes): create it, then commit its ids as admin/vercel-project.json
#   {"projectId":"prj_…","orgId":"team_HPUh311dFa6AoKlBNtS9Oiph","projectName":"wildshard-admin"}
# so this upload never names a project after a build directory. The project has no Git link: nothing auto-deploys.
set -euo pipefail

repo="$(git rev-parse --show-toplevel)"
cd "$repo"
sha="$(git rev-parse --short HEAD)"
full="$(git rev-parse HEAD)"
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
trap 'rm -rf "$work"' EXIT
# the site, sp-x2's admin-data pipeline and every report path it reads (scripts/admin-data.mjs exportedAdminTree)
reports=(progress/memory art/playtest docs/plans/SHARD-PLATFORM.md)
if git cat-file -e "HEAD:progress/loading/sf67" 2>/dev/null; then reports+=(progress/loading/sf67); fi
git archive HEAD admin tsconfig.json package.json scripts/admin-data.mjs scripts/admin-data scripts/memory-report-data.mjs \
  scripts/memory-report-blocks.mjs "${reports[@]}" | tar -x -C "$work"
ln -s "$repo/node_modules" "$work/node_modules"

echo "deploy-admin: building $sha"
# ADMIN_REV: the export has no .git, so the pipeline reads this clean archive and records HEAD's full sha as its pin
(cd "$work" && ADMIN_REV="$full" node node_modules/vite/bin/vite.js build --config admin/vite.config.ts --logLevel warn)

mkdir -p "$work/dist-admin/.vercel"
cp admin/vercel-project.json "$work/dist-admin/.vercel/project.json"

echo "deploy-admin: uploading"
url="$(vercel deploy "$work/dist-admin" --prod --yes --scope raynos-projects 2>/dev/null | grep -Eo "https://[^ ]+vercel.app" | tail -1)"
echo "deploy-admin: $url"

live="https://wildshard-admin.vercel.app"
build="$(curl -fsS "$live/version.json" | sed -E 's/.*"build":"([^"]+)".*/\1/')"
case "$build" in
  "$sha"*) echo "deploy-admin: live at $live (build $build)" ;;
  *) echo "deploy-admin: $live reports build $build, not $sha" >&2; exit 1 ;;
esac
