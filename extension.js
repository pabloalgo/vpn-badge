import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import St from "gi://St";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

const CLI = "/usr/local/bin/adguardvpn-cli";
const POLL_INTERVAL = 15; // seconds

// Strip ANSI escape codes from CLI output
function stripAnsi(str) {
	return str.replace(/\x1b\[[0-9;]*m/g, "");
}

const VPNIndicator = GObject.registerClass(
	class VPNIndicator extends PanelMenu.Button {
		_init() {
			super._init(0.0, "VPN Badge", false);

			this._icon = new St.Icon({
				icon_name: "network-vpn-symbolic",
				style_class: "system-status-icon",
				style: "color: #9e9e9e;",
			});
			this.add_child(this._icon);

			this._connected = false;
			this._location = "";

			// ── Menu items ──
			this._statusItem = new PopupMenu.PopupMenuItem("Checking...", {
				reactive: false,
			});
			this.menu.addMenuItem(this._statusItem);
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

			this._connectFastest = new PopupMenu.PopupMenuItem("⚡ Fastest");
			this._connectFastest.connect("activate", () =>
				this._runAsync(["connect", "--fastest", "-y"]),
			);
			this.menu.addMenuItem(this._connectFastest);

			this._disconnectItem = new PopupMenu.PopupMenuItem("✋ Disconnect");
			this._disconnectItem.connect("activate", () =>
				this._runAsync(["disconnect", "-y"]),
			);
			this._disconnectItem.visible = false;
			this.menu.addMenuItem(this._disconnectItem);

			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

			this._locationsSubmenu = new PopupMenu.PopupSubMenuMenuItem(
				"📍 Locations",
			);
			this.menu.addMenuItem(this._locationsSubmenu);

			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

			const refreshItem = new PopupMenu.PopupMenuItem("🔄 Refresh");
			refreshItem.connect("activate", () => {
				this._fetchStatus();
				this._fetchLocations();
			});
			this.menu.addMenuItem(refreshItem);

			// ── Initial load ──
			this._fetchStatus();
			this._fetchLocations();

			// ── Polling ──
			this._pollId = GLib.timeout_add_seconds(
				GLib.PRIORITY_DEFAULT,
				POLL_INTERVAL,
				() => {
					this._fetchStatus();
					return GLib.SOURCE_CONTINUE;
				},
			);
		}

		// ── Async CLI execution (non-blocking) ──
		_runAsync(argv) {
			try {
				const proc = Gio.Subprocess.new(
					[CLI, ...argv],
					Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
				);
				proc.communicate_utf8_async(null, null, (p, res) => {
					try {
						p.communicate_utf8_finish(res);
					} catch (e) {
						log(`VPN Badge: ${e.message}`);
					}
					GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
						this._fetchStatus();
						return GLib.SOURCE_REMOVE;
					});
				});
			} catch (e) {
				log(`VPN Badge spawn error: ${e.message}`);
			}
		}

		_execAsync(args, callback) {
			try {
				const proc = Gio.Subprocess.new(
					[CLI, ...args],
					Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
				);
				proc.communicate_utf8_async(null, null, (p, res) => {
					let output = "";
					try {
						const [stdout] = p.communicate_utf8_finish(res);
						if (stdout) output = stripAnsi(stdout.trim());
					} catch (e) {
						log(`VPN Badge: ${e.message}`);
					}
					callback(output);
				});
			} catch (e) {
				log(`VPN Badge exec error: ${e.message}`);
				callback("");
			}
		}

		// ── Parse status ──
		_parseStatus(output) {
			if (!output) return;

			if (output.toLowerCase().includes("connected to")) {
				this._connected = true;
				const match = output.match(/connected to\s+(\S+)/i);
				if (match) this._location = match[1].trim();
				this._statusItem.label.set_text(`🟢 ${this._location || "Connected"}`);
				this._icon.style = "color: #4caf50;";
				this._connectFastest.visible = false;
				this._disconnectItem.visible = true;
			} else {
				this._connected = false;
				this._location = "";
				this._statusItem.label.set_text("🔴 VPN Off");
				this._icon.style = "color: #9e9e9e;";
				this._connectFastest.visible = true;
				this._disconnectItem.visible = false;
			}
		}

		_fetchStatus() {
			this._execAsync(["status"], (out) => this._parseStatus(out));
		}

		// ── Parse locations ──
		_parseLocations(output) {
			this._locationsSubmenu.menu.removeAll();
			if (!output) return;

			const lines = output.split("\n");
			for (const raw of lines) {
				const line = stripAnsi(raw);
				// ISO  COUNTRY  CITY  PING
				const match = line.match(
					/^(\w{2})\s+(\S[\w\s]+?)\s{2,}(\S[\w\s]+?)\s{2,}(\d+)/,
				);
				if (match) {
					const [, iso, country, city, ping] = match;
					const label = `${city.trim()}, ${country.trim()} (${ping}ms)`;
					const item = new PopupMenu.PopupMenuItem(label);
					item.connect("activate", () =>
						this._runAsync(["connect", "-l", city.trim(), "-y"]),
					);
					this._locationsSubmenu.menu.addMenuItem(item);
				}
			}
		}

		_fetchLocations() {
			this._execAsync(["list-locations"], (out) => this._parseLocations(out));
		}

		// ── Cleanup ──
		destroy() {
			if (this._pollId) {
				GLib.source_remove(this._pollId);
				this._pollId = null;
			}
			super.destroy();
		}
	},
);

export default class VPNBadgeExtension extends Extension {
	enable() {
		this._indicator = new VPNIndicator();
		Main.panel.addToStatusArea(this.uuid, this._indicator);
	}

	disable() {
		this._indicator?.destroy();
		this._indicator = null;
	}
}
