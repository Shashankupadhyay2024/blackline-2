#!/bin/bash
# One-time publish to GitHub (run on your Mac from this folder):   bash publish.sh
# Creates github.com/<you>/blackline-2, pushes the code, turns on GitHub Pages (browser version),
# and uploads the game as a release so the one-line installer works.
# Run it again any time to push updates and refresh the release.
set -euo pipefail
cd "$(dirname "$0")"
REPO=blackline-2; TAG=v2.0.0
command -v git >/dev/null || { echo "Install Apple's developer tools first:  xcode-select --install"; exit 1; }
command -v gh  >/dev/null || { echo "Install the GitHub CLI first:  brew install gh   (no Homebrew? get the installer at https://cli.github.com)"; exit 1; }
gh auth status >/dev/null 2>&1 || gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
U=$(gh api user -q .login); ID=$(gh api user -q .id)
echo "Publishing as $U"
perl -pi -e "s/Shashankupadhyay2024/$U/g" README.md install.sh

# release asset: the game files the installer drops into the Electron runtime
rm -rf .rel && mkdir -p .rel/app && cp mac/main.js mac/package.json .rel/app/ && cp -R docs/index.html docs/assets .rel/app/ && cp mac/icon.icns .rel/
rm -f BLACKLINE2-game.zip && (cd .rel && zip -qr -9 ../BLACKLINE2-game.zip .) && rm -rf .rel

[ -d .git ] || git init -q -b main
git config user.name  >/dev/null || git config user.name "$U"
git config user.email >/dev/null || git config user.email "$ID+$U@users.noreply.github.com"
grep -qx 'BLACKLINE2-game.zip' .gitignore || echo 'BLACKLINE2-game.zip' >> .gitignore
git add -A
git diff --cached --quiet || git commit -q -m "BLACKLINE 2: campaign, battle royale, multiplayer, zombies, horror"
gh repo view "$U/$REPO" >/dev/null 2>&1 || gh repo create "$REPO" --public \
  --description "BLACKLINE 2: a first-person shooter with a story campaign, battle royale, online multiplayer, zombies and horror. Built with Three.js." \
  --homepage "https://$U.github.io/$REPO/"
git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$U/$REPO.git"
git push -u origin main
gh api -X POST "repos/$U/$REPO/pages" -f "source[branch]=main" -f "source[path]=/docs" >/dev/null 2>&1 || true
gh api -X PUT "repos/$U/$REPO/topics" -f "names[]=game" -f "names[]=fps" -f "names[]=threejs" -f "names[]=webgl" -f "names[]=multiplayer" -f "names[]=electron" -f "names[]=ai-assisted" >/dev/null || true
if gh release view "$TAG" --repo "$U/$REPO" >/dev/null 2>&1; then
  gh release upload "$TAG" BLACKLINE2-game.zip --repo "$U/$REPO" --clobber
else
  gh release create "$TAG" BLACKLINE2-game.zip --repo "$U/$REPO" --title "BLACKLINE 2" --latest \
    --notes "Install on a Mac with one command:
\`\`\`
curl -fsSL https://raw.githubusercontent.com/$U/$REPO/main/install.sh | bash
\`\`\`
Or play in your browser: https://$U.github.io/$REPO/"
fi
echo
echo "Repo:     https://github.com/$U/$REPO"
echo "Browser:  https://$U.github.io/$REPO/   (GitHub Pages takes 1-2 minutes the first time)"
echo "Install:  curl -fsSL https://raw.githubusercontent.com/$U/$REPO/main/install.sh | bash"
echo "Online:   https://render.com/deploy?repo=https://github.com/$U/$REPO"
