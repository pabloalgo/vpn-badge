# vpn-badge

GNOME Shell extension for AdGuard VPN.

It adds:
- a top-bar status indicator
- a Quick Settings toggle
- connection status and location list
- preferences for CLI path, polling interval, notifications, and duration display

## Features

- Top bar icon: green when connected, grey when disconnected
- Quick Settings toggle for connect/disconnect
- Fastest-location connect
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

## License

MIT
