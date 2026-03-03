import { createHash } from "crypto";
import { Plugin } from "obsidian";
import { SyncEntry, SyncState } from "./types";
import { SYNC_STATE_VERSION, TASK_HASH_LENGTH } from "./constants";

export class SyncStateManager {
	private state: SyncState = { version: SYNC_STATE_VERSION, entries: {} };
	private plugin: Plugin;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	async load(): Promise<void> {
		const data = (await this.plugin.loadData()) ?? {};
		const raw = data.syncState;
		if (raw && raw.version === SYNC_STATE_VERSION) {
			this.state = raw;
		} else {
			this.state = { version: SYNC_STATE_VERSION, entries: {} };
		}
	}

	async save(): Promise<void> {
		const data = (await this.plugin.loadData()) ?? {};
		data.syncState = this.state;
		await this.plugin.saveData(data);
	}

	static computeHash(displayText: string, filePath: string): string {
		return createHash("sha256")
			.update(displayText + "\0" + filePath)
			.digest("hex")
			.slice(0, TASK_HASH_LENGTH);
	}

	hasEntry(hash: string): boolean {
		return hash in this.state.entries;
	}

	getEntry(hash: string): SyncEntry | undefined {
		return this.state.entries[hash];
	}

	setEntry(entry: SyncEntry): void {
		this.state.entries[entry.taskHash] = entry;
	}

	deleteEntry(hash: string): void {
		delete this.state.entries[hash];
	}

	/** Returns hashes tracked for a file that are no longer in the current task set. */
	staleHashesForFile(filePath: string, currentHashes: Set<string>): string[] {
		return Object.values(this.state.entries)
			.filter(
				(e) => e.filePath === filePath && !currentHashes.has(e.taskHash)
			)
			.map((e) => e.taskHash);
	}

	/** Updates state entries when a note is renamed. */
	handleRename(oldPath: string, newPath: string, newBasename: string): void {
		for (const entry of Object.values(this.state.entries)) {
			if (entry.filePath === oldPath) {
				entry.filePath = newPath;
				entry.listName = newBasename;
			}
		}
	}
}
