# vpn-badge

GNOME Shell extension for AdGuard VPN.

It adds:
- a top-bar status indicator
- a Quick Settings toggle
- connection status and location list
- login/logout actions
- reconnect last
- up to 3 favorites
- free-plan warning when the account is on the free tier
- preferences for CLI path, polling interval, notifications, duration display, and favorites

## Features

- Top bar icon: green when connected, grey when disconnected
- Quick Settings toggle for connect/disconnect and login when needed
- Fastest-location connect
- Login / logout actions
- Reconnect last used location
- Up to 3 favorites in a submenu
- Free-plan warning in the menu and status updates
- Location list with ping sorting
- Desktop notifications on state changes
- Auto-refresh every 15 seconds by default
- Non-blocking CLI calls
- Preferences window for basic configuration

## Requirements

- AdGuard VPN CLI installed at `/usr/local/bin/adguardvpn-cli`
- GNOME Shell 48+

## Development install

```bash
make dev
```

Then disable/enable the extension and log out/in on Wayland:

```bash
gnome-extensions disable vpn-badge@pabloalgo.dev
gnome-extensions enable vpn-badge@pabloalgo.dev
```

## Install

```bash
make install
```

## Uninstall

```bash
make uninstall
```

## Files

- `extension.js` — extension logic
- `prefs.js` — preferences window
- `schemas/org.gnome.shell.extensions.vpn-badge.gschema.xml` — GSettings schema
- `CHANGELOG.md` — Keep a Changelog format
- 3 favorite locations configurable in preferences

## License

MIT
