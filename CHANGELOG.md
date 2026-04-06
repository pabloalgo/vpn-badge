# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Quick Settings toggle in GNOME Shell
- Preferences window for CLI path, polling interval, notifications, and duration display
- Desktop notifications for VPN state changes
- Connection duration display in the status label
- GSettings schema and install targets

## [0.2.0] - 2026-04-06

### Added
- Top bar VPN status icon (green connected, grey disconnected)
- Connect to fastest location
- Disconnect
- Browse and connect to specific cities (locations submenu)
- Auto-refresh status every 15 seconds
- Manual refresh button
- Async CLI calls via `Gio.Subprocess` (non-blocking, no UI freeze)
- Symlink-based install for development
- MIT License

[Unreleased]: https://github.com/pabloalgo/vpn-badge/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/pabloalgo/vpn-badge/releases/tag/v0.2.0
