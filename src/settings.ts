import { App, PluginSettingTab, Setting } from "obsidian";
import type RemindersSyncPlugin from "../main";
import { RemindersSyncSettings } from "./types";
import { DEFAULT_SYNC_TAG, PLUGIN_NAME } from "./constants";

export const DEFAULT_SETTINGS: RemindersSyncSettings = {
	syncTag: DEFAULT_SYNC_TAG,
	autoSyncOnSave: true,
	autoSyncDebounceMs: 2000,
	periodicSyncIntervalSec: 0,
};

export class RemindersSyncSettingTab extends PluginSettingTab {
	plugin: RemindersSyncPlugin;

	constructor(app: App, plugin: RemindersSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: PLUGIN_NAME });

		new Setting(containerEl)
			.setName("Sync tag")
			.setDesc(
				"Frontmatter tag that opts a note into syncing. " +
					"Add 'tags: [sync-reminders]' or 'sync-reminders: true' to a note's frontmatter."
			)
			.addText((text) =>
				text
					.setPlaceholder("sync-reminders")
					.setValue(this.plugin.settings.syncTag)
					.onChange(async (value) => {
						this.plugin.settings.syncTag =
							value.trim() || DEFAULT_SYNC_TAG;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Auto-sync on save")
			.setDesc("Automatically sync when a tagged note is saved.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoSyncOnSave)
					.onChange(async (value) => {
						this.plugin.settings.autoSyncOnSave = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Auto-sync debounce (ms)")
			.setDesc(
				"How long to wait after a save before triggering sync. " +
					"Increase if you experience lag while typing."
			)
			.addText((text) =>
				text
					.setPlaceholder("2000")
					.setValue(String(this.plugin.settings.autoSyncDebounceMs))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 0) {
							this.plugin.settings.autoSyncDebounceMs = num;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Periodic sync interval (seconds)")
			.setDesc(
				"Automatically sync all tagged notes every N seconds. " +
					"Set to 0 to disable. Useful for pulling completions from Apple Reminders."
			)
			.addText((text) =>
				text
					.setPlaceholder("0")
					.setValue(
						String(this.plugin.settings.periodicSyncIntervalSec)
					)
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 0) {
							this.plugin.settings.periodicSyncIntervalSec = num;
							await this.plugin.saveSettings();
							this.plugin.restartPeriodicSync();
						}
					})
			);
	}
}
