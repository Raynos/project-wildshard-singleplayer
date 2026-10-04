#!/usr/bin/env bash
# SHARD-PLATFORM SF16: the M1 look board in one command. The CLI has no client flag, so this assembles by hand:
#   1. exports <client ref> (default HEAD) and <legacy ref> (default: the last commit that still ships the template's
#      legacy plugin) with git archive + scripts/link-node-modules.mjs, so neither side builds the shared working tree;
#   2. builds both with vite, and the template's shardfile product from the client export (--product-only);
#   3. assembles the shardfile client: the client build + the product + the ws-shardfile script in index.html;
#   4. runs board.mjs from this checkout through the browser lane: today (the legacy build, ?chunk=_template) beside the
#      shardfile client, six cameras, writing board.jpg and evidence.json next to it.
#   progress/shard-platform/sf16/run.sh <scratch dir> [client ref] [legacy ref]
set -euo pipefail
out=${1:?usage: run.sh <scratch dir> [client ref] [legacy ref]}
client_ref=${2:-HEAD}
legacy_ref=${3:-55be90f8c4a4eacdf32ac1ae66a98ce6447902f3}
mkdir -p "$out"; out=$(cd "$out" && pwd -P)
repo=$(cd "$(dirname "$0")/../../.." && pwd -P)
cd "$repo"
export_tree() { # <ref> <dir>
  rm -rf "$2"; mkdir -p "$2"
  git archive "$1" | tar -x -C "$2"
  node scripts/link-node-modules.mjs "$repo" "$2"
}
build() { # <tree> <dist>
  (cd "$1" && pnpm exec vite build --outDir "$2" --logLevel warn > "$2.log" 2>&1) || { tail -40 "$2.log"; exit 1; }
}
export_tree "$client_ref" "$out/client-tree"
build "$out/client-tree" "$out/client-dist"
if [ "$(git rev-parse "$legacy_ref^{tree}")" = "$(git rev-parse "$client_ref^{tree}")" ]; then
  legacy_dist="$out/client-dist"
else
  export_tree "$legacy_ref" "$out/legacy-tree"
  build "$out/legacy-tree" "$out/legacy-dist"
  legacy_dist="$out/legacy-dist"
fi
rm -rf "$out/product" "$out/client"
(cd "$out/client-tree" && node scripts/wildshard.mjs build src/shards/_template "$out/product" --product-only)
cp -R "$out/client-dist" "$out/client"
cp "$out/product"/* "$out/client/"
node -e '
const { readFileSync, writeFileSync } = require("node:fs");
const [client, product] = process.argv.slice(1);
const json = readFileSync(`${product}/shard.json`, "utf8").replaceAll("<", "\\u003c");
const page = `${client}/index.html`, html = readFileSync(page, "utf8");
if (!html.includes("</head>") || html.includes("id=\"ws-shardfile\"")) throw new Error("index.html: no </head>, or already embeds a shardfile");
writeFileSync(page, html.replace("</head>", `<script id="ws-shardfile" type="application/json">${json}</script></head>`));
' "$out/client" "$out/product"
scripts/browser-lane.sh node progress/shard-platform/sf16/board.mjs "$legacy_dist" "$out/client" "$out/shots"
