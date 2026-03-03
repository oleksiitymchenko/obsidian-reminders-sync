import { App, TFile } from "obsidian";
import { RemindersSyncSettings, SyncEntry } from "./types";
import {
	ensureListExists,
	getRemindersInList,
	createReminder,
	markReminderComplete,
} from "./appleScript";
import { extractTasksFromContent, noteIsTaggedForSync } from "./taskParser";
import { SyncStateManager } from "./syncState";

export class SyncEngine {
	private app: App;
	private settings: RemindersSyncSettings;
	private stateManager: SyncStateManager;
	private isSyncing = false;

	constructor(
		app: App,
		settings: RemindersSyncSettings,
		stateManager: SyncStateManager
	) {
		this.app = app;
		this.settings = settings;
		this.stateManager = stateManager;
	}

	async syncAll(): Promise<void> {
		if (this.isSyncing) return;
		this.isSyncing = true;
		try {
			const files = this.app.vault.getMarkdownFiles();
			for (const file of files) {
				const cache = this.app.metadataCache.getFileCache(file);
				if (!noteIsTaggedForSync(cache, this.settings.syncTag))
					continue;
				await this.syncNoteInternal(file);
			}
		} finally {
			this.isSyncing = false;
		}
	}

	async syncNote(file: TFile): Promise<void> {
		if (this.isSyncing) return;
		this.isSyncing = true;
		try {
			await this.syncNoteInternal(file);
		} finally {
			this.isSyncing = false;
		}
	}

	private async syncNoteInternal(file: TFile): Promise<void> {
		const listName = file.basename;
		await ensureListExists(listName);

		const content = await this.app.vault.read(file);
		const tasks = extractTasksFromContent(content, file.path);
		const currentHashes = new Set<string>();

		// ── Push: Obsidian → Apple Reminders ──────────────────────────────────
		for (const task of tasks) {
			const hash = SyncStateManager.computeHash(
				task.displayText,
				task.filePath
			);
			currentHashes.add(hash);

			const existing = this.stateManager.getEntry(hash);

			if (!existing) {
				// Never synced before
				if (task.isCompleted) continue; // already done, nothing to push
				await createReminder(listName, task);
				const entry: SyncEntry = {
					taskHash: hash,
					reminderName: task.displayText,
					listName,
					filePath: file.path,
					lastSyncedAt: Date.now(),
					pushedAsCompleted: false,
				};
				this.stateManager.setEntry(entry);
			} else if (!existing.pushedAsCompleted && task.isCompleted) {
				// Task was completed in Obsidian — reflect it in Reminders
				await markReminderComplete(listName, existing.reminderName);
				existing.pushedAsCompleted = true;
				existing.lastSyncedAt = Date.now();
				this.stateManager.setEntry(existing);
			}
			// else: already in sync, nothing to do
		}

		// Remove state entries for tasks that no longer exist in the note
		const staleHashes = this.stateManager.staleHashesForFile(
			file.path,
			currentHashes
		);
		for (const hash of staleHashes) {
			this.stateManager.deleteEntry(hash);
		}

		// ── Pull: Apple Reminders → Obsidian (completions only) ───────────────
		const reminders = await getRemindersInList(listName);
		const completedInReminders = new Set(
			reminders.filter((r) => r.isCompleted).map((r) => r.name)
		);

		let updatedContent = content;
		let contentModified = false;

		for (const task of tasks) {
			if (task.isCompleted) continue; // already done in Obsidian

			const hash = SyncStateManager.computeHash(
				task.displayText,
				task.filePath
			);
			const entry = this.stateManager.getEntry(hash);
			if (!entry || entry.pushedAsCompleted) continue;

			if (completedInReminders.has(entry.reminderName)) {
				// Completed in Reminders but not yet in Obsidian — check it off
				const lines = updatedContent.split("\n");
				if (
					task.lineNumber >= 0 &&
					task.lineNumber < lines.length &&
					/- \[ \]/.test(lines[task.lineNumber])
				) {
					lines[task.lineNumber] = lines[task.lineNumber].replace(
						/- \[ \]/,
						"- [x]"
					);
					updatedContent = lines.join("\n");
					contentModified = true;
				}

				entry.pushedAsCompleted = true;
				entry.lastSyncedAt = Date.now();
				this.stateManager.setEntry(entry);
			}
		}

		if (contentModified) {
			await this.app.vault.modify(file, updatedContent);
		}

		await this.stateManager.save();
	}
}
