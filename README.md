# vpn-badge

> GNOME Shell extension — AdGuard VPN status in the top bar

Connect, disconnect, and browse locations from the panel menu.
No external GUI needed. Wraps [`adguardvpn-cli`](https://github.com/AdguardTeam/AdGuardVPNCLI).

## Features

- 🟢/🔴 VPN status icon in top bar
- ⚡ Connect to fastest location
- 📍 Browse and connect to specific cities
- ✋ One-click disconnect
- 🔄 Auto-refresh every 15 seconds
- Non-blocking (async CLI calls — no UI freezes)

## Install

```bash
git clone https://github.com/pabloalgo/vpn-badge.git
cd vpn-badge
make install
```

Or manually:

```bash
cp -r . ~/.local/share/gnome-shell/extensions/vpn-badge@pabloalgo.dev/
gnome-extensions enable vpn-badge@pabloalgo.dev
```

Then **logout and login** (Wayland requires re-login).

## Uninstall

```bash
gnome-extensions disable vpn-badge@pabloalgo.dev
rm -rf ~/.local/share/gnome-shell/extensions/vpn-badge@pabloalgo.dev
```

## Requirements

- [AdGuard VPN CLI](https://github.com/AdguardTeam/AdGuardVPNCLI) at `/usr/local/bin/adguardvpn-cli`
- GNOME Shell 48+

## License

MIT
