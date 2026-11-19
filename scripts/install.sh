#!/bin/sh
# Install or update Glade on Linux for the current user (no sudo):
#
#   curl -fsSL https://raw.githubusercontent.com/styltsou/glade/main/scripts/install.sh | sh
#
#   app      -> ~/.local/lib/glade/Glade.AppImage  (replaced in place by Glade's own updater)
#   command  -> ~/.local/bin/glade                 (symlink to the AppImage)
#   launcher -> ~/.local/share/applications/glade.desktop
#   icons    -> ~/.local/share/icons/hicolor/<size>/apps/glade.png (+ scalable svg)
#
# Run it again to update to the latest release. Options (environment):
#   PREFIX=/some/dir          install somewhere other than ~/.local
#   ICON_VARIANT=black|white  icon tile (default: white on dark desktops, black on light)
set -eu

REPO="styltsou/glade"
PREFIX="${PREFIX:-$HOME/.local}"
RAW="https://raw.githubusercontent.com/$REPO/main"

die() { echo "glade install: $*" >&2; exit 1; }

[ "$(uname -s)" = "Linux" ] || die "this script is for Linux. On Windows, download the installer from https://github.com/$REPO/releases/latest"
case "$(uname -m)" in
  x86_64 | amd64) ;;
  *) die "no prebuilt Glade for $(uname -m) yet; build from source: https://github.com/$REPO#build-from-source" ;;
esac
command -v curl >/dev/null 2>&1 || die "curl is required"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT INT TERM

echo "Looking up the latest Glade release..."
curl -fsSL -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/releases/latest" -o "$TMP/release.json" \
  || die "could not reach GitHub to find the latest release"
URL="$(grep -o '"browser_download_url": *"[^"]*\.AppImage"' "$TMP/release.json" | head -n 1 | sed 's/.*"\(https[^"]*\)"$/\1/')"
TAG="$(grep -o '"tag_name": *"[^"]*"' "$TMP/release.json" | head -n 1 | sed 's/.*"\([^"]*\)"$/\1/')"
[ -n "$URL" ] || die "the latest release has no AppImage"

echo "Downloading Glade $TAG..."
curl -fL --progress-bar "$URL" -o "$TMP/Glade.AppImage" || die "download failed"
chmod 755 "$TMP/Glade.AppImage"

APP_DIR="$PREFIX/lib/glade"
APP="$APP_DIR/Glade.AppImage"
mkdir -p "$APP_DIR" "$PREFIX/bin"
# Move into place in one step so a running Glade keeps its old file open.
cp "$TMP/Glade.AppImage" "$APP.new"
mv -f "$APP.new" "$APP"
ln -sf "$APP" "$PREFIX/bin/glade"

# Icon: black tile for light desktops, white tile for dark ones.
VARIANT="${ICON_VARIANT:-auto}"
if [ "$VARIANT" = "auto" ]; then
  if gsettings get org.gnome.desktop.interface color-scheme 2>/dev/null | grep -q dark; then
    VARIANT=white
  else
    VARIANT=black
  fi
fi
case "$VARIANT" in black | white) ;; *) die "ICON_VARIANT must be black or white" ;; esac

ICONS="$PREFIX/share/icons/hicolor"
for size in 32 128 256; do
  mkdir -p "$ICONS/${size}x${size}/apps"
  curl -fsSL "$RAW/assets/icon/$VARIANT/$size.png" -o "$ICONS/${size}x${size}/apps/glade.png" \
    || echo "warning: could not download the ${size}px icon" >&2
done
mkdir -p "$ICONS/scalable/apps"
curl -fsSL "$RAW/assets/icon/glade-$VARIANT.svg" -o "$ICONS/scalable/apps/glade.svg" \
  || echo "warning: could not download the scalable icon" >&2

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

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$PREFIX/share/applications" || true
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -f -t "$ICONS" 2>/dev/null || true

echo "Installed Glade $TAG to $PREFIX (launcher: Glade, command: glade). It updates itself from now on."

# AppImages need FUSE 2 to start.
if ! { ldconfig -p 2>/dev/null || /sbin/ldconfig -p 2>/dev/null; } | grep -q 'libfuse\.so\.2'; then
  echo
  echo "Note: Glade needs FUSE 2 (libfuse.so.2), which this system doesn't seem to have. Install it with:"
  echo "  Ubuntu 24.04+/Debian 13:  sudo apt install libfuse2t64"
  echo "  Ubuntu 22.04/Debian 12:   sudo apt install libfuse2"
  echo "  Fedora:                   sudo dnf install fuse-libs"
  echo "  Arch:                     sudo pacman -S fuse2"
fi

case ":$PATH:" in
  *":$PREFIX/bin:"*) ;;
  *) echo; echo "Add $PREFIX/bin to your PATH to run 'glade' from a terminal." ;;
esac
