import { App, TFile } from "obsidian";
import { ObsidianTask, RemindersSyncSettings } from "./types";
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
		await this.withLock(async () => {
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
		});
	}

	async syncNote(file: TFile): Promise<void> {
		await this.withLock(() => this.syncNoteInternal(file));
	}

	/**
	 * Acquires the sync lock for the duration of `fn`.
	 * Returns without calling `fn` if a sync is already in progress.
	 */
	private async withLock<T>(fn: () => Promise<T>): Promise<T | undefined> {
		if (this.isSyncing) return undefined;
		this.isSyncing = true;
		try {
			return await fn();
		} finally {
			this.isSyncing = false;
		}
	}

	private async syncNoteInternal(file: TFile): Promise<void> {
		const { basename: listName, path: filePath } = file;
		const content = await this.app.vault.read(file);
		const tasks = extractTasksFromContent(content, filePath);

		// Compute hashes once — reused by push, stale-cleanup, and pull
		const hashes = tasks.map((t) =>
			SyncStateManager.computeHash(t.displayText, t.filePath)
		);

		await ensureListExists(listName);
		await this.pushTasks(listName, filePath, tasks, hashes);

		const currentHashSet = new Set(hashes);
		for (const hash of this.stateManager.staleHashesForFile(
			filePath,
			currentHashSet
		)) {
			this.stateManager.deleteEntry(hash);
		}

		const updatedContent = await this.pullCompletions(
			listName,
			content,
			tasks,
			hashes
		);
		if (updatedContent !== content) {
			await this.app.vault.modify(file, updatedContent);
		}

		await this.stateManager.save();
	}

	/** Push direction: Obsidian → Apple Reminders. */
	private async pushTasks(
		listName: string,
		filePath: string,
		tasks: ObsidianTask[],
		hashes: string[]
	): Promise<void> {
		for (let i = 0; i < tasks.length; i++) {
			const task = tasks[i];
			const hash = hashes[i];
			const existing = this.stateManager.getEntry(hash);

			if (!existing) {
				if (task.isCompleted) continue; // already done — nothing to push
				await createReminder(listName, task);
				this.stateManager.setEntry({
					taskHash: hash,
					reminderName: task.displayText,
					listName,
					filePath,
					lastSyncedAt: Date.now(),
					pushedAsCompleted: false,
				});
			} else if (!existing.pushedAsCompleted && task.isCompleted) {
				// Completed in Obsidian — mirror it to Reminders
				await markReminderComplete(listName, existing.reminderName);
				existing.pushedAsCompleted = true;
				existing.lastSyncedAt = Date.now();
				this.stateManager.setEntry(existing);
			}
		}
	}

	/**
	 * Pull direction: Apple Reminders → Obsidian (completions only).
	 * Returns the original `content` reference if nothing changed.
	 */
	private async pullCompletions(
		listName: string,
		content: string,
		tasks: ObsidianTask[],
		hashes: string[]
	): Promise<string> {
		const reminders = await getRemindersInList(listName);
		const completedNames = new Set(
			reminders.filter((r) => r.isCompleted).map((r) => r.name)
		);

		if (completedNames.size === 0) return content;

		const lines = content.split("\n");
		let modified = false;

		for (let i = 0; i < tasks.length; i++) {
			const task = tasks[i];
			if (task.isCompleted) continue;

			const entry = this.stateManager.getEntry(hashes[i]);
			if (!entry || entry.pushedAsCompleted) continue;
			if (!completedNames.has(entry.reminderName)) continue;

			const { lineNumber } = task;
			if (
				lineNumber >= 0 &&
				lineNumber < lines.length &&
				/- \[ \]/.test(lines[lineNumber])
			) {
				lines[lineNumber] = lines[lineNumber].replace(
					/- \[ \]/,
					"- [x]"
				);
				modified = true;
			}

			entry.pushedAsCompleted = true;
			entry.lastSyncedAt = Date.now();
			this.stateManager.setEntry(entry);
		}

		return modified ? lines.join("\n") : content;
	}
}
