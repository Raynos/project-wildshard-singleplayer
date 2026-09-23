#!/bin/bash
# usage: run.sh <name> <refimg|-> <prompt>
D="$(cd "$(dirname "$0")/.." && pwd)"  # dev/nalati-cleanroom (raw images land in gen/, not committed)
name=$1; ref=$2; prompt=$3
out="$D/gen/raw/$name.png"
args=()
[ "$ref" != "-" ] && args=(-i "$ref")
codex exec -m gpt-6-sol -s danger-full-access --skip-git-repo-check -C "$D/gen" "${args[@]}" -- "$prompt ... Generate exactly one image with your built-in image_gen tool, then copy the file path YOUR image_gen reported to $out , do not touch any other file." >> "$D/gen/logs/$name.log" 2>&1
echo "done $name $(ls -la "$out" 2>&1)" >> "$D/gen/logs/_done.txt"
