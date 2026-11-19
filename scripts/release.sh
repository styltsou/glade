#!/usr/bin/env bash
# Prepare a release: bump the version everywhere, commit, and tag v<version>.
#   scripts/release.sh 0.2.0
# Then publish it with:
#   git push --follow-tags
# Pushing the tag starts .github/workflows/release.yml, which builds the
# installers and publishes the GitHub Release that installed copies update from.
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"

VERSION="${1:-}"
VERSION="${VERSION#v}"
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
  echo "usage: scripts/release.sh <version>   e.g. scripts/release.sh 0.2.0" >&2
  exit 1
fi
TAG="v$VERSION"

if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  echo "Tag $TAG already exists." >&2
  exit 1
fi

FILES=(package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock)
if ! git diff --quiet HEAD -- "${FILES[@]}"; then
  echo "These files have uncommitted changes; commit or discard them first:" >&2
  git diff --name-only HEAD -- "${FILES[@]}" >&2
  exit 1
fi

# package.json and tauri.conf.json: the top-level "version" field (the first
# one in each file). Cargo.toml: the version line of [package].
sed -i -E "0,/^  \"version\": \"[^\"]*\"/s//  \"version\": \"$VERSION\"/" package.json src-tauri/tauri.conf.json
sed -i -E "0,/^version = \"[^\"]*\"/s//version = \"$VERSION\"/" src-tauri/Cargo.toml
for f in package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml; do
  grep -q "\"\?version\"\? \?[:=] \"$VERSION\"" "$f" || { echo "Could not set the version in $f" >&2; exit 1; }
done

# Cargo.lock: let cargo record glade's new version.
(cd src-tauri && cargo metadata --format-version 1 >/dev/null)

git add -- "${FILES[@]}"
git commit -m "chore: release $TAG" -- "${FILES[@]}"
git tag -a "$TAG" -m "Glade $TAG"

echo
echo "Committed and tagged $TAG. Publish it with:"
echo "  git push --follow-tags"
