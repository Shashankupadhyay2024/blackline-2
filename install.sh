#!/bin/bash
# BLACKLINE 2 installer for macOS (Apple Silicon or Intel).
#   curl -fsSL https://raw.githubusercontent.com/Shashankupadhyay2024/blackline-2/main/install.sh | bash
# Downloads the Electron runtime and the latest game release, builds "BLACKLINE 2.app"
# in /Applications (or ~/Applications), signs it locally and opens it.
set -euo pipefail
REPO="${BLACKLINE_REPO:-Shashankupadhyay2024/blackline-2}"
EV=44.5.0
ARCH=$([ "$(uname -m)" = arm64 ] && echo arm64 || echo x64)
APP="BLACKLINE 2.app"
[ "$(uname)" = Darwin ] || { echo "This installer is for macOS. On other systems, play in the browser: https://${REPO%%/*}.github.io/${REPO##*/}/"; exit 1; }
DEST=/Applications; [ -w "$DEST" ] || { DEST="$HOME/Applications"; mkdir -p "$DEST"; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT; cd "$T"

echo "▸ Downloading BLACKLINE 2 (about 55 MB)…"
curl -fL --progress-bar -o game.zip "https://github.com/$REPO/releases/latest/download/BLACKLINE2-game.zip"
echo "▸ Downloading the app runtime (about 110 MB)…"
curl -fL --progress-bar -o electron.zip "https://github.com/electron/electron/releases/download/v$EV/electron-v$EV-darwin-$ARCH.zip"

echo "▸ Building the app…"
mkdir game && (cd game && unzip -q ../game.zip)
ditto -xk electron.zip . && mv Electron.app "$APP"
R="$APP/Contents/Resources"; rm -f "$R/default_app.asar"
cp -R game/app "$R/app"; cp game/icon.icns "$R/electron.icns"
P="$APP/Contents/Info.plist"
plutil -replace CFBundleName -string "BLACKLINE 2" "$P"
plutil -replace CFBundleDisplayName -string "BLACKLINE 2" "$P"
plutil -replace CFBundleIdentifier -string com.blackline.two "$P"
plutil -replace CFBundleShortVersionString -string 2.0.0 "$P"
plutil -replace CFBundleVersion -string 2.0.0 "$P"
plutil -remove ElectronAsarIntegrity "$P" 2>/dev/null || true
xattr -cr "$APP"
codesign --force --deep --sign - "$APP" 2>/dev/null

echo "▸ Installing to $DEST…"
rm -rf "$DEST/$APP" && mv "$APP" "$DEST/"
touch "$DEST/$APP"
echo "✓ Installed $DEST/$APP"
open "$DEST/$APP"
