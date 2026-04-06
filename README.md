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

## Development workflow

Source of truth:

- repo: `/home/pablo/dev/projects/gnome/vpn/`
- GNOME Shell dev install: `/home/pablo/.local/share/gnome-shell/extensions/vpn-badge@pabloalgo.dev/`

Install the development symlinks:

```bash
make dev
```

This links the extension files from the repo into GNOME Shell's extensions folder.

After changes, reload the extension:

```bash
gnome-extensions disable vpn-badge@pabloalgo.dev
gnome-extensions enable vpn-badge@pabloalgo.dev
```

On Wayland, a logout/login may still be needed if GNOME Shell caches stale code.

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

## License

MIT
