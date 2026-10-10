#!/usr/bin/env bash
# Works out this CI run's version and writes it to $GITHUB_OUTPUT:
#   version       x.y.z      from package.json — the single source of truth
#   msix_version  x.y.z.0    MSIX package (the Store requires the last part to be 0)
#   is_release    true|false
#
# uGit's own release flow already bumps the version by hand in package.json,
# src-tauri/tauri.conf.json and src-tauri/Cargo.toml before tagging (see README),
# unlike a build that derives its version purely from the tag. So this script
# doesn't invent a version — it reads the one already committed, and on a tag
# push just checks that tag actually matches it, to catch a forgotten bump
# before it ships as a mismatched release.
#
# Inputs (set by GitHub Actions): GITHUB_REF_TYPE, GITHUB_REF_NAME, GITHUB_OUTPUT.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
version="$(node -p "require('$root/package.json').version")"

if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "::error::package.json version '$version' doesn't look like x.y.z" >&2
  exit 1
fi

if [[ "${GITHUB_REF_TYPE:-}" == "tag" ]]; then
  tag="${GITHUB_REF_NAME:-}"
  if [[ "$tag" != "v$version" ]]; then
    echo "::error::Tag '$tag' doesn't match package.json version '$version' — bump the version in package.json, src-tauri/tauri.conf.json and src-tauri/Cargo.toml first" >&2
    exit 1
  fi
  is_release=true
else
  is_release=false
fi

echo "Version: $version (release: $is_release)"
{
  echo "version=$version"
  echo "msix_version=$version.0"
  echo "is_release=$is_release"
} >> "${GITHUB_OUTPUT:-/dev/stdout}"
