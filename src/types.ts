export interface ObsidianTask {
	text: string; // raw text incl. emoji metadata
	displayText: string; // stripped of 📅 metadata — used for hash + reminder name
	isCompleted: boolean;
	dueDate: Date | null; // parsed from 📅 YYYY-MM-DD
	lineNumber: number;
	filePath: string;
}

export interface AppleReminder {
	name: string;
	isCompleted: boolean;
}

export interface SyncEntry {
	taskHash: string; // sha256(displayText + '\0' + filePath).slice(0,16)
	reminderName: string; // exact name stored in Apple Reminders
	listName: string; // = note basename (no extension)
	filePath: string; // vault-relative path — needed for stale detection + rename tracking
	lastSyncedAt: number;
	pushedAsCompleted: boolean;
}

export interface SyncState {
	version: number;
	entries: Record<string, SyncEntry>; // keyed by taskHash
}

export interface RemindersSyncSettings {
	syncTag: string; // default: "sync-reminders"
	autoSyncOnSave: boolean; // default: true
	autoSyncDebounceMs: number; // default: 2000
	periodicSyncIntervalSec: number; // 0 = disabled
}
