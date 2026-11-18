#!/usr/bin/env bash
# Build Glade in release mode and install it for the current user (no sudo):
#   binary   -> ~/.local/bin/glade
#   launcher -> ~/.local/share/applications/glade.desktop
#   icons    -> ~/.local/share/icons/hicolor/<size>/apps/glade.png
#
# Re-run after changing the app to update the installed version.
#   bun run install:local            # build + install
#   bun run install:local -- --skip-build   # just reinstall the last build
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"

if [ "${1:-}" != "--skip-build" ]; then
  # --no-bundle: we only need the binary (the frontend is embedded in it).
  bun run tauri build --no-bundle
fi

BIN=src-tauri/target/release/glade
[ -x "$BIN" ] || { echo "No release binary at $BIN. Run without --skip-build." >&2; exit 1; }

PREFIX="${PREFIX:-$HOME/.local}"
install -Dm755 "$BIN" "$PREFIX/bin/glade"

for size in 32 128; do
  install -Dm644 "src-tauri/icons/${size}x${size}.png" "$PREFIX/share/icons/hicolor/${size}x${size}/apps/glade.png"
done
install -Dm644 "src-tauri/icons/128x128@2x.png" "$PREFIX/share/icons/hicolor/256x256/apps/glade.png"

mkdir -p "$PREFIX/share/applications"
cat > "$PREFIX/share/applications/glade.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Glade
Comment=Markdown viewer and editor
Exec=$PREFIX/bin/glade %F
Icon=glade
Terminal=false
Categories=Utility;TextEditor;
MimeType=text/markdown;
StartupWMClass=glade
DESKTOP

command -v update-desktop-database >/dev/null && update-desktop-database "$PREFIX/share/applications" || true
command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -f -t "$PREFIX/share/icons/hicolor" 2>/dev/null || true

echo "Installed Glade to $PREFIX (launcher: Glade, command: glade)."
