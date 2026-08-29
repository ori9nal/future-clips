#!/usr/bin/env bash
# Build + gate the cutout library for every niche, end to end.
set -u
for n in "$@"; do
  echo "=================== $n ==================="
  node --env-file=.env.local tools/build-library.mjs --niche "$n" --kind people --per-query 5 --keep 2 2>&1 | grep -vE "GLib|^$"
  node tools/dedupe-library.mjs      --niche "$n" --kind people --apply 2>&1 | grep -vE "GLib|^$" | tail -3
  node tools/translucency-check.mjs  --niche "$n" --kind people --apply 2>&1 | grep -vE "GLib|^$" | tail -3
done
