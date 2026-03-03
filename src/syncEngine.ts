import { App, TFile } from "obsidian";
import { ObsidianTask, RemindersSyncSettings, SyncEntry } from "./types";
import { NOTICE_PREFIX } from "./constants";
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
				try {
					await this.syncNoteInternal(file);
				} catch (err) {
					console.error(
						`${NOTICE_PREFIX}sync failed for ${file.path}:`,
						err
					);
				}
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

		const currentHashes = await this.pushTasks(file, listName, tasks);

		const staleHashes = this.stateManager.staleHashesForFile(
			file.path,
			currentHashes
		);
		for (const hash of staleHashes) {
			this.stateManager.deleteEntry(hash);
		}

		const { updatedContent, modified } = await this.pullCompletions(
			file,
			listName,
			content,
			tasks
		);

		if (modified) {
			await this.app.vault.modify(file, updatedContent);
		}

		await this.stateManager.save();
	}

	/** Push Obsidian tasks → Apple Reminders. Returns the set of current task hashes. */
	private async pushTasks(
		file: TFile,
		listName: string,
		tasks: ObsidianTask[]
	): Promise<Set<string>> {
		const currentHashes = new Set<string>();

		for (const task of tasks) {
			const hash = SyncStateManager.computeHash(
				task.displayText,
				task.filePath
			);
			currentHashes.add(hash);

			const existing = this.stateManager.getEntry(hash);

			if (!existing) {
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
				// Task completed in Obsidian — reflect it in Reminders
				await markReminderComplete(listName, existing.reminderName);
				existing.pushedAsCompleted = true;
				existing.lastSyncedAt = Date.now();
				this.stateManager.setEntry(existing);
			}
		}

		return currentHashes;
	}

	/** Pull completions from Apple Reminders → Obsidian. Returns updated content and whether it changed. */
	private async pullCompletions(
		_file: TFile,
		listName: string,
		content: string,
		tasks: ObsidianTask[]
	): Promise<{ updatedContent: string; modified: boolean }> {
		const reminders = await getRemindersInList(listName);
		const completedInReminders = new Set(
			reminders.filter((r) => r.isCompleted).map((r) => r.name)
		);

		let updatedContent = content;
		let modified = false;

		for (const task of tasks) {
			if (task.isCompleted) continue; // already done in Obsidian

			const hash = SyncStateManager.computeHash(
				task.displayText,
				task.filePath
			);
			const entry = this.stateManager.getEntry(hash);
			if (!entry || entry.pushedAsCompleted) continue;

			if (completedInReminders.has(entry.reminderName)) {
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
					modified = true;
				}

				entry.pushedAsCompleted = true;
				entry.lastSyncedAt = Date.now();
				this.stateManager.setEntry(entry);
			}
		}

		return { updatedContent, modified };
	}
}
