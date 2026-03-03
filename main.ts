import { Plugin, TFile, debounce, Notice } from "obsidian";
import { RemindersSyncSettings } from "./src/types";
import { DEFAULT_SETTINGS, RemindersSyncSettingTab } from "./src/settings";
import { SyncStateManager } from "./src/syncState";
import { SyncEngine } from "./src/syncEngine";
import { noteIsTaggedForSync } from "./src/taskParser";

export default class RemindersSyncPlugin extends Plugin {
	settings: RemindersSyncSettings;
	private stateManager: SyncStateManager;
	private syncEngine: SyncEngine;
	private periodicSyncIntervalId: number | null = null;

	async onload() {
		await this.loadSettings();

		this.stateManager = new SyncStateManager(this);
		await this.stateManager.load();

		this.syncEngine = new SyncEngine(
			this.app,
			this.settings,
			this.stateManager
		);

		this.addSettingTab(new RemindersSyncSettingTab(this.app, this));

		// Ribbon button for immediate sync
		this.addRibbonIcon("refresh-cw", "Sync Reminders now", async () => {
			await this.syncEngine.syncAll();
			new Notice("Reminders Sync: Done.");
		});

		this.addCommand({
			id: "sync-all-reminders",
			name: "Sync all tagged notes to Apple Reminders",
			callback: async () => {
				await this.syncEngine.syncAll();
				new Notice("Reminders Sync: Done.");
			},
		});

		this.restartPeriodicSync();

		// Auto-sync on save (debounced, trailing edge)
		this.registerEvent(
			this.app.vault.on(
				"modify",
				debounce(
					async (file: TFile) => {
						if (
							!(file instanceof TFile) ||
							file.extension !== "md"
						)
							return;
						if (!this.settings.autoSyncOnSave) return;
						const cache =
							this.app.metadataCache.getFileCache(file);
						if (
							!noteIsTaggedForSync(
								cache,
								this.settings.syncTag
							)
						)
							return;
						await this.syncEngine.syncNote(file);
					},
					this.settings.autoSyncDebounceMs,
					true
				)
			)
		);

		// Update sync state when notes are renamed
		this.registerEvent(
			this.app.vault.on("rename", async (file, oldPath) => {
				if (!(file instanceof TFile) || file.extension !== "md")
					return;
				this.stateManager.handleRename(
					oldPath,
					file.path,
					file.basename
				);
				await this.stateManager.save();
			})
		);
	}

	onunload() {
		this.stopPeriodicSync();
	}

	restartPeriodicSync() {
		this.stopPeriodicSync();
		const sec = this.settings.periodicSyncIntervalSec;
		if (sec > 0) {
			this.periodicSyncIntervalId = window.setInterval(() => {
				this.syncEngine.syncAll();
			}, sec * 1000);
		}
	}

	private stopPeriodicSync() {
		if (this.periodicSyncIntervalId !== null) {
			window.clearInterval(this.periodicSyncIntervalId);
			this.periodicSyncIntervalId = null;
		}
	}

	async loadSettings() {
		const data = (await this.loadData()) ?? {};
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
	}

	async saveSettings() {
		const data = (await this.loadData()) ?? {};
		data.settings = this.settings;
		await this.saveData(data);
	}
}
