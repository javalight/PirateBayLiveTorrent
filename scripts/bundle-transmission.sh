#!/usr/bin/env bash
# Bundle a self-contained transmission-daemon (plus all its non-system
# dylibs, with rewritten rpaths) into resources/bin/. The result runs on
# a clean Mac with no Homebrew, no Transmission install, nothing.
#
# Run this on a Mac that has `brew install transmission-cli dylibbundler`
# whenever you bump the daemon version. The output goes to
# resources/bin/ and is shipped by electron-builder via extraResources.

set -euo pipefail

SRC=$(brew --prefix)/bin/transmission-daemon
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEST_DIR="$PROJECT_DIR/resources/bin"

if [ ! -x "$SRC" ]; then
  echo "ERROR: $SRC not found. Install with: brew install transmission-cli" >&2
  exit 1
fi

if ! command -v dylibbundler >/dev/null 2>&1; then
  echo "ERROR: dylibbundler not found. Install with: brew install dylibbundler" >&2
  exit 1
fi

echo "→ Cleaning $DEST_DIR"
rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR"

echo "→ Copying $SRC → $DEST_DIR/transmission-daemon"
cp "$SRC" "$DEST_DIR/transmission-daemon"
chmod +x "$DEST_DIR/transmission-daemon"

echo "→ Bundling non-system dylibs into $DEST_DIR (libs/ subdir)"
# -od overwrites destination, -b bundles, -x is the executable to scan,
# -d is where dylibs go, -p is the relative @rpath the binary will use.
dylibbundler \
  -od -b \
  -x "$DEST_DIR/transmission-daemon" \
  -d "$DEST_DIR/libs/" \
  -p '@executable_path/libs/'

echo "→ Verifying linkage"
otool -L "$DEST_DIR/transmission-daemon" | sed 's/^/    /'

echo
echo "✓ Bundle ready at $DEST_DIR"
echo "  $(du -sh "$DEST_DIR" | cut -f1) total"
