#!/usr/bin/env bash
# Deploy the marketing site (MARKETING-SITE MS4, E465): by hand, never from a push, the same way as the drafts site.
# Builds from a clean export of HEAD (nobody's half-finished files ship), then uploads the static output to the Vercel
# project `wildshard-site` (no Git link). Public from the first deploy (Jake, Q4).
#
#   bash site/tools/deploy.sh          # commit first: it ships HEAD, not the working tree
set -euo pipefail

repo="$(git rev-parse --show-toplevel)"
cd "$repo"
sha="$(git rev-parse --short HEAD)"
dirty="$(git status --porcelain -- site | grep -v '^??' || true)"
if [ -n "$dirty" ]; then
  echo "deploy-site: site/ has uncommitted edits; HEAD ($sha) ships without them:" >&2
  echo "$dirty" >&2
fi

work="$(mktemp -d "${TMPDIR:-/tmp}/wildshard-site-deploy.XXXXXX")"
trap 'rm -rf "$work"' EXIT
git archive HEAD site tsconfig.json package.json | tar -x -C "$work"
node "$repo/scripts/link-node-modules.mjs" "$repo" "$work" # E432: no whole-folder node_modules symlink

echo "deploy-site: building $sha"
(cd "$work" && SITE_BUILD_SHA="$sha" "$repo/node_modules/.bin/vite" build --config site/vite.config.ts --logLevel warn)

# Link the output folder to the project (ids are not secrets; the CLI's own login is the credential).
mkdir -p "$work/dist-site/.vercel"
cp site/vercel-project.json "$work/dist-site/.vercel/project.json"

echo "deploy-site: uploading"
url="$(vercel deploy "$work/dist-site" --prod --yes --scope raynos-projects 2>/dev/null | grep -Eo "https://[^ ]+vercel.app" | tail -1)"
echo "deploy-site: $url"

live="https://wildshard-site.vercel.app"
build="$(curl -fsS "$live/version.json" | sed -E 's/.*"build":"([^"]+)".*/\1/')"
case "$build" in
  "$sha"*) echo "deploy-site: live at $live (build $build)" ;;
  *) echo "deploy-site: $live reports build $build, not $sha" >&2; exit 1 ;;
esac
