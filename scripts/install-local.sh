#!/usr/bin/env bash
# Build Glade in release mode and install it for the current user (no sudo):
#   binary   -> ~/.local/bin/glade
#   launcher -> ~/.local/share/applications/glade.desktop
#   icons    -> ~/.local/share/icons/hicolor/<size>/apps/glade.png (+ scalable svg)
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

# Icon: black tile for light desktops, white tile for dark ones.
#   ICON_VARIANT=black|white overrides the automatic choice.
VARIANT="${ICON_VARIANT:-auto}"
if [ "$VARIANT" = "auto" ]; then
  if gsettings get org.gnome.desktop.interface color-scheme 2>/dev/null | grep -q dark; then
    VARIANT=white
  else
    VARIANT=black
  fi
fi
for size in 32 128 256; do
  install -Dm644 "assets/icon/$VARIANT/${size}.png" "$PREFIX/share/icons/hicolor/${size}x${size}/apps/glade.png"
done
install -Dm644 "assets/icon/glade-$VARIANT.svg" "$PREFIX/share/icons/hicolor/scalable/apps/glade.svg"

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

echo "Installed Glade to $PREFIX (launcher: Glade, command: glade, icon: $VARIANT)."
