import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import St from "gi://St";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import {
	QuickMenuToggle,
	SystemIndicator,
} from "resource:///org/gnome/shell/ui/quickSettings.js";

const DEFAULT_CLI_PATH = "/usr/local/bin/adguardvpn-cli";
const DEFAULT_POLL_INTERVAL = 15;
const EXTENSION_NAME = "VPN Badge";

function stripAnsi(text) {
	return text.replace(/\x1b\[[0-9;]*m/g, "");
}

function formatDuration(ms) {
	if (!ms || ms < 0) {
		return "";
	}

	const totalMinutes = Math.floor(ms / 60000);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}

	return `${minutes}m`;
}

class VPNController {
	constructor(settings) {
		this._settings = settings;
		this._observers = new Set();
		this._pollId = 0;
		this._initialSync = true;
		this.state = {
			connected: false,
			location: "",
			connectedSince: 0,
			statusLabel: "Checking…",
			locations: [],
			loggedIn: true,
			freeAccount: false,
			accountLabel: "Checking account…",
			error: "",
		};

		this._settings.connect("changed::poll-interval", () =>
			this.restartPolling(),
		);
		this._settings.connect("changed::cli-path", () => this.refreshAll());
		this._settings.connect("changed::show-duration", () =>
			this.refreshStatus(),
		);
		this._settings.connect("changed::favorite-1", () => this._emit());
		this._settings.connect("changed::favorite-2", () => this._emit());
		this._settings.connect("changed::favorite-3", () => this._emit());
	}

	get cliPath() {
		const path = this._settings.get_string("cli-path").trim();
		return path || DEFAULT_CLI_PATH;
	}

	get pollInterval() {
		const interval = this._settings.get_uint("poll-interval");
		return Math.max(5, interval || DEFAULT_POLL_INTERVAL);
	}

	get showDuration() {
		return this._settings.get_boolean("show-duration");
	}

	get notificationsEnabled() {
		return this._settings.get_boolean("notifications");
	}

	get loggedIn() {
		return this.state.loggedIn;
	}

	get freeAccount() {
		return this.state.freeAccount;
	}

	addObserver(callback, immediate = true) {
		this._observers.add(callback);
		if (immediate) {
			callback(this._snapshot());
		}
		return () => this._observers.delete(callback);
	}

	_snapshot() {
		return {
			...this.state,
			locations: this.state.locations.map((item) => ({ ...item })),
		};
	}

	_emit() {
		const snapshot = this._snapshot();
		for (const callback of this._observers) {
			callback(snapshot);
		}
	}

	_notify(title, message) {
		if (!message) {
			return;
		}

		try {
			Main.notify(title, message);
		} catch (error) {
			log(`${EXTENSION_NAME}: notify failed: ${error.message}`);
		}
	}

	async _exec(argv) {
		return new Promise((resolve) => {
			try {
				const proc = Gio.Subprocess.new(
					[this.cliPath, ...argv],
					Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
				);

				proc.communicate_utf8_async(null, null, (process, result) => {
					let stdout = "";
					let stderr = "";
					let ok = false;

					try {
						const response = process.communicate_utf8_finish(result);
						ok = response[0];
						stdout = response[1] ?? "";
						stderr = response[2] ?? "";
					} catch (error) {
						stderr = error.message;
					}

					resolve({
						ok,
						stdout: stripAnsi(stdout).trim(),
						stderr: stripAnsi(stderr).trim(),
					});
				});
			} catch (error) {
				resolve({ ok: false, stdout: "", stderr: error.message });
			}
		});
	}

	_parseStatus(output) {
		const previous = {
			connected: this.state.connected,
			location: this.state.location,
			loggedIn: this.state.loggedIn,
			freeAccount: this.state.freeAccount,
		};

		if (!output) {
			this.state.error = "No status output";
			return previous;
		}

		const text = output
			.split("\n")
			.map((line) => stripAnsi(line).trim())
			.filter(Boolean)
			.join("\n");
		const firstLine = text.split("\n")[0] ?? "";

		if (/not logged in/i.test(text)) {
			this.state.loggedIn = false;
			this.state.connected = false;
			this.state.location = "";
			this.state.connectedSince = 0;
			this.state.accountLabel = "🔒 Not logged in";
			this.state.freeAccount = false;
			this.state.error = "";
		} else {
			if (this.state.loggedIn) {
				this.state.freeAccount = /free version/i.test(text)
					? true
					: this.state.freeAccount;
			}

			if (/^Connected to\s+/i.test(firstLine)) {
				const match = firstLine.match(/^Connected to\s+(.+?)\s+in\s+/i);
				this.state.connected = true;
				this.state.location =
					match?.[1]?.trim() ??
					firstLine
						.replace(/^Connected to\s+/i, "")
						.replace(/\s+in\s+.*$/, "")
						.trim();
				this.state.error = "";
				if (!previous.connected) {
					this.state.connectedSince = Date.now();
				}
			} else {
				this.state.connected = false;
				this.state.location = "";
				this.state.connectedSince = 0;
				this.state.error = "";
			}

			if (
				!this.state.accountLabel ||
				/^🔒 Not logged in/.test(this.state.accountLabel)
			) {
				this.state.accountLabel = this.state.freeAccount
					? "⚠ Free plan"
					: "✅ Logged in";
			}
		}

		const duration =
			this.showDuration && this.state.connected && this.state.connectedSince
				? formatDuration(Date.now() - this.state.connectedSince)
				: "";

		if (this.state.connected) {
			this.state.statusLabel = duration
				? `🟢 ${this.state.location} — ${duration}`
				: `🟢 ${this.state.location}`;
		} else if (!this.state.loggedIn) {
			this.state.statusLabel = "🔒 Not logged in";
		} else {
			this.state.statusLabel = "🔴 VPN Off";
		}

		return previous;
	}

	_parseLocations(output) {
		const lines = output
			.split("\n")
			.map((line) => stripAnsi(line).trim())
			.filter((line) => line && /^[A-Z]{2}\s+/.test(line));

		const items = [];
		const seen = new Set();
		for (const line of lines) {
			const match = line.match(/^([A-Z]{2})\s+(.+?)\s{2,}(.+?)\s{2,}(\d+)$/);
			if (!match) {
				continue;
			}

			const [, iso, country, city, ping] = match;
			const normalizedCity = city.trim();
			const normalizedCountry = country.trim();
			const key = `${normalizedCountry}|${normalizedCity}`;
			if (seen.has(key)) {
				continue;
			}
			seen.add(key);
			items.push({
				iso,
				country: normalizedCountry,
				city: normalizedCity,
				ping: Number.parseInt(ping, 10),
			});
		}

		items.sort((a, b) => a.ping - b.ping);
		this.state.locations = items;
	}

	async refreshStatus({ notify = false } = {}) {
		const { stdout, stderr } = await this._exec(["status"]);
		const previous = this._parseStatus(stdout || stderr);
		this._emit();

		if (notify && this.notificationsEnabled) {
			if (!previous.connected && this.state.connected) {
				this._notify(EXTENSION_NAME, `Connected to ${this.state.location}`);
			} else if (previous.connected && !this.state.connected) {
				this._notify(EXTENSION_NAME, "VPN disconnected");
			} else if (
				previous.connected &&
				this.state.connected &&
				previous.location !== this.state.location
			) {
				this._notify(EXTENSION_NAME, `Switched to ${this.state.location}`);
			}
		}

		return this.state;
	}

	async refreshLocations() {
		const { stdout, stderr } = await this._exec(["list-locations"]);
		this._parseLocations(stdout || stderr);
		this._emit();
		return this.state.locations;
	}

	async refreshAccount({ notify = false } = {}) {
		const { stdout, stderr } = await this._exec(["license"]);
		const previous = {
			loggedIn: this.state.loggedIn,
			freeAccount: this.state.freeAccount,
		};
		const text = (stdout || stderr || "")
			.split("\n")
			.map((line) => stripAnsi(line).trim())
			.filter(Boolean)
			.join("\n");

		if (!text) {
			this.state.error = "No license output";
			this._emit();
			return previous;
		}

		if (/not logged in/i.test(text)) {
			this.state.loggedIn = false;
			this.state.freeAccount = false;
			this.state.accountLabel = "🔒 Not logged in";
			this.state.error = "";
		} else {
			this.state.loggedIn = true;
			this.state.freeAccount = /free version/i.test(text);

			const accountMatch = text.match(/^Logged in as\s+(.+)$/im);
			const account = accountMatch?.[1]?.trim();
			this.state.accountLabel = this.state.freeAccount
				? account
					? `⚠ Free plan — ${account}`
					: "⚠ Free plan"
				: account
					? `✅ Logged in as ${account}`
					: "✅ Logged in";
			this.state.error = "";
		}

		this._emit();

		if (notify && this.notificationsEnabled) {
			if (!previous.loggedIn && this.state.loggedIn) {
				this._notify(
					EXTENSION_NAME,
					this.state.freeAccount
						? "Signed in to a free AdGuard VPN account"
						: "Signed in to AdGuard VPN",
				);
			} else if (previous.loggedIn && !this.state.loggedIn) {
				this._notify(EXTENSION_NAME, "Signed out of AdGuard VPN");
			} else if (!previous.freeAccount && this.state.freeAccount) {
				this._notify(
					EXTENSION_NAME,
					"Free AdGuard VPN plan detected: fewer locations available",
				);
			}
		}

		return this.state;
	}

	async refreshAll({ notify = false } = {}) {
		await this.refreshAccount({ notify });
		await this.refreshStatus({ notify });
		await this.refreshLocations();
		return this.state;
	}

	async connectFastest() {
		const { stderr } = await this._exec(["connect", "--fastest", "-y"]);
		if (stderr) {
			this.state.error = stderr;
			this._emit();
		}
		await this.refreshStatus({ notify: true });
	}

	async login() {
		const { stderr } = await this._exec(["login"]);
		if (stderr) {
			this.state.error = stderr;
			this._emit();
		}
		await this.refreshAll({ notify: true });
	}

	async logout() {
		const { stderr } = await this._exec(["logout"]);
		if (stderr) {
			this.state.error = stderr;
			this._emit();
		}
		await this.refreshAll({ notify: true });
	}

	async reconnectLast() {
		const { stderr } = await this._exec(["connect"]);
		if (stderr) {
			this.state.error = stderr;
			this._emit();
		}
		await this.refreshStatus({ notify: true });
	}

	async disconnect() {
		const { stderr } = await this._exec(["disconnect"]);
		if (stderr) {
			this.state.error = stderr;
			this._emit();
		}
		await this.refreshStatus({ notify: true });
	}

	async connectLocation(city) {
		const { stderr } = await this._exec(["connect", "-l", city, "-y"]);
		if (stderr) {
			this.state.error = stderr;
			this._emit();
		}
		await this.refreshStatus({ notify: true });
	}

	get favoriteLocations() {
		return ["favorite-1", "favorite-2", "favorite-3"]
			.map((key) => this._settings.get_string(key).trim())
			.filter(Boolean);
	}

	async toggle() {
		if (!this.state.loggedIn) {
			await this.login();
			return;
		}

		if (this.state.connected) {
			await this.disconnect();
			return;
		}

		await this.connectFastest();
	}

	startPolling() {
		this.stopPolling();
		this._pollId = GLib.timeout_add_seconds(
			GLib.PRIORITY_DEFAULT,
			this.pollInterval,
			() => {
				this.refreshAll();
				return GLib.SOURCE_CONTINUE;
			},
		);
	}

	stopPolling() {
		if (this._pollId) {
			GLib.source_remove(this._pollId);
			this._pollId = 0;
		}
	}

	restartPolling() {
		this.startPolling();
	}

	destroy() {
		this.stopPolling();
		this._observers.clear();
	}
}

const VPNIndicator = GObject.registerClass(
	class VPNIndicator extends PanelMenu.Button {
		_init(service, extension) {
			super._init(0.0, EXTENSION_NAME, false);
			this._service = service;
			this._extension = extension;

			this._icon = new St.Icon({
				icon_name: "network-vpn-symbolic",
				style_class: "system-status-icon",
				style: "color: #9e9e9e;",
			});
			this.add_child(this._icon);

			this._statusItem = new PopupMenu.PopupMenuItem("Checking…", {
				reactive: false,
			});
			this.menu.addMenuItem(this._statusItem);

			this._accountItem = new PopupMenu.PopupMenuItem("Checking account…", {
				reactive: false,
			});
			this.menu.addMenuItem(this._accountItem);
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

			this._loginItem = new PopupMenu.PopupMenuItem("🔑 Log in");
			this._loginItem.connect("activate", () => this._service.login());
			this.menu.addMenuItem(this._loginItem);

			this._logoutItem = new PopupMenu.PopupMenuItem("🚪 Log out");
			this._logoutItem.connect("activate", () => this._service.logout());
			this.menu.addMenuItem(this._logoutItem);

			this._connectFastest = new PopupMenu.PopupMenuItem("⚡ Connect Fastest");
			this._connectFastest.connect("activate", () =>
				this._service.connectFastest(),
			);
			this.menu.addMenuItem(this._connectFastest);

			this._reconnectLast = new PopupMenu.PopupMenuItem("↩ Reconnect Last");
			this._reconnectLast.connect("activate", () =>
				this._service.reconnectLast(),
			);
			this.menu.addMenuItem(this._reconnectLast);

			this._favoritesSubmenu = new PopupMenu.PopupSubMenuMenuItem(
				"⭐ Favorites",
			);
			this.menu.addMenuItem(this._favoritesSubmenu);

			this._disconnectItem = new PopupMenu.PopupMenuItem("✋ Disconnect");
			this._disconnectItem.connect("activate", () =>
				this._service.disconnect(),
			);
			this._disconnectItem.visible = false;
			this.menu.addMenuItem(this._disconnectItem);

			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

			this._locationsSubmenu = new PopupMenu.PopupSubMenuMenuItem(
				"📍 Locations",
			);
			this.menu.addMenuItem(this._locationsSubmenu);

			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

			this._refreshItem = new PopupMenu.PopupMenuItem("🔄 Refresh");
			this._refreshItem.connect("activate", () => this._service.refreshAll());
			this.menu.addMenuItem(this._refreshItem);

			this._preferencesItem = new PopupMenu.PopupMenuItem("⚙ Preferences");
			this._preferencesItem.connect("activate", () =>
				this._extension.openPreferences(),
			);
			this.menu.addMenuItem(this._preferencesItem);

			this._disconnectObserver = this._service.addObserver(
				(state) => this._sync(state),
				false,
			);
			this._sync(this._service._snapshot());
		}

		_sync(state) {
			this._statusItem.label.set_text(state.statusLabel || "Checking…");
			this._accountItem.label.set_text(
				state.accountLabel || "Checking account…",
			);
			this._icon.style = state.connected
				? "color: #4caf50;"
				: state.loggedIn
					? "color: #9e9e9e;"
					: "color: #d97706;";
			this._loginItem.visible = !state.loggedIn;
			this._logoutItem.visible = state.loggedIn;
			this._connectFastest.visible = state.loggedIn && !state.connected;
			this._reconnectLast.visible = state.loggedIn && !state.connected;
			this._favoritesSubmenu.visible = state.loggedIn;
			this._disconnectItem.visible = state.loggedIn && state.connected;
			this._locationsSubmenu.visible = state.loggedIn;
			this._buildFavorites();
			this._buildLocations(state.locations);
		}

		_buildFavorites() {
			this._favoritesSubmenu.menu.removeAll();

			const favorites = this._service.favoriteLocations;
			if (!favorites.length) {
				const empty = new PopupMenu.PopupMenuItem("No favorites set", {
					reactive: false,
				});
				this._favoritesSubmenu.menu.addMenuItem(empty);
				return;
			}

			for (const favorite of favorites) {
				const item = new PopupMenu.PopupMenuItem(favorite);
				item.connect("activate", () => this._service.connectLocation(favorite));
				this._favoritesSubmenu.menu.addMenuItem(item);
			}
		}

		_buildLocations(locations) {
			this._locationsSubmenu.menu.removeAll();

			if (!locations.length) {
				const empty = new PopupMenu.PopupMenuItem("No locations available", {
					reactive: false,
				});
				this._locationsSubmenu.menu.addMenuItem(empty);
				return;
			}

			for (const location of locations) {
				const label = `${location.city}, ${location.country} (${location.ping}ms)`;
				const item = new PopupMenu.PopupMenuItem(label);
				item.connect("activate", () =>
					this._service.connectLocation(location.city),
				);
				this._locationsSubmenu.menu.addMenuItem(item);
			}
		}

		destroy() {
			this._disconnectObserver?.();
			this._disconnectObserver = null;
			super.destroy();
		}
	},
);

const VPNQuickToggle = GObject.registerClass(
	class VPNQuickToggle extends QuickMenuToggle {
		_init(service, extension) {
			super._init({
				title: EXTENSION_NAME,
				subtitle: "Checking…",
				iconName: "network-vpn-symbolic",
				toggleMode: false,
			});

			this._service = service;
			this._extension = extension;

			this.menu.setHeader(
				Gio.ThemedIcon.new("network-vpn-symbolic"),
				EXTENSION_NAME,
				null,
			);
			this.connect("clicked", () => this._service.toggle());

			this._loginItem = this.menu.addAction("Log in", () =>
				this._service.login(),
			);
			this._loginItem.visible = false;

			this._logoutItem = this.menu.addAction("Log out", () =>
				this._service.logout(),
			);
			this._logoutItem.visible = false;

			this._reconnectLastItem = this.menu.addAction("Reconnect Last", () =>
				this._service.reconnectLast(),
			);
			this._reconnectLastItem.visible = true;

			const refreshItem = this.menu.addAction("Refresh", () =>
				this._service.refreshAll(),
			);
			refreshItem.visible = true;

			const preferencesItem = this.menu.addAction("Preferences", () =>
				this._extension.openPreferences(),
			);
			preferencesItem.visible = true;

			this._disconnectObserver = this._service.addObserver(
				(state) => this._sync(state),
				false,
			);
			this._sync(this._service._snapshot());
		}

		_sync(state) {
			this.checked = state.connected;
			this.subtitle =
				state.freeAccount && state.loggedIn
					? `${state.statusLabel || "Checking…"} • Free plan`
					: state.statusLabel || "Checking…";
			this.title = EXTENSION_NAME;
			this._loginItem.visible = !state.loggedIn;
			this._logoutItem.visible = state.loggedIn;
			this._reconnectLastItem.visible = state.loggedIn && !state.connected;
		}

		destroy() {
			this._disconnectObserver?.();
			this._disconnectObserver = null;
			super.destroy();
		}
	},
);

const VPNQuickSettings = GObject.registerClass(
	class VPNQuickSettings extends SystemIndicator {
		_init(service, extension) {
			super._init();
			this._service = service;
			this._extension = extension;

			this._indicator = this._addIndicator();
			this._indicator.gicon = Gio.ThemedIcon.new("network-vpn-symbolic");
			this.quickSettingsItems.push(
				new VPNQuickToggle(this._service, this._extension),
			);

			// Add to Quick Settings panel if available
			const quickSettingsPanel = Main.panel.statusArea.quickSettings;
			if (typeof quickSettingsPanel?.addExternalIndicator === "function") {
				quickSettingsPanel.addExternalIndicator(this, 2);
			}
		}

		destroy() {
			super.destroy();
		}
	},
);

export default class VPNBadgeExtension extends Extension {
	enable() {
		this._settings = this.getSettings();
		this._service = new VPNController(this._settings);
		this._indicator = new VPNIndicator(this._service, this);
		this._quickSettings = new VPNQuickSettings(this._service, this);

		Main.panel.addToStatusArea(this.uuid, this._indicator);
		this._service.startPolling();
		this._service.refreshAll();
	}

	disable() {
		this._service?.destroy();
		this._service = null;

		this._quickSettings?.destroy();
		this._quickSettings = null;

		this._indicator?.destroy();
		this._indicator = null;

		this._settings = null;
	}
}
