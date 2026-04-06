#!/usr/bin/env bash
set -euo pipefail

UUID="vpn-badge@pabloalgo.dev"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

# Install extension as symlinks for development
mkdir -p "$DEST"
ln -sf "$(pwd)/extension.js" "$DEST/"
ln -sf "$(pwd)/metadata.json" "$DEST/"
ln -sf "$(pwd)/stylesheet.css" "$DEST/"
echo "Installed $UUID (symlinks)"
echo "Logout and login to activate (Wayland requires re-login)"
