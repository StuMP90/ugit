#!/usr/bin/env bash
# Works out this CI run's version and writes it to $GITHUB_OUTPUT:
#   version       x.y.z      the single source of truth for this run
#   msix_version  x.y.z.0    MSIX package (the Store requires the last part to be 0)
#   is_release    true|false
#
# The tag is authoritative, not the committed version in package.json/tauri.conf.json/
# Cargo.toml — pushing vX.Y.Z builds and releases X.Y.Z regardless of what's currently
# committed there. packaging/ci-set-version.sh stamps this version into those files for
# the build (so a shipped artifact's own metadata matches the tag it came from), but that
# never gets committed back.
#
# Anything else (push to main, pull request, manual run) gets 0.0.<run number>, never
# mistakable for a release.
#
# Inputs (set by GitHub Actions): GITHUB_REF_TYPE, GITHUB_REF_NAME, GITHUB_RUN_NUMBER, GITHUB_OUTPUT.
set -euo pipefail

if [[ "${GITHUB_REF_TYPE:-}" == "tag" ]]; then
  tag="${GITHUB_REF_NAME:-}"
  if [[ ! "$tag" =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    echo "::error::Release tag '$tag' must look like v1.2.3" >&2
    exit 1
  fi
  version="${BASH_REMATCH[1]}.${BASH_REMATCH[2]}.${BASH_REMATCH[3]}"
  is_release=true
else
  version="0.0.${GITHUB_RUN_NUMBER:-0}"
  is_release=false
fi

echo "Version: $version (release: $is_release)"
{
  echo "version=$version"
  echo "msix_version=$version.0"
  echo "is_release=$is_release"
} >> "${GITHUB_OUTPUT:-/dev/stdout}"
