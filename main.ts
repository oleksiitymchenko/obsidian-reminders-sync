import { Plugin, TFile, debounce, Notice } from "obsidian";
import { RemindersSyncSettings } from "./src/types";
import { DEFAULT_SETTINGS, RemindersSyncSettingTab } from "./src/settings";
import { SyncStateManager } from "./src/syncState";
import { SyncEngine } from "./src/syncEngine";
import { noteIsTaggedForSync } from "./src/taskParser";
import {
	CMD_SYNC_ALL_ID,
	CMD_SYNC_ALL_NAME,
	MD_EXTENSION,
	NOTICE_DONE,
	NOTICE_PREFIX,
	RIBBON_ICON,
	RIBBON_TOOLTIP,
} from "./src/constants";

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

		this.addRibbonIcon(RIBBON_ICON, RIBBON_TOOLTIP, () => {
			void this.triggerSyncAll();
		});

		this.addCommand({
			id: CMD_SYNC_ALL_ID,
			name: CMD_SYNC_ALL_NAME,
			callback: () => {
				void this.triggerSyncAll();
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
							file.extension !== MD_EXTENSION
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
						try {
							await this.syncEngine.syncNote(file);
						} catch (err) {
							console.error(
								`${NOTICE_PREFIX}auto-sync error for ${file.path}:`,
								err
							);
						}
					},
					this.settings.autoSyncDebounceMs,
					true
				)
			)
		);

		// Update sync state when notes are renamed
		this.registerEvent(
			this.app.vault.on("rename", async (file, oldPath) => {
				if (!(file instanceof TFile) || file.extension !== MD_EXTENSION)
					return;
				try {
					this.stateManager.handleRename(
						oldPath,
						file.path,
						file.basename
					);
					await this.stateManager.save();
				} catch (err) {
					console.error(
						`${NOTICE_PREFIX}rename handler error:`,
						err
					);
				}
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
				void this.syncEngine.syncAll().catch((err) =>
					console.error(`${NOTICE_PREFIX}periodic sync error:`, err)
				);
			}, sec * 1000);
		}
	}

	private stopPeriodicSync() {
		if (this.periodicSyncIntervalId !== null) {
			window.clearInterval(this.periodicSyncIntervalId);
			this.periodicSyncIntervalId = null;
		}
	}

	private async triggerSyncAll(): Promise<void> {
		await this.syncEngine.syncAll();
		new Notice(NOTICE_DONE);
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
