#!/usr/bin/env bash
# Restore only checksum-verified smoke bytes; retry one failed transfer, never a build.
set -euo pipefail

for attempt in 1 2; do
  rm -rf dist
  mkdir -p dist
  if shasum -a 256 --check boot-dist.sha256 && tar -xf boot-dist.tar -C dist; then
    exit 0
  fi
  if [ "$attempt" = 2 ]; then
    echo 'boot-dist: checksum or unpack still failed after one fresh download' >&2
    exit 1
  fi
  echo 'boot-dist: checksum or unpack failed; downloading the exact-run artifact once more' >&2
  rm -rf dist
  rm -f boot-dist.tar boot-dist.sha256 boot-dist-proof.json
  : "${GITHUB_RUN_ID:?The smoke run must identify its artifact}"
  : "${GITHUB_REPOSITORY:?The smoke repository must be explicit}"
  gh run download "$GITHUB_RUN_ID" --repo "$GITHUB_REPOSITORY" --name boot-dist --dir .
done
