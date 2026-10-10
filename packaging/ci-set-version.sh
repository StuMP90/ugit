#!/usr/bin/env bash
# Stamps the version CI computed (from the git tag, via ci-version.sh) into the three files
# that normally carry a hand-bumped version, so a built artifact's own metadata (the .deb's
# package version, the exe's file version / window title, the .msix manifest) always matches
# the tag that triggered the build — without requiring the tag and the committed files to be
# kept in sync by hand first.
#
# CI-only: this edits the checkout in place and nothing commits or pushes it back, so it never
# touches the repository's actual committed version.
#
# Usage: packaging/ci-set-version.sh x.y.z
set -euo pipefail

version="${1:?usage: ci-set-version.sh x.y.z}"
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "::error::'$version' doesn't look like x.y.z" >&2
  exit 1
fi

root="$(cd "$(dirname "$0")/.." && pwd)"

node -e "
  const fs = require('fs');
  for (const f of ['$root/package.json', '$root/src-tauri/tauri.conf.json']) {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    j.version = '$version';
    fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n');
  }
"

# Only the [package] table's own version (the file's first 'version = ' line) — dependency
# tables further down can contain the same key (e.g. 'serde = { version = "1", ... }').
sed -i "0,/^version = \".*\"/{s/^version = \".*\"/version = \"$version\"/}" "$root/src-tauri/Cargo.toml"

echo "Stamped version $version into package.json, tauri.conf.json, Cargo.toml"
