import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";

import {
	gettext as _,
	ExtensionPreferences,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class VPNBadgePreferences extends ExtensionPreferences {
	fillPreferencesWindow(window) {
		this._settings = this.getSettings();

		const page = new Adw.PreferencesPage({
			title: _("VPN Badge"),
			icon_name: "network-vpn-symbolic",
		});
		window.add(page);

		const general = new Adw.PreferencesGroup({
			title: _("General"),
		});
		page.add(general);

		general.add(this._cliPathRow());
		general.add(this._pollIntervalRow());
		general.add(this._notificationsRow());
		general.add(this._durationRow());

		const favorites = new Adw.PreferencesGroup({
			title: _("Favorites"),
			description: _(
				"Up to three quick-connect locations shown in the VPN menu.",
			),
		});
		page.add(favorites);
		favorites.add(this._favoriteRow("favorite-1", _("Favorite 1")));
		favorites.add(this._favoriteRow("favorite-2", _("Favorite 2")));
		favorites.add(this._favoriteRow("favorite-3", _("Favorite 3")));

		window.connect("close-request", () => {
			this._settings = null;
		});
	}

	_cliPathRow() {
		const row = new Adw.ActionRow({
			title: _("CLI path"),
			subtitle: _("Path to the AdGuard VPN CLI executable"),
		});

		const entry = new Gtk.Entry({
			hexpand: true,
			text: this._settings.get_string("cli-path"),
		});

		entry.connect("changed", () => {
			this._settings.set_string("cli-path", entry.text.trim());
		});

		row.add_suffix(entry);
		row.activatable_widget = entry;
		return row;
	}

	_pollIntervalRow() {
		const row = new Adw.ActionRow({
			title: _("Polling interval"),
			subtitle: _("Seconds between automatic status refreshes"),
		});

		const spin = Gtk.SpinButton.new_with_range(5, 300, 5);
		spin.set_value(this._settings.get_uint("poll-interval"));
		spin.set_valign(Gtk.Align.CENTER);

		spin.connect("value-changed", () => {
			this._settings.set_uint("poll-interval", spin.get_value_as_int());
		});

		row.add_suffix(spin);
		row.activatable_widget = spin;
		return row;
	}

	_notificationsRow() {
		const row = new Adw.ActionRow({
			title: _("Notifications"),
			subtitle: _("Show a desktop notification when the VPN state changes"),
		});

		const toggle = new Gtk.Switch({
			valign: Gtk.Align.CENTER,
			active: this._settings.get_boolean("notifications"),
		});

		this._settings.bind(
			"notifications",
			toggle,
			"active",
			Gio.SettingsBindFlags.DEFAULT,
		);

		row.add_suffix(toggle);
		row.activatable_widget = toggle;
		return row;
	}

	_durationRow() {
		const row = new Adw.ActionRow({
			title: _("Show duration"),
			subtitle: _("Show connection duration when the VPN is connected"),
		});

		const toggle = new Gtk.Switch({
			valign: Gtk.Align.CENTER,
			active: this._settings.get_boolean("show-duration"),
		});

		this._settings.bind(
			"show-duration",
			toggle,
			"active",
			Gio.SettingsBindFlags.DEFAULT,
		);

		row.add_suffix(toggle);
		row.activatable_widget = toggle;
		return row;
	}

	_favoriteRow(key, title) {
		const row = new Adw.ActionRow({
			title,
			subtitle: _("Location name used for the Favorites submenu"),
		});

		const entry = new Gtk.Entry({
			hexpand: true,
			placeholder_text: _("e.g. Paris"),
			text: this._settings.get_string(key),
		});

		entry.connect("changed", () => {
			this._settings.set_string(key, entry.text.trim());
		});

		row.add_suffix(entry);
		row.activatable_widget = entry;
		return row;
	}
}
