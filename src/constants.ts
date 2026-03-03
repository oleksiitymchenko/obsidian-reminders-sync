// ── Plugin identity ───────────────────────────────────────────────────────────
export const PLUGIN_NAME = "Reminders Sync";
export const NOTICE_PREFIX = "Reminders Sync: ";

// ── Commands ──────────────────────────────────────────────────────────────────
export const CMD_SYNC_ALL_ID = "sync-all-reminders";
export const CMD_SYNC_ALL_NAME = "Sync all tagged notes to Apple Reminders";

// ── UI ────────────────────────────────────────────────────────────────────────
export const RIBBON_ICON = "refresh-cw";
export const RIBBON_TOOLTIP = "Sync Reminders now";

// ── Notices ───────────────────────────────────────────────────────────────────
export const NOTICE_DONE = `${NOTICE_PREFIX}Done.`;
export const NOTICE_PERMISSION_DENIED =
	`${NOTICE_PREFIX}Permission denied. Please allow Obsidian to control ` +
	`Reminders in System Settings → Privacy & Security → Automation.`;
export const NOTICE_TIMEOUT = `${NOTICE_PREFIX}Apple Reminders timed out. Is the app responsive?`;
export const NOTICE_PERMISSION_DURATION_MS = 10_000;
export const NOTICE_TIMEOUT_DURATION_MS = 8_000;

// ── osascript ─────────────────────────────────────────────────────────────────
export const AS_OUTPUT_DELIMITER = "|||";
export const AS_EXEC_TIMEOUT_MS = 10_000;

// ── Files ─────────────────────────────────────────────────────────────────────
export const MD_EXTENSION = "md";

// ── Task parsing ──────────────────────────────────────────────────────────────
export const TASK_INCOMPLETE_RE = /^(\s*)-\s\[\s\]\s(.+)$/;
export const TASK_COMPLETE_RE = /^(\s*)-\s\[x\]\s(.+)$/i;
export const DUE_DATE_RE = /📅\s*(\d{4}-\d{2}-\d{2})/;

// ── Settings defaults ─────────────────────────────────────────────────────────
export const DEFAULT_SYNC_TAG = "sync-reminders";

// ── Sync state ────────────────────────────────────────────────────────────────
export const SYNC_STATE_VERSION = 1;
export const TASK_HASH_LENGTH = 16;
