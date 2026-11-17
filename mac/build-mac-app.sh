#!/bin/bash
# Build "BLACKLINE 2.app" from the stock Electron runtime + the game in docs/.
# Run on a Mac from the repo folder:   bash mac/build-mac-app.sh
# Output: mac/out/BLACKLINE 2.app and mac/out/BLACKLINE2-game.zip (the release asset install.sh uses)
set -euo pipefail
cd "$(dirname "$0")"
EV=44.5.0; ARCH=$([ "$(uname -m)" = arm64 ] && echo arm64 || echo x64)
mkdir -p out && cd out
rm -rf game && mkdir -p game/app && cp ../main.js ../package.json game/app/ && cp -R ../../docs/index.html ../../docs/assets game/app/ && cp ../icon.icns game/
rm -f BLACKLINE2-game.zip && (cd game && zip -qr ../BLACKLINE2-game.zip .)
[ -f electron-$ARCH.zip ] || curl -L --fail -o electron-$ARCH.zip "https://github.com/electron/electron/releases/download/v$EV/electron-v$EV-darwin-$ARCH.zip"
A="BLACKLINE 2.app"; rm -rf Electron.app "$A" && ditto -xk electron-$ARCH.zip . && mv Electron.app "$A"
R="$A/Contents/Resources"; rm -f "$R/default_app.asar"; cp -R game/app "$R/app"; cp game/icon.icns "$R/electron.icns"
P="$A/Contents/Info.plist"
plutil -replace CFBundleName -string "BLACKLINE 2" "$P"; plutil -replace CFBundleDisplayName -string "BLACKLINE 2" "$P"
plutil -replace CFBundleIdentifier -string com.blackline.two "$P"
plutil -replace CFBundleShortVersionString -string 2.0.0 "$P"; plutil -replace CFBundleVersion -string 2.0.0 "$P"
plutil -remove ElectronAsarIntegrity "$P" 2>/dev/null || true
codesign --force --deep --sign - "$A"
echo "Built $(pwd)/$A and BLACKLINE2-game.zip"
